import axios from 'axios'
import type { 
  Project, 
  Document, 
  ApiResponse, 
  CreateProjectRequest, 
  UploadDocumentsResponse,
  VectorizeStatus,
  VectorizeRequest,
  SearchRequest,
  SearchResponse,
  ProjectSearchApiInfo,
} from '@docvec/shared'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

export const projectApi = {
  getAll: () => api.get<ApiResponse<Project[]>>('/projects'),
  getById: (id: string) => api.get<ApiResponse<Project>>(`/projects/${id}`),
  create: (data: CreateProjectRequest) => api.post<ApiResponse<Project>>('/projects', data),
  update: (id: string, data: Partial<CreateProjectRequest>) => api.put<ApiResponse<Project>>(`/projects/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse>(`/projects/${id}`),
}

export const documentApi = {
  getByProject: (projectId: string) => api.get<ApiResponse<Document[]>>(`/documents/${projectId}`),
  getContent: (projectId: string, documentId: string) => api.get<ApiResponse<Document>>(`/documents/${projectId}/${documentId}`),
  upload: (projectId: string, files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => formData.append('files', file))
    return api.post<ApiResponse<UploadDocumentsResponse>>(`/documents/${projectId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  delete: (projectId: string, documentId: string) => api.delete<ApiResponse>(`/documents/${projectId}/${documentId}`),
}

export const vectorApi = {
  getStatus: (projectId: string) => api.get<ApiResponse<VectorizeStatus>>(`/vector/status/${projectId}`),
  vectorize: (projectId: string, config?: VectorizeRequest) =>
    api.post<ApiResponse<VectorizeStatus>>(`/vector/vectorize/${projectId}`, config ?? {}),
  search: (data: SearchRequest) => api.post<ApiResponse<SearchResponse>>('/vector/search', data),
  getSearchApi: (projectId: string) =>
    api.get<ApiResponse<ProjectSearchApiInfo>>(`/vector/search-api/${projectId}`),
  downloadUrl: (projectId: string) => `/api/vector/download/${projectId}`,
}

export default api
