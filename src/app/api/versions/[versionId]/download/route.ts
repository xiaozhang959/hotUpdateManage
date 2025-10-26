import { prisma } from '@/lib/prisma'
import { getConfig } from '@/lib/system-config'
import path from 'path'
import { existsSync, statSync } from 'fs'
import { createReadStream } from 'fs'
import { Readable } from 'stream'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params
    const version = await prisma.version.findUnique({ where: { id: versionId } })
    if (!version) {
      return new Response(JSON.stringify({ error: '版本不存在' }), { status: 404 })
    }
    const url = new URL(req.url)
    const iParam = url.searchParams.get('i')
    const index = Math.max(0, Math.min(Number.isFinite(Number(iParam)) ? Number(iParam) : 0, Math.max(0, (safeParseArray(version.downloadUrls).length - 1))))
    const providersArr = safeParseProviders(version.storageProviders)
    const cur = providersArr[index]

    // 如果明确为 LINK 类型，直接302到对应直链
    if (typeof cur === 'string' ? cur.toUpperCase() === 'LINK' : (cur?.type || '').toUpperCase() === 'LINK') {
      const urls = safeParseArray(version.downloadUrls)
      const target = urls[index] || version.downloadUrl
      if (!target) return new Response(JSON.stringify({ error: '该版本无可用下载链接' }), { status: 404 })
      return Response.redirect(target, 302)
    }

    // 解析当前索引对应的 provider 信息
    const provider = (typeof cur === 'string' ? cur : (cur?.type || version.storageProvider || '')).toUpperCase()
    const storageConfigId = (typeof cur === 'object' && cur?.configId) ? cur.configId : version.storageConfigId
    const objKey = (typeof cur === 'object' && cur?.objectKey) ? cur.objectKey : version.objectKey

    // S3/OSS: 生成预签名 URL 并重定向（有效期 5 分钟）
    if (provider === 'S3' || provider === 'OSS') {
      if (!storageConfigId) {
        return new Response(JSON.stringify({ error: '存储配置缺失' }), { status: 400 })
      }
      const cfg = await prisma.storageConfig.findUnique({ where: { id: storageConfigId } })
      if (!cfg) return new Response(JSON.stringify({ error: '存储配置不存在' }), { status: 404 })
      const conf = cfg.configJson ? JSON.parse(cfg.configJson) : {}

      if (provider === 'S3') {
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
        const client = new S3Client({
          region: conf.region,
          credentials: conf.accessKeyId ? { accessKeyId: conf.accessKeyId, secretAccessKey: conf.secretAccessKey } : undefined,
          endpoint: conf.endpoint,
          forcePathStyle: !!conf.forcePathStyle
        })
        const key = objKey || deriveObjectKeyFromUrl(safeParseArray(version.downloadUrls)[index])
        if (!key) return new Response(JSON.stringify({ error: '对象键缺失' }), { status: 400 })
        const cfgExpire = Number(await getConfig('s3_presign_expire_seconds')) || 3600
        const expiresIn = clamp(cfgExpire, 60, 86400)
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: conf.bucket, Key: key }),
          { expiresIn }
        )
        return Response.redirect(url, 302)
      }

      if (provider === 'OSS') {
        const OSS = (await import('ali-oss')).default
        const client = new OSS({
          region: conf.region,
          bucket: conf.bucket,
          accessKeyId: conf.accessKeyId,
          accessKeySecret: conf.accessKeySecret,
          endpoint: conf.endpoint,
          secure: conf.secure !== false
        })
        const key = objKey || deriveObjectKeyFromUrl(safeParseArray(version.downloadUrls)[index])
        if (!key) return new Response(JSON.stringify({ error: '对象键缺失' }), { status: 400 })
        const cfgExpire = Number(await getConfig('oss_presign_expire_seconds')) || 3600
        const expires = clamp(cfgExpire, 60, 86400)
        const url = client.signatureUrl(key, { expires })
        return Response.redirect(url, 302)
      }
    }

    // WebDAV: 通过服务端代理流式转发，避免客户端认证
    if (provider === 'WEBDAV') {
      if (!storageConfigId) {
        return new Response(JSON.stringify({ error: '存储配置缺失' }), { status: 400 })
      }
      const cfg = await prisma.storageConfig.findUnique({ where: { id: storageConfigId } })
      if (!cfg) return new Response(JSON.stringify({ error: '存储配置不存在' }), { status: 404 })
      const conf = cfg.configJson ? JSON.parse(cfg.configJson) : {}

      const baseUrl: string = (conf.baseUrl || '').replace(/\/$/, '')
      const rootPath: string = (conf.rootPath || '').replace(/^\/+|\/+$/g, '')
      const authHeader = conf.username && conf.password
        ? 'Basic ' + Buffer.from(`${conf.username}:${conf.password}`).toString('base64')
        : null

      const key = objKey || deriveObjectKeyFromUrl(safeParseArray(version.downloadUrls)[index])
      if (!key) return new Response(JSON.stringify({ error: '对象键缺失' }), { status: 400 })
      const remoteUrl = `${baseUrl}/${[rootPath, key].filter(Boolean).join('/')}`
      const upstream = await fetch(remoteUrl, { headers: authHeader ? { Authorization: authHeader } : undefined })
      if (!upstream.ok || !upstream.body) {
        return new Response(JSON.stringify({ error: `远端下载失败: ${upstream.status}` }), { status: upstream.status })
      }

      const fileNameEnc = (key.split('/').pop() || 'file')
      const fileName = safeDecodeURIComponent(fileNameEnc)
      const headers = new Headers()
      headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
      headers.set('Content-Length', upstream.headers.get('content-length') || '')
      headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeRFC5987ValueChars(fileName)}`)
      return new Response(upstream.body, { status: 200, headers })
    }

    // 本地存储：直接从本地目录流式返回，baseDir 来自存储配置（默认为 'uploads'）
    if (provider === 'LOCAL') {
      // 读取本地存储配置（若有），以确定 baseDir 与 publicPrefix
      let baseDir = 'uploads'
      let publicPrefix = '/uploads'
      if (storageConfigId) {
        const cfg = await prisma.storageConfig.findUnique({ where: { id: storageConfigId } })
        if (cfg?.configJson) {
          try {
            const conf = JSON.parse(cfg.configJson)
            if (typeof conf.baseDir === 'string' && conf.baseDir.trim()) baseDir = conf.baseDir.trim()
            if (typeof conf.publicPrefix === 'string' && conf.publicPrefix.trim()) publicPrefix = conf.publicPrefix.trim()
          } catch {}
        }
      }
      // 物理根目录固定为 uploads，baseDir 为其下子目录（兼容 legacy 路径）
      const subDir = sanitizeSegment(baseDir)
      const uploadsRoot = path.join(process.cwd(), 'uploads')
      const physicalBase = subDir && subDir.toLowerCase() !== 'uploads' ? path.join(uploadsRoot, subDir) : uploadsRoot

      let key = objKey
      if (!key) {
        // 兼容旧版本：从直链按 publicPrefix 推导对象键
        key = deriveLocalObjectKeyFromUrl(safeParseArray(version.downloadUrls)[index], publicPrefix) ||
              deriveObjectKeyFromUrl(safeParseArray(version.downloadUrls)[index])
      }
      if (!key) return new Response(JSON.stringify({ error: '对象键缺失' }), { status: 400 })
      const safe = parseLocalObjectKey(key)
      if (!safe) {
        return new Response(JSON.stringify({ error: '非法对象键' }), { status: 400 })
      }
      const primaryPath = path.join(physicalBase, safe.projectId, safe.fileName)
      const legacyRoot = path.join(process.cwd(), baseDir)
      const legacyPath = path.join(legacyRoot, safe.projectId, safe.fileName)
      const filePath = existsSync(primaryPath) ? primaryPath : legacyPath
      // 目录穿越保护
      const resolved = path.resolve(filePath)
      const allowedRoot = path.resolve(uploadsRoot)
      const allowedLegacy = path.resolve(legacyRoot)
      if (!resolved.startsWith(allowedRoot) && !resolved.startsWith(allowedLegacy)) {
        return new Response(JSON.stringify({ error: '路径越界' }), { status: 400 })
      }
      if (!existsSync(resolved)) {
        return new Response(JSON.stringify({ error: '文件不存在' }), { status: 404 })
      }
      const stats = statSync(resolved)
      const stream = createReadStream(resolved)
      const headers = new Headers()
      headers.set('Content-Type', 'application/octet-stream')
      headers.set('Content-Length', String(stats.size))
      headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeRFC5987ValueChars(safe.fileName)}`)
      return new Response(Readable.toWeb(stream) as any, { status: 200, headers })
    }

    // 其他类型：回退到主链接
    if (version.downloadUrl) {
      return Response.redirect(version.downloadUrl, 302)
    }
    return new Response(JSON.stringify({ error: '无法生成下载链接' }), { status: 400 })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || '下载失败' }), { status: 500 })
  }
}

function safeDecodeURIComponent(s: string) {
  try { return decodeURIComponent(s) } catch { return s }
}

// RFC5987 文件名编码
function encodeRFC5987ValueChars(str: string) {
  return encodeURIComponent(str)
    .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))
    .replace(/%(7C|60|5E)/g, (match, hex) => '%' + hex)
}

function safeParseArray(json: any): string[] {
  try {
    const arr = typeof json === 'string' ? JSON.parse(json) : json
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function safeParseProviders(json: any): any[] {
  try {
    const arr = typeof json === 'string' ? JSON.parse(json) : json
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

function deriveObjectKeyFromUrl(u?: string): string | null {
  if (!u) return null
  try {
    // 支持相对与绝对地址
    const url = u.startsWith('http') ? new URL(u) : new URL(u, 'http://localhost')
    const p = decodeURIComponent(url.pathname)
    // /uploads/<projectId>/<file>
    const m = p.match(/\/(?:api\/)?uploads\/([^/]+)\/(.+)$/)
    if (m) return `${m[1]}/${m[2]}`
    // 默认返回去掉前导斜杠的路径（用于 S3/OSS 兼容）
    return p.replace(/^\//, '')
  } catch { return null }
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function deriveLocalObjectKeyFromUrl(u?: string, publicPrefix?: string): string | null {
  if (!u) return null
  try {
    const url = u.startsWith('http') ? new URL(u) : new URL(u, 'http://localhost')
    const p = decodeURIComponent(url.pathname)
    const prefix = (publicPrefix || '/uploads').replace(/\/$/, '')
    const re = new RegExp('^' + prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '/([^/]+)/(.+)$')
    const m = p.match(re)
    if (m) return `${m[1]}/${m[2]}`
    return null
  } catch { return null }
}

function sanitizeSegment(s?: string) {
  return (s || '').replace(/[\\/]/g, '').trim()
}

function parseLocalObjectKey(objectKey: string): { projectId: string; fileName: string } | null {
  try {
    // 形如：projectId/encodedFileName
    const [projectId, ...rest] = objectKey.split('/')
    if (!projectId || rest.length === 0) return null
    const enc = rest.join('/')
    const fileName = safeDecodeURIComponent(enc)
    if (fileName.includes('..') || fileName.includes('\\') || fileName.includes('/')) {
      // 防止目录穿越（文件名中不允许再含路径分隔）
      return null
    }
    return { projectId, fileName }
  } catch {
    return null
  }
}

export const runtime = 'nodejs'
