<template>
  <header class="border-b border-border bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
    <div class="container mx-auto px-6 max-w-7xl">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-3 group">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
            <el-icon class="text-white text-lg"><Document /></el-icon>
          </div>
          <span class="text-xl font-semibold text-text-primary group-hover:text-primary-600 transition-colors">
            DocVec
          </span>
        </router-link>

        <!-- Navigation -->
        <nav class="flex items-center gap-6">
          <router-link
            to="/"
            class="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
            :class="{ '!text-primary-600': $route.path === '/' }"
          >
            首页
          </router-link>
          <router-link
            to="/projects"
            class="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
            :class="{ '!text-primary-600': $route.path.startsWith('/projects') }"
          >
            项目管理
          </router-link>
        </nav>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <el-button type="primary" @click="handleCreateProject">
            <el-icon class="mr-1"><Plus /></el-icon>
            新建项目
          </el-button>
        </div>
      </div>
    </div>
  </header>

  <!-- 创建项目对话框 -->
  <CreateProjectDialog v-model="showCreateDialog" @created="handleProjectCreated" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Document, Plus } from '@element-plus/icons-vue'
import CreateProjectDialog from './CreateProjectDialog.vue'

const router = useRouter()
const showCreateDialog = ref(false)

function handleCreateProject() {
  showCreateDialog.value = true
}

function handleProjectCreated(project: any) {
  router.push(`/projects/${project.id}`)
}
</script>
