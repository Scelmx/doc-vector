import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')

export const PATHS = {
  data: DATA_DIR,
  projects: path.join(DATA_DIR, 'projects'),
  documents: path.join(DATA_DIR, 'documents'),
  vectors: path.join(DATA_DIR, 'vectors'),
  knowledgeGraphs: path.join(DATA_DIR, 'knowledge-graphs'),
  projectsJson: path.join(DATA_DIR, 'projects.json'),
}

export function ensureDataDirs() {
  for (const p of Object.values(PATHS)) {
    if (!p.endsWith('.json') && !fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true })
    }
  }
  
  // 初始化项目列表文件
  if (!fs.existsSync(PATHS.projectsJson)) {
    fs.writeFileSync(PATHS.projectsJson, JSON.stringify([], null, 2))
  }
}

export function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    return [] as T
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(content) as T
}

export function writeJsonFile(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

export function getProjectDir(projectId: string) {
  return path.join(PATHS.documents, projectId)
}

export function getVectorDir(projectId: string) {
  return path.join(PATHS.vectors, projectId)
}

export function getKnowledgeGraphPath(projectId: string) {
  return path.join(PATHS.knowledgeGraphs, `${projectId}.json`)
}
