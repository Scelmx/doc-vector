import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

/** 将目录打包为 tar.gz 临时文件，返回文件路径 */
export function createTarGzArchive(sourceDir: string, archiveName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(os.tmpdir(), archiveName)

    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath)
    }

    const proc = spawn('tar', ['-czf', tmpPath, '-C', sourceDir, '.'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('error', (err) => {
      reject(new Error(`打包失败: ${err.message}。请确认系统已安装 tar 命令。`))
    })

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(tmpPath)) {
        resolve(tmpPath)
      } else {
        reject(new Error(stderr || `tar 退出码 ${code}`))
      }
    })
  })
}
