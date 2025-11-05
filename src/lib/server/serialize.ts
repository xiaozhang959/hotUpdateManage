// Utilities to safely serialize DB values for JSON responses

export function safeNumberFromBigInt(value: bigint | null | undefined): number | string | null {
  if (value === null || value === undefined) return null
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
  const minSafe = BigInt(Number.MIN_SAFE_INTEGER)
  if (value <= maxSafe && value >= minSafe) {
    return Number(value)
  }
  return value.toString()
}

export function withSerializedSize<T extends { size?: any }>(obj: T): T & { size?: number | string | null } {
  if (!('size' in obj)) return obj as any
  const v = (obj as any).size
  if (typeof v === 'bigint') {
    return { ...obj, size: safeNumberFromBigInt(v as bigint) }
  }
  return obj as any
}
