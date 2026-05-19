import express from 'express'
import cors from 'cors'
import { projectRouter } from './routes/project.js'
import { documentRouter } from './routes/document.js'
import { vectorRouter } from './routes/vector.js'
import { ensureDataDirs } from './utils/storage.js'

const app = express()
const PORT = process.env.PORT || 3001

// 确保数据目录存在
ensureDataDirs()

// 中间件
app.use(cors())
app.use(express.json())

// API 路由
app.use('/api/projects', projectRouter)
app.use('/api/documents', documentRouter)
app.use('/api/vector', vectorRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use(
  (
    err: Error & { code?: string },
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: '单个文件不能超过 50MB' })
    }
    if (err.message?.includes('不支持的文件类型')) {
      return res.status(400).json({ success: false, error: err.message })
    }
    next(err)
  }
)

app.listen(PORT, () => {
  console.log(`[DocVec Server] 服务器运行在 http://localhost:${PORT}`)
})

export default app
