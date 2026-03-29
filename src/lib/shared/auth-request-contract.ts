export const AUTH_REQUEST_VERSION = 1 as const
export const AUTH_REQUEST_ALGORITHM = 'RSA-OAEP-256/AES-256-GCM'

export interface AuthTransportPublicConfig {
  version: typeof AUTH_REQUEST_VERSION
  kid: string
  algorithm: typeof AUTH_REQUEST_ALGORITHM
  publicKey: string
  maxAgeMs: number
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
