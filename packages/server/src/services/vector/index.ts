/** 向量 / RAG / 检索模块统一导出 */
export { runRagPipeline } from './pipeline.js'
export type { RagPipelineOptions, RagPipelineResult } from './pipeline.js'
export {
  buildKnowledgeGraphFromChunks,
  saveKnowledgeGraph,
  loadKnowledgeGraph,
  expandQueryWithGraph,
  searchKnowledgeGraph,
  matchGraphNodes,
} from './knowledge-graph.js'
export {
  buildSearchQueries,
  expandWithSynonyms,
  clearProjectSynonymCache,
  getProjectSynonymsPath,
  PROJECT_SYNONYMS_FILE,
} from './query-expansion.js'
export { buildSynonymGroupsFromProject } from './synonym-mining.js'
export { hybridSearch, RETRIEVAL_CONFIG } from './retrieval/index.js'
export type { HybridSearchOptions, HybridSearchOutcome } from './retrieval/types.js'
export { createEmbeddings, createVectorStore, loadVectorStore } from '../utils/embedding.js'
