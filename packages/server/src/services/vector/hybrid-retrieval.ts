/**
 * 兼容层：请优先从 retrieval 模块导入
 * @deprecated 使用 `import { hybridSearch } from './retrieval/index.js'`
 */
export { hybridSearch, RETRIEVAL_CONFIG } from './retrieval/index.js'
export type { HybridSearchOptions, HybridSearchOutcome } from './retrieval/types.js'
