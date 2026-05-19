import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import type { Document, Project, UploadDocumentsResponse } from '@docvec/shared'
import { getDocumentFileType, isPlainTextDocument } from '@docvec/shared'
import { PATHS, readJsonFile, writeJsonFile, getProjectDir } from '../../utils/storage.js'
import { ensureExtractedText, readDocumentText } from './parser.js'

/** 项目文档元数据文件路径 */
export function getDocumentsMetaPath(projectId: string): string {
  return path.join(getProjectDir(projectId), 'documents.json')
}

/**
 * 列出项目下全部文档
 */
export function listDocuments(projectId: string): Document[] {
  return readJsonFile<Document[]>(getDocumentsMetaPath(projectId))
}

/**
 * 上传并解析多个文件
 */
export async function uploadDocuments(
  projectId: string,
  files: Express.Multer.File[]
): Promise<UploadDocumentsResponse> {
  const projects = readJsonFile<Project[]>(PATHS.projectsJson)
  const projectIndex = projects.findIndex((p) => p.id === projectId)
  if (projectIndex === -1) {
    throw new Error('项目不存在')
  }

  const projectDir = getProjectDir(projectId)
  const metaPath = getDocumentsMetaPath(projectId)
  const existingDocs = readJsonFile<Document[]>(metaPath)

  const newDocuments: Document[] = []
  const errors: string[] = []

  for (const file of files) {
    try {
      const { textFilename } = await ensureExtractedText(
        projectDir,
        file.filename,
        file.originalname
      )

      newDocuments.push({
        id: uuidv4(),
        projectId,
        filename: file.filename,
        originalName: file.originalname,
        textFilename: textFilename !== file.filename ? textFilename : undefined,
        fileType: getDocumentFileType(file.originalname),
        size: file.size,
        createdAt: new Date().toISOString(),
        vectorized: false,
      })
    } catch (err) {
      const storedPath = path.join(projectDir, file.filename)
      if (fs.existsSync(storedPath)) {
        fs.unlinkSync(storedPath)
      }
      const msg = err instanceof Error ? err.message : '解析失败'
      errors.push(`${file.originalname}: ${msg}`)
    }
  }

  if (newDocuments.length === 0) {
    const errMsg = errors.length > 0 ? errors.join('；') : '没有文件上传成功'
    throw new Error(errMsg)
  }

  const allDocuments = [...existingDocs, ...newDocuments]
  writeJsonFile(metaPath, allDocuments)

  projects[projectIndex].documentCount = allDocuments.length
  projects[projectIndex].updatedAt = new Date().toISOString()
  projects[projectIndex].vectorized = false
  projects[projectIndex].knowledgeGraphBuilt = false
  writeJsonFile(PATHS.projectsJson, projects)

  return {
    uploaded: newDocuments.length,
    failed: files.length - newDocuments.length,
    documents: newDocuments,
    ...(errors.length > 0 ? { message: `部分文件失败：${errors.join('；')}` } : {}),
  }
}

/**
 * 获取文档详情（含正文）
 */
export async function getDocumentWithContent(
  projectId: string,
  documentId: string
): Promise<(Document & { content: string }) | null> {
  const documents = listDocuments(projectId)
  const doc = documents.find((d) => d.id === documentId)
  if (!doc) return null

  const projectDir = getProjectDir(projectId)
  const content = await readDocumentText(projectDir, doc)
  return { ...doc, content }
}

/**
 * 删除文档及磁盘文件
 */
export function deleteDocument(projectId: string, documentId: string): boolean {
  const metaPath = getDocumentsMetaPath(projectId)
  const documents = readJsonFile<Document[]>(metaPath)
  const docIndex = documents.findIndex((d) => d.id === documentId)
  if (docIndex === -1) return false

  const doc = documents[docIndex]
  const projectDir = getProjectDir(projectId)

  const filePath = path.join(projectDir, doc.filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  if (doc.textFilename && doc.textFilename !== doc.filename) {
    const textPath = path.join(projectDir, doc.textFilename)
    if (fs.existsSync(textPath)) {
      fs.unlinkSync(textPath)
    }
  }

  documents.splice(docIndex, 1)
  writeJsonFile(metaPath, documents)

  const projects = readJsonFile<Project[]>(PATHS.projectsJson)
  const projectIndex = projects.findIndex((p) => p.id === projectId)
  if (projectIndex !== -1) {
    projects[projectIndex].documentCount = documents.length
    projects[projectIndex].updatedAt = new Date().toISOString()
    writeJsonFile(PATHS.projectsJson, projects)
  }

  return true
}
