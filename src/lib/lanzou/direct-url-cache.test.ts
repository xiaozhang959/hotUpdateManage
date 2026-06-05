import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearLanzouDirectUrlCache,
  getCachedLanzouDirectUrl,
  getLanzouDirectUrlExpirationTime,
} from './direct-url-cache'

describe('lanzou direct url cache', () => {
  afterEach(() => {
    vi.useRealTimers()
    clearLanzouDirectUrlCache()
  })

  it('parses unix seconds e parameter as expiration time', () => {
    const now = 1_700_000_000_000
    const expiresAt = getLanzouDirectUrlExpirationTime('https://example.com/file.apk?e=1700003600', now)
    expect(expiresAt).toBe(1_700_003_600_000)
  })

  it('parses unix milliseconds e parameter as expiration time', () => {
    const now = 1_700_000_000_000
    const expiresAt = getLanzouDirectUrlExpirationTime('https://example.com/file.apk?e=1700003600000', now)
    expect(expiresAt).toBe(1_700_003_600_000)
  })

  it('returns null for missing or expired e parameter', () => {
    const now = 1_700_000_000_000
    expect(getLanzouDirectUrlExpirationTime('https://example.com/file.apk', now)).toBeNull()
    expect(getLanzouDirectUrlExpirationTime('https://example.com/file.apk?e=1699999999', now)).toBeNull()
  })

  it('reuses cached direct url before expiration', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const resolve = vi.fn()
      .mockResolvedValueOnce('https://example.com/file.apk?e=1700003600')
      .mockResolvedValueOnce('https://example.com/file.apk?e=1700007200')

    const first = await getCachedLanzouDirectUrl({
      storageConfigId: 'cfg-1',
      shareUrl: 'https://www.lanzouf.com/iabc',
      sharePassword: '1234',
      resolve,
    })
    const second = await getCachedLanzouDirectUrl({
      storageConfigId: 'cfg-1',
      shareUrl: 'https://www.lanzouf.com/iabc',
      sharePassword: '1234',
      resolve,
    })

    expect(first).toBe('https://example.com/file.apk?e=1700003600')
    expect(second).toBe(first)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent resolve calls', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    let resolvePromise!: (value: string) => void
    const resolve = vi.fn(() => new Promise<string>((resolveInner) => {
      resolvePromise = resolveInner
    }))

    const first = getCachedLanzouDirectUrl({
      storageConfigId: 'cfg-1',
      shareUrl: 'https://www.lanzouf.com/iabc',
      sharePassword: '1234',
      resolve,
    })
    const second = getCachedLanzouDirectUrl({
      storageConfigId: 'cfg-1',
      shareUrl: 'https://www.lanzouf.com/iabc',
      sharePassword: '1234',
      resolve,
    })
    resolvePromise('https://example.com/file.apk?e=1700003600')

    await expect(Promise.all([first, second])).resolves.toEqual([
      'https://example.com/file.apk?e=1700003600',
      'https://example.com/file.apk?e=1700003600',
    ])
    expect(resolve).toHaveBeenCalledTimes(1)
  })
})
