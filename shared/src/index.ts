import type { DocumentFileType } from './document-formats.js'

export type { DocumentFileType, SupportedExtension } from './document-formats.js'
export {
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_FORMATS_LABEL,
  SUPPORTED_ACCEPT_ATTR,
  getFileExtension,
  isSupportedDocument,
  getDocumentFileType,
  isPlainTextDocument,
} from './document-formats.js'

// 项目状态
export type ProjectStatus = 'pending' | 'processing' | 'completed' | 'failed'

// RAG 训练阶段
export type RagPipelineStage =
  | 'pending'
  | 'loading'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'knowledge_graph'
  | 'completed'
  | 'failed'

// 项目信息
export interface Project {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  documentCount: number
  vectorized: boolean
  vectorizedAt?: string
  knowledgeGraphBuilt?: boolean
  status: ProjectStatus
}

// 文档信息
export interface Document {
  id: string
  projectId: string
  filename: string
  originalName: string
  /** 用于 RAG 的纯文本文件（PDF/Word 等上传后会生成） */
  textFilename?: string
  fileType?: DocumentFileType
  size: number
  content?: string
  createdAt: string
  vectorized: boolean
}

// API 响应
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface CreateProjectRequest {
  name: string
  description?: string
}

export interface UploadDocumentsResponse {
  uploaded: number
  failed: number
  documents: Document[]
}

// 文本分割配置
export interface ChunkConfig {
  chunkSize: number
  chunkOverlap: number
}

// RAG 训练请求
export interface VectorizeRequest {
  chunkSize?: number
  chunkOverlap?: number
  /** 是否同步构建知识图谱，默认 true */
  buildKnowledgeGraph?: boolean
}

// 向量化 / RAG 训练状态
export interface VectorizeStatus {
  projectId: string
  status: ProjectStatus
  stage: RagPipelineStage
  progress: number
  stageMessage?: string
  processedDocuments: number
  totalDocuments: number
  totalChunks?: number
  chunkConfig?: ChunkConfig
  knowledgeGraphBuilt?: boolean
  knowledgeGraphStats?: { nodes: number; edges: number }
  /** 自动挖掘的同义词组数量 */
  synonymGroups?: number
  error?: string
}

// 知识图谱
export type KnowledgeGraphNodeType = 'concept' | 'entity' | 'document' | 'section'

export interface KnowledgeGraphNode {
  id: string
  label: string
  type: KnowledgeGraphNodeType
}

export interface KnowledgeGraphEdge {
  source: string
  target: string
  relation: string
  weight: number
}

export interface KnowledgeGraph {
  projectId: string
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  builtAt: string
}

// 搜索
export interface SearchRequest {
  projectId: string
  query: string
  topK?: number
}

export type SearchResultSource = 'vector' | 'graph' | 'both'

export interface SearchResult {
  documentId: string
  filename: string
  content: string
  score: number
  section?: string
  chunkIndex?: number
  /** 命中来源：向量语义 / 知识图谱 / 双路命中 */
  source?: SearchResultSource
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
  projectId: string
  /** 图谱扩展后的检索 query（向量侧使用） */
  expandedQuery?: string
  /** 图谱为 query 补充的关联词 */
  graphTerms?: string[]
  /** 多路检索实际使用的 query 列表 */
  searchQueries?: string[]
  /** 是否启用了图谱混合检索 */
  hybridSearch?: boolean
  /** 是否经过重排序 */
  reranked?: boolean
  /** 重排序前候选数量 */
  candidateCount?: number
}

/** 对外仅暴露的语义搜索 API 信息 */
export interface ProjectSearchApiInfo {
  projectId: string
  projectName: string
  method: 'POST'
  url: string
  description: string
  bodyExample: {
    projectId: string
    query: string
    topK: number
  }
}
