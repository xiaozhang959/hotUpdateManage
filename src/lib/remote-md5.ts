import { createHash } from 'crypto'
import { existsSync, createReadStream, readdirSync } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'

// Helpers
function normalizeEtag(etag: string | null): string | null {
  if (!etag) return null
  // Strip weak validator and quotes: W/"abcd" -> abcd
  etag = etag.trim()
  if (etag.startsWith('W/')) etag = etag.slice(2)
  etag = etag.replace(/^"|"$/g, '')
  return etag
}

function isHexMd5(str: string | null): str is string {
  return !!str && /^[a-fA-F0-9]{32}$/.test(str)
}

function isMultipartEtag(etag: string | null) {
  return !!etag && etag.includes('-')
}

export function isUploadsUrl(url: string): boolean {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url)
      return u.pathname.startsWith('/uploads/')
    }
    return url.startsWith('/uploads/')
  } catch {
    return false
  }
}

export function getLocalUploadsPathFromUrl(url: string): string | null {
  try {
    // Accept absolute URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url)
      url = u.pathname
    }
    if (!url.startsWith('/uploads/')) return null
    const parts = url.split('/')
    // /uploads/{projectId}/{encodedFileName}
    const projectId = parts[2]
    const encodedName = parts.slice(3).join('/') // support nested segments if any
    const fileName = decodeURIComponent(encodedName)
    const uploadsRoot = path.join(process.cwd(), 'uploads')
    // 首选标准路径：uploads/projectId/file
    let full = path.join(uploadsRoot, projectId, fileName)
    if (existsSync(full)) return full
    // 兼容 baseDir 子目录：uploads/<subDir>/projectId/file
    try {
      const entries = readdirSync(uploadsRoot, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory() && e.name.toLowerCase() !== projectId.toLowerCase()) {
          const candidate = path.join(uploadsRoot, e.name, projectId, fileName)
          if (existsSync(candidate)) return candidate
        }
      }
    } catch {}
    return full
  } catch {
    return null
  }
}

export async function computeLocalFileMd5(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = createHash('md5')
      const rs = createReadStream(absPath)
      rs.on('data', (chunk) => hash.update(chunk))
      rs.on('end', () => resolve(hash.digest('hex')))
      rs.on('error', (err) => reject(err))
    } catch (e) {
      reject(e)
    }
  })
}

export async function headForRemoteMd5(url: string): Promise<{ md5?: string; etag?: string; etagIsMd5?: boolean; source?: string } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal as any })
    if (!res.ok) return null
    const rawEtag = normalizeEtag(res.headers.get('etag'))
    const contentMd5B64 = res.headers.get('content-md5')
    // Prefer Content-MD5 if present
    if (contentMd5B64) {
      try {
        const buf = Buffer.from(contentMd5B64, 'base64')
        const hex = buf.toString('hex')
        if (isHexMd5(hex)) return { md5: hex, source: 'content-md5' }
      } catch {}
    }
    if (rawEtag && !isMultipartEtag(rawEtag) && isHexMd5(rawEtag)) {
      return { md5: rawEtag, etag: rawEtag, etagIsMd5: true, source: 'etag' }
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function getForRemoteMd5(url: string, sizeLimitBytes = 100 * 1024 * 1024): Promise<{ md5?: string; bytes?: number; source?: string } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal as any })
    if (!res.ok || !res.body) return null
    const lenHeader = res.headers.get('content-length')
    if (lenHeader && Number(lenHeader) > sizeLimitBytes) return null
    // If Content-Length unknown, we will guard during read
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    let received = 0
    const hash = createHash('md5')
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) {
        received += value.byteLength
        if (received > sizeLimitBytes) {
          try { reader.cancel() } catch {}
          return null
        }
        hash.update(value)
      }
    }
    return { md5: hash.digest('hex'), bytes: received, source: 'get-stream' }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function resolveMd5ForUrl(url: string, sizeLimitBytes = 100 * 1024 * 1024): Promise<{ md5?: string; from: 'local' | 'etag' | 'content-md5' | 'get-stream'; note?: string } | null> {
  // Local uploads short-circuit
  if (isUploadsUrl(url)) {
    const p = getLocalUploadsPathFromUrl(url)
    if (p && existsSync(p)) {
      const st = await stat(p)
      if (st.isFile()) {
        const md5 = await computeLocalFileMd5(p)
        return { md5, from: 'local' }
      }
    }
  }

  // Remote HEAD first
  const head = await headForRemoteMd5(url)
  if (head?.md5) {
    return { md5: head.md5, from: (head.source as any) || 'etag' }
  }

  // Fallback to GET stream within limit
  const get = await getForRemoteMd5(url, sizeLimitBytes)
  if (get?.md5) {
    return { md5: get.md5, from: 'get-stream' }
  }
  return null
}

/**
 * 解析远程/本地文件大小（字节）。
 * - 本地 `/uploads/*`：直接使用 fs.stat.size
 * - 远程：优先 HEAD 的 `content-length`
 * - 兜底：使用 `Range: bytes=0-0` 获取 `content-range` 的总长度
 */
export async function resolveSizeForUrl(url: string, timeoutMs = 8000): Promise<number | null> {
  // 本地上传：直接读取文件大小
  if (isUploadsUrl(url)) {
    const p = getLocalUploadsPathFromUrl(url)
    if (p && existsSync(p)) {
      try {
        const st = await stat(p)
        if (st.isFile()) return Number(st.size)
      } catch {}
    }
  }

  // 远程：HEAD 优先
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const head = await fetch(url, { method: 'HEAD', signal: controller.signal as any })
    if (head.ok) {
      const len = head.headers.get('content-length')
      const n = len ? Number(len) : NaN
      if (!Number.isNaN(n) && n > 0) return n
    }
  } catch {}
  finally {
    clearTimeout(timer)
  }

  // 兜底：Range 探测
  const controller2 = new AbortController()
  const timer2 = setTimeout(() => controller2.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: controller2.signal as any })
    if (res.status === 206) {
      const cr = res.headers.get('content-range') || '' // e.g. bytes 0-0/12345
      const m = /\/(\d+)$/.exec(cr)
      if (m && m[1]) {
        const total = Number(m[1])
        if (!Number.isNaN(total) && total >= 1) return total
      }
    }
  } catch {}
  finally {
    clearTimeout(timer2)
  }

  return null
}
