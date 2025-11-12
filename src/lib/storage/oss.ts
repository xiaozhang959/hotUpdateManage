import crypto from 'crypto'
import type { StorageProvider, PutParams, PutResult } from './types'

type OSSConfig = {
  region: string
  bucket: string
  accessKeyId: string
  accessKeySecret: string
  endpoint?: string
  secure?: boolean
  publicBaseUrl?: string
}

function buildPublicUrl(cfg: OSSConfig, key: string) {
  if (cfg.publicBaseUrl) {
    return `${cfg.publicBaseUrl.replace(/\/$/,'')}/${key}`
  }
  if (cfg.endpoint) {
    const ep = cfg.endpoint.replace(/^https?:\/\//,'')
    return `https://${cfg.bucket}.${ep}/${key}`
  }
  return `https://${cfg.bucket}.oss-${cfg.region}.aliyuncs.com/${key}`
}

export function createOSSProvider(raw: Partial<OSSConfig>): StorageProvider {
  const cfg: OSSConfig = {
    region: raw.region || '',
    bucket: raw.bucket || '',
    accessKeyId: raw.accessKeyId || '',
    accessKeySecret: raw.accessKeySecret || '',
    endpoint: raw.endpoint,
    secure: raw.secure !== false,
    publicBaseUrl: raw.publicBaseUrl
  }

  return {
    name: 'OSS',
    async putObject({ projectId, fileName, buffer, filePath, stream, contentType }: PutParams): Promise<PutResult> {
      const key = `${projectId}/${encodeURIComponent(fileName)}`
      // 计算MD5（优先stream/filePath，避免大内存）
      let md5 = ''
      if (stream) {
        md5 = await new Promise<string>((resolve, reject) => {
          const hash = crypto.createHash('md5')
          stream.on('data', (chunk: Buffer) => hash.update(chunk))
          stream.on('end', () => resolve(hash.digest('hex')))
          stream.on('error', reject)
        })
      } else if (filePath) {
        const { createReadStream } = await import('fs')
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
        throw new Error('OSS putObject requires buffer | filePath | stream')
      }
      const OSS = (await import('ali-oss')).default
      const client = new OSS({
        region: cfg.region,
        bucket: cfg.bucket,
        accessKeyId: cfg.accessKeyId,
        accessKeySecret: cfg.accessKeySecret,
        ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
        secure: cfg.secure
      })
      if (filePath) {
        await client.put(key, filePath, { headers: { 'Content-Type': contentType || 'application/octet-stream' } })
      } else if (stream) {
        await client.putStream(key, stream, { headers: { 'Content-Type': contentType || 'application/octet-stream' } })
      } else if (buffer) {
        await client.put(key, buffer, { headers: { 'Content-Type': contentType || 'application/octet-stream' } })
      }
      const url = buildPublicUrl(cfg, key)
      return { url, fileName, md5, objectKey: key }
    }
    ,
    async deleteObject({ projectId, objectKey }: { projectId: string; objectKey: string }): Promise<boolean> {
      try {
        const OSS = (await import('ali-oss')).default
        const client = new OSS({
          region: cfg.region,
          bucket: cfg.bucket,
          accessKeyId: cfg.accessKeyId,
          accessKeySecret: cfg.accessKeySecret,
          ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
          secure: cfg.secure
        })
        await client.delete(objectKey)
        return true
      } catch {
        return false
      }
    }
  }
}
