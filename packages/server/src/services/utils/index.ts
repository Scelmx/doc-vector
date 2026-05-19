/** 跨模块公共能力：Embedding、文本相似度、术语抽取 */
export {
  createEmbeddings,
  createVectorStore,
  loadVectorStore,
} from './embedding.js'
export {
  extractQueryTerms,
  normalizeText,
  levenshtein,
  editSimilarity,
  bigramJaccard,
  fuzzyMatchScore,
} from './text-similarity.js'
export { extractTermsFromChunk } from './term-extraction.js'
