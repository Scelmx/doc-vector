import type { KnowledgeGraph, SearchResult } from '@docvec/shared'
import type { StoredChunk } from '../../../utils/chunk-store.js'
import { searchKnowledgeGraph } from '../knowledge-graph.js'
import { mergeRankedListsWithRrf } from './rrf.js'

/**
 * 多 query 知识图谱结构检索，RRF 合并
 */
export function retrieveByGraph(
  queries: string[],
  graph: KnowledgeGraph,
  chunks: StoredChunk[],
  perQueryLimit: number
): SearchResult[] {
  const lists = queries.map((q) =>
    searchKnowledgeGraph(q, graph, chunks, perQueryLimit).map((h) => ({
      documentId: h.documentId,
      filename: h.filename,
      chunkIndex: h.chunkIndex,
      content: h.content,
      section: h.section || undefined,
      score: h.score,
      source: 'graph' as const,
    }))
  )

  return mergeRankedListsWithRrf(lists, 'graph').map(({ rrf, ...item }) => ({
    ...item,
    score: Math.round(Math.min(1, item.score * 0.6 + (rrf ?? 0) * 6) * 1000) / 1000,
  }))
}
