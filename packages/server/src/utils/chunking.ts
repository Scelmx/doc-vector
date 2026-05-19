/**
 * 将文本分割为块。优先按段落聚合，超长段落使用字符级滑动窗口（适配中文）。
 */
export function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  if (normalized.length <= chunkSize) return [normalized]

  const safeOverlap = Math.min(overlap, chunkSize - 1)
  const chunks: string[] = []
  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)

  let buffer = ''

  const flushBuffer = () => {
    if (buffer.trim()) {
      chunks.push(buffer.trim())
      buffer = ''
    }
  }

  const pushSlidingChunks = (content: string) => {
    let start = 0
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length)
      const piece = content.slice(start, end).trim()
      if (piece) chunks.push(piece)
      if (end >= content.length) break
      const nextStart = end - safeOverlap
      start = nextStart > start ? nextStart : end
    }
  }

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      flushBuffer()
      pushSlidingChunks(para)
      continue
    }

    const candidate = buffer ? `${buffer}\n\n${para}` : para
    if (candidate.length > chunkSize) {
      flushBuffer()
      buffer = para
    } else {
      buffer = candidate
    }
  }

  flushBuffer()
  return chunks.length > 0 ? chunks : [normalized]
}

/** 将 hnswlib 余弦距离转为 0~1 相似度 */
export function cosineDistanceToSimilarity(distance: number): number {
  const similarity = 1 - distance
  return Math.max(0, Math.min(1, similarity))
}
