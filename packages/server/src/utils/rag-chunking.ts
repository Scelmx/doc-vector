/**
 * RAG 标准分块：Markdown 结构感知 + 递归字符切分
 */
export interface RagChunk {
  content: string
  metadata: {
    documentId: string
    filename: string
    chunkIndex: number
    section?: string
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 按 Markdown 标题切分为章节 */
function splitByMarkdownSections(text: string): Array<{ section: string; body: string }> {
  const lines = text.split('\n')
  const sections: Array<{ section: string; body: string }> = []
  let currentSection = '正文'
  let buffer: string[] = []

  const flush = () => {
    const body = buffer.join('\n').trim()
    if (body) sections.push({ section: currentSection, body })
    buffer = []
  }

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      flush()
      currentSection = headerMatch[2].trim()
    } else {
      buffer.push(line)
    }
  }
  flush()

  return sections.length > 0 ? sections : [{ section: '正文', body: text }]
}

function slidingWindowChunks(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = []
  const safeOverlap = Math.min(overlap, chunkSize - 1)
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    const piece = text.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= text.length) break
    const next = end - safeOverlap
    start = next > start ? next : end
  }

  return chunks
}

function splitSectionBody(body: string, chunkSize: number, overlap: number): string[] {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let buffer = ''

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      if (buffer.trim()) {
        chunks.push(buffer.trim())
        buffer = ''
      }
      chunks.push(...slidingWindowChunks(para, chunkSize, overlap))
      continue
    }

    const candidate = buffer ? `${buffer}\n\n${para}` : para
    if (candidate.length > chunkSize) {
      if (buffer.trim()) chunks.push(buffer.trim())
      buffer = para
    } else {
      buffer = candidate
    }
  }

  if (buffer.trim()) chunks.push(buffer.trim())
  return chunks
}

/**
 * 将文档内容切分为带元数据的 RAG chunks
 */
export function buildRagChunks(
  content: string,
  documentId: string,
  filename: string,
  chunkSize: number,
  chunkOverlap: number
): RagChunk[] {
  const cleaned = cleanText(content)
  if (!cleaned) return []

  const sections = splitByMarkdownSections(cleaned)
  const chunks: RagChunk[] = []
  let globalIndex = 0

  for (const { section, body } of sections) {
    const pieces = splitSectionBody(body, chunkSize, chunkOverlap)
    for (const piece of pieces) {
      chunks.push({
        content: piece,
        metadata: {
          documentId,
          filename,
          chunkIndex: globalIndex++,
          section,
        },
      })
    }
  }

  return chunks
}
