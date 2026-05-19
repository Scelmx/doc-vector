import fs from 'fs'
import path from 'path'

/** 是否在 pkg 可执行文件内运行 */
export function isPkgRuntime(): boolean {
  return Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg)
}

/**
 * 应用根目录
 * - pkg：可执行文件所在目录
 * - 开发/Node：当前工作目录（请在 packages/server 下启动）
 */
export function getAppRoot(): string {
  if (process.env.DOCVEC_APP_ROOT) {
    return path.resolve(process.env.DOCVEC_APP_ROOT)
  }
  if (isPkgRuntime()) {
    return path.dirname(process.execPath)
  }
  return process.cwd()
}

/**
 * 数据目录（默认 {应用根}/data）
 */
export function getDataDir(): string {
  if (process.env.DOCVEC_DATA_DIR) {
    return path.resolve(process.env.DOCVEC_DATA_DIR)
  }
  return path.join(getAppRoot(), 'data')
}

/** 全局同义词文件路径 */
export function getGlobalSynonymsPath(): string {
  const bundled = path.join(getAppRoot(), 'data', 'synonyms.json')
  if (fs.existsSync(bundled)) return bundled
  return path.join(getDataDir(), 'synonyms.json')
}
