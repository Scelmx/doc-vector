import fs from 'fs'
import path from 'path'
import { getDocumentFileType, isPlainTextDocument } from '@docvec/shared'

/**
 * 剥离 HTML 标签，保留纯文本
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 解析 .docx */
async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ path: filePath })
  return (result.value || '').trim()
}

/** 解析旧版 .doc */
async function extractDoc(filePath: string): Promise<string> {
  const WordExtractor = (await import('word-extractor')).default
  const extractor = new WordExtractor()
  const doc = await extractor.extract(filePath)
  return (doc.getBody() || '').trim()
}

/**
 * 从磁盘文件提取可用于 RAG 的纯文本
 */
export async function extractTextFromFile(
  filePath: string,
  originalName: string
): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${originalName}`)
  }

  const fileType = getDocumentFileType(originalName)

  if (isPlainTextDocument(originalName)) {
    const raw = fs.readFileSync(filePath, 'utf-8')
    if (fileType === 'html') {
      return stripHtml(raw)
    }
    return raw.trim()
  }

  if (fileType === 'word') {
    const ext = path.extname(originalName).toLowerCase()
    if (ext === '.docx') {
      return extractDocx(filePath)
    }
    if (ext === '.doc') {
      return extractDoc(filePath)
    }
    throw new Error(`不支持的 Word 格式: ${ext}`)
  }

  throw new Error(`无法解析的文件类型: ${originalName}`)
}

/**
 * 解析文档对应的文本文件路径（sidecar 或原文件）
 */
export function resolveTextFilePath(
  projectDir: string,
  doc: { filename: string; textFilename?: string }
): string {
  if (doc.textFilename) {
    return path.join(projectDir, doc.textFilename)
  }
  return path.join(projectDir, doc.filename)
}

/**
 * 读取项目内文档的纯文本（优先 sidecar）
 */
export async function readDocumentText(
  projectDir: string,
  doc: { filename: string; originalName: string; textFilename?: string }
): Promise<string> {
  const textPath = resolveTextFilePath(projectDir, doc)

  if (doc.textFilename && fs.existsSync(textPath)) {
    return fs.readFileSync(textPath, 'utf-8').trim()
  }

  if (isPlainTextDocument(doc.originalName)) {
    return fs.readFileSync(textPath, 'utf-8').trim()
  }

  const sourcePath = path.join(projectDir, doc.filename)
  return extractTextFromFile(sourcePath, doc.originalName)
}

/**
 * 上传二进制文档时提取文本并写入 .extracted.txt sidecar
 */
export async function ensureExtractedText(
  projectDir: string,
  storedFilename: string,
  originalName: string
): Promise<{ textFilename: string; extracted: boolean }> {
  if (isPlainTextDocument(originalName)) {
    return { textFilename: storedFilename, extracted: false }
  }

  const sourcePath = path.join(projectDir, storedFilename)
  const text = await extractTextFromFile(sourcePath, originalName)

  if (!text) {
    throw new Error(`未能从文件中提取文本: ${originalName}`)
  }

  const base = path.parse(storedFilename).name
  const textFilename = `${base}.extracted.txt`
  fs.writeFileSync(path.join(projectDir, textFilename), text, 'utf-8')

  return { textFilename, extracted: true }
}
