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
  userId: string
  storageOwnerUserId?: string
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
const SESSIONS_ROOT_RESOLVED = path.resolve(SESSIONS_ROOT)
const UPLOAD_ID_RE = /^[0-9]{13}-[a-z0-9]{8}$/
const STATELESS_UPLOAD_PREFIX = 's3u.'
const DEFAULT_SESSION_TTL_HOURS = Math.max(
  1,
  parseInt(process.env.UPLOAD_SESSION_TTL_HOURS || process.env.NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS || '72', 10) || 72,
)

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await fsp.mkdir(dir, { recursive: true })
}

function safeName(name: string) {
  return name.replace(/[<>:"|?*\\/]/g, '_').replace(/\.{2,}/g, '_').replace(/^\./, '_')
}

function assertSafeUploadId(uploadId: string) {
  if (!UPLOAD_ID_RE.test(uploadId)) throw new Error('invalid uploadId')
}

function isStatelessUploadId(uploadId: string) {
  return uploadId.startsWith(STATELESS_UPLOAD_PREFIX)
}

function getUploadSessionSecret() {
  const secret = process.env.UPLOAD_SESSION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('missing upload session secret')
  }
  return secret
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + padding, 'base64').toString('utf-8')
}

function signPayload(payloadEncoded: string) {
  return crypto.createHmac('sha256', getUploadSessionSecret()).update(payloadEncoded).digest('hex')
}

function createStatelessUploadId(meta: Omit<UploadSessionMeta, 'uploadId'>) {
  const payloadEncoded = toBase64Url(JSON.stringify({
    v: 1,
    exp: Date.now() + DEFAULT_SESSION_TTL_HOURS * 3600 * 1000,
    meta,
  }))
  return `${STATELESS_UPLOAD_PREFIX}${payloadEncoded}.${signPayload(payloadEncoded)}`
}

function loadStatelessSession(uploadId: string): UploadSessionMeta | null {
  if (!isStatelessUploadId(uploadId)) return null

  const token = uploadId.slice(STATELESS_UPLOAD_PREFIX.length)
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex <= 0) throw new Error('invalid uploadId')

  const payloadEncoded = token.slice(0, dotIndex)
  const signature = token.slice(dotIndex + 1)
  const expected = signPayload(payloadEncoded)
  const actualBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error('invalid uploadId')
  }

  const payload = JSON.parse(fromBase64Url(payloadEncoded)) as {
    v?: number
    exp?: number
    meta?: Omit<UploadSessionMeta, 'uploadId'>
  }
  if (!payload?.meta || payload.v !== 1 || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
    throw new Error('upload session expired')
  }

  return {
    uploadId,
    ...payload.meta,
  }
}

function getSessionDir(uploadId: string) {
  assertSafeUploadId(uploadId)
  const dir = path.join(SESSIONS_ROOT, uploadId)
  const resolved = path.resolve(dir)
  if (!resolved.startsWith(SESSIONS_ROOT_RESOLVED + path.sep)) {
    throw new Error('invalid uploadId')
  }
  return resolved
}

export function choosePartSize(fileSize: number) {
  // S3 限制：每段>=5MiB；为兼容通用场景，默认 8MiB；超大文件按上限调整
  const min = 8 * 1024 * 1024
  const maxParts = 10000
  let size = min
  while (Math.ceil(fileSize / size) > maxParts) size *= 2
  return size
}

export async function createSession(params: { userId: string, storageOwnerUserId?: string | null, projectId: string, fileName: string, fileSize: number, contentType?: string, storageConfigId?: string | null, preferSingle?: boolean }) {
  const { userId, projectId } = params
  const storageOwnerUserId = params.storageOwnerUserId || userId
  const active = await getActiveStorageProvider(storageOwnerUserId)
  const specified = params.storageConfigId ? await getProviderByConfigId(params.storageConfigId, storageOwnerUserId) : null
  if (params.storageConfigId && !specified) {
    throw new Error('invalid storageConfigId')
  }
  const providerSelection = specified
    ? { provider: specified, configId: params.storageConfigId || null }
    : active
  const providerName = providerSelection.provider.name
  const partSize = choosePartSize(params.fileSize)
  const totalParts = Math.max(1, Math.ceil(params.fileSize / partSize))

  const safeFileName = safeName(params.fileName)
  const metaBase: Omit<UploadSessionMeta, 'uploadId'> = {
    userId,
    storageOwnerUserId,
    strategy: providerName === 'S3' ? (params.preferSingle ? 'S3_SINGLE' : 'S3_MULTIPART') : (providerName === 'LOCAL' ? 'LOCAL_CHUNK' : 'SERVER_CHUNK_TO_REMOTE'),
    projectId,
    fileName: safeFileName,
    contentType: params.contentType,
    fileSize: params.fileSize,
    partSize,
    totalParts,
    providerName,
    storageConfigId: providerSelection.configId || null,
    objectKey: `${projectId}/${encodeURIComponent(safeFileName)}`,
  }

  // 若是 S3 多段直传，创建 multipart upload 记录
  if (metaBase.strategy === 'S3_MULTIPART') {
    const cfg = metaBase.storageConfigId ? await prisma.storageConfig.findUnique({ where: { id: metaBase.storageConfigId } }) : null
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
      Key: metaBase.objectKey!,
      ContentType: params.contentType || 'application/octet-stream',
    }))
    metaBase.s3UploadId = res.UploadId || null
  }

  // S3 直传会话不落本地磁盘，避免 Vercel 等只读文件系统报错
  if (providerName === 'S3') {
    const uploadId = createStatelessUploadId(metaBase)
    return {
      uploadId,
      ...metaBase,
    }
  }

  if (process.env.VERCEL) {
    throw new Error('当前存储策略依赖服务端本地分片缓存，Vercel 环境请改用 S3 直传')
  }

  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  assertSafeUploadId(uploadId)
  await ensureDir(SESSIONS_ROOT)
  const dir = getSessionDir(uploadId)
  await ensureDir(dir)
  await ensureDir(path.join(dir, 'parts'))

  const meta: UploadSessionMeta = {
    uploadId,
    ...metaBase,
  }

  await fsp.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8')
  return meta
}

export async function loadSession(uploadId: string, expectedUserId?: string): Promise<UploadSessionMeta> {
  const stateless = loadStatelessSession(uploadId)
  if (stateless) {
    if (expectedUserId && (!stateless?.userId || stateless.userId !== expectedUserId)) {
      throw new Error('forbidden')
    }
    return stateless
  }

  const metaPath = path.join(getSessionDir(uploadId), 'meta.json')
  const raw = await fsp.readFile(metaPath, 'utf-8')
  const meta = JSON.parse(raw) as UploadSessionMeta

  if (expectedUserId) {
    if (!meta?.userId || meta.userId !== expectedUserId) {
      throw new Error('forbidden')
    }
  }

  return meta
}

export async function listUploadedParts(uploadId: string): Promise<number[]> {
  if (isStatelessUploadId(uploadId)) return []
  const dir = path.join(getSessionDir(uploadId), 'parts')
  try {
    const files = await fsp.readdir(dir)
    return files.map(f => parseInt(f.replace(/\.part$/, ''), 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b)
  } catch {
    return []
  }
}

export async function writeChunk(uploadId: string, partIndex: number, bodyStream: any) {
  if (isStatelessUploadId(uploadId)) throw new Error('stateless upload does not support chunks')
  const partsDir = path.join(getSessionDir(uploadId), 'parts')
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
  if (isStatelessUploadId(uploadId)) throw new Error('stateless upload does not support server assembly')
  const meta = await loadSession(uploadId)
  const dir = getSessionDir(uploadId)
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
    const p = await getProviderByConfigId(meta.storageConfigId, meta.storageOwnerUserId || meta.userId)
    if (!p) throw new Error('invalid storageConfigId')
    provider = p
  } else {
    const sel = await getActiveStorageProvider(meta.storageOwnerUserId || meta.userId)
    provider = sel.provider
  }
  const put = await provider.putObject({ projectId: meta.projectId, fileName: meta.fileName, filePath: assembled, contentType: meta.contentType || 'application/octet-stream' })
  return put
}

export async function removeSession(uploadId: string) {
  if (isStatelessUploadId(uploadId)) return
  const dir = getSessionDir(uploadId)
  try {
    // 递归删除
    const { rm } = await import('fs/promises')
    await rm(dir, { recursive: true, force: true })
  } catch {}
}
