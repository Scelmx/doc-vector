import fs from 'fs'
import path from 'path'
import type { KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from '@docvec/shared'
import type { RagChunk } from '../../utils/rag-chunking.js'
import type { StoredChunk } from '../../utils/chunk-store.js'
import { chunkKey } from '../../utils/chunk-store.js'
import { extractTermsFromChunk } from '../utils/term-extraction.js'
import { extractQueryTerms, fuzzyMatchScore } from '../utils/text-similarity.js'
import { getKnowledgeGraphPath, writeJsonFile } from '../../utils/storage.js'

/** 图谱节点 ID：类型 + 规范化 label */
function nodeId(label: string, type: string): string {
  return `${type}:${label.toLowerCase().replace(/\s+/g, '_').slice(0, 80)}`
}

/**
 * 从 RAG chunks 构建轻量知识图谱（实体共现 + 章节层级）
 */
export function buildKnowledgeGraphFromChunks(
  projectId: string,
  chunks: RagChunk[]
): KnowledgeGraph {
  const nodeMap = new Map<string, KnowledgeGraphNode>()
  const edgeMap = new Map<string, KnowledgeGraphEdge>()

  // 添加节点
  const addNode = (label: string, type: KnowledgeGraphNode['type']) => {
    const id = nodeId(label, type)
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, label, type })
    }
    return id
  }

  // 添加边
  const addEdge = (source: string, target: string, relation: string, weight = 1) => {
    if (source === target) return
    const key = [source, target, relation].sort().join('|')
    const existing = edgeMap.get(key)
    if (existing) {
      existing.weight += weight
    } else {
      edgeMap.set(key, { source, target, relation, weight })
    }
  }

  for (const chunk of chunks) {
    const { filename, section, documentId } = chunk.metadata
    const docNode = addNode(filename, 'document')
    const sectionLabel = section || '正文'
    const sectionNode = addNode(`${filename}::${sectionLabel}`, 'section')

    addEdge(docNode, sectionNode, 'contains', 2)

    const entities = extractTermsFromChunk(chunk.content)
    for (const entity of entities) {
      const entityNode = addNode(entity, 'entity')
      addEdge(sectionNode, entityNode, 'mentions', 1)
    }

    // 同 chunk 内实体共现 → 相关
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = addNode(entities[i], 'entity')
        const b = addNode(entities[j], 'entity')
        addEdge(a, b, 'related_to', 1)
      }
    }

    // 章节作为概念节点
    if (section && section !== '正文') {
      const conceptNode = addNode(sectionLabel, 'concept')
      addEdge(sectionNode, conceptNode, 'describes', 1)
    }

    void documentId
  }

  return {
    projectId,
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    builtAt: new Date().toISOString(),
  }
}

/** 持久化知识图谱到 data/knowledge-graphs */
export function saveKnowledgeGraph(graph: KnowledgeGraph): void {
  const filePath = getKnowledgeGraphPath(graph.projectId)
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  writeJsonFile(filePath, graph)
}

/** 读取项目知识图谱 */
export function loadKnowledgeGraph(projectId: string): KnowledgeGraph | null {
  const filePath = getKnowledgeGraphPath(projectId)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as KnowledgeGraph
}

const FUZZY_MATCH_THRESHOLD = 0.48

/** 模糊匹配图谱节点（实体/概念/章节） */
export function matchGraphNodes(
  query: string,
  graph: KnowledgeGraph,
  minScore = FUZZY_MATCH_THRESHOLD
): Map<string, number> {
  const terms = extractQueryTerms(query)
  const scores = new Map<string, number>()

  for (const node of graph.nodes) {
    let score = 0

    if (node.type === 'entity' || node.type === 'concept') {
      score = fuzzyMatchScore(node.label, query, terms)
    } else if (node.type === 'section') {
      score = fuzzyMatchScore(node.label, query, terms)
      const sectionPart = node.label.includes('::') ? node.label.split('::').pop()! : node.label
      score = Math.max(score, fuzzyMatchScore(sectionPart, query, terms))
    } else if (node.type === 'document') {
      score = fuzzyMatchScore(node.label, query, terms) * 0.9
    }

    if (score >= minScore) {
      scores.set(node.id, Math.max(scores.get(node.id) ?? 0, score))
    }
  }

  return scores
}

/** 从种子节点沿边收集可加入 query 的关联词 */
function collectRelatedLabels(
  graph: KnowledgeGraph,
  seedScores: Map<string, number>
): string[] {
  const matchedNodeIds = new Set(seedScores.keys())
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))
  const relatedLabels = new Set<string>()

  const addLabel = (node: KnowledgeGraphNode | undefined) => {
    if (!node) return
    if (node.type === 'entity' || node.type === 'concept') {
      relatedLabels.add(node.label)
    } else if (node.type === 'section') {
      const part = node.label.includes('::') ? node.label.split('::').pop()! : node.label
      if (part && part !== '正文') relatedLabels.add(part)
    }
  }

  for (const edge of graph.edges) {
    const relations = new Set(['related_to', 'mentions', 'describes', 'contains'])
    if (!relations.has(edge.relation)) continue

    if (matchedNodeIds.has(edge.source)) addLabel(nodeById.get(edge.target))
    if (matchedNodeIds.has(edge.target)) addLabel(nodeById.get(edge.source))
  }

  // 从高分种子再扩散一跳（模糊匹配到的实体）
  propagateNodeScores(graph, seedScores, 1)
  for (const nodeId of seedScores.keys()) {
    if ((seedScores.get(nodeId) ?? 0) < 0.55) continue
    addLabel(nodeById.get(nodeId))
  }

  return [...relatedLabels].slice(0, 10)
}

/** 用知识图谱扩展查询词（模糊实体链接 + 关系扩散） */
export function expandQueryWithGraph(
  query: string,
  graph: KnowledgeGraph | null
): { expandedQuery: string; terms: string[] } {
  if (!graph || graph.nodes.length === 0) {
    return { expandedQuery: query, terms: [] }
  }

  const seedScores = matchGraphNodes(query, graph)
  if (seedScores.size === 0) return { expandedQuery: query, terms: [] }

  const terms = collectRelatedLabels(graph, seedScores)
  if (terms.length === 0) return { expandedQuery: query, terms: [] }
  return { expandedQuery: `${query} ${terms.join(' ')}`, terms }
}

/** 图谱检索单条命中 */
export interface GraphSearchHit {
  documentId: string
  filename: string
  chunkIndex: number
  section: string
  content: string
  score: number
}

/** 沿图谱边传播节点得分（多跳衰减） */
function propagateNodeScores(
  graph: KnowledgeGraph,
  nodeScores: Map<string, number>,
  hops = 2
): void {
  const adjacency = new Map<string, Array<{ neighbor: string; weight: number }>>()
  for (const edge of graph.edges) {
    const w = Math.min(edge.weight / 3, 1)
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, [])
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, [])
    adjacency.get(edge.source)!.push({ neighbor: edge.target, weight: w })
    adjacency.get(edge.target)!.push({ neighbor: edge.source, weight: w })
  }

  let current = new Map(nodeScores)
  for (let hop = 0; hop < hops; hop++) {
    const next = new Map(current)
    for (const [nodeId, score] of current) {
      if (score < 0.15) continue
      for (const { neighbor, weight } of adjacency.get(nodeId) ?? []) {
        const boosted = score * 0.55 * weight
        const prev = next.get(neighbor) ?? 0
        if (boosted > prev) next.set(neighbor, boosted)
      }
    }
    current = next
    for (const [id, s] of current) {
      nodeScores.set(id, Math.max(nodeScores.get(id) ?? 0, s))
    }
  }
}

/** 章节节点 → 对应文本块 */
function chunksForSectionNode(node: KnowledgeGraphNode, chunks: StoredChunk[]): StoredChunk[] {
  const sectionKey = node.label
  return chunks.filter((c) => `${c.filename}::${c.section}` === sectionKey)
}

/** 文档节点 → 该文件全部文本块 */
function chunksForDocumentNode(node: KnowledgeGraphNode, chunks: StoredChunk[]): StoredChunk[] {
  return chunks.filter((c) => c.filename === node.label)
}

/** 从实体/概念节点追溯到关联章节 */
function collectSectionNodeIds(graph: KnowledgeGraph, nodeId: string, visited: Set<string>): string[] {
  const sections: string[] = []
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (node?.type === 'section') sections.push(nodeId)

  for (const edge of graph.edges) {
    let neighbor: string | null = null
    if (edge.source === nodeId) neighbor = edge.target
    else if (edge.target === nodeId) neighbor = edge.source
    if (!neighbor || visited.has(neighbor)) continue

    const neighborNode = graph.nodes.find((n) => n.id === neighbor)
    if (!neighborNode) continue

    if (neighborNode.type === 'section') {
      sections.push(neighbor)
    } else if (neighborNode.type === 'entity' || neighborNode.type === 'concept') {
      visited.add(neighbor)
      sections.push(...collectSectionNodeIds(graph, neighbor, visited))
    }
  }
  return sections
}

/**
 * 基于知识图谱结构召回文本块（实体/章节/文档关联）
 */
export function searchKnowledgeGraph(
  query: string,
  graph: KnowledgeGraph,
  chunks: StoredChunk[],
  topK: number
): GraphSearchHit[] {
  if (graph.nodes.length === 0 || chunks.length === 0) return []

  const nodeScores = matchGraphNodes(query, graph, FUZZY_MATCH_THRESHOLD)

  if (nodeScores.size === 0) return []

  propagateNodeScores(graph, nodeScores)

  const chunkScores = new Map<string, { chunk: StoredChunk; score: number }>()
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))

  const addChunk = (chunk: StoredChunk, score: number) => {
    const key = chunkKey(chunk)
    const prev = chunkScores.get(key)
    if (!prev || score > prev.score) chunkScores.set(key, { chunk, score })
  }

  for (const [nodeId, score] of nodeScores) {
    if (score < 0.2) continue
    const node = nodeById.get(nodeId)
    if (!node) continue

    if (node.type === 'section') {
      for (const c of chunksForSectionNode(node, chunks)) addChunk(c, score)
    } else if (node.type === 'document') {
      for (const c of chunksForDocumentNode(node, chunks)) addChunk(c, score * 0.9)
    } else if (node.type === 'entity' || node.type === 'concept') {
      const visited = new Set<string>([nodeId])
      const sectionIds = collectSectionNodeIds(graph, nodeId, visited)
      for (const sid of sectionIds) {
        const sectionNode = nodeById.get(sid)
        if (!sectionNode) continue
        for (const c of chunksForSectionNode(sectionNode, chunks)) {
          addChunk(c, score * 0.85)
        }
      }
    }
  }

  return [...chunkScores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({
      documentId: chunk.documentId,
      filename: chunk.filename,
      chunkIndex: chunk.chunkIndex,
      section: chunk.section,
      content: chunk.content,
      score: Math.round(score * 1000) / 1000,
    }))
}
