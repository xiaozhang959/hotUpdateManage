import crypto from 'node:crypto'

const SAFETY_MARGIN_MS = 60_000
const FALLBACK_TTL_MS = 10 * 60_000
const MIN_CACHE_TTL_MS = 5_000
const MAX_CACHE_ENTRIES = 2000

interface CachedDirectUrl {
  url: string
  expiresAt: number
}

const directUrlCache = new Map<string, CachedDirectUrl>()
const resolvingDirectUrls = new Map<string, Promise<string>>()

export interface LanzouDirectUrlCacheParams {
  storageConfigId: string
  shareUrl: string
  sharePassword?: string
  resolve: () => Promise<string>
}

export async function getCachedLanzouDirectUrl(params: LanzouDirectUrlCacheParams) {
  const cacheKey = buildLanzouDirectUrlCacheKey(params.storageConfigId, params.shareUrl, params.sharePassword)
  const cached = getValidCachedDirectUrl(cacheKey)
  if (cached) return cached

  const resolving = resolvingDirectUrls.get(cacheKey)
  if (resolving) return resolving

  const next = params.resolve().then((directUrl) => {
    cacheDirectUrl(cacheKey, directUrl)
    return directUrl
  }).finally(() => {
    resolvingDirectUrls.delete(cacheKey)
  })
  resolvingDirectUrls.set(cacheKey, next)
  return next
}

export function getLanzouDirectUrlExpirationTime(url: string, nowMs = Date.now()) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const rawExpires = parsed.searchParams.get('e')
  if (!rawExpires || !/^\d+$/.test(rawExpires)) return null

  const value = Number(rawExpires)
  if (!Number.isSafeInteger(value) || value <= 0) return null

  const expiresAt = value < 1_000_000_000_000 ? value * 1000 : value
  if (expiresAt <= nowMs) return null
  return expiresAt
}

export function clearLanzouDirectUrlCache() {
  directUrlCache.clear()
  resolvingDirectUrls.clear()
}

function buildLanzouDirectUrlCacheKey(storageConfigId: string, shareUrl: string, sharePassword?: string) {
  return crypto
    .createHash('sha256')
    .update(storageConfigId)
    .update('\0')
    .update(shareUrl)
    .update('\0')
    .update(sharePassword || '')
    .digest('hex')
}

function getValidCachedDirectUrl(cacheKey: string) {
  const cached = directUrlCache.get(cacheKey)
  if (!cached) return null

  if (cached.expiresAt - Date.now() <= MIN_CACHE_TTL_MS) {
    directUrlCache.delete(cacheKey)
    return null
  }
  return cached.url
}

function cacheDirectUrl(cacheKey: string, directUrl: string) {
  const now = Date.now()
  const expiresAt = getLanzouDirectUrlExpirationTime(directUrl, now)
  const effectiveExpiresAt = expiresAt ? expiresAt - SAFETY_MARGIN_MS : now + FALLBACK_TTL_MS
  if (effectiveExpiresAt - now <= MIN_CACHE_TTL_MS) return

  directUrlCache.set(cacheKey, { url: directUrl, expiresAt: effectiveExpiresAt })
  pruneDirectUrlCache()
}

function pruneDirectUrlCache() {
  const now = Date.now()
  for (const [key, value] of directUrlCache) {
    if (value.expiresAt <= now) directUrlCache.delete(key)
  }

  while (directUrlCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = directUrlCache.keys().next().value
    if (!oldestKey) break
    directUrlCache.delete(oldestKey)
  }
}
