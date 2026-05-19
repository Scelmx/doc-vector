import type { SearchResult, SearchResultSource } from '@docvec/shared'
import { chunkKey, type StoredChunk } from '../../../utils/chunk-store.js'
import { RETRIEVAL_CONFIG } from './config.js'
import type { RankedSearchResult } from './types.js'

const { RRF_K } = RETRIEVAL_CONFIG

/**
 * 单路多 query 结果的 RRF 合并（图谱或同类列表）
 */
export function mergeRankedListsWithRrf(
  lists: SearchResult[][],
  source: SearchResultSource
): RankedSearchResult[] {
  const byKey = new Map<string, RankedSearchResult>()

  for (const list of lists) {
    list.forEach((item, rank) => {
      const key = resultKey(item)
      const rrfBoost = 1 / (RRF_K + rank + 1)
      const existing = byKey.get(key)
      if (existing) {
        existing.rrf = (existing.rrf ?? 0) + rrfBoost
        existing.score = Math.max(existing.score, item.score)
      } else {
        byKey.set(key, { ...item, source, rrf: rrfBoost })
      }
    })
  }

  return [...byKey.values()].sort((a, b) => (b.rrf ?? 0) - (a.rrf ?? 0))
}

/**
 * 向量路 + 图谱路 双路 RRF 融合
 */
export function fuseVectorAndGraph(
  vectorResults: SearchResult[],
  graphResults: SearchResult[],
  limit: number
): RankedSearchResult[] {
  const byKey = new Map<string, RankedSearchResult & { sources: Set<string> }>()

  const addList = (list: SearchResult[], source: SearchResultSource) => {
    list.forEach((item, rank) => {
      const key = resultKey(item)
      const rrfBoost = 1 / (RRF_K + rank + 1)
      const existing = byKey.get(key)
      if (existing) {
        existing.rrf = (existing.rrf ?? 0) + rrfBoost
        existing.sources.add(source)
        existing.score = Math.max(existing.score, item.score)
      } else {
        byKey.set(key, {
          ...item,
          rrf: rrfBoost,
          sources: new Set([source]),
          source: item.source ?? source,
        })
      }
    })
  }

  addList(vectorResults, 'vector')
  addList(graphResults, 'graph')

  return [...byKey.values()]
    .sort((a, b) => (b.rrf ?? 0) - (a.rrf ?? 0))
    .slice(0, limit)
    .map(({ rrf, sources, ...item }) => ({
      ...item,
      source: resolveSource(sources, item.source),
      rrf,
    }))
}

/** 根据命中来源集合解析最终 source 标签 */
function resolveSource(
  sources: Set<string>,
  fallback?: SearchResultSource
): SearchResultSource {
  if (sources.size > 1) return 'both'
  if (sources.has('vector')) return 'vector'
  if (sources.has('graph')) return 'graph'
  return fallback ?? 'vector'
}

/** 生成 chunk 唯一键 */
export function resultKey(item: Pick<SearchResult, 'documentId' | 'chunkIndex'>): string {
  return `${item.documentId}:${item.chunkIndex ?? 0}`
}

/**
 * 向量多 query 合并后的分数归一化
 */
export function mergeVectorQueryResults(
  byKey: Map<string, RankedSearchResult & { bestScore: number }>
): SearchResult[] {
  return [...byKey.values()]
    .sort((a, b) => (b.rrf ?? 0) - (a.rrf ?? 0))
    .map(({ rrf, bestScore, ...item }) => ({
      ...item,
      score: Math.round(Math.min(1, bestScore * 0.6 + (rrf ?? 0) * 6) * 1000) / 1000,
    }))
}

/** StoredChunk 唯一键 */
export function chunkResultKey(chunk: StoredChunk): string {
  return chunkKey(chunk)
}
