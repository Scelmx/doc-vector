/**
 * 收集 pkg 运行所需的原生模块与默认数据文件
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')
const assetsRoot = path.join(serverRoot, 'pkg-assets')
const modulesRoot = path.join(assetsRoot, 'node_modules')

/** 随发布包携带的 npm 包（含原生/动态加载） */
const RUNTIME_PACKAGES = [
  'hnswlib-node',
  '@xenova/transformers',
  '@huggingface/jinja',
  'onnxruntime-node',
  'onnxruntime-web',
  'onnxruntime-common',
  'sharp',
]

function rmAndMkdir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, dereference: true })
}

function copyPackage(name) {
  try {
    const pkgJson = require.resolve(`${name}/package.json`)
    const src = path.dirname(pkgJson)
    const dest = path.join(modulesRoot, ...name.split('/'))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    copyDir(src, dest)
    copyNestedModules(src)
    console.log(`[prepare-pkg-assets] + ${name}`)
    return true
  } catch (err) {
    console.warn(`[prepare-pkg-assets] 跳过 ${name}:`, err.message)
    return false
  }
}

/** 复制 pnpm 包目录下的 node_modules（sharp、jinja 等） */
function copyNestedModules(pkgDir) {
  const nested = path.join(pkgDir, 'node_modules')
  if (!fs.existsSync(nested)) return
  for (const ent of fs.readdirSync(nested)) {
    const src = path.join(nested, ent)
    const dest = path.join(modulesRoot, ent)
    if (ent.startsWith('@')) {
      fs.mkdirSync(dest, { recursive: true })
      for (const sub of fs.readdirSync(src)) {
        copyDir(path.join(src, sub), path.join(dest, sub))
      }
    } else {
      copyDir(src, dest)
    }
  }
}

rmAndMkdir(assetsRoot)
fs.mkdirSync(modulesRoot, { recursive: true })

for (const name of RUNTIME_PACKAGES) {
  copyPackage(name)
}

// 默认同义词表
const synonymsSrc = path.join(serverRoot, 'data/synonyms.json')
const synonymsDestDir = path.join(assetsRoot, 'data')
fs.mkdirSync(synonymsDestDir, { recursive: true })
if (fs.existsSync(synonymsSrc)) {
  fs.copyFileSync(synonymsSrc, path.join(synonymsDestDir, 'synonyms.json'))
} else {
  fs.writeFileSync(path.join(synonymsDestDir, 'synonyms.json'), '[]\n')
}

fs.mkdirSync(path.join(assetsRoot, 'data/documents'), { recursive: true })
fs.mkdirSync(path.join(assetsRoot, 'data/vectors'), { recursive: true })
fs.mkdirSync(path.join(assetsRoot, 'data/knowledge-graphs'), { recursive: true })
if (!fs.existsSync(path.join(assetsRoot, 'data/projects.json'))) {
  fs.writeFileSync(path.join(assetsRoot, 'data/projects.json'), '[]\n')
}

console.log('[prepare-pkg-assets] 已写入 pkg-assets/')
