import type { SearchResult } from '@docvec/shared'
import { expandQueryWithGraph } from '../knowledge-graph.js'
import { buildSearchQueries } from '../query-expansion.js'
import { loadVectorStore } from '../../utils/embedding.js'
import { RETRIEVAL_CONFIG } from './config.js'
import { retrieveByGraph } from './graph-retriever.js'
import { fuseVectorAndGraph } from './rrf.js'
import { rerankCandidates } from './reranker.js'
import type { HybridSearchOptions, HybridSearchOutcome } from './types.js'
import { retrieveByVector } from './vector-retriever.js'

/**
 * 混合检索主流程：
 * 1. Query 扩展（图谱 + 同义词 → 多 query）
 * 2. 向量多路召回 + 图谱多路召回
 * 3. RRF 融合
 * 4. Bi-Encoder 重排序（默认，无额外模型）
 */
export async function hybridSearch(options: HybridSearchOptions): Promise<HybridSearchOutcome> {
  const {
    projectId,
    vectorDir,
    query,
    topK,
    graph,
    chunks,
    embeddings,
    skipRerank = false,
  } = options

  // 图谱扩展 query 词
  const { expandedQuery, terms: graphTerms } = expandQueryWithGraph(query, graph)
  // 多路检索 query（含同义词）
  const searchQueries = buildSearchQueries(
    query,
    graphTerms,
    RETRIEVAL_CONFIG.MAX_SEARCH_QUERIES,
    projectId
  )

  const perQueryLimit = Math.min(
    Math.ceil((topK * RETRIEVAL_CONFIG.CANDIDATE_MULTIPLIER) / 2),
    RETRIEVAL_CONFIG.MAX_CANDIDATES_PER_ROUTE
  )

  const vectorStore = await loadVectorStore(vectorDir, embeddings)
  const vectorResults = await retrieveByVector(vectorStore, searchQueries, perQueryLimit)

  const graphQueries = [...new Set([query, ...graphTerms.slice(0, 3)])].slice(0, 4)
  const graphResults =
    graph && chunks.length > 0
      ? retrieveByGraph(graphQueries, graph, chunks, perQueryLimit)
      : []

  const rerankPoolSize = Math.min(
    topK * RETRIEVAL_CONFIG.RERANK_CANDIDATE_MULTIPLIER,
    RETRIEVAL_CONFIG.MAX_RERANK_CANDIDATES
  )

  let candidates: SearchResult[]
  if (graphResults.length > 0) {
    // 双路 RRF 融合
    candidates = fuseVectorAndGraph(vectorResults, graphResults, rerankPoolSize).map(
      ({ rrf, sources, ...rest }) => rest
    )
  } else {
    candidates = vectorResults.slice(0, rerankPoolSize)
  }

  let results: SearchResult[]
  let reranked = false

  if (!skipRerank && RETRIEVAL_CONFIG.ENABLE_RERANK && candidates.length > 0) {
    const { results: rerankedResults } = await rerankCandidates(query, candidates, topK, embeddings)
    results = rerankedResults
    reranked = true
  } else {
    results = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((r) => ({ ...r, source: r.source ?? 'vector' }))
  }

  return {
    results,
    expandedQuery,
    graphTerms,
    searchQueries,
    reranked,
    candidateCount: candidates.length,
  }
}
