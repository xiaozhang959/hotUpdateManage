import { promises as fsp } from 'fs'
import { existsSync, createWriteStream, createReadStream } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getActiveStorageProvider, getProviderByConfigId } from '@/lib/storage'
import type { StorageProvider } from '@/lib/storage/types'
import { prisma } from '@/lib/prisma'

export type ResumableStrategy = 'LOCAL_CHUNK' | 'SERVER_CHUNK_TO_REMOTE' | 'S3_MULTIPART' | 'S3_SINGLE'

export interface UploadSessionMeta {
  uploadId: string
  strategy: ResumableStrategy
  projectId: string
  fileName: string
  contentType?: string
  fileSize: number
  partSize: number
  totalParts: number
  providerName: string
  storageConfigId?: string | null
  objectKey?: string | null
  // S3
  s3UploadId?: string | null
}

const SESSIONS_ROOT = path.join(process.cwd(), 'uploads', '_sessions')

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await fsp.mkdir(dir, { recursive: true })
}

function safeName(name: string) {
  return name.replace(/[<>:"|?*\\/]/g, '_').replace(/\.{2,}/g, '_').replace(/^\./, '_')
}

export function choosePartSize(fileSize: number) {
  // S3 限制：每段>=5MiB；为兼容通用场景，默认 8MiB；超大文件按上限调整
  const min = 8 * 1024 * 1024
  const maxParts = 10000
  let size = min
  while (Math.ceil(fileSize / size) > maxParts) size *= 2
  return size
}

export async function createSession(params: { userId: string, projectId: string, fileName: string, fileSize: number, contentType?: string, storageConfigId?: string | null, preferSingle?: boolean }) {
  const { userId, projectId } = params
  const active = await getActiveStorageProvider(userId)
  const specified = params.storageConfigId ? await getProviderByConfigId(params.storageConfigId) : null
  const providerSel = specified || active.provider
  const providerName = providerSel.name
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const partSize = choosePartSize(params.fileSize)
  const totalParts = Math.max(1, Math.ceil(params.fileSize / partSize))

  await ensureDir(SESSIONS_ROOT)
  const dir = path.join(SESSIONS_ROOT, uploadId)
  await ensureDir(dir)
  await ensureDir(path.join(dir, 'parts'))

  let meta: UploadSessionMeta = {
    uploadId,
    strategy: providerName === 'S3' ? (params.preferSingle ? 'S3_SINGLE' : 'S3_MULTIPART') : (providerName === 'LOCAL' ? 'LOCAL_CHUNK' : 'SERVER_CHUNK_TO_REMOTE'),
    projectId,
    fileName: safeName(params.fileName),
    contentType: params.contentType,
    fileSize: params.fileSize,
    partSize,
    totalParts,
    providerName,
    storageConfigId: params.storageConfigId || null,
    objectKey: `${projectId}/${encodeURIComponent(safeName(params.fileName))}`,
  }

  // 若是 S3 多段直传，创建 multipart upload 记录
  if (meta.strategy === 'S3_MULTIPART') {
    const cfg = params.storageConfigId ? await prisma.storageConfig.findUnique({ where: { id: params.storageConfigId } }) : null
    const cfgJson = cfg ? JSON.parse(cfg.configJson || '{}') : {}
    const { S3Client, CreateMultipartUploadCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
      region: cfgJson.region,
      credentials: cfgJson.accessKeyId ? { accessKeyId: cfgJson.accessKeyId, secretAccessKey: cfgJson.secretAccessKey } : undefined,
      endpoint: cfgJson.endpoint,
      forcePathStyle: cfgJson.forcePathStyle
    })
    const res = await client.send(new CreateMultipartUploadCommand({
      Bucket: cfgJson.bucket,
      Key: meta.objectKey!,
      ContentType: params.contentType || 'application/octet-stream',
    }))
    meta.s3UploadId = res.UploadId || null
  }

  await fsp.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')
  return meta
}

export async function loadSession(uploadId: string): Promise<UploadSessionMeta> {
  const metaPath = path.join(SESSIONS_ROOT, uploadId, 'meta.json')
  const raw = await fsp.readFile(metaPath, 'utf-8')
  return JSON.parse(raw)
}

export async function listUploadedParts(uploadId: string): Promise<number[]> {
  const dir = path.join(SESSIONS_ROOT, uploadId, 'parts')
  try {
    const files = await fsp.readdir(dir)
    return files.map(f => parseInt(f.replace(/\.part$/, ''), 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b)
  } catch {
    return []
  }
}

export async function writeChunk(uploadId: string, partIndex: number, bodyStream: any) {
  const partsDir = path.join(SESSIONS_ROOT, uploadId, 'parts')
  await ensureDir(partsDir)
  const partPath = path.join(partsDir, `${partIndex}.part`)
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(partPath)
    bodyStream.pipe(ws)
    ws.on('finish', resolve)
    ws.on('error', reject)
    bodyStream.on('error', reject)
  })
}

export async function assembleAndStore(uploadId: string) {
  const meta = await loadSession(uploadId)
  const dir = path.join(SESSIONS_ROOT, uploadId)
  const partsDir = path.join(dir, 'parts')
  const assembled = path.join(dir, 'assembled.tmp')

  // 拼接
  const ws = createWriteStream(assembled)
  for (let i = 0; i < meta.totalParts; i++) {
    const pp = path.join(partsDir, `${i}.part`)
    const rs = createReadStream(pp)
    await new Promise<void>((resolve, reject) => { rs.pipe(ws, { end: false }); rs.on('end', resolve); rs.on('error', reject) })
  }
  await new Promise<void>((resolve) => ws.end(resolve))

  // 调用 provider.putObject(filePath) —— 流式/路径写入
  let provider: StorageProvider
  if (meta.storageConfigId) {
    const p = await getProviderByConfigId(meta.storageConfigId)
    if (!p) throw new Error('invalid storageConfigId')
    provider = p
  } else {
    const sel = await getActiveStorageProvider()
    provider = sel.provider
  }
  const put = await provider.putObject({ projectId: meta.projectId, fileName: meta.fileName, filePath: assembled, contentType: meta.contentType || 'application/octet-stream' })
  return put
}

export async function removeSession(uploadId: string) {
  const dir = path.join(SESSIONS_ROOT, uploadId)
  try {
    // 递归删除
    const { rm } = await import('fs/promises')
    await rm(dir, { recursive: true, force: true })
  } catch {}
}
