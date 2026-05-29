import { createHash, generateKeyPairSync } from 'node:crypto'
import forge from 'node-forge'
import { prisma } from '@/lib/prisma'
import {
  AUTH_REQUEST_ALGORITHM,
  AUTH_REQUEST_VERSION,
  type AuthTransportPublicConfig,
  type EncryptedAuthRequestEnvelope,
} from '@/lib/shared/auth-request-contract'

const AUTH_REQUEST_MAX_AGE_MS = Number(process.env.AUTH_REQUEST_MAX_AGE_MS || 2 * 60 * 1000)
const DB_KEY_PAIR_CONFIG_KEY = 'auth_transport_rsa_key_pair'

interface AuthTransportKeyPair {
  kid: string
  publicKeyPem: string
  privateKeyPem: string
  source: 'env' | 'database'
}

interface StoredAuthTransportKeyPair {
  publicKeyPem: string
  privateKeyPem: string
  createdAt: string
}

let cachedKeyPairPromise: Promise<AuthTransportKeyPair> | null = null

function normalizePem(input?: string | null) {
  return input?.replace(/\\n/g, '\n').trim() || ''
}

function toBase64UrlFromBuffer(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64UrlToBinary(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('binary')
}

function buildKid(publicKeyPem: string) {
  return toBase64UrlFromBuffer(createHash('sha256').update(publicKeyPem).digest()).slice(0, 16)
}

function toKeyPair(stored: Pick<StoredAuthTransportKeyPair, 'publicKeyPem' | 'privateKeyPem'>): AuthTransportKeyPair {
  return {
    kid: buildKid(stored.publicKeyPem),
    publicKeyPem: stored.publicKeyPem,
    privateKeyPem: stored.privateKeyPem,
    source: 'database',
  }
}

function parseStoredKeyPair(value: string): AuthTransportKeyPair | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredAuthTransportKeyPair>
    const publicKeyPem = normalizePem(parsed.publicKeyPem)
    const privateKeyPem = normalizePem(parsed.privateKeyPem)

    if (!publicKeyPem || !privateKeyPem) {
      return null
    }

    return toKeyPair({ publicKeyPem, privateKeyPem })
  } catch {
    return null
  }
}

function generateStoredKeyPair(): StoredAuthTransportKeyPair {
  const generated = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })

  return {
    publicKeyPem: generated.publicKey,
    privateKeyPem: generated.privateKey,
    createdAt: new Date().toISOString(),
  }
}

async function readStoredKeyPair() {
  const record = await prisma.systemConfig.findUnique({
    where: { key: DB_KEY_PAIR_CONFIG_KEY },
    select: { value: true },
  })

  return record ? parseStoredKeyPair(record.value) : null
}

async function getDatabaseKeyPair(): Promise<AuthTransportKeyPair> {
  const existing = await readStoredKeyPair()
  if (existing) {
    return existing
  }

  const generated = generateStoredKeyPair()

  try {
    await prisma.systemConfig.create({
      data: {
        key: DB_KEY_PAIR_CONFIG_KEY,
        value: JSON.stringify(generated),
        type: 'string',
        category: 'security',
        description: '自动生成的认证请求 RSA 密钥对；如配置环境变量则优先使用环境变量。',
      },
    })

    return toKeyPair(generated)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const concurrentExisting = await readStoredKeyPair()
      if (concurrentExisting) {
        return concurrentExisting
      }
    }

    throw error
  }
}

async function getAuthTransportKeyPair(): Promise<AuthTransportKeyPair> {
  if (cachedKeyPairPromise) {
    return cachedKeyPairPromise
  }

  cachedKeyPairPromise = (async () => {
    const publicKeyPem = normalizePem(process.env.AUTH_TRANSPORT_PUBLIC_KEY_PEM)
    const privateKeyPem = normalizePem(process.env.AUTH_TRANSPORT_PRIVATE_KEY_PEM)

    if (publicKeyPem && privateKeyPem) {
      return {
        kid: buildKid(publicKeyPem),
        publicKeyPem,
        privateKeyPem,
        source: 'env' as const,
      }
    }

    return getDatabaseKeyPair()
  })().catch((error) => {
    cachedKeyPairPromise = null
    throw error
  })

  return cachedKeyPairPromise
}

export async function getAuthTransportPublicConfig(): Promise<AuthTransportPublicConfig> {
  const pair = await getAuthTransportKeyPair()
  return {
    version: AUTH_REQUEST_VERSION,
    kid: pair.kid,
    algorithm: AUTH_REQUEST_ALGORITHM,
    publicKey: pair.publicKeyPem,
    maxAgeMs: AUTH_REQUEST_MAX_AGE_MS,
  }
}

function parseEncryptedEnvelope(rawPayload: unknown): EncryptedAuthRequestEnvelope {
  const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('加密请求体格式无效')
  }

  const envelope = parsed as Partial<EncryptedAuthRequestEnvelope>

  if (
    envelope.version !== AUTH_REQUEST_VERSION
    || typeof envelope.kid !== 'string'
    || typeof envelope.key !== 'string'
    || typeof envelope.iv !== 'string'
    || typeof envelope.ciphertext !== 'string'
    || typeof envelope.tag !== 'string'
    || typeof envelope.ts !== 'number'
  ) {
    throw new Error('加密请求体不完整')
  }

  return envelope as EncryptedAuthRequestEnvelope
}

export async function decryptAuthRequestData(rawPayload: unknown): Promise<Record<string, unknown>> {
  const envelope = parseEncryptedEnvelope(rawPayload)
  const pair = await getAuthTransportKeyPair()

  if (envelope.kid !== pair.kid) {
    throw new Error('加密密钥已更新，请刷新页面后重试')
  }

  if (Math.abs(Date.now() - envelope.ts) > AUTH_REQUEST_MAX_AGE_MS) {
    throw new Error('加密请求已过期，请刷新页面后重试')
  }

  try {
    const privateKey = forge.pki.privateKeyFromPem(pair.privateKeyPem)
    const aesKey = privateKey.decrypt(fromBase64UrlToBinary(envelope.key), 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    })

    const decipher = forge.cipher.createDecipher('AES-GCM', aesKey)
    decipher.start({
      iv: fromBase64UrlToBinary(envelope.iv),
      tagLength: 128,
      tag: forge.util.createBuffer(fromBase64UrlToBinary(envelope.tag)),
    })
    decipher.update(forge.util.createBuffer(fromBase64UrlToBinary(envelope.ciphertext)))

    if (!decipher.finish()) {
      throw new Error('AES-GCM decrypt failed')
    }

    const plaintext = forge.util.decodeUtf8(decipher.output.getBytes())
    const parsed = JSON.parse(plaintext) as Record<string, unknown>

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Encrypted payload must be a JSON object')
    }

    const payloadTs = typeof parsed.ts === 'number' ? parsed.ts : envelope.ts
    if (Math.abs(Date.now() - payloadTs) > AUTH_REQUEST_MAX_AGE_MS) {
      throw new Error('Payload timestamp expired')
    }

    return parsed
  } catch (error) {
    console.error('解密加密请求失败:', error)
    throw new Error('加密请求解密失败，请刷新页面后重试')
  }
}
