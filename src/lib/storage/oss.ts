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
    async putObject({ projectId, fileName, buffer, contentType }: PutParams): Promise<PutResult> {
      const key = `${projectId}/${encodeURIComponent(fileName)}`
      const md5 = crypto.createHash('md5').update(buffer).digest('hex')
      const OSS = (await import('ali-oss')).default
      const client = new OSS({
        region: cfg.region,
        bucket: cfg.bucket,
        accessKeyId: cfg.accessKeyId,
        accessKeySecret: cfg.accessKeySecret,
        ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
        secure: cfg.secure
      })
      await client.put(key, buffer, {
        headers: { 'Content-Type': contentType || 'application/octet-stream' }
      })
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
