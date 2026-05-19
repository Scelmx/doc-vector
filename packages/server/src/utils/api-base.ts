import type { Request } from 'express'

/** 从请求或环境变量解析对外 API 基址 */
export function getApiBaseUrl(req: Request): string {
  const envUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, '')
  if (envUrl) return envUrl

  const forwardedProto = req.get('x-forwarded-proto')
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol
  const host = req.get('host') || `localhost:${process.env.PORT || 3001}`
  return `${protocol}://${host}`
}
