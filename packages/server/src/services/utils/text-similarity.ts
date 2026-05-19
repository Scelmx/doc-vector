/** 中文/英文 query 分词（轻量规则） */
export function extractQueryTerms(query: string): string[] {
  const terms = new Set<string>()
  const trimmed = query.trim()
  if (trimmed.length >= 2) terms.add(trimmed)
  for (const part of trimmed.split(/[\s,，。；;、!?！？：:]+/)) {
    if (part.length >= 2 && !STOP_WORDS.has(part)) terms.add(part)
  }
  return [...terms]
}

const STOP_WORDS = new Set([
  '的', '了', '是', '在', '和', '与', '或', '及', '等', '这', '那', '有', '为', '以', '对', '中', '怎么', '如何', '什么',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'by', 'at', 'from', 'how', 'what',
])

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

/** Levenshtein 距离 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const curr = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost)
      row[j - 1] = prev
      prev = curr
    }
    row[b.length] = prev
  }
  return row[b.length]
}

/** 相似度 0~1（基于编辑距离） */
export function editSimilarity(a: string, b: string): number {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length)
    return 0.85 + ratio * 0.1
  }
  const dist = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return Math.max(0, 1 - dist / maxLen)
}

/** 字符二元组 Jaccard，适合中文短词模糊匹配 */
export function bigramJaccard(a: string, b: string): number {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0

  const grams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    if (s.length === 1) set.add(s)
    return set
  }

  const ga = grams(na)
  const gb = grams(nb)
  let inter = 0
  for (const g of ga) {
    if (gb.has(g)) inter++
  }
  const union = ga.size + gb.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * 标签与 query/词项的模糊匹配分 0~1
 * 综合：子串、编辑距离、二元组
 */
export function fuzzyMatchScore(label: string, query: string, terms: string[]): number {
  const lower = label.toLowerCase()
  const qLower = query.toLowerCase()

  if (lower.length >= 2 && (qLower.includes(lower) || lower.includes(qLower))) {
    return 1
  }

  let best = 0
  const candidates = terms.length > 0 ? terms : [query]

  for (const term of candidates) {
    if (term.length < 2) continue
    const tLower = term.toLowerCase()
    if (lower.includes(tLower) || tLower.includes(lower)) {
      best = Math.max(best, 0.88)
      continue
    }

    const edit = editSimilarity(term, label)
    if (edit >= 0.72) best = Math.max(best, 0.55 + edit * 0.4)

    const bi = bigramJaccard(term, label)
    if (bi >= 0.5) best = Math.max(best, 0.45 + bi * 0.45)
  }

  const qEdit = editSimilarity(query, label)
  if (qEdit >= 0.65) best = Math.max(best, 0.5 + qEdit * 0.45)

  const qBi = bigramJaccard(query, label)
  if (qBi >= 0.42) best = Math.max(best, 0.4 + qBi * 0.5)

  return Math.min(1, best)
}
