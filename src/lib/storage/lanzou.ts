import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { StorageProvider, PutParams, PutResult } from './types'
import { LanzouClient, type LanzouConfig } from '@/lib/lanzou/client'

export type { LanzouConfig }

export function createLanzouProvider(raw: Partial<LanzouConfig>): StorageProvider {
  const cfg: LanzouConfig = {
    baseUrl: raw.baseUrl,
    shareBaseUrl: raw.shareBaseUrl,
    uploadPath: raw.uploadPath,
    cookie: raw.cookie,
    folderId: raw.folderId ?? -1,
    userAgent: raw.userAgent,
    sharePassword: raw.sharePassword,
    resolverEndpoint: raw.resolverEndpoint,
    timeoutMs: raw.timeoutMs,
  }

  return {
    name: 'LANZOU',
    async putObject({ fileName, buffer, filePath, stream, contentType }: PutParams): Promise<PutResult> {
      if (stream && !buffer && !filePath) {
        throw new Error('LANZOU putObject requires buffer or filePath')
      }

      const md5 = await calculateMd5({ buffer, filePath })
      const client = new LanzouClient(cfg)
      const uploaded = await client.uploadFile({
        folderId: cfg.folderId,
        fileName,
        buffer,
        filePath,
        contentType,
      })

      const fileId = String(uploaded.id)
      const password = cfg.sharePassword?.trim()
      if (password) {
        await client.setFilePassword(fileId, password)
      }

      const share = await client.shareFile(fileId)
      if (!password && share.onof === '1' && share.pwd) {
        throw new Error('蓝奏云返回的分享链接需要提取码，请在 LANZOU 配置中设置 sharePassword 后重试')
      }

      const url = client.buildShareUrl(share) || client.buildShareUrl(uploaded)
      if (!url) {
        throw new Error('LANZOU upload succeeded but share url is missing')
      }

      return {
        url,
        fileName,
        md5,
        objectKey: fileId,
      }
    },
    async deleteObject({ objectKey }: { projectId: string; objectKey: string }): Promise<boolean> {
      try {
        const fileId = objectKey.trim()
        if (!fileId) return false
        return await new LanzouClient(cfg).deleteFile(fileId)
      } catch {
        return false
      }
    },
  }
}

async function calculateMd5(params: Pick<PutParams, 'buffer' | 'filePath'>) {
  if (params.buffer) {
    return crypto.createHash('md5').update(params.buffer).digest('hex')
  }
  if (params.filePath) {
    return new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('md5')
      const rs = createReadStream(params.filePath!)
      rs.on('data', (chunk) => hash.update(chunk as Buffer))
      rs.on('end', () => resolve(hash.digest('hex')))
      rs.on('error', reject)
    })
  }
  throw new Error('LANZOU putObject requires buffer or filePath')
}
