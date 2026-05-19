/** 生成符合 RFC 5987 的 Content-Disposition，避免中文等非 ASCII 字符导致 header 报错 */
export function buildContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download.tar.gz'
  const encoded = encodeURIComponent(filename)
  if (asciiFallback === filename) {
    return `attachment; filename="${asciiFallback}"`
  }
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}
