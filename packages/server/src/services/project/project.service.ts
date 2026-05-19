import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import type { Project, CreateProjectRequest } from '@docvec/shared'
import {
  PATHS,
  readJsonFile,
  writeJsonFile,
  getProjectDir,
  getVectorDir,
  getKnowledgeGraphPath,
} from '../../utils/storage.js'

/**
 * 获取全部项目
 */
export function listProjects(): Project[] {
  return readJsonFile<Project[]>(PATHS.projectsJson)
}

/**
 * 按 ID 获取项目
 */
export function getProjectById(id: string): Project | undefined {
  return listProjects().find((p) => p.id === id)
}

/**
 * 创建项目及文档目录
 */
export function createProject(input: CreateProjectRequest): Project {
  const projects = listProjects()

  const newProject: Project = {
    id: uuidv4(),
    name: input.name.trim(),
    description: input.description?.trim() || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documentCount: 0,
    vectorized: false,
    knowledgeGraphBuilt: false,
    status: 'pending',
  }

  const projectDir = getProjectDir(newProject.id)
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true })
  }

  projects.push(newProject)
  writeJsonFile(PATHS.projectsJson, projects)
  return newProject
}

/**
 * 更新项目元数据
 */
export function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'description'>>
): Project | null {
  const projects = listProjects()
  const index = projects.findIndex((p) => p.id === id)
  if (index === -1) return null

  if (patch.name) projects[index].name = patch.name.trim()
  if (patch.description !== undefined) {
    projects[index].description = patch.description.trim()
  }
  projects[index].updatedAt = new Date().toISOString()

  writeJsonFile(PATHS.projectsJson, projects)
  return projects[index]
}

/**
 * 删除项目及关联数据（文档目录、向量库、知识图谱）
 */
export function deleteProject(id: string): boolean {
  const projects = listProjects()
  const index = projects.findIndex((p) => p.id === id)
  if (index === -1) return false

  const projectDir = getProjectDir(id)
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true })
  }

  const vectorDir = getVectorDir(id)
  if (fs.existsSync(vectorDir)) {
    fs.rmSync(vectorDir, { recursive: true })
  }

  const kgPath = getKnowledgeGraphPath(id)
  if (fs.existsSync(kgPath)) {
    fs.unlinkSync(kgPath)
  }

  projects.splice(index, 1)
  writeJsonFile(PATHS.projectsJson, projects)
  return true
}
