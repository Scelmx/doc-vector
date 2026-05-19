/**
 * 将服务端打包为单文件 CommonJS，供 pkg 生成可执行文件
 */
import * as esbuild from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')
const repoRoot = path.join(serverRoot, '../..')

/** 含原生模块或动态 require，不打入 bundle，由 release/node_modules 提供 */
const externalNative = [
  'hnswlib-node',
  '@xenova/transformers',
  '@huggingface/jinja',
  'onnxruntime-node',
  'onnxruntime-web',
  'onnxruntime-common',
  'sharp',
]

await esbuild.build({
  entryPoints: [path.join(serverRoot, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(serverRoot, 'dist/bundle.cjs'),
  sourcemap: true,
  minify: false,
  external: externalNative,
  alias: {
    '@docvec/shared': path.join(repoRoot, 'shared/src/index.ts'),
  },
  banner: {
    js: "const __importMetaUrl = require('url').pathToFileURL(__filename).href;",
  },
  define: {
    'import.meta.url': '__importMetaUrl',
  },
  logLevel: 'info',
})

console.log('[esbuild] 已输出 dist/bundle.cjs')
