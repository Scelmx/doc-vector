import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import { createRequire } from 'module'
import { getAppRoot } from './runtime-paths.js'

export type TransformersModule = typeof import('@huggingface/transformers')

let cached: TransformersModule | null = null

const TRANSFORMERS_ENTRY = path.join(
  '@huggingface',
  'transformers',
  'dist',
  'transformers.node.mjs'
)

/**
 * 解析 Transformers 入口（pkg 必须从磁盘加载，不能打进 snapshot）
 */
export function resolveTransformersEntry(): string {
  const roots = [getAppRoot(), process.cwd(), path.join(getAppRoot(), '..')]

  for (const root of roots) {
    const full = path.join(root, 'node_modules', TRANSFORMERS_ENTRY)
    if (fs.existsSync(full)) return full
  }

  for (const pkgJson of [
    path.join(getAppRoot(), 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ]) {
    if (!fs.existsSync(pkgJson)) continue
    const req = createRequire(pkgJson)
    try {
      return req.resolve('@huggingface/transformers/dist/transformers.node.mjs')
    } catch {
      /* try next */
    }
  }

  throw new Error(
    '未找到 @huggingface/transformers，请确认 release 目录下 node_modules 完整，或在开发环境执行 pnpm install'
  )
}

/** 从文件系统动态加载 transformers（避免 pkg 将 ESM 打入 snapshot） */
export async function loadTransformers(): Promise<TransformersModule> {
  if (cached) return cached
  const entry = resolveTransformersEntry()
  cached = (await import(pathToFileURL(entry).href)) as TransformersModule
  return cached
}
