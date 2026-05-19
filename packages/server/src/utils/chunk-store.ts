import fs from 'fs'
import path from 'path'

export interface StoredChunk {
  documentId: string
  filename: string
  chunkIndex: number
  section: string
  content: string
}

/** 从 HNSW docstore 加载全部文本块（供图谱检索使用） */
export function loadChunksFromDocstore(vectorDir: string): StoredChunk[] {
  const docstorePath = path.join(vectorDir, 'docstore.json')
  if (!fs.existsSync(docstorePath)) return []

  const raw = JSON.parse(fs.readFileSync(docstorePath, 'utf-8')) as Array<
    [string, { pageContent: string; metadata: Record<string, unknown> }]
  >

  return raw.map(([, doc]) => ({
    documentId: doc.metadata.documentId as string,
    filename: doc.metadata.filename as string,
    chunkIndex: (doc.metadata.chunkIndex as number) ?? 0,
    section: (doc.metadata.section as string) || '正文',
    content: doc.pageContent,
  }))
}

export function chunkKey(chunk: Pick<StoredChunk, 'documentId' | 'chunkIndex'>): string {
  return `${chunk.documentId}:${chunk.chunkIndex}`
}
