import { describe, expect, it } from 'vitest'
import { calculateMD5, generateApiKey, generateRandomMD5 } from './crypto'

describe('crypto helpers', () => {
  it('calculates md5 for strings and buffers', () => {
    expect(calculateMD5('hello')).toBe('5d41402abc4b2a76b9719d911017c592')
    expect(calculateMD5(Buffer.from('hello'))).toBe('5d41402abc4b2a76b9719d911017c592')
  })

  it('generates hex tokens with expected lengths', () => {
    expect(generateApiKey()).toMatch(/^[a-f0-9]{64}$/)
    expect(generateRandomMD5()).toMatch(/^[a-f0-9]{32}$/)
  })
})
