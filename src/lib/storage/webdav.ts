import crypto from 'crypto'
import type { StorageProvider, PutParams, PutResult, WebDAVConfig } from './types'

function joinUrl(...parts: string[]) {
  return parts
    .filter(Boolean)
    .map((p) => p.replace(/\/+$/,'').replace(/^\/+/,''))
    .join('/')
}

async function mkcolIfNeeded(baseUrl: string, authHeader: string | null) {
  try {
    const res = await fetch(baseUrl, { method: 'MKCOL', headers: authHeader ? { Authorization: authHeader } : undefined })
    // 201 Created / 405 Method Not Allowed (already exists) / 409 conflict when parent missing
    if (res.status === 201 || res.status === 405 || res.status === 200) return
  } catch {/* ignore */}
}

export function createWebDAVProvider(cfg: WebDAVConfig): StorageProvider {
  const base = cfg.baseUrl.replace(/\/$/, '')
  const publicBase = (cfg.publicBaseUrl || cfg.baseUrl).replace(/\/$/, '')
  const root = (cfg.rootPath || '').replace(/\/+$/,'')
  const authHeader = cfg.username && cfg.password
    ? 'Basic ' + Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')
    : null

  return {
    name: 'WEBDAV',
    async putObject({ projectId, fileName, buffer }: PutParams): Promise<PutResult> {
      const md5 = crypto.createHash('md5').update(buffer).digest('hex')
      const dirUrl = `${base}/${joinUrl(root, projectId)}`
      await mkcolIfNeeded(dirUrl, authHeader)

      const encoded = encodeURIComponent(fileName)
      const remotePath = `${base}/${joinUrl(root, projectId, encoded)}`
      const res = await fetch(remotePath, {
        method: 'PUT',
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          'Content-Type': 'application/octet-stream'
        },
        body: buffer
      })
      if (!res.ok) {
        throw new Error(`WebDAV PUT failed: ${res.status} ${res.statusText}`)
      }
      const url = `${publicBase}/${joinUrl(root, projectId, encoded)}`
      const objectKey = `${projectId}/${encoded}`
      return { url, fileName, md5, objectKey }
    }
    ,
    async deleteObject({ projectId, objectKey }: { projectId: string; objectKey: string }): Promise<boolean> {
      try {
        const parts = objectKey.split('/')
        const encName = parts[1] || ''
        const remotePath = `${base}/${joinUrl(root, projectId, encName)}`
        const res = await fetch(remotePath, { method: 'DELETE', headers: authHeader ? { Authorization: authHeader } : undefined })
        return res.ok || res.status === 404
      } catch {
        return false
      }
    }
  }
}
