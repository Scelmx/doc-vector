import { Router } from 'express'
import type { Project, ApiResponse, CreateProjectRequest } from '@docvec/shared'
import { projectService } from '../services/project/index.js'

export const projectRouter = Router()

projectRouter.get('/', (_req, res) => {
  try {
    const projects = projectService.listProjects()
    res.json({ success: true, data: projects } as ApiResponse<Project[]>)
  } catch {
    res.status(500).json({ success: false, error: '获取项目列表失败' } as ApiResponse)
  }
})

projectRouter.get('/:id', (req, res) => {
  try {
    const project = projectService.getProjectById(req.params.id)
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' } as ApiResponse)
    }
    res.json({ success: true, data: project } as ApiResponse<Project>)
  } catch {
    res.status(500).json({ success: false, error: '获取项目失败' } as ApiResponse)
  }
})

projectRouter.post('/', (req, res) => {
  try {
    const body = req.body as CreateProjectRequest
    if (!body.name || !body.name.trim()) {
      return res.status(400).json({ success: false, error: '项目名称不能为空' } as ApiResponse)
    }
    const newProject = projectService.createProject(body)
    res.status(201).json({ success: true, data: newProject } as ApiResponse<Project>)
  } catch {
    res.status(500).json({ success: false, error: '创建项目失败' } as ApiResponse)
  }
})

projectRouter.put('/:id', (req, res) => {
  try {
    const updated = projectService.updateProject(req.params.id, req.body)
    if (!updated) {
      return res.status(404).json({ success: false, error: '项目不存在' } as ApiResponse)
    }
    res.json({ success: true, data: updated } as ApiResponse<Project>)
  } catch {
    res.status(500).json({ success: false, error: '更新项目失败' } as ApiResponse)
  }
})

projectRouter.delete('/:id', (req, res) => {
  try {
    const ok = projectService.deleteProject(req.params.id)
    if (!ok) {
      return res.status(404).json({ success: false, error: '项目不存在' } as ApiResponse)
    }
    res.json({ success: true, message: '项目已删除' } as ApiResponse)
  } catch {
    res.status(500).json({ success: false, error: '删除项目失败' } as ApiResponse)
  }
})
