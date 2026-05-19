/**
 * 将 Vite 构建产物复制到 release/web
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.join(__dirname, '..')
const distDir = path.join(webRoot, 'dist')
const releaseDir = path.join(webRoot, 'release/web')

if (!fs.existsSync(distDir)) {
  console.error('请先执行 pnpm build（生成 packages/web/dist）')
  process.exit(1)
}

if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true })
}
fs.mkdirSync(path.dirname(releaseDir), { recursive: true })
fs.cpSync(distDir, releaseDir, { recursive: true })

const readme = `# DocVec Web 静态资源

将本目录交由 Nginx / Caddy 托管，并将 /api 反向代理到后端服务。

示例:
  location /api/ {
    proxy_pass http://127.0.0.1:3001;
  }
`
fs.writeFileSync(path.join(releaseDir, 'README.txt'), readme)

console.log(`[pack] 前端发布包: ${releaseDir}`)
