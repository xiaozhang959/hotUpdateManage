import { describe, expect, it } from 'vitest'
import { safeNumberFromBigInt, withSerializedSize } from './serialize'

describe('BigInt serialization helpers', () => {
  it('keeps safe BigInt values as numbers', () => {
    expect(safeNumberFromBigInt(BigInt(123))).toBe(123)
    expect(withSerializedSize({ size: BigInt(123) })).toEqual({ size: 123 })
  })

  it('serializes unsafe BigInt values as strings', () => {
    const unsafe = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)
    expect(safeNumberFromBigInt(unsafe)).toBe(unsafe.toString())
    expect(withSerializedSize({ id: 'file', size: unsafe })).toEqual({ id: 'file', size: unsafe.toString() })
  })

  it('keeps null and missing size values stable', () => {
    expect(safeNumberFromBigInt(null)).toBeNull()
    expect(withSerializedSize({ id: 'file', size: null })).toEqual({ id: 'file', size: null })
    expect(withSerializedSize({ id: 'file' })).toEqual({ id: 'file' })
  })
})
