import fs from 'fs'
import path from 'path'
import type { Document, ChunkConfig, VectorizeStatus } from '@docvec/shared'
import { getProjectDir, getVectorDir, getKnowledgeGraphPath, writeJsonFile } from '../../utils/storage.js'
import { buildRagChunks, type RagChunk } from '../../utils/rag-chunking.js'
import { createEmbeddings, createVectorStore } from '../utils/embedding.js'
import {
  buildKnowledgeGraphFromChunks,
  saveKnowledgeGraph,
} from './knowledge-graph.js'
import { buildSynonymGroupsFromProject } from './synonym-mining.js'
import { clearProjectSynonymCache, PROJECT_SYNONYMS_FILE } from './query-expansion.js'
import { readDocumentText } from '../document/parser.js'

const VECTOR_CONFIG_FILE = 'vector-config.json'
const CHUNKS_MANIFEST_FILE = 'chunks-manifest.json'

/** RAG 训练流水线入参 */
export interface RagPipelineOptions {
  projectId: string
  documents: Document[]
  chunkConfig: ChunkConfig
  buildKnowledgeGraph: boolean
  onProgress: (update: Partial<VectorizeStatus>) => void
}

/** RAG 训练流水线结果 */
export interface RagPipelineResult {
  totalChunks: number
  knowledgeGraphBuilt: boolean
  knowledgeGraphStats?: { nodes: number; edges: number }
  synonymGroups?: number
}

/**
 * 标准 RAG 训练：加载 → 分块 → 向量化 → 索引 → 知识图谱 → 同义词挖掘
 */
export async function runRagPipeline(options: RagPipelineOptions): Promise<RagPipelineResult> {
  const { projectId, documents, chunkConfig, buildKnowledgeGraph, onProgress } = options
  const projectDir = getProjectDir(projectId)
  const vectorDir = getVectorDir(projectId)

  // 清理旧向量库与图谱
  if (fs.existsSync(vectorDir)) {
    fs.rmSync(vectorDir, { recursive: true })
  }
  const kgPath = getKnowledgeGraphPath(projectId)
  if (fs.existsSync(kgPath)) {
    fs.unlinkSync(kgPath)
  }
  clearProjectSynonymCache(projectId)
  fs.mkdirSync(vectorDir, { recursive: true })

  onProgress({
    stage: 'loading',
    stageMessage: '加载文档...',
    progress: 5,
    processedDocuments: 0,
    totalDocuments: documents.length,
  })

  onProgress({
    stage: 'chunking',
    stageMessage: '结构化分块（Markdown 感知）...',
    progress: 10,
  })

  const allChunks: RagChunk[] = []

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]
    const filePath = path.join(projectDir, doc.filename)

    if (fs.existsSync(filePath)) {
      try {
        const content = await readDocumentText(projectDir, doc)
        if (!content.trim()) {
          console.warn(`[RAG] 文档无有效文本: ${doc.originalName}`)
          continue
        }
        const docChunks = buildRagChunks(
          content,
          doc.id,
          doc.originalName,
          chunkConfig.chunkSize,
          chunkConfig.chunkOverlap
        )
        allChunks.push(...docChunks)
      } catch (err) {
        console.error(`[RAG] 读取文档失败 ${doc.originalName}:`, err)
      }
    }

    onProgress({
      processedDocuments: i + 1,
      progress: 10 + Math.round(((i + 1) / documents.length) * 25),
      totalChunks: allChunks.length,
    })
  }

  if (allChunks.length === 0) {
    throw new Error('未能从文档中提取有效文本块')
  }

  writeJsonFile(path.join(vectorDir, VECTOR_CONFIG_FILE), {
    ...chunkConfig,
    pipeline: 'rag-v1',
    savedAt: new Date().toISOString(),
  })

  writeJsonFile(
    path.join(vectorDir, CHUNKS_MANIFEST_FILE),
    allChunks.map((c) => ({
      documentId: c.metadata.documentId,
      filename: c.metadata.filename,
      chunkIndex: c.metadata.chunkIndex,
      section: c.metadata.section,
      length: c.content.length,
    }))
  )

  onProgress({
    stage: 'embedding',
    stageMessage: `生成向量嵌入（${allChunks.length} 个文本块）...`,
    progress: 40,
    totalChunks: allChunks.length,
  })

  const texts = allChunks.map((c) => c.content)
  const metadatas = allChunks.map((c) => ({
    documentId: c.metadata.documentId,
    filename: c.metadata.filename,
    chunkIndex: c.metadata.chunkIndex,
    section: c.metadata.section ?? '',
  }))

  const embeddings = createEmbeddings()

  onProgress({
    stage: 'indexing',
    stageMessage: '构建向量索引...',
    progress: 65,
  })

  const vectorStore = await createVectorStore(texts, metadatas, embeddings, vectorDir)
  await vectorStore.save(vectorDir)

  let knowledgeGraphBuilt = false
  let knowledgeGraphStats: { nodes: number; edges: number } | undefined
  let graph = null as ReturnType<typeof buildKnowledgeGraphFromChunks> | null

  if (buildKnowledgeGraph) {
    onProgress({
      stage: 'knowledge_graph',
      stageMessage: '构建项目知识图谱...',
      progress: 85,
    })

    graph = buildKnowledgeGraphFromChunks(projectId, allChunks)
    saveKnowledgeGraph(graph)
    knowledgeGraphBuilt = true
    knowledgeGraphStats = { nodes: graph.nodes.length, edges: graph.edges.length }
  }

  onProgress({
    stage: 'knowledge_graph',
    stageMessage: '挖掘文档同义词...',
    progress: 92,
  })

  let synonymGroups: string[][] = []
  try {
    synonymGroups = await buildSynonymGroupsFromProject(allChunks, graph)
    writeJsonFile(path.join(vectorDir, PROJECT_SYNONYMS_FILE), synonymGroups)
    clearProjectSynonymCache(projectId)
    console.log(`[RAG] 项目 ${projectId} 自动生成 ${synonymGroups.length} 组同义词`)
  } catch (err) {
    console.warn('[RAG] 同义词挖掘失败:', err)
  }

  onProgress({
    stage: 'completed',
    stageMessage: '训练完成',
    progress: 100,
    knowledgeGraphBuilt,
    knowledgeGraphStats,
  })

  return {
    totalChunks: allChunks.length,
    knowledgeGraphBuilt,
    knowledgeGraphStats,
    synonymGroups: synonymGroups.length,
  }
}
