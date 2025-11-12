import crypto from 'crypto'
import type { StorageProvider, PutParams, PutResult, WebDAVConfig } from './types'
import { createReadStream } from 'fs'

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
    async putObject({ projectId, fileName, buffer, filePath, stream }: PutParams): Promise<PutResult> {
      // 计算MD5：优先使用 filePath/stream 以避免大内存
      let md5 = ''
      if (stream) {
        md5 = await new Promise<string>((resolve, reject) => {
          const hash = crypto.createHash('md5')
          stream.on('data', (chunk: Buffer) => hash.update(chunk))
          stream.on('end', () => resolve(hash.digest('hex')))
          stream.on('error', reject)
        })
      } else if (filePath) {
        md5 = await new Promise<string>((resolve, reject) => {
          const hash = crypto.createHash('md5')
          const rs = createReadStream(filePath)
          rs.on('data', (chunk) => hash.update(chunk as Buffer))
          rs.on('end', () => resolve(hash.digest('hex')))
          rs.on('error', reject)
        })
      } else if (buffer) {
        md5 = crypto.createHash('md5').update(buffer).digest('hex')
      } else {
        throw new Error('WEBDAV putObject requires buffer | filePath | stream')
      }
      const dirUrl = `${base}/${joinUrl(root, projectId)}`
      await mkcolIfNeeded(dirUrl, authHeader)

      const encoded = encodeURIComponent(fileName)
      const remotePath = `${base}/${joinUrl(root, projectId, encoded)}`
      const body: any = stream ? stream : (filePath ? createReadStream(filePath) : (buffer as any))
      const init: any = {
        method: 'PUT',
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          'Content-Type': 'application/octet-stream'
        },
        body
      }
      // Node.js (undici) 需要在服务端发送 body 时显式设置 duplex
      // 某些 Node 版本即便是 Buffer 也会要求设置，因此在服务端一律设置
      if (typeof (globalThis as any).window === 'undefined') {
        (init as any).duplex = 'half'
      }
      const res = await fetch(remotePath, init)
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
