<template>
  <div
    class="bg-surface border border-border rounded-xl p-5 cursor-pointer card-hover"
    @click="$emit('click')"
  >
    <div class="flex items-start justify-between mb-4">
      <div class="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
        <el-icon class="text-primary-600 text-lg"><Folder /></el-icon>
      </div>
      <el-tag
        :type="project.vectorized ? 'success' : 'info'"
        size="small"
        effect="light"
      >
        {{ project.vectorized ? '已向量化' : '待处理' }}
      </el-tag>
    </div>
    
    <h3 class="text-lg font-semibold text-text-primary mb-1 truncate">
      {{ project.name }}
    </h3>
    
    <p v-if="project.description" class="text-text-secondary text-sm mb-4 line-clamp-2">
      {{ project.description }}
    </p>
    
    <div class="flex items-center gap-4 text-text-secondary text-xs">
      <span class="flex items-center gap-1">
        <el-icon><Document /></el-icon>
        {{ project.documentCount }} 文档
      </span>
      <span>{{ formatDate(project.updatedAt) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Folder, Document } from '@element-plus/icons-vue'
import type { Project } from '@docvec/shared'

defineProps<{
  project: Project
}>()

defineEmits<{
  click: []
}>()

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>
