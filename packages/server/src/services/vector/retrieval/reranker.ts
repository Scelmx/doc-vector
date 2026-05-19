import type { Pipeline } from '@xenova/transformers'
import { pipeline } from '@xenova/transformers'
import type { SearchResult } from '@docvec/shared'
import { createEmbeddings } from '../../utils/embedding.js'
import { RETRIEVAL_CONFIG } from './config.js'

/**
 * Cross-Encoder 重排序器（可选，默认不加载）
 * 仅在 ENABLE_CROSS_ENCODER=true 时使用
 */
class CrossEncoderReranker {
  private pipe: Pipeline | null = null
  private loadFailed = false

  /**
   * 懒加载 Cross-Encoder 模型
   */
  async initialize(): Promise<Pipeline | null> {
    if (this.loadFailed) return null
    if (!this.pipe) {
      try {
        console.log(`[Reranker] 加载 Cross-Encoder: ${RETRIEVAL_CONFIG.RERANKER_MODEL}...`)
        // 使用轻量 MS MARCO 模型
        this.pipe = await pipeline('text-classification', RETRIEVAL_CONFIG.RERANKER_MODEL)
        console.log('[Reranker] Cross-Encoder 加载完成')
      } catch (err) {
        this.loadFailed = true
        console.warn('[Reranker] Cross-Encoder 加载失败:', err)
        return null
      }
    }
    return this.pipe
  }

  /** Sigmoid 将 logit 转为 0~1 分数 */
  private logitToScore(logit: number): number {
    return 1 / (1 + Math.exp(-logit))
  }

  /**
   * 对 query-passage 对打分
   */
  async scorePair(query: string, passage: string): Promise<number> {
    const pipe = await this.initialize()
    if (!pipe) return -1

    const truncated = passage.slice(0, RETRIEVAL_CONFIG.RERANK_PASSAGE_MAX_CHARS)
    try {
      const output = (await pipe(query, { text_pair: truncated })) as Array<{
        label: string
        score: number
      }>
      if (Array.isArray(output) && output.length > 0 && typeof output[0].score === 'number') {
        return output[0].label === 'LABEL_0' ? 1 - output[0].score : output[0].score
      }
      const raw = output as unknown as { logits?: { data: Float32Array } }
      if (raw?.logits?.data?.length) {
        return this.logitToScore(raw.logits.data[0])
      }
    } catch {
      try {
        const combined = `${query}[SEP]${truncated}`
        const output = (await pipe(combined)) as Array<{ score: number }>
        if (output?.[0]?.score != null) return output[0].score
      } catch {
        return -1
      }
    }
    return -1
  }
}

let rerankerInstance: CrossEncoderReranker | null = null

/** 获取 Cross-Encoder 单例 */
function getReranker(): CrossEncoderReranker {
  if (!rerankerInstance) rerankerInstance = new CrossEncoderReranker()
  return rerankerInstance
}

/** 计算两向量余弦相似度 */
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

/**
 * Bi-Encoder 重排（复用已加载的 Embedding，批量编码，无额外模型下载）
 */
async function rerankWithEmbeddings(
  query: string,
  candidates: SearchResult[],
  topK: number,
  embeddings: ReturnType<typeof createEmbeddings>
): Promise<SearchResult[]> {
  if (candidates.length === 0) return []

  // 批量 embed query 与所有 passage
  const queryVec = await embeddings.embedQuery(query)
  const passages = candidates.map((c) =>
    c.content.slice(0, RETRIEVAL_CONFIG.RERANK_PASSAGE_MAX_CHARS)
  )
  const docVecs = await embeddings.embedDocuments(passages)

  const scored: SearchResult[] = candidates.map((item, i) => {
    const sim = cosineSimilarity(queryVec, docVecs[i])
    return {
      ...item,
      score: Math.round(Math.max(0, Math.min(1, sim)) * 1000) / 1000,
    }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

/**
 * Cross-Encoder 重排（逐条打分，较慢，仅可选开启）
 */
async function rerankWithCrossEncoder(
  query: string,
  candidates: SearchResult[],
  topK: number
): Promise<SearchResult[] | null> {
  const reranker = getReranker()
  const pipe = await reranker.initialize()
  if (!pipe) return null

  const scored: SearchResult[] = []
  for (const item of candidates) {
    const ceScore = await reranker.scorePair(query, item.content)
    if (ceScore < 0) return null
    scored.push({
      ...item,
      score: Math.round(ceScore * 1000) / 1000,
    })
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK)
}

/**
 * 对 RRF 融合后的候选集重排序
 * 默认 Bi-Encoder；ENABLE_CROSS_ENCODER 时尝试 Cross-Encoder
 */
export async function rerankCandidates(
  query: string,
  candidates: SearchResult[],
  topK: number,
  embeddings: ReturnType<typeof createEmbeddings>
): Promise<{ results: SearchResult[]; method: 'cross-encoder' | 'bi-encoder' }> {
  if (candidates.length === 0) return { results: [], method: 'bi-encoder' }

  const limited = candidates.slice(0, RETRIEVAL_CONFIG.MAX_RERANK_CANDIDATES)

  // 默认：Bi-Encoder（快，不下载新模型）
  const biResults = await rerankWithEmbeddings(query, limited, topK, embeddings)

  if (RETRIEVAL_CONFIG.ENABLE_CROSS_ENCODER) {
    const ceResults = await rerankWithCrossEncoder(query, limited, topK)
    if (ceResults) {
      return { results: ceResults, method: 'cross-encoder' }
    }
  }

  return { results: biResults, method: 'bi-encoder' }
}
