<template>
  <div class="space-y-12">
    <!-- Hero Section -->
    <section class="text-center py-16">
      <div class="max-w-3xl mx-auto space-y-6">
        <h1 class="text-5xl font-bold text-text-primary leading-tight text-balance">
          智能文档向量化平台
        </h1>
        <p class="text-xl text-text-secondary leading-relaxed text-pretty">
          上传 Markdown、Word、TXT、HTML 等文档，一键训练知识库，实现智能语义搜索。
          基于 LangChain 构建，完全本地化运行，保护您的数据隐私。
        </p>
        <div class="flex items-center justify-center gap-4 pt-4">
          <el-button type="primary" size="large" @click="handleCreateProject">
            <el-icon class="mr-2"><Plus /></el-icon>
            创建新项目
          </el-button>
          <el-button size="large" @click="$router.push('/projects')">
            <el-icon class="mr-2"><Folder /></el-icon>
            浏览项目
          </el-button>
        </div>
      </div>
    </section>

    <!-- Stats Section -->
    <section class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-surface border border-border rounded-2xl p-6 card-hover">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <el-icon class="text-primary-600 text-2xl"><FolderOpened /></el-icon>
          </div>
          <div>
            <div class="text-3xl font-bold text-text-primary">{{ projectStore.projectCount }}</div>
            <div class="text-text-secondary text-sm">项目总数</div>
          </div>
        </div>
      </div>
      
      <div class="bg-surface border border-border rounded-2xl p-6 card-hover">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <el-icon class="text-blue-400 text-2xl"><Document /></el-icon>
          </div>
          <div>
            <div class="text-3xl font-bold text-text-primary">{{ projectStore.totalDocuments }}</div>
            <div class="text-text-secondary text-sm">文档数量</div>
          </div>
        </div>
      </div>
      
      <div class="bg-surface border border-border rounded-2xl p-6 card-hover">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <el-icon class="text-amber-400 text-2xl"><Connection /></el-icon>
          </div>
          <div>
            <div class="text-3xl font-bold text-text-primary">{{ projectStore.vectorizedCount }}</div>
            <div class="text-text-secondary text-sm">已向量化</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-8">
      <h2 class="text-2xl font-semibold text-text-primary mb-8 text-center">核心功能</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-surface border border-border rounded-2xl p-6 card-hover">
          <div class="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center mb-4">
            <el-icon class="text-primary-600 text-xl"><FolderAdd /></el-icon>
          </div>
          <h3 class="text-lg font-semibold text-text-primary mb-2">新建文档项目</h3>
          <p class="text-text-secondary text-sm leading-relaxed">
            创建独立的文档项目，方便管理和组织您的知识库。每个项目都有独立的向量空间。
          </p>
        </div>

        <div class="bg-surface border border-border rounded-2xl p-6 card-hover">
          <div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
            <el-icon class="text-blue-400 text-xl"><Upload /></el-icon>
          </div>
          <h3 class="text-lg font-semibold text-text-primary mb-2">批量上传文档</h3>
          <p class="text-text-secondary text-sm leading-relaxed">
            支持 Word、Markdown、TXT、HTML 等格式，拖拽即可上传，快速构建知识库。
          </p>
        </div>

        <div class="bg-surface border border-border rounded-2xl p-6 card-hover">
          <div class="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
            <el-icon class="text-amber-400 text-xl"><MagicStick /></el-icon>
          </div>
          <h3 class="text-lg font-semibold text-text-primary mb-2">一键向量化</h3>
          <p class="text-text-secondary text-sm leading-relaxed">
            使用本地 Embedding 模型进行文档向量化，无需 API Key，完全离线运行。
          </p>
        </div>
      </div>
    </section>

    <!-- Recent Projects -->
    <section v-if="recentProjects.length > 0" class="py-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-semibold text-text-primary">最近项目</h2>
        <router-link to="/projects" class="text-primary-600 hover:text-primary-700 text-sm font-medium">
          查看全部
        </router-link>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ProjectCard
          v-for="project in recentProjects"
          :key="project.id"
          :project="project"
          @click="$router.push(`/projects/${project.id}`)"
        />
      </div>
    </section>
  </div>

  <!-- 创建项目对话框 -->
  <CreateProjectDialog v-model="showCreateDialog" @created="handleProjectCreated" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Plus, Folder, FolderOpened, Document, Connection, 
  FolderAdd, Upload, MagicStick 
} from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import CreateProjectDialog from '@/components/CreateProjectDialog.vue'
import ProjectCard from '@/components/ProjectCard.vue'

const router = useRouter()
const projectStore = useProjectStore()
const showCreateDialog = ref(false)

const recentProjects = computed(() => {
  return [...projectStore.projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6)
})

onMounted(() => {
  projectStore.fetchProjects()
})

function handleCreateProject() {
  showCreateDialog.value = true
}

function handleProjectCreated(project: any) {
  router.push(`/projects/${project.id}`)
}
</script>
