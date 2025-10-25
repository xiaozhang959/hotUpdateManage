import { prisma } from '@/lib/prisma'
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

    // 如果是本地或无对象存储信息，则直接重定向到存储的主链接
    if (!version.storageProvider || !version.objectKey) {
      if (version.downloadUrl) {
        return Response.redirect(version.downloadUrl, 302)
      }
      return new Response(JSON.stringify({ error: '该版本无可用下载链接' }), { status: 404 })
    }

    // 优先基于存储配置生成可直接访问的链接
    const storageConfigId = version.storageConfigId
    const provider = version.storageProvider

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
        const url = await getSignedUrl(
          client,
          new GetObjectCommand({ Bucket: conf.bucket, Key: version.objectKey }),
          { expiresIn: 300 }
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
        const url = client.signatureUrl(version.objectKey, { expires: 300 })
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

      const remoteUrl = `${baseUrl}/${[rootPath, version.objectKey].filter(Boolean).join('/')}`
      const upstream = await fetch(remoteUrl, { headers: authHeader ? { Authorization: authHeader } : undefined })
      if (!upstream.ok || !upstream.body) {
        return new Response(JSON.stringify({ error: `远端下载失败: ${upstream.status}` }), { status: upstream.status })
      }

      const fileNameEnc = (version.objectKey.split('/').pop() || 'file')
      const fileName = safeDecodeURIComponent(fileNameEnc)
      const headers = new Headers()
      headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
      headers.set('Content-Length', upstream.headers.get('content-length') || '')
      headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeRFC5987ValueChars(fileName)}`)
      return new Response(upstream.body, { status: 200, headers })
    }

    // 本地存储：直接从本地uploads目录流式返回，避免额外跳转
    if (provider === 'LOCAL' && version.objectKey) {
      const safe = parseLocalObjectKey(version.objectKey)
      if (!safe) {
        return new Response(JSON.stringify({ error: '非法对象键' }), { status: 400 })
      }
      const filePath = path.join(process.cwd(), 'uploads', safe.projectId, safe.fileName)
      const uploadsRoot = path.join(process.cwd(), 'uploads')
      // 目录穿越保护
      const resolved = path.resolve(filePath)
      if (!resolved.startsWith(path.resolve(uploadsRoot))) {
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
