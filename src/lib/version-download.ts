import { existsSync, statSync, createReadStream } from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { prisma } from '@/lib/prisma'
import { getConfig } from '@/lib/system-config'
import { normalizeProviderType } from '@/lib/version-artifacts'

export interface DownloadArtifactTarget {
  downloadUrl: string
  storageProvider?: string | null
  objectKey?: string | null
  storageConfigId?: string | null
  fileName?: string | null
}

export async function buildVersionDownloadResponse(target: DownloadArtifactTarget) {
  const provider = normalizeProviderType(target.storageProvider, target.downloadUrl)

  if (!target.downloadUrl) {
    return new Response(JSON.stringify({ error: '该版本无可用下载链接' }), { status: 404 })
  }

  if (!provider || provider === 'LINK') {
    return Response.redirect(target.downloadUrl, 302)
  }

  if (provider === 'S3' || provider === 'OSS') {
    if (!target.storageConfigId) {
      return new Response(JSON.stringify({ error: '存储配置缺失' }), { status: 400 })
    }

    const cfg = await prisma.storageConfig.findUnique({ where: { id: target.storageConfigId } })
    if (!cfg) {
      return new Response(JSON.stringify({ error: '存储配置不存在' }), { status: 404 })
    }
    const conf = cfg.configJson ? JSON.parse(cfg.configJson) : {}
    const objectKey = target.objectKey || deriveObjectKeyFromUrl(target.downloadUrl)
    if (!objectKey) {
      return new Response(JSON.stringify({ error: '对象键缺失' }), { status: 400 })
    }

    if (provider === 'S3') {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const client = new S3Client({
        region: conf.region,
        credentials: conf.accessKeyId ? { accessKeyId: conf.accessKeyId, secretAccessKey: conf.secretAccessKey } : undefined,
        endpoint: conf.endpoint,
        forcePathStyle: Boolean(conf.forcePathStyle),
      })
      const expiresIn = clamp(Number(await getConfig('s3_presign_expire_seconds')) || 3600, 60, 86400)
      const signedUrl = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: conf.bucket, Key: objectKey }),
        { expiresIn },
      )
      return Response.redirect(signedUrl, 302)
    }

    const OSS = (await import('ali-oss')).default
    const client = new OSS({
      region: conf.region,
      bucket: conf.bucket,
      accessKeyId: conf.accessKeyId,
      accessKeySecret: conf.accessKeySecret,
      endpoint: conf.endpoint,
      secure: conf.secure !== false,
    })
    const expires = clamp(Number(await getConfig('oss_presign_expire_seconds')) || 3600, 60, 86400)
    return Response.redirect(client.signatureUrl(objectKey, { expires }), 302)
  }

  if (provider === 'WEBDAV') {
    if (!target.storageConfigId) {
      return new Response(JSON.stringify({ error: '存储配置缺失' }), { status: 400 })
    }
    const cfg = await prisma.storageConfig.findUnique({ where: { id: target.storageConfigId } })
    if (!cfg) {
      return new Response(JSON.stringify({ error: '存储配置不存在' }), { status: 404 })
    }
    const conf = cfg.configJson ? JSON.parse(cfg.configJson) : {}
    const objectKey = target.objectKey || deriveObjectKeyFromUrl(target.downloadUrl)
    if (!objectKey) {
      return new Response(JSON.stringify({ error: '对象键缺失' }), { status: 400 })
    }

    const baseUrl = String(conf.baseUrl || '').replace(/\/$/, '')
    const rootPath = String(conf.rootPath || '').replace(/^\/+|\/+$/g, '')
    const authHeader = conf.username && conf.password
      ? 'Basic ' + Buffer.from(`${conf.username}:${conf.password}`).toString('base64')
      : null

    const upstream = await fetch(`${baseUrl}/${[rootPath, objectKey].filter(Boolean).join('/')}`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: `远端下载失败: ${upstream.status}` }), { status: upstream.status })
    }

    const fileName = target.fileName || safeDecodeURIComponent(objectKey.split('/').pop() || 'file')
    const headers = new Headers()
    headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeRFC5987ValueChars(fileName)}`)
    return new Response(upstream.body, { status: 200, headers })
  }

  if (provider === 'LOCAL') {
    let baseDir = 'uploads'
    let publicPrefix = '/uploads'
    if (target.storageConfigId) {
      const cfg = await prisma.storageConfig.findUnique({ where: { id: target.storageConfigId } })
      if (cfg?.configJson) {
        try {
          const conf = JSON.parse(cfg.configJson)
          if (typeof conf.baseDir === 'string' && conf.baseDir.trim()) baseDir = conf.baseDir.trim()
          if (typeof conf.publicPrefix === 'string' && conf.publicPrefix.trim()) publicPrefix = conf.publicPrefix.trim()
        } catch {
          // ignore invalid local storage config payload
        }
      }
    }

    const objectKey =
      target.objectKey
      || deriveLocalObjectKeyFromUrl(target.downloadUrl, publicPrefix)
      || deriveObjectKeyFromUrl(target.downloadUrl)

    if (!objectKey) {
      return new Response(JSON.stringify({ error: '对象键缺失' }), { status: 400 })
    }

    const safeKey = parseLocalObjectKey(objectKey)
    if (!safeKey) {
      return new Response(JSON.stringify({ error: '非法对象键' }), { status: 400 })
    }

    const subDir = sanitizeSegment(baseDir)
    const uploadsRoot = path.join(process.cwd(), 'uploads')
    const physicalBase = subDir && subDir.toLowerCase() !== 'uploads' ? path.join(uploadsRoot, subDir) : uploadsRoot
    const primaryPath = path.join(physicalBase, safeKey.projectId, safeKey.fileName)
    const legacyRoot = path.join(process.cwd(), baseDir)
    const legacyPath = path.join(legacyRoot, safeKey.projectId, safeKey.fileName)
    const filePath = existsSync(primaryPath) ? primaryPath : legacyPath
    const resolvedPath = path.resolve(filePath)
    const allowedRoot = path.resolve(uploadsRoot)
    const allowedLegacy = path.resolve(legacyRoot)

    if (!resolvedPath.startsWith(allowedRoot) && !resolvedPath.startsWith(allowedLegacy)) {
      return new Response(JSON.stringify({ error: '路径越界' }), { status: 400 })
    }
    if (!existsSync(resolvedPath)) {
      return new Response(JSON.stringify({ error: '文件不存在' }), { status: 404 })
    }

    const stats = statSync(resolvedPath)
    const stream = createReadStream(resolvedPath)
    const headers = new Headers()
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Content-Length', String(stats.size))
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeRFC5987ValueChars(target.fileName || safeKey.fileName)}`)
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers })
  }

  return Response.redirect(target.downloadUrl, 302)
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function encodeRFC5987ValueChars(value: string) {
  return encodeURIComponent(value)
    .replace(/['()*]/g, (char) => '%' + char.charCodeAt(0).toString(16))
    .replace(/%(7C|60|5E)/g, (_match, hex) => '%' + hex)
}

function deriveObjectKeyFromUrl(downloadUrl?: string) {
  if (!downloadUrl) return null
  try {
    const url = downloadUrl.startsWith('http') ? new URL(downloadUrl) : new URL(downloadUrl, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)
    const uploadMatch = pathname.match(/\/(?:api\/)?uploads\/([^/]+)\/(.+)$/)
    if (uploadMatch) {
      return `${uploadMatch[1]}/${uploadMatch[2]}`
    }
    return pathname.replace(/^\//, '')
  } catch {
    return null
  }
}

function deriveLocalObjectKeyFromUrl(downloadUrl?: string, publicPrefix?: string) {
  if (!downloadUrl) return null
  try {
    const url = downloadUrl.startsWith('http') ? new URL(downloadUrl) : new URL(downloadUrl, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)
    const prefix = (publicPrefix || '/uploads').replace(/\/$/, '')
    const matcher = new RegExp('^' + prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '/([^/]+)/(.+)$')
    const match = pathname.match(matcher)
    if (match) {
      return `${match[1]}/${match[2]}`
    }
    return null
  } catch {
    return null
  }
}

function sanitizeSegment(value?: string) {
  return (value || '').replace(/[\\/]/g, '').trim()
}

function parseLocalObjectKey(objectKey: string) {
  const [projectId, ...rest] = objectKey.split('/')
  if (!projectId || rest.length === 0) return null
  const fileName = safeDecodeURIComponent(rest.join('/'))
  if (!fileName || fileName.includes('..') || fileName.includes('\\') || fileName.includes('/')) {
    return null
  }
  return { projectId, fileName }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}
