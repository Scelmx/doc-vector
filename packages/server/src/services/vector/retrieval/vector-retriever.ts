import type { SearchResult } from '@docvec/shared'
import { cosineDistanceToSimilarity } from '../../../utils/chunking.js'
import { loadVectorStore } from '../../utils/embedding.js'
import { RETRIEVAL_CONFIG } from './config.js'
import { mergeVectorQueryResults, resultKey } from './rrf.js'
import type { RankedSearchResult } from './types.js'

const { RRF_K, MIN_VECTOR_SCORE } = RETRIEVAL_CONFIG

export type VectorStore = Awaited<ReturnType<typeof loadVectorStore>>

/**
 * 多 query 向量语义检索，RRF 合并去重
 */
export async function retrieveByVector(
  vectorStore: VectorStore,
  queries: string[],
  perQueryLimit: number
): Promise<SearchResult[]> {
  const byKey = new Map<string, RankedSearchResult & { bestScore: number }>()

  for (const q of queries) {
    const pairs = await vectorStore.similaritySearchWithScore(q, perQueryLimit)
    pairs.forEach(([doc, distance], rank) => {
      const score = cosineDistanceToSimilarity(distance)
      if (score < MIN_VECTOR_SCORE) return

      const item: RankedSearchResult & { bestScore: number } = {
        documentId: doc.metadata.documentId as string,
        filename: doc.metadata.filename as string,
        chunkIndex: (doc.metadata.chunkIndex as number) ?? 0,
        content: doc.pageContent,
        section: (doc.metadata.section as string) || undefined,
        score,
        source: 'vector',
        rrf: 1 / (RRF_K + rank + 1),
        bestScore: score,
      }

      const key = resultKey(item)
      const existing = byKey.get(key)
      if (existing) {
        // 同 chunk 被多条 query 命中时累加 RRF
        existing.rrf = (existing.rrf ?? 0) + item.rrf!
        existing.bestScore = Math.max(existing.bestScore, score)
      } else {
        byKey.set(key, item)
      }
    })
  }

  return mergeVectorQueryResults(byKey)
}
