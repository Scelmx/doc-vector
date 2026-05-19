import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getVectorDir } from '../../utils/storage.js'
import { extractQueryTerms, normalizeText } from '../utils/text-similarity.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GLOBAL_SYNONYMS_PATH = path.join(__dirname, '../../../data/synonyms.json')

/** 项目级同义词文件名（存于 vectorDir） */
export const PROJECT_SYNONYMS_FILE = 'synonyms.json'

/** 内置通用同义词组 */
const DEFAULT_SYNONYM_GROUPS: string[][] = [
  ['退货', '退款', '退换货', '返款', '退回'],
  ['安装', '部署', '配置', '搭建'],
  ['删除', '移除', '清除'],
  ['上传', '导入', '添加'],
  ['下载', '导出', '获取'],
  ['搜索', '检索', '查询', '查找'],
  ['错误', '异常', '报错', '失败'],
  ['文档', '说明', '手册', '指南'],
  ['图标', 'icon', 'symbols'],
  ['发布', '发包', '上线', '部署'],
  ['训练', '向量化', '索引', '构建知识库'],
]

const synonymMapCache = new Map<string, Map<string, string[]>>()

/**
 * 将同义词组展开为 Map：词 -> 同组其它词
 */
function buildSynonymMap(groups: string[][]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const group of groups) {
    const normalized = group.map((w) => w.trim()).filter(Boolean)
    for (const word of normalized) {
      const key = normalizeText(word)
      const related = normalized.filter((w) => normalizeText(w) !== key)
      const existing = map.get(key) ?? []
      map.set(key, [...new Set([...existing, ...related])])
    }
  }
  return map
}

/** 加载全局 + 内置同义词组 */
function loadGlobalSynonymGroups(): string[][] {
  const groups = [...DEFAULT_SYNONYM_GROUPS]
  if (fs.existsSync(GLOBAL_SYNONYMS_PATH)) {
    try {
      const custom = JSON.parse(fs.readFileSync(GLOBAL_SYNONYMS_PATH, 'utf-8')) as string[][]
      if (Array.isArray(custom)) groups.push(...custom)
    } catch {
      console.warn('[QueryExpansion] 全局 synonyms.json 解析失败')
    }
  }
  return groups
}

/** 加载训练时自动生成的项目同义词 */
function loadProjectSynonymGroups(projectId: string): string[][] {
  const synonymsPath = path.join(getVectorDir(projectId), PROJECT_SYNONYMS_FILE)
  if (!fs.existsSync(synonymsPath)) return []
  try {
    const data = JSON.parse(fs.readFileSync(synonymsPath, 'utf-8')) as string[][]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/**
 * 获取合并后的同义词 Map（带缓存）
 */
function getSynonymMap(projectId?: string): Map<string, string[]> {
  const cacheKey = projectId ?? '__global__'
  let map = synonymMapCache.get(cacheKey)
  if (!map) {
    const groups = loadGlobalSynonymGroups()
    if (projectId) groups.push(...loadProjectSynonymGroups(projectId))
    map = buildSynonymMap(groups)
    synonymMapCache.set(cacheKey, map)
  }
  return map
}

/** 训练完成后清除同义词缓存 */
export function clearProjectSynonymCache(projectId: string) {
  synonymMapCache.delete(projectId)
  synonymMapCache.delete('__global__')
}

/** 项目同义词文件路径 */
export function getProjectSynonymsPath(projectId: string): string {
  return path.join(getVectorDir(projectId), PROJECT_SYNONYMS_FILE)
}

/**
 * 基于同义词表扩展 query（全局 + 项目自动挖掘）
 */
export function expandWithSynonyms(query: string, projectId?: string): string[] {
  const map = getSynonymMap(projectId)
  const terms = extractQueryTerms(query)
  const extras = new Set<string>()

  for (const term of terms) {
    const related = map.get(normalizeText(term))
    if (related) related.forEach((r) => extras.add(r))
  }

  if (query.length <= 20) {
    const related = map.get(normalizeText(query))
    if (related) related.forEach((r) => extras.add(r))
  }

  return [...extras]
}

/**
 * 生成多路检索 query（原问 + 同义词 + 图谱词 + 拆词）
 */
export function buildSearchQueries(
  query: string,
  graphTerms: string[] = [],
  maxQueries = 6,
  projectId?: string
): string[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const queries = new Set<string>()
  queries.add(trimmed)

  const synonyms = expandWithSynonyms(trimmed, projectId)
  for (const syn of synonyms.slice(0, 4)) {
    queries.add(`${trimmed} ${syn}`)
    queries.add(syn)
  }

  if (graphTerms.length > 0) {
    queries.add(`${trimmed} ${graphTerms.slice(0, 6).join(' ')}`)
    for (const term of graphTerms.slice(0, 3)) {
      queries.add(`${trimmed} ${term}`)
    }
  }

  const terms = extractQueryTerms(trimmed)
  for (const term of terms) {
    if (term !== trimmed && term.length >= 2) {
      queries.add(term)
      const termSyns = expandWithSynonyms(term, projectId)
      for (const syn of termSyns.slice(0, 2)) {
        queries.add(`${term} ${syn}`)
      }
    }
  }

  return [...queries].filter((q) => q.length >= 2).slice(0, maxQueries)
}
