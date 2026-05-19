<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-text-primary">项目管理</h1>
        <p class="text-text-secondary mt-1">管理您的文档项目，上传文件并进行向量化</p>
      </div>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon>
        新建项目
      </el-button>
    </div>

    <!-- Search and Filter -->
    <div class="flex items-center gap-4">
      <el-input
        v-model="searchQuery"
        placeholder="搜索项目..."
        prefix-icon="Search"
        clearable
        class="w-80"
      />
      <el-select v-model="filterStatus" placeholder="状态筛选" clearable class="w-40">
        <el-option label="全部" value="" />
        <el-option label="已向量化" value="vectorized" />
        <el-option label="待处理" value="pending" />
      </el-select>
    </div>

    <!-- Loading -->
    <div v-if="projectStore.loading" class="flex items-center justify-center py-20">
      <el-icon class="text-4xl text-primary-500 animate-spin"><Loading /></el-icon>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredProjects.length === 0"
      class="text-center py-20 bg-surface border border-border rounded-2xl"
    >
      <div class="w-16 h-16 rounded-full bg-surface-light flex items-center justify-center mx-auto mb-4">
        <el-icon class="text-3xl text-text-secondary"><FolderOpened /></el-icon>
      </div>
      <h3 class="text-lg font-semibold text-text-primary mb-2">
        {{ searchQuery ? '未找到匹配的项目' : '暂无项目' }}
      </h3>
      <p class="text-text-secondary mb-6">
        {{ searchQuery ? '请尝试其他搜索关键词' : '创建您的第一个文档项目开始使用' }}
      </p>
      <el-button v-if="!searchQuery" type="primary" @click="showCreateDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon>
        创建项目
      </el-button>
    </div>

    <!-- Projects Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <ProjectCard
        v-for="project in filteredProjects"
        :key="project.id"
        :project="project"
        @click="$router.push(`/projects/${project.id}`)"
      />
    </div>
  </div>

  <!-- 创建项目对话框 -->
  <CreateProjectDialog v-model="showCreateDialog" @created="handleProjectCreated" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Loading, FolderOpened } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import CreateProjectDialog from '@/components/CreateProjectDialog.vue'
import ProjectCard from '@/components/ProjectCard.vue'

const router = useRouter()
const projectStore = useProjectStore()
const showCreateDialog = ref(false)
const searchQuery = ref('')
const filterStatus = ref('')

const filteredProjects = computed(() => {
  let result = [...projectStore.projects]
  
  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    )
  }
  
  // 状态过滤
  if (filterStatus.value === 'vectorized') {
    result = result.filter((p) => p.vectorized)
  } else if (filterStatus.value === 'pending') {
    result = result.filter((p) => !p.vectorized)
  }
  
  // 按更新时间排序
  return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
})

onMounted(() => {
  projectStore.fetchProjects()
})

function handleProjectCreated(project: any) {
  router.push(`/projects/${project.id}`)
}
</script>
