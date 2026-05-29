import { describe, expect, it } from 'vitest'
import { normalizeTimeZone } from './timezone'

describe('normalizeTimeZone', () => {
  it('keeps valid timezone names', () => {
    expect(normalizeTimeZone('UTC')).toBe('UTC')
    expect(normalizeTimeZone('Asia/Shanghai')).toBe('Asia/Shanghai')
  })

  it('trims leading colon and falls back for invalid values', () => {
    expect(normalizeTimeZone(':Asia/Shanghai')).toBe('Asia/Shanghai')
    expect(normalizeTimeZone('not-a-zone', 'UTC')).toBe('UTC')
  })
})
