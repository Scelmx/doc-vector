import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type {
  Project,
  Document,
  ApiResponse,
  VectorizeStatus,
  VectorizeRequest,
  SearchRequest,
  SearchResponse,
  ChunkConfig,
  ProjectSearchApiInfo,
  RagPipelineStage,
} from '@docvec/shared'
import {
  PATHS,
  readJsonFile,
  writeJsonFile,
  getProjectDir,
  getVectorDir,
  getKnowledgeGraphPath,
} from '../utils/storage.js'
import {
  createEmbeddings,
  hybridSearch,
  runRagPipeline,
  loadKnowledgeGraph,
} from '../services/vector/index.js'
import { loadChunksFromDocstore } from '../utils/chunk-store.js'
import { getApiBaseUrl } from '../utils/api-base.js'
import { createTarGzArchive } from '../utils/archive.js'
import { buildContentDisposition } from '../utils/content-disposition.js'

export const vectorRouter = Router()

/** RAG 常用默认：约 512 token 量级 */
const DEFAULT_CHUNK_SIZE = 800
const DEFAULT_CHUNK_OVERLAP = 100
const VECTOR_CONFIG_FILE = 'vector-config.json'

const vectorizeProgress = new Map<string, VectorizeStatus>()

/** 规范化 chunk 配置 */
function normalizeChunkConfig(body?: VectorizeRequest): ChunkConfig {
  const chunkSize = Math.min(4000, Math.max(100, Number(body?.chunkSize) || DEFAULT_CHUNK_SIZE))
  const chunkOverlap = Math.min(
    chunkSize - 1,
    Math.max(0, Number(body?.chunkOverlap) || DEFAULT_CHUNK_OVERLAP)
  )
  return { chunkSize, chunkOverlap }
}

/** 读取向量配置 */
function readVectorConfig(vectorDir: string): ChunkConfig | undefined {
  const configPath = path.join(vectorDir, VECTOR_CONFIG_FILE)
  if (!fs.existsSync(configPath)) return undefined
  const raw = readJsonFile<ChunkConfig & { pipeline?: string }>(configPath)
  return { chunkSize: raw.chunkSize, chunkOverlap: raw.chunkOverlap }
}

/** 将阶段映射为状态 */
function mapStageToStatus(stage: RagPipelineStage): VectorizeStatus['status'] {
  if (stage === 'completed') return 'completed'
  if (stage === 'failed') return 'failed'
  if (stage === 'pending') return 'pending'
  return 'processing'
}

// 对外仅暴露语义搜索 API 信息
vectorRouter.get('/search-api/:projectId', (req, res) => {
  try {
    const { projectId } = req.params
    const projects = readJsonFile<Project[]>(PATHS.projectsJson)
    const project = projects.find((p) => p.id === projectId)

    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' } as ApiResponse)
    }

    const baseUrl = getApiBaseUrl(req)
    const info: ProjectSearchApiInfo = {
      projectId,
      projectName: project.name,
      method: 'POST',
      url: `${baseUrl}/api/vector/search`,
      description: project.vectorized
        ? '混合检索：多 query + 图谱 + 同义词，RRF 融合后 Embedding 重排序'
        : '请先完成知识库训练后再调用',
      bodyExample: {
        projectId,
        query: '你的问题',
        topK: 5,
      },
    }

    res.json({ success: true, data: info } as ApiResponse<ProjectSearchApiInfo>)
  } catch {
    res.status(500).json({ success: false, error: '获取搜索 API 失败' } as ApiResponse)
  }
})

// 下载向量库（含索引、分块清单；若有知识图谱则一并打包）
vectorRouter.get('/download/:projectId', async (req, res) => {
  let tmpPath: string | null = null
  let stagingDir: string | null = null

  try {
    const { projectId } = req.params
    const projects = readJsonFile<Project[]>(PATHS.projectsJson)
    const project = projects.find((p) => p.id === projectId)

    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' } as ApiResponse)
    }

    if (!project.vectorized) {
      return res.status(400).json({ success: false, error: '项目尚未完成训练，无法下载' } as ApiResponse)
    }

    const vectorDir = getVectorDir(projectId)
    if (!fs.existsSync(vectorDir)) {
      return res.status(404).json({ success: false, error: '向量库不存在' } as ApiResponse)
    }

    stagingDir = path.join(os.tmpdir(), `docvec-export-${projectId}-${Date.now()}`)
    fs.mkdirSync(stagingDir, { recursive: true })

    for (const name of fs.readdirSync(vectorDir)) {
      fs.cpSync(path.join(vectorDir, name), path.join(stagingDir, name), { recursive: true })
    }

    const kgPath = getKnowledgeGraphPath(projectId)
    if (fs.existsSync(kgPath)) {
      fs.copyFileSync(kgPath, path.join(stagingDir, 'knowledge-graph.json'))
    }

    const displayName = `docvec-${project.name}-${projectId.slice(0, 8)}.tar.gz`
    const archiveFile = `docvec-${projectId.slice(0, 8)}.tar.gz`
    tmpPath = await createTarGzArchive(stagingDir, archiveFile)
    if (stagingDir && fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true })
      stagingDir = null
    }

    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Disposition', buildContentDisposition(displayName))

    const stream = fs.createReadStream(tmpPath)
    stream.pipe(res)
    res.on('finish', () => cleanupExportTmp(tmpPath, null))
    res.on('close', () => cleanupExportTmp(tmpPath, null))
  } catch (error) {
    cleanupExportTmp(tmpPath, stagingDir)
    console.error('下载向量库失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '下载向量库失败',
    } as ApiResponse)
  }
})

function cleanupExportTmp(tmpPath: string | null, stagingDir: string | null) {
  if (tmpPath && fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
  if (stagingDir && fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true })
  }
}

vectorRouter.get('/status/:projectId', (req, res) => {
  try {
    const { projectId } = req.params
    const status = vectorizeProgress.get(projectId)

    if (status) {
      return res.json({ success: true, data: status } as ApiResponse<VectorizeStatus>)
    }

    const projects = readJsonFile<Project[]>(PATHS.projectsJson)
    const project = projects.find((p) => p.id === projectId)

    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' } as ApiResponse)
    }

    const vectorDir = getVectorDir(projectId)
    const chunkConfig = project.vectorized ? readVectorConfig(vectorDir) : undefined
    const graph = project.knowledgeGraphBuilt ? loadKnowledgeGraph(projectId) : null

    res.json({
      success: true,
      data: {
        projectId,
        status: project.vectorized ? 'completed' : 'pending',
        stage: project.vectorized ? 'completed' : 'pending',
        progress: project.vectorized ? 100 : 0,
        processedDocuments: project.vectorized ? project.documentCount : 0,
        totalDocuments: project.documentCount,
        chunkConfig,
        knowledgeGraphBuilt: project.knowledgeGraphBuilt ?? false,
        knowledgeGraphStats: graph
          ? { nodes: graph.nodes.length, edges: graph.edges.length }
          : undefined,
      },
    } as ApiResponse<VectorizeStatus>)
  } catch {
    res.status(500).json({ success: false, error: '获取训练状态失败' } as ApiResponse)
  }
})

vectorRouter.post('/vectorize/:projectId', async (req, res) => {
  const { projectId } = req.params
  const chunkConfig = normalizeChunkConfig(req.body as VectorizeRequest)
  const buildKnowledgeGraph = (req.body as VectorizeRequest)?.buildKnowledgeGraph !== false

  try {
    const projects = readJsonFile<Project[]>(PATHS.projectsJson)
    const projectIndex = projects.findIndex((p) => p.id === projectId)

    if (projectIndex === -1) {
      return res.status(404).json({ success: false, error: '项目不存在' } as ApiResponse)
    }

    const metaPath = path.join(getProjectDir(projectId), 'documents.json')
    const documents = readJsonFile<Document[]>(metaPath)

    if (documents.length === 0) {
      return res.status(400).json({ success: false, error: '项目中没有文档' } as ApiResponse)
    }

    const status: VectorizeStatus = {
      projectId,
      status: 'processing',
      stage: 'loading',
      stageMessage: '准备训练...',
      progress: 0,
      processedDocuments: 0,
      totalDocuments: documents.length,
      chunkConfig,
      knowledgeGraphBuilt: false,
    }
    vectorizeProgress.set(projectId, status)

    projects[projectIndex].status = 'processing'
    projects[projectIndex].vectorized = false
    projects[projectIndex].knowledgeGraphBuilt = false
    writeJsonFile(PATHS.projectsJson, projects)

    res.json({ success: true, data: status } as ApiResponse<VectorizeStatus>)

    runRagPipeline({
      projectId,
      documents,
      chunkConfig,
      buildKnowledgeGraph,
      onProgress: (update) => {
        const current = vectorizeProgress.get(projectId)
        if (!current) return
        Object.assign(current, update)
        if (update.stage) {
          current.status = mapStageToStatus(update.stage)
        }
      },
    })
      .then(async (result) => {
        const current = vectorizeProgress.get(projectId)
        if (current) {
          current.status = 'completed'
          current.stage = 'completed'
          current.progress = 100
          current.totalChunks = result.totalChunks
          current.knowledgeGraphBuilt = result.knowledgeGraphBuilt
          current.knowledgeGraphStats = result.knowledgeGraphStats
          current.synonymGroups = result.synonymGroups
        }

        const currentProjects = readJsonFile<Project[]>(PATHS.projectsJson)
        const idx = currentProjects.findIndex((p) => p.id === projectId)
        if (idx !== -1) {
          currentProjects[idx].vectorized = true
          currentProjects[idx].vectorizedAt = new Date().toISOString()
          currentProjects[idx].knowledgeGraphBuilt = result.knowledgeGraphBuilt
          currentProjects[idx].status = 'completed'
          currentProjects[idx].updatedAt = new Date().toISOString()
          writeJsonFile(PATHS.projectsJson, currentProjects)
        }

        const meta = path.join(getProjectDir(projectId), 'documents.json')
        const updatedDocs = documents.map((d) => ({ ...d, vectorized: true }))
        writeJsonFile(meta, updatedDocs)
      })
      .catch((error) => {
        console.error('RAG 训练失败:', error)
        const errorStatus = vectorizeProgress.get(projectId)
        if (errorStatus) {
          errorStatus.status = 'failed'
          errorStatus.stage = 'failed'
          errorStatus.error = error instanceof Error ? error.message : '训练失败'
        }

        const currentProjects = readJsonFile<Project[]>(PATHS.projectsJson)
        const idx = currentProjects.findIndex((p) => p.id === projectId)
        if (idx !== -1) {
          currentProjects[idx].status = 'failed'
          writeJsonFile(PATHS.projectsJson, currentProjects)
        }
      })
  } catch {
    res.status(500).json({ success: false, error: '启动训练失败' } as ApiResponse)
  }
})

vectorRouter.post('/search', async (req, res) => {
  try {
    const { projectId, query, topK = 5 } = req.body as SearchRequest

    if (!projectId || !query) {
      return res.status(400).json({ success: false, error: '缺少必要参数' } as ApiResponse)
    }

    const projects = readJsonFile<Project[]>(PATHS.projectsJson)
    const project = projects.find((p) => p.id === projectId)

    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' } as ApiResponse)
    }

    if (!project.vectorized) {
      return res.status(400).json({ success: false, error: '项目尚未完成知识库训练' } as ApiResponse)
    }

    const vectorDir = getVectorDir(projectId)
    const embeddings = createEmbeddings()
    const graph = loadKnowledgeGraph(projectId)
    const chunks = loadChunksFromDocstore(vectorDir)
    const hybridEnabled = Boolean(graph && project.knowledgeGraphBuilt)

    const {
      results: searchResults,
      expandedQuery,
      graphTerms,
      searchQueries,
      reranked,
      candidateCount,
    } = await hybridSearch({
      projectId,
      vectorDir,
      query,
      topK,
      graph: hybridEnabled ? graph : null,
      chunks,
      embeddings,
    })

    res.json({
      success: true,
      data: {
        results: searchResults,
        query,
        projectId,
        expandedQuery: expandedQuery !== query ? expandedQuery : undefined,
        graphTerms: graphTerms.length > 0 ? graphTerms : undefined,
        searchQueries: searchQueries.length > 1 ? searchQueries : undefined,
        hybridSearch: hybridEnabled,
        reranked,
        candidateCount,
      },
    } as ApiResponse<SearchResponse>)
  } catch (error) {
    console.error('搜索失败:', error)
    res.status(500).json({ success: false, error: '搜索失败' } as ApiResponse)
  }
})
