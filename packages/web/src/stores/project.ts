import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, Document } from '@docvec/shared'
import { projectApi, documentApi } from '@/api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const documents = ref<Document[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const projectCount = computed(() => projects.value.length)
  const vectorizedCount = computed(() => projects.value.filter((p) => p.vectorized).length)
  const totalDocuments = computed(() => projects.value.reduce((sum, p) => sum + p.documentCount, 0))

  async function fetchProjects() {
    loading.value = true
    error.value = null
    try {
      const { data } = await projectApi.getAll()
      if (data.success && data.data) {
        projects.value = data.data
      }
    } catch (e: any) {
      error.value = e.message || '获取项目列表失败'
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(id: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await projectApi.getById(id)
      if (data.success && data.data) {
        currentProject.value = data.data
      }
    } catch (e: any) {
      error.value = e.message || '获取项目失败'
    } finally {
      loading.value = false
    }
  }

  async function createProject(name: string, description?: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await projectApi.create({ name, description })
      if (data.success && data.data) {
        projects.value.push(data.data)
        return data.data
      }
    } catch (e: any) {
      error.value = e.message || '创建项目失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteProject(id: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await projectApi.delete(id)
      if (data.success) {
        projects.value = projects.value.filter((p) => p.id !== id)
      }
    } catch (e: any) {
      error.value = e.message || '删除项目失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchDocuments(projectId: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await documentApi.getByProject(projectId)
      if (data.success && data.data) {
        documents.value = data.data
      }
    } catch (e: any) {
      error.value = e.message || '获取文档列表失败'
    } finally {
      loading.value = false
    }
  }

  async function uploadDocuments(projectId: string, files: File[]) {
    loading.value = true
    error.value = null
    try {
      const { data } = await documentApi.upload(projectId, files)
      if (data.success && data.data) {
        documents.value.push(...data.data.documents)
        // 更新项目文档数量
        const project = projects.value.find((p) => p.id === projectId)
        if (project) {
          project.documentCount += data.data.uploaded
          project.vectorized = false
        }
        if (currentProject.value?.id === projectId) {
          currentProject.value.documentCount += data.data.uploaded
          currentProject.value.vectorized = false
        }
        return data.data
      }
    } catch (e: any) {
      error.value = e.message || '上传文档失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteDocument(projectId: string, documentId: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await documentApi.delete(projectId, documentId)
      if (data.success) {
        documents.value = documents.value.filter((d) => d.id !== documentId)
        // 更新项目文档数量
        const project = projects.value.find((p) => p.id === projectId)
        if (project) {
          project.documentCount -= 1
        }
        if (currentProject.value?.id === projectId) {
          currentProject.value.documentCount -= 1
        }
      }
    } catch (e: any) {
      error.value = e.message || '删除文档失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    projects,
    currentProject,
    documents,
    loading,
    error,
    projectCount,
    vectorizedCount,
    totalDocuments,
    fetchProjects,
    fetchProject,
    createProject,
    deleteProject,
    fetchDocuments,
    uploadDocuments,
    deleteDocument,
  }
})
