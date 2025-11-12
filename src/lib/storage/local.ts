import { writeFile, mkdir, rename, stat } from 'fs/promises'
import { existsSync, createReadStream, createWriteStream } from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { StorageProvider, PutParams, PutResult, LocalConfig } from './types'

const defaultCfg: Required<Pick<LocalConfig, 'publicPrefix' | 'baseDir'>> = {
  publicPrefix: '/uploads',
  baseDir: 'uploads'
}

export function createLocalProvider(cfg?: LocalConfig): StorageProvider {
  const config = { ...defaultCfg, ...(cfg || {}) }
  const sanitize = (s?: string) => (s || '').replace(/[\\/]/g, '').trim()
  // 将所有本地文件统一归档到 uploads 根目录下；baseDir 作为其下的子目录（可为空）
  const subDir = (() => {
    const sd = sanitize(config.baseDir)
    if (!sd || sd.toLowerCase() === 'uploads') return ''
    return sd
  })()
  const uploadsRoot = path.join(process.cwd(), 'uploads')
  const physicalBaseDir = subDir ? path.join(uploadsRoot, subDir) : uploadsRoot
  return {
    name: 'LOCAL',
    async putObject({ projectId, fileName, buffer, filePath, stream }: PutParams): Promise<PutResult> {
      const uploadDir = path.join(physicalBaseDir, projectId)
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }
      const destPath = path.join(uploadDir, fileName)

      let md5 = ''
      if (stream) {
        // 单次流式写入并计算MD5
        await new Promise<void>((resolve, reject) => {
          const hash = crypto.createHash('md5')
          const ws = createWriteStream(destPath)
          stream.on('data', (chunk: Buffer) => hash.update(chunk))
          stream.pipe(ws)
          ws.on('finish', () => { md5 = hash.digest('hex'); resolve() })
          ws.on('error', reject)
          stream.on('error', reject)
        })
      } else if (filePath) {
        await rename(filePath, destPath)
        // 再次读取计算MD5（避免占用内存）
        md5 = await new Promise<string>((resolve, reject) => {
          const hash = crypto.createHash('md5')
          const rs = createReadStream(destPath)
          rs.on('data', (chunk) => hash.update(chunk as Buffer))
          rs.on('end', () => resolve(hash.digest('hex')))
          rs.on('error', reject)
        })
      } else if (buffer) {
        await writeFile(destPath, buffer)
        md5 = crypto.createHash('md5').update(buffer).digest('hex')
      } else {
        throw new Error('LOCAL putObject requires buffer | filePath | stream')
      }
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
        // 优先新规范路径（uploads[/subDir]/projectId/fileName）
        const primary = path.join(physicalBaseDir, projectId, fileName)
        const legacy = path.join(process.cwd(), config.baseDir, projectId, fileName)
        const filePath = existsSync(primary) ? primary : legacy
        const { unlink } = await import('fs/promises')
        await unlink(filePath)
        return true
      } catch {
        return false
      }
    }
  }
}
