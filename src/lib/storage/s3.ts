import crypto from 'crypto'
import type { StorageProvider, PutParams, PutResult } from './types'

type S3Config = {
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
  forcePathStyle?: boolean
  publicBaseUrl?: string
}

function buildPublicUrl(cfg: S3Config, key: string) {
  if (cfg.publicBaseUrl) {
    return `${cfg.publicBaseUrl.replace(/\/$/,'')}/${key}`
  }
  if (cfg.endpoint) {
    const ep = cfg.endpoint.replace(/^https?:\/\//,'')
    if (cfg.forcePathStyle) {
      return `https://${ep}/${cfg.bucket}/${key}`
    }
    return `https://${cfg.bucket}.${ep}/${key}`
  }
  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`
}

export function createS3Provider(raw: Partial<S3Config>): StorageProvider {
  const cfg: S3Config = {
    region: raw.region || '',
    bucket: raw.bucket || '',
    accessKeyId: raw.accessKeyId || '',
    secretAccessKey: raw.secretAccessKey || '',
    endpoint: raw.endpoint,
    forcePathStyle: Boolean(raw.forcePathStyle),
    publicBaseUrl: raw.publicBaseUrl
  }

  return {
    name: 'S3',
    async putObject({ projectId, fileName, buffer, contentType }: PutParams): Promise<PutResult> {
      const key = `${projectId}/${encodeURIComponent(fileName)}`
      const md5 = crypto.createHash('md5').update(buffer).digest('hex')
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const client = new S3Client({
        region: cfg.region,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey
        },
        ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
        ...(cfg.forcePathStyle ? { forcePathStyle: true } : {})
      })
      await client.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream'
      }))
      const url = buildPublicUrl(cfg, key)
      return { url, fileName, md5, objectKey: key }
    }
    ,
    async deleteObject({ projectId, objectKey }: { projectId: string; objectKey: string }): Promise<boolean> {
      try {
        const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
        const client = new S3Client({
          region: cfg.region,
          credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
          ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
          ...(cfg.forcePathStyle ? { forcePathStyle: true } : {})
        })
        await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: objectKey }))
        return true
      } catch {
        return false
      }
    }
  }
}
