import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import fs from 'fs'
import type { Document, ApiResponse, UploadDocumentsResponse } from '@docvec/shared'
import { isSupportedDocument, SUPPORTED_FORMATS_LABEL } from '@docvec/shared'
import { getProjectDir } from '../utils/storage.js'
import { documentService } from '../services/document/index.js'

export const documentRouter = Router()

const MAX_FILE_SIZE = 50 * 1024 * 1024

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const projectId = req.params.projectId
    const projectDir = getProjectDir(projectId)
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true })
    }
    cb(null, projectDir)
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (isSupportedDocument(file.originalname)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件类型。支持：${SUPPORTED_FORMATS_LABEL}`))
    }
  },
})

documentRouter.get('/:projectId', (req, res) => {
  try {
    const documents = documentService.listDocuments(req.params.projectId)
    res.json({ success: true, data: documents } as ApiResponse<Document[]>)
  } catch {
    res.status(500).json({ success: false, error: '获取文档列表失败' } as ApiResponse)
  }
})

documentRouter.post('/:projectId/upload', upload.array('files', 50), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: '请选择要上传的文件' } as ApiResponse)
    }
    const data = await documentService.uploadDocuments(req.params.projectId, files)
    res.status(201).json({ success: true, data } as ApiResponse<UploadDocumentsResponse>)
  } catch (error) {
    console.error('上传文档失败:', error)
    const message = error instanceof Error ? error.message : '上传文档失败'
    const status = message.includes('不存在') ? 404 : message.includes('没有文件') ? 400 : 500
    res.status(status).json({ success: false, error: message } as ApiResponse)
  }
})

documentRouter.get('/:projectId/:documentId', async (req, res) => {
  try {
    const data = await documentService.getDocumentWithContent(
      req.params.projectId,
      req.params.documentId
    )
    if (!data) {
      return res.status(404).json({ success: false, error: '文档不存在' } as ApiResponse)
    }
    res.json({ success: true, data } as ApiResponse<Document>)
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取文档内容失败'
    res.status(500).json({ success: false, error: message } as ApiResponse)
  }
})

documentRouter.delete('/:projectId/:documentId', (req, res) => {
  try {
    const ok = documentService.deleteDocument(req.params.projectId, req.params.documentId)
    if (!ok) {
      return res.status(404).json({ success: false, error: '文档不存在' } as ApiResponse)
    }
    res.json({ success: true, message: '文档已删除' } as ApiResponse)
  } catch {
    res.status(500).json({ success: false, error: '删除文档失败' } as ApiResponse)
  }
})
