import { createHash } from 'crypto'
import { existsSync, createReadStream } from 'fs'
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
    const full = path.join(process.cwd(), 'uploads', projectId, fileName)
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

