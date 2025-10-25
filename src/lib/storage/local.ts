import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { StorageProvider, PutParams, PutResult, LocalConfig } from './types'

const defaultCfg: Required<Pick<LocalConfig, 'publicPrefix' | 'baseDir'>> = {
  publicPrefix: '/uploads',
  baseDir: 'uploads'
}

export function createLocalProvider(cfg?: LocalConfig): StorageProvider {
  const config = { ...defaultCfg, ...(cfg || {}) }
  return {
    name: 'LOCAL',
    async putObject({ projectId, fileName, buffer }: PutParams): Promise<PutResult> {
      const uploadDir = path.join(process.cwd(), config.baseDir, projectId)
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }
      const filePath = path.join(uploadDir, fileName)
      await writeFile(filePath, buffer)
      const md5 = crypto.createHash('md5').update(buffer).digest('hex')
      const encoded = encodeURIComponent(fileName)
      const url = `${config.publicPrefix}/${projectId}/${encoded}`
      const objectKey = `${projectId}/${encoded}`
      return { url, fileName, md5, objectKey }
    }
    ,
    async deleteObject({ projectId, objectKey }: { projectId: string; objectKey: string }): Promise<boolean> {
      try {
        // objectKey format: projectId/encodedFileName
        const parts = objectKey.split('/')
        const encName = parts[1] || ''
        const fileName = decodeURIComponent(encName)
        const filePath = path.join(process.cwd(), config.baseDir, projectId, fileName)
        const { unlink } = await import('fs/promises')
        await unlink(filePath)
        return true
      } catch {
        return false
      }
    }
  }
}
