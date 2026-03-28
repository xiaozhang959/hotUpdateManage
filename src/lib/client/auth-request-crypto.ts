'use client'

import forge from 'node-forge'

interface AuthTransportPublicConfig {
  version: number
  kid: string
  algorithm: string
  publicKey: string
  maxAgeMs: number
}

interface EncryptLoginRequestParams {
  account: string
  password: string
}

let cachedPublicConfig: AuthTransportPublicConfig | null = null
let inflightPublicConfig: Promise<AuthTransportPublicConfig> | null = null

function toBase64Url(binary: string) {
  return forge.util.encode64(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function fetchTransportPublicConfig(force = false) {
  if (!force && cachedPublicConfig) {
    return cachedPublicConfig
  }

  if (!force && inflightPublicConfig) {
    return inflightPublicConfig
  }

  const promise = fetch('/api/auth/transport-key', {
    method: 'GET',
    cache: 'no-store',
  }).then(async (response) => {
    const data = await response.json().catch(() => null)
    if (!response.ok || !data) {
      throw new Error(data?.error || '获取登录加密公钥失败')
    }

    cachedPublicConfig = data as AuthTransportPublicConfig
    return cachedPublicConfig
  }).finally(() => {
    inflightPublicConfig = null
  })

  inflightPublicConfig = promise
  return promise
}

export async function primeAuthTransportPublicConfig() {
  await fetchTransportPublicConfig()
}

export async function encryptLoginRequestPayload(params: EncryptLoginRequestParams) {
  const config = await fetchTransportPublicConfig(true)
  const publicKey = forge.pki.publicKeyFromPem(config.publicKey)
  const aesKey = forge.random.getBytesSync(32)
  const iv = forge.random.getBytesSync(12)
  const ts = Date.now()
  const plaintext = JSON.stringify({
    account: params.account.trim(),
    password: params.password,
    ts,
  })

  const cipher = forge.cipher.createCipher('AES-GCM', aesKey)
  cipher.start({
    iv,
    tagLength: 128,
  })
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(plaintext)))

  if (!cipher.finish()) {
    throw new Error('前端加密失败')
  }

  const encryptedAesKey = publicKey.encrypt(aesKey, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: {
      md: forge.md.sha256.create(),
    },
  })

  return JSON.stringify({
    version: config.version,
    kid: config.kid,
    key: toBase64Url(encryptedAesKey),
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(cipher.output.getBytes()),
    tag: toBase64Url(cipher.mode.tag.getBytes()),
    ts,
  })
}
