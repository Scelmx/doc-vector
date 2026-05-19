import type { KnowledgeGraph } from '@docvec/shared'
import type { RagChunk } from '../../utils/rag-chunking.js'
import { extractTermsFromChunk } from '../utils/term-extraction.js'
import { bigramJaccard, editSimilarity, normalizeText } from '../utils/text-similarity.js'
import { createEmbeddings } from '../utils/embedding.js'

const MAX_TERMS = 120
const MAX_GROUPS = 80
const EMBEDDING_SIM_THRESHOLD = 0.82
const FUZZY_SIM_MIN = 0.68
const FUZZY_SIM_MAX = 0.99

/** 并查集：合并同义候选词 */
class UnionFind {
  parent = new Map<string, string>()

  /** 查找根节点（路径压缩） */
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    if (this.parent.get(x) !== x) this.parent.set(x, this.find(this.parent.get(x)!))
    return this.parent.get(x)!
  }

  /** 合并两个词到同一组 */
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(rb, ra)
  }
}

/** 过滤过短/过长/纯数字词 */
function isValidTerm(term: string): boolean {
  if (term.length < 2 || term.length > 24) return false
  if (/^\d+$/.test(term)) return false
  return true
}

/** 从 chunks + 知识图谱收集候选词 */
export function collectCandidateTerms(chunks: RagChunk[], graph: KnowledgeGraph | null): string[] {
  const terms = new Set<string>()

  for (const chunk of chunks) {
    for (const t of extractTermsFromChunk(chunk.content)) {
      if (isValidTerm(t)) terms.add(t)
    }
    const section = chunk.metadata.section
    if (section && section !== '正文' && isValidTerm(section)) {
      terms.add(section)
    }
  }

  if (graph) {
    for (const node of graph.nodes) {
      if (node.type === 'entity' || node.type === 'concept') {
        if (isValidTerm(node.label)) terms.add(node.label)
      }
      if (node.type === 'section') {
        const part = node.label.includes('::') ? node.label.split('::').pop()! : node.label
        if (isValidTerm(part)) terms.add(part)
      }
    }
  }

  return [...terms].slice(0, MAX_TERMS)
}

/** 判断两词是否应归为同义（模糊 + 包含关系） */
function shouldPairAsSynonyms(a: string, b: string): boolean {
  if (normalizeText(a) === normalizeText(b)) return false

  const edit = editSimilarity(a, b)
  const bi = bigramJaccard(a, b)

  if (edit >= FUZZY_SIM_MIN && edit <= FUZZY_SIM_MAX) return true
  if (bi >= 0.55 && edit >= 0.5) return true

  // 缩写：一方包含另一方且较短方 >= 2 字
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (na.length >= 2 && nb.length >= 2) {
    if (na.includes(nb) || nb.includes(na)) {
      const shorter = Math.min(na.length, nb.length)
      const longer = Math.max(na.length, nb.length)
      if (shorter >= 2 && shorter / longer >= 0.35) return true
    }
  }

  return false
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/** 从图谱 related_to 边挖掘（共现且字面相近） */
function mergeFromGraphEdges(uf: UnionFind, graph: KnowledgeGraph, termSet: Set<string>) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))

  for (const edge of graph.edges) {
    if (edge.relation !== 'related_to' || edge.weight < 1) continue
    const src = nodeById.get(edge.source)
    const tgt = nodeById.get(edge.target)
    if (!src || !tgt || src.type !== 'entity' || tgt.type !== 'entity') continue
    if (!termSet.has(src.label) || !termSet.has(tgt.label)) continue
    if (shouldPairAsSynonyms(src.label, tgt.label)) {
      uf.union(src.label, tgt.label)
    }
  }
}

/** 字面模糊配对 */
function mergeFromFuzzyPairs(uf: UnionFind, terms: string[]) {
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      if (shouldPairAsSynonyms(terms[i], terms[j])) {
        uf.union(terms[i], terms[j])
      }
    }
  }
}

/** Embedding 语义相近配对（适合「图标」↔「icon」类） */
async function mergeFromEmbeddings(uf: UnionFind, terms: string[]) {
  if (terms.length < 2) return

  const embeddings = createEmbeddings()
  const vectors = await embeddings.embedDocuments(terms)

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      if (normalizeText(terms[i]) === normalizeText(terms[j])) continue
      const sim = cosineSimilarity(vectors[i], vectors[j])
      if (sim >= EMBEDDING_SIM_THRESHOLD && sim < 0.995) {
        uf.union(terms[i], terms[j])
      }
    }
  }
}

/**
 * 根据项目文档与知识图谱自动挖掘同义词组
 */
export async function buildSynonymGroupsFromProject(
  chunks: RagChunk[],
  graph: KnowledgeGraph | null
): Promise<string[][]> {
  const terms = collectCandidateTerms(chunks, graph)
  if (terms.length < 2) return []

  const termSet = new Set(terms)
  const uf = new UnionFind()

  if (graph) mergeFromGraphEdges(uf, graph, termSet)
  mergeFromFuzzyPairs(uf, terms)

  try {
    await mergeFromEmbeddings(uf, terms.slice(0, 60))
  } catch (err) {
    console.warn('[SynonymMining] Embedding 聚类跳过:', err)
  }

  const groupMap = new Map<string, Set<string>>()
  for (const term of terms) {
    const root = uf.find(term)
    if (!groupMap.has(root)) groupMap.set(root, new Set())
    groupMap.get(root)!.add(term)
  }

  return [...groupMap.values()]
    .map((set) => [...set])
    .filter((g) => g.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_GROUPS)
}
