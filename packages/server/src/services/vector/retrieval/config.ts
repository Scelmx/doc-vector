/**
 * 混合检索与重排序配置
 * 默认使用 Bi-Encoder 重排（复用 Embedding 模型，无额外下载），首次搜索更快
 */
export const RETRIEVAL_CONFIG = {
  /** RRF 融合常数 */
  RRF_K: 60,
  /** 向量检索最低相似度 */
  MIN_VECTOR_SCORE: 0.12,
  /** 多 query 扩展上限（降低可减少向量检索次数） */
  MAX_SEARCH_QUERIES: 4,
  /** 每路检索候选倍数（相对 topK） */
  CANDIDATE_MULTIPLIER: 4,
  /** 单路检索最大候选数 */
  MAX_CANDIDATES_PER_ROUTE: 24,
  /** 融合后送入重排序的候选倍数 */
  RERANK_CANDIDATE_MULTIPLIER: 3,
  /** 重排序最大候选数（越小越快） */
  MAX_RERANK_CANDIDATES: 15,
  /** 是否启用重排序 */
  ENABLE_RERANK: true,
  /**
   * 是否启用 Cross-Encoder（需额外下载模型，首次慢）
   * 默认 false：仅用 Bi-Encoder 重排
   * 影响首次性能
   */
  ENABLE_CROSS_ENCODER: false,
  /** Cross-Encoder 模型（仅在 ENABLE_CROSS_ENCODER=true 时加载） */
  RERANKER_MODEL: 'Xenova/ms-marco-MiniLM-L-6-v2',
  /** 重排序时截断 passage 字符数 */
  RERANK_PASSAGE_MAX_CHARS: 384,
} as const
