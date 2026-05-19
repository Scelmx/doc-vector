const STOP_WORDS = new Set([
  '的', '了', '是', '在', '和', '与', '或', '及', '等', '这', '那', '有', '为', '以', '对', '中',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'by', 'at', 'from',
])

/** 从文本块提取候选实体/术语（Markdown 加粗、代码、链接等） */
export function extractTermsFromChunk(content: string): string[] {
  const entities = new Set<string>()
  const patterns = [
    /\*\*([^*]+)\*\*/g,
    /`([^`]+)`/g,
    /\[([^\]]+)\]\([^)]+\)/g,
    /「([^」]+)」/g,
    /"([^"]{2,30})"/g,
    /《([^》]+)》/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const term = match[1].trim()
      if (term.length >= 2 && term.length <= 40 && !STOP_WORDS.has(term)) {
        entities.add(term)
      }
    }
  }

  return [...entities].slice(0, 15)
}
