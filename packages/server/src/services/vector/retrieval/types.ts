import type { KnowledgeGraph, SearchResult } from '@docvec/shared'
import type { StoredChunk } from '../../../utils/chunk-store.js'
import type { createEmbeddings } from '../../utils/embedding.js'

/** 混合检索入参 */
export interface HybridSearchOptions {
  projectId: string
  vectorDir: string
  query: string
  topK: number
  graph: KnowledgeGraph | null
  chunks: StoredChunk[]
  embeddings: ReturnType<typeof createEmbeddings>
  /** 跳过重排序（调试用） */
  skipRerank?: boolean
}

/** 混合检索返回 */
export interface HybridSearchOutcome {
  results: SearchResult[]
  expandedQuery: string
  graphTerms: string[]
  searchQueries: string[]
  reranked: boolean
  candidateCount: number
}

/** 带 RRF 中间状态的检索结果 */
export type RankedSearchResult = SearchResult & {
  rrf?: number
  bestScore?: number
  sources?: Set<string>
}
