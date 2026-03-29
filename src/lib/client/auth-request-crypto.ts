'use client'

import forge from 'node-forge'
import type { AuthTransportPublicConfig } from '@/lib/shared/auth-request-contract'

function toBase64Url(binary: string) {
  return forge.util.encode64(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function encryptAuthRequestPayload<T extends Record<string, unknown>>(
  config: AuthTransportPublicConfig,
  payload: T,
) {
  const publicKey = forge.pki.publicKeyFromPem(config.publicKey)
  const aesKey = forge.random.getBytesSync(32)
  const iv = forge.random.getBytesSync(12)
  const ts = Date.now()
  const plaintext = JSON.stringify({
    ...payload,
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
