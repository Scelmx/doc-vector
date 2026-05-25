<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="loading && !project" class="flex items-center justify-center py-20">
      <el-icon class="text-4xl text-primary-500 animate-spin"><Loading /></el-icon>
    </div>

    <!-- Not Found -->
    <div v-else-if="!project" class="text-center py-20">
      <h2 class="text-xl font-semibold text-text-primary mb-2">项目不存在</h2>
      <p class="text-text-secondary mb-6">请检查链接是否正确</p>
      <el-button @click="$router.push('/projects')">返回项目列表</el-button>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-4">
          <el-button text @click="$router.push('/projects')">
            <el-icon class="mr-1"><ArrowLeft /></el-icon>
            返回
          </el-button>
          <div>
            <h1 class="text-2xl font-bold text-text-primary">{{ project.name }}</h1>
            <p v-if="project.description" class="text-text-secondary mt-1">
              {{ project.description }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <el-tag
            :type="project.vectorized ? 'success' : 'info'"
            effect="light"
          >
            {{ project.vectorized ? '已训练' : '待训练' }}
          </el-tag>
          <el-popconfirm
            title="确定要删除这个项目吗？所有文档和向量数据将被删除。"
            confirm-button-text="删除"
            cancel-button-text="取消"
            @confirm="handleDeleteProject"
          >
            <template #reference>
              <el-button type="danger" plain>
                <el-icon class="mr-1"><Delete /></el-icon>
                删除项目
              </el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>

      <!-- Tabs -->
      <el-tabs v-model="activeTab" class="project-tabs">
        <!-- Documents Tab -->
        <el-tab-pane label="文档管理" name="documents">
          <div class="space-y-6 pt-4">
            <!-- Upload Area -->
            <div
              class="upload-dragger"
              :class="{ 'is-dragover': isDragging }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
              @click="triggerFileInput"
            >
              <input
                ref="fileInput"
                type="file"
                multiple
                accept=".md,.markdown,.txt,.doc,.docx,.html,.htm"
                class="hidden"
                @change="handleFileSelect"
              />
              <el-icon class="text-4xl text-text-secondary mb-4"><Upload /></el-icon>
              <p class="text-text-primary font-medium mb-1">
                拖拽文件到此处或点击上传
              </p>
              <p class="text-text-secondary text-sm">
                支持 Markdown、TXT、Word、HTML，可批量上传
              </p>
            </div>

            <!-- Upload Progress -->
            <div v-if="uploading" class="bg-surface border border-border rounded-xl p-4">
              <div class="flex items-center gap-3">
                <el-icon class="text-primary-500 animate-spin"><Loading /></el-icon>
                <span class="text-text-primary">正在上传...</span>
              </div>
            </div>

            <!-- Documents List -->
            <div class="bg-surface border border-border rounded-xl overflow-hidden">
              <div class="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 class="font-semibold text-text-primary">
                  文档列表 ({{ projectStore.documents.length }})
                </h3>
              </div>
              
              <div v-if="projectStore.documents.length === 0" class="p-8 text-center">
                <el-icon class="text-3xl text-text-secondary mb-3"><Document /></el-icon>
                <p class="text-text-secondary">暂无文档，请上传支持的文档文件</p>
              </div>
              
              <div v-else class="divide-y divide-border">
                <div
                  v-for="doc in projectStore.documents"
                  :key="doc.id"
                  class="px-5 py-4 flex items-center justify-between hover:bg-surface-light transition-colors"
                >
                  <div class="flex items-center gap-3">
                    <el-icon class="text-text-secondary"><Document /></el-icon>
                    <div>
                      <p class="text-text-primary font-medium">{{ doc.originalName }}</p>
                      <p class="text-text-secondary text-xs">
                        {{ formatFileSize(doc.size) }} · {{ formatDate(doc.createdAt) }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <el-tag v-if="doc.fileType" size="small" type="info" effect="plain" class="uppercase">
                      {{ formatFileType(doc.fileType) }}
                    </el-tag>
                    <el-tag v-if="doc.vectorized" type="success" size="small" effect="plain">
                      已训练
                    </el-tag>
                    <el-popconfirm
                      title="确定要删除这个文档吗？"
                      confirm-button-text="删除"
                      cancel-button-text="取消"
                      @confirm="handleDeleteDocument(doc.id)"
                    >
                      <template #reference>
                        <el-button text type="danger" size="small">
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </template>
                    </el-popconfirm>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- Vectorize Tab -->
        <el-tab-pane label="向量化" name="vectorize">
          <div class="space-y-6 pt-4">
            <div class="bg-surface border border-border rounded-xl p-6 shadow-card">
              <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <h3 class="text-lg font-semibold text-text-primary mb-1">知识库训练</h3>
                  <p class="text-text-secondary text-sm max-w-xl">
                    标准 RAG：文档加载 → 结构化分块 → 向量嵌入 → 索引构建 → 知识图谱，与「重新训练」一并执行。
                  </p>
                </div>
                <div class="flex flex-wrap items-center gap-2 shrink-0">
                  <el-button
                    v-if="project.vectorized"
                    size="large"
                    :loading="downloading"
                    @click="handleDownloadVectors"
                  >
                    <el-icon class="mr-1"><Download /></el-icon>
                    下载向量库
                  </el-button>
                  <el-button
                    type="primary"
                    size="large"
                    :loading="vectorizing"
                    :disabled="project.documentCount === 0"
                    @click="handleVectorize"
                  >
                    <el-icon v-if="!vectorizing" class="mr-1"><MagicStick /></el-icon>
                    {{ vectorizing ? '训练中...' : (project.vectorized ? '重新训练' : '开始训练') }}
                  </el-button>
                </div>
              </div>

              <el-collapse class="mb-6 border-none">
                <el-collapse-item title="高级参数（分块与知识图谱）" name="advanced">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label class="block text-sm text-text-secondary mb-2">分块大小（字符）</label>
                      <el-input-number
                        v-model="chunkConfig.chunkSize"
                        :min="100"
                        :max="4000"
                        :step="50"
                        class="w-full"
                        controls-position="right"
                      />
                    </div>
                    <div>
                      <label class="block text-sm text-text-secondary mb-2">重叠长度（字符）</label>
                      <el-input-number
                        v-model="chunkConfig.chunkOverlap"
                        :min="0"
                        :max="Math.max(0, chunkConfig.chunkSize - 1)"
                        :step="10"
                        class="w-full"
                        controls-position="right"
                      />
                    </div>
                  </div>
                  <div class="mt-4">
                    <el-checkbox v-model="buildKnowledgeGraph">
                      同步构建项目知识图谱（提升语义理解与检索精度）
                    </el-checkbox>
                  </div>
                </el-collapse-item>
              </el-collapse>

              <div v-if="vectorStatus && vectorStatus.status !== 'pending'" class="space-y-4">
                <el-progress
                  :percentage="vectorStatus.progress"
                  :status="vectorStatus.status === 'completed' ? 'success' : (vectorStatus.status === 'failed' ? 'exception' : '')"
                  :stroke-width="10"
                />
                <div class="flex items-center justify-between text-sm flex-wrap gap-2">
                  <span class="text-text-secondary">
                    {{ vectorStatus.stageMessage || getStageText(vectorStatus.stage) }}
                  </span>
                  <el-tag :type="getStatusType(vectorStatus.status)" size="small" effect="plain">
                    {{ getStatusText(vectorStatus.status) }}
                  </el-tag>
                </div>
                <div v-if="vectorStatus.totalChunks" class="text-text-secondary text-xs">
                  共 {{ vectorStatus.totalChunks }} 个文本块
                  <span v-if="vectorStatus.knowledgeGraphStats">
                    · 知识图谱 {{ vectorStatus.knowledgeGraphStats.nodes }} 节点 / {{ vectorStatus.knowledgeGraphStats.edges }} 关系
                  </span>
                  <span v-if="vectorStatus.synonymGroups">
                    · 同义词 {{ vectorStatus.synonymGroups }} 组
                  </span>
                </div>
                <p v-if="vectorStatus.error" class="text-red-600 text-sm">{{ vectorStatus.error }}</p>
              </div>

              <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-surface-light rounded-lg p-4 text-center">
                  <div class="text-2xl font-bold text-text-primary">{{ project.documentCount }}</div>
                  <div class="text-text-secondary text-sm">文档</div>
                </div>
                <div class="bg-surface-light rounded-lg p-4 text-center">
                  <div class="text-2xl font-bold text-text-primary">{{ project.vectorized ? '已训练' : '未训练' }}</div>
                  <div class="text-text-secondary text-sm">知识库</div>
                </div>
                <div class="bg-surface-light rounded-lg p-4 text-center">
                  <div class="text-2xl font-bold text-text-primary">{{ project.knowledgeGraphBuilt ? '已构建' : '—' }}</div>
                  <div class="text-text-secondary text-sm">知识图谱</div>
                </div>
                <div class="bg-surface-light rounded-lg p-4 text-center">
                  <div class="text-2xl font-bold text-text-primary">{{ vectorStatus?.totalChunks ?? '—' }}</div>
                  <div class="text-text-secondary text-sm">文本块</div>
                </div>
              </div>
            </div>

            <div v-if="project.vectorized" class="bg-surface border border-border rounded-xl p-6 shadow-card">
              <h3 class="text-lg font-semibold text-text-primary mb-1">混合检索 API</h3>
              <p class="text-text-secondary text-sm mb-4">
                多路召回 + RRF 融合 + 重排序，供大模型或业务系统集成
              </p>

              <div v-if="searchApiLoading" class="flex justify-center py-4">
                <el-icon class="text-2xl text-primary-500 animate-spin"><Loading /></el-icon>
              </div>
              <template v-else-if="searchApi">
                <div class="flex items-center gap-2 mb-3">
                  <el-tag size="small" type="primary" effect="plain">{{ searchApi.method }}</el-tag>
                  <code class="api-endpoint-code flex-1">{{ searchApi.url }}</code>
                  <el-button size="small" type="primary" plain @click="copyText(searchApi.url)">复制</el-button>
                </div>
                <p class="text-text-secondary text-xs mb-3">{{ searchApi.description }}</p>
                <pre class="text-xs bg-slate-50 border border-border rounded-lg p-3 overflow-x-auto text-slate-600">{{ JSON.stringify(searchApi.bodyExample, null, 2) }}</pre>
              </template>
            </div>
            <!-- Search (only when vectorized) -->
            <div v-if="project.vectorized" class="bg-surface border border-border rounded-xl p-6 shadow-card">
              <h3 class="text-lg font-semibold text-text-primary mb-4">混合检索测试</h3>
              <p class="text-text-secondary text-xs mb-3">
                多 query 向量 + 图谱 + 同义词 → RRF 融合 → Embedding 重排序（轻量）
              </p>
              <div
                v-if="lastSearchMeta?.searchQueries?.length"
                class="mb-3 text-xs text-text-secondary bg-slate-50 border border-border rounded-lg p-3"
              >
                <p class="font-medium text-text-primary mb-1">本次检索 query：</p>
                <p class="break-words">{{ lastSearchMeta.searchQueries.join(' · ') }}</p>
                <p v-if="lastSearchMeta.graphTerms?.length" class="mt-2">
                  图谱扩展词：{{ lastSearchMeta.graphTerms.join('、') }}
                </p>
                <p v-if="lastSearchMeta.reranked" class="mt-2 text-primary-600">
                  已重排序（{{ lastSearchMeta.candidateCount ?? '—' }} 条候选 → Top 结果）
                </p>
              </div>
              <div class="flex gap-3 mb-4">
                <el-input
                  v-model="searchQuery"
                  placeholder="输入搜索内容..."
                  clearable
                  class="flex-1"
                  @keyup.enter="handleSearch"
                />
                <el-button type="primary" :loading="searching" @click="handleSearch">
                  搜索
                </el-button>
              </div>
              
              <!-- Search Results -->
              <div v-if="searchResults.length > 0" class="space-y-3">
                <div
                  v-for="(result, index) in searchResults"
                  :key="index"
                  class="bg-surface-light rounded-lg p-4"
                >
                  <div class="mb-2 flex items-center gap-2 flex-wrap">
                    <span class="text-primary-600 font-medium text-sm">
                      {{ result.filename }}<span v-if="result.section" class="text-text-secondary font-normal"> · {{ result.section }}</span>
                    </span>
                    <el-tag :type="similarityTagType(result.score)" size="small" effect="plain">
                      相似度 {{ formatSimilarity(result.score) }}
                    </el-tag>
                    <el-tag v-if="result.source" size="small" type="info" effect="plain">
                      {{ result.source === 'both' ? '向量+图谱' : result.source === 'graph' ? '图谱' : '向量' }}
                    </el-tag>
                  </div>
                  <p class="text-text-secondary text-sm leading-relaxed line-clamp-3">
                    {{ result.content }}
                  </p>
                </div>
              </div>
              <p v-else-if="searchPerformed" class="text-text-secondary text-center py-4">
                未找到相关结果
              </p>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ArrowLeft, Delete, Upload, Document, Loading, MagicStick, Download 
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { vectorApi } from '@/api'
import type {
  VectorizeStatus,
  SearchResult,
  ProjectSearchApiInfo,
  ChunkConfig,
  RagPipelineStage,
  DocumentFileType,
} from '@docvec/shared'
import { isSupportedDocument, SUPPORTED_FORMATS_LABEL } from '@docvec/shared'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()

const loading = ref(true)
const activeTab = ref('documents')
const isDragging = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Vectorize state
const vectorizing = ref(false)
const downloading = ref(false)
const vectorStatus = ref<VectorizeStatus | null>(null)
const chunkConfig = ref<ChunkConfig>({ chunkSize: 800, chunkOverlap: 100 })
const buildKnowledgeGraph = ref(true)
let pollInterval: ReturnType<typeof setInterval> | null = null

const searchApi = ref<ProjectSearchApiInfo | null>(null)
const searchApiLoading = ref(false)

// Search state
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<SearchResult[]>([])
const searchPerformed = ref(false)
const lastSearchMeta = ref<{
  searchQueries?: string[]
  graphTerms?: string[]
  reranked?: boolean
  candidateCount?: number
} | null>(null)

const project = computed(() => projectStore.currentProject)

onMounted(async () => {
  const projectId = route.params.id as string
  await Promise.all([
    projectStore.fetchProject(projectId),
    projectStore.fetchDocuments(projectId),
  ])
  loading.value = false
  
  await fetchVectorStatus()
  if (projectStore.currentProject?.vectorized) {
    await fetchSearchApi()
  }
})

watch(() => route.params.id, async (newId) => {
  if (newId) {
    loading.value = true
    await Promise.all([
      projectStore.fetchProject(newId as string),
      projectStore.fetchDocuments(newId as string),
    ])
    loading.value = false
  }
})

// 清理轮询
import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    await uploadFiles(Array.from(input.files))
    input.value = '' // Reset input
  }
}

async function handleDrop(event: DragEvent) {
  isDragging.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const validFiles = Array.from(files).filter((f) => isSupportedDocument(f.name))
    if (validFiles.length > 0) {
      await uploadFiles(validFiles)
    } else {
      ElMessage.warning(`请上传支持的文件：${SUPPORTED_FORMATS_LABEL}`)
    }
  }
}

async function uploadFiles(files: File[]) {
  if (!project.value) return
  
  uploading.value = true
  try {
    const result = await projectStore.uploadDocuments(project.value.id, files)
    ElMessage.success(`成功上传 ${result?.uploaded || 0} 个文件`)
    // 重新获取项目信息
    await projectStore.fetchProject(project.value.id)
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function handleDeleteDocument(documentId: string) {
  if (!project.value) return
  
  try {
    await projectStore.deleteDocument(project.value.id, documentId)
    ElMessage.success('文档已删除')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '删除失败')
  }
}

async function handleDeleteProject() {
  if (!project.value) return
  
  try {
    await projectStore.deleteProject(project.value.id)
    ElMessage.success('项目已删除')
    router.push('/projects')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '删除失败')
  }
}

async function fetchVectorStatus() {
  if (!project.value) return
  
  try {
    const { data } = await vectorApi.getStatus(project.value.id)
    if (data.success && data.data) {
      vectorStatus.value = data.data
      if (data.data.chunkConfig) {
        chunkConfig.value = { ...data.data.chunkConfig }
      }
    }
  } catch (e) {
    // 忽略错误
  }
}

async function fetchSearchApi() {
  if (!project.value || !project.value.vectorized) return
  searchApiLoading.value = true
  try {
    const { data } = await vectorApi.getSearchApi(project.value.id)
    if (data.success && data.data) {
      searchApi.value = data.data
    }
  } catch {
    // 忽略
  } finally {
    searchApiLoading.value = false
  }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

async function handleDownloadVectors() {
  if (!project.value) return
  downloading.value = true
  try {
    const url = vectorApi.downloadUrl(project.value.id)
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `下载失败 (${res.status})`)
    }
    const disposition = res.headers.get('Content-Disposition')
    let filename = `docvec-${project.value.name}.tar.gz`
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
      const asciiMatch = disposition.match(/filename="([^"]+)"/i)
      if (utf8Match) {
        filename = decodeURIComponent(utf8Match[1])
      } else if (asciiMatch) {
        filename = asciiMatch[1]
      }
    }
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
    ElMessage.success('向量库下载完成')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '下载失败'
    ElMessage.error(msg)
  } finally {
    downloading.value = false
  }
}

async function handleVectorize() {
  if (!project.value) return
  
  vectorizing.value = true
  try {
    const { data } = await vectorApi.vectorize(project.value.id, {
      chunkSize: chunkConfig.value.chunkSize,
      chunkOverlap: chunkConfig.value.chunkOverlap,
      buildKnowledgeGraph: buildKnowledgeGraph.value,
    })
    if (data.success && data.data) {
      vectorStatus.value = data.data
      // 开始轮询状态
      startPolling()
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '训练启动失败')
    vectorizing.value = false
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval)
  
  pollInterval = setInterval(async () => {
    await fetchVectorStatus()
    
    if (vectorStatus.value?.status === 'completed' || vectorStatus.value?.status === 'failed') {
      if (pollInterval) clearInterval(pollInterval)
      vectorizing.value = false
      
      if (vectorStatus.value.status === 'completed') {
        ElMessage.success('知识库训练完成')
        if (project.value) {
          await projectStore.fetchProject(project.value.id)
          await fetchSearchApi()
        }
      } else {
        ElMessage.error('训练失败')
      }
    }
  }, 2000)
}

function formatSimilarity(score: number): string {
  if (!Number.isFinite(score)) return '—'
  return `${(score * 100).toFixed(2)}%`
}

function similarityTagType(score: number): 'success' | 'warning' | 'info' {
  if (score >= 0.7) return 'success'
  if (score >= 0.4) return 'warning'
  return 'info'
}

async function handleSearch() {
  if (!project.value || !searchQuery.value.trim()) return
  
  searching.value = true
  searchPerformed.value = true
  try {
    const { data } = await vectorApi.search({
      projectId: project.value.id,
      query: searchQuery.value,
      topK: 5,
    })
    if (data.success && data.data) {
      searchResults.value = data.data.results
      lastSearchMeta.value = {
        searchQueries: data.data.searchQueries,
        graphTerms: data.data.graphTerms,
        reranked: data.data.reranked,
        candidateCount: data.data.candidateCount,
      }
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '搜索失败')
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

function getStageText(stage: RagPipelineStage) {
  const map: Record<RagPipelineStage, string> = {
    pending: '等待开始',
    loading: '加载文档',
    chunking: '结构化分块',
    embedding: '向量嵌入',
    indexing: '构建索引',
    knowledge_graph: '构建知识图谱',
    completed: '训练完成',
    failed: '训练失败',
  }
  return map[stage] || stage
}

function getStatusType(status: string) {
  const types: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    completed: 'success',
    processing: 'warning',
    failed: 'danger',
    pending: 'info',
  }
  return types[status] || 'info'
}

function getStatusText(status: string) {
  const texts: Record<string, string> = {
    completed: '已完成',
    processing: '处理中',
    failed: '失败',
    pending: '待处理',
  }
  return texts[status] || status
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatFileType(type: DocumentFileType) {
  const map: Record<DocumentFileType, string> = {
    markdown: 'MD',
    text: 'TXT',
    word: 'Word',
    html: 'HTML',
    unknown: 'File',
  }
  return map[type] || type
}
</script>

<style scoped>
:deep(.project-tabs .el-tabs__header) {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 6px;
  margin-bottom: 0;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

:deep(.project-tabs .el-tabs__nav-wrap::after) {
  display: none;
}

:deep(.project-tabs .el-tabs__nav) {
  border: none;
}

:deep(.project-tabs .el-tabs__item) {
  color: #64748b;
  padding: 10px 24px !important;
  height: auto;
  line-height: 1.25;
  border-radius: 8px;
  border: 1px solid transparent;
  font-weight: 500;
  transition: color 0.2s, background 0.2s, border-color 0.2s, box-shadow 0.2s;
}

:deep(.project-tabs .el-tabs__item:hover) {
  color: #334155;
  background: #f8fafc;
}

:deep(.project-tabs .el-tabs__item.is-active) {
  color: #2563eb;
  background: #eff6ff;
  border-color: #bfdbfe;
  font-weight: 600;
  box-shadow: 0 1px 3px rgb(37 99 235 / 0.12);
}

:deep(.project-tabs .el-tabs__active-bar) {
  display: none;
}

:deep(.project-tabs .el-tabs__content) {
  overflow: visible;
}
</style>
