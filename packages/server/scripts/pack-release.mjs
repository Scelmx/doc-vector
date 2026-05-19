/**
 * 组装 release 目录：可执行文件 + 运行时资源
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')
const releaseRoot = path.join(serverRoot, 'release')

const platform = process.argv[2] || process.platform
const arch = process.argv[3] || process.arch

const targetMap = {
  'darwin-arm64': 'node20-macos-arm64',
  'darwin-x64': 'node20-macos-x64',
  'linux-x64': 'node20-linux-x64',
  'win32-x64': 'node20-win-x64',
}

const key = `${platform}-${arch}`
const pkgTarget = targetMap[key]
if (!pkgTarget) {
  console.error(`不支持的平台: ${key}，可选: ${Object.keys(targetMap).join(', ')}`)
  process.exit(1)
}

const exeName = platform === 'win32' ? 'docvec-server.exe' : 'docvec-server'
const pkgOutDir = path.join(releaseRoot, pkgTarget)

console.log(`[pack] 目标: ${pkgTarget}`)

const publicPkgs =
  '@xenova/transformers,onnxruntime-node,hnswlib-node,sharp,@huggingface/jinja'
execSync(
  `npx @yao-pkg/pkg dist/bundle.cjs --targets ${pkgTarget} --output ${path.join(pkgOutDir, exeName)} --compress GZip --public-packages "${publicPkgs}" --fallback-to-source`,
  { cwd: serverRoot, stdio: 'inherit' }
)

const bundleDir = path.join(releaseRoot, 'docvec-server')
if (fs.existsSync(bundleDir)) fs.rmSync(bundleDir, { recursive: true, force: true })
fs.mkdirSync(bundleDir, { recursive: true })

fs.copyFileSync(path.join(pkgOutDir, exeName), path.join(bundleDir, exeName))
fs.cpSync(path.join(serverRoot, 'pkg-assets'), bundleDir, { recursive: true })

fs.writeFileSync(
  path.join(bundleDir, 'package.json'),
  JSON.stringify({ name: 'docvec-server', private: true, type: 'commonjs' }, null, 2)
)

// 启动脚本
const startSh = `#!/bin/sh
cd "$(dirname "$0")"
export DOCVEC_APP_ROOT="$(pwd)"
export DOCVEC_DATA_DIR="$(pwd)/data"
export NODE_PATH="$(pwd)/node_modules"
exec ./${exeName} "$@"
`
fs.writeFileSync(path.join(bundleDir, 'start.sh'), startSh, { mode: 0o755 })

if (platform === 'win32') {
  const startBat = `@echo off
cd /d "%~dp0"
set DOCVEC_APP_ROOT=%~dp0
set DOCVEC_DATA_DIR=%~dp0data
set NODE_PATH=%~dp0node_modules
${exeName} %*
`
  fs.writeFileSync(path.join(bundleDir, 'start.bat'), startBat)
}

const readme = `# DocVec Server 发布包

## 运行

macOS / Linux:
  ./start.sh

Windows:
  start.bat

或手动设置环境变量后运行 ${exeName}:
  DOCVEC_APP_ROOT=当前目录
  DOCVEC_DATA_DIR=当前目录/data
  PORT=3001

## 目录

- ${exeName}  主程序
- data/       数据目录（项目、文档、向量库）
- node_modules/  原生依赖（hnswlib-node 等，请勿删除）

## 说明

- 首次检索会下载 BGE 等 ONNX 模型，需联网
- 系统需安装 tar（向量库下载打包功能）
`
fs.writeFileSync(path.join(bundleDir, 'README.txt'), readme)

console.log(`[pack] 发布包已生成: ${bundleDir}`)
