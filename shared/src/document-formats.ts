/** 支持的文档扩展名（小写，含点） */
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  '.md',
  '.markdown',
  '.txt',
  '.doc',
  '.docx',
  '.html',
  '.htm',
] as const

export type SupportedExtension = (typeof SUPPORTED_DOCUMENT_EXTENSIONS)[number]

export type DocumentFileType = 'markdown' | 'text' | 'word' | 'html' | 'unknown'

export function getFileExtension(filename: string): string {
  const lower = filename.toLowerCase()
  const dot = lower.lastIndexOf('.')
  return dot >= 0 ? lower.slice(dot) : ''
}

export function isSupportedDocument(filename: string): boolean {
  const ext = getFileExtension(filename)
  return SUPPORTED_DOCUMENT_EXTENSIONS.includes(ext as SupportedExtension)
}

export function getDocumentFileType(filename: string): DocumentFileType {
  const ext = getFileExtension(filename)
  switch (ext) {
    case '.md':
    case '.markdown':
      return 'markdown'
    case '.txt':
      return 'text'
    case '.doc':
    case '.docx':
      return 'word'
    case '.html':
    case '.htm':
      return 'html'
    default:
      return 'unknown'
  }
}

/** 是否可直接按 UTF-8 文本读取（无需二进制解析） */
export function isPlainTextDocument(filename: string): boolean {
  const type = getDocumentFileType(filename)
  return type === 'markdown' || type === 'text' || type === 'html'
}

export const SUPPORTED_FORMATS_LABEL = 'Markdown、TXT、Word（.doc/.docx）、HTML'

export const SUPPORTED_ACCEPT_ATTR = '.md,.markdown,.txt,.doc,.docx,.html,.htm'
