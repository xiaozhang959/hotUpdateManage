import { createHash, generateKeyPairSync } from 'crypto'
import forge from 'node-forge'

const AUTH_REQUEST_VERSION = 1 as const
const AUTH_REQUEST_MAX_AGE_MS = Number(process.env.AUTH_REQUEST_MAX_AGE_MS || 2 * 60 * 1000)
const AUTH_REQUEST_ALGORITHM = 'RSA-OAEP-256/AES-256-GCM'

interface AuthTransportKeyPair {
  kid: string
  publicKeyPem: string
  privateKeyPem: string
  source: 'env' | 'runtime-generated'
}

export interface EncryptedAuthRequestEnvelope {
  version: typeof AUTH_REQUEST_VERSION
  kid: string
  key: string
  iv: string
  ciphertext: string
  tag: string
  ts: number
}

export interface DecryptedAuthRequestPayload {
  account: string
  password: string
  ts: number
}

let cachedKeyPair: AuthTransportKeyPair | null = null
let hasWarnedAboutRuntimeKeys = false

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

function getAuthTransportKeyPair(): AuthTransportKeyPair {
  if (cachedKeyPair) {
    return cachedKeyPair
  }

  const publicKeyPem = normalizePem(process.env.AUTH_TRANSPORT_PUBLIC_KEY_PEM)
  const privateKeyPem = normalizePem(process.env.AUTH_TRANSPORT_PRIVATE_KEY_PEM)

  if (publicKeyPem && privateKeyPem) {
    cachedKeyPair = {
      kid: buildKid(publicKeyPem),
      publicKeyPem,
      privateKeyPem,
      source: 'env',
    }
    return cachedKeyPair
  }

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

  cachedKeyPair = {
    kid: buildKid(generated.publicKey),
    publicKeyPem: generated.publicKey,
    privateKeyPem: generated.privateKey,
    source: 'runtime-generated',
  }

  if (!hasWarnedAboutRuntimeKeys) {
    hasWarnedAboutRuntimeKeys = true
    console.warn('[auth-request-crypto] 未配置 AUTH_TRANSPORT_PUBLIC_KEY_PEM / AUTH_TRANSPORT_PRIVATE_KEY_PEM，已使用进程内临时密钥；若服务重启或多实例部署，请改为环境变量固定密钥。')
  }

  return cachedKeyPair
}

export function getAuthTransportPublicConfig() {
  const pair = getAuthTransportKeyPair()
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
    throw new Error('登录请求加密数据格式无效')
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
    throw new Error('登录请求加密数据不完整')
  }

  return envelope as EncryptedAuthRequestEnvelope
}

export function decryptAuthRequestPayload(rawPayload: unknown): DecryptedAuthRequestPayload {
  const envelope = parseEncryptedEnvelope(rawPayload)
  const pair = getAuthTransportKeyPair()

  if (envelope.kid !== pair.kid) {
    throw new Error('登录加密密钥已更新，请刷新页面后重试')
  }

  if (Math.abs(Date.now() - envelope.ts) > AUTH_REQUEST_MAX_AGE_MS) {
    throw new Error('登录请求已过期，请刷新页面后重试')
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
    const parsed = JSON.parse(plaintext) as Partial<DecryptedAuthRequestPayload>

    if (typeof parsed.account !== 'string' || typeof parsed.password !== 'string') {
      throw new Error('Missing required auth fields')
    }

    return {
      account: parsed.account.trim(),
      password: parsed.password,
      ts: typeof parsed.ts === 'number' ? parsed.ts : envelope.ts,
    }
  } catch (error) {
    console.error('解密登录请求失败:', error)
    throw new Error('登录请求解密失败，请刷新页面后重试')
  }
}
