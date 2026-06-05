import crypto from 'node:crypto'
import type { LanzouConfig } from './client'

const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const LANZOU_PROXY_MODES = new Set(['off', 'all', 'resolve'])

export function generateLanzouSharePassword(length = 4) {
  const bytes = crypto.randomBytes(length)
  let password = ''
  for (const byte of bytes) {
    password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]
  }
  return password
}

export function normalizeLanzouConfig(provider: string, config: unknown): Record<string, unknown> {
  const normalized = isRecord(config) ? { ...config } : {}
  if (provider.trim().toUpperCase() !== 'LANZOU') return normalized

  const sharePassword = String(normalized.sharePassword || '').trim()
  if (sharePassword && (sharePassword.length < 2 || sharePassword.length > 6)) {
    throw new Error('LANZOU sharePassword 长度必须为 2-6 位')
  }
  normalized.sharePassword = sharePassword || generateLanzouSharePassword()

  const proxyMode = String(normalized.proxyMode || 'off').trim().toLowerCase()
  if (!LANZOU_PROXY_MODES.has(proxyMode)) {
    throw new Error('LANZOU proxyMode 只能是 off、all 或 resolve')
  }
  const proxyUrl = String(normalized.proxyUrl || '').trim()
  if (proxyUrl) {
    validateProxyUrl(proxyUrl)
    normalized.proxyUrl = proxyUrl
  } else if (proxyMode !== 'off') {
    throw new Error('LANZOU 开启代理时必须填写 proxyUrl')
  } else {
    delete normalized.proxyUrl
  }
  normalized.proxyMode = proxyMode

  return normalized
}

export function hasLanzouResolveProxy(config: LanzouConfig) {
  return hasLanzouProxy(config, 'resolve')
}

export function hasLanzouAllProxy(config: LanzouConfig) {
  return hasLanzouProxy(config, 'all')
}

function hasLanzouProxy(config: LanzouConfig, scope: 'all' | 'resolve') {
  const proxyUrl = config.proxyUrl?.trim()
  if (!proxyUrl) return false
  const proxyMode = (config.proxyMode || 'off').toLowerCase()
  if (scope === 'all') return proxyMode === 'all'
  return proxyMode === 'all' || proxyMode === 'resolve'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validateProxyUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('LANZOU proxyUrl 格式无效')
  }
  if (parsed.protocol !== 'http:') {
    throw new Error('LANZOU proxyUrl 当前仅支持 http:// 代理')
  }
}
