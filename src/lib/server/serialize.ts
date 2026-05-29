// Utilities to safely serialize DB values for JSON responses

type SerializableSize = bigint | number | string | null | undefined
type WithSerializedSize<T> = Omit<T, 'size'> & { size?: number | string | null }

export function safeNumberFromBigInt(value: bigint | null | undefined): number | string | null {
  if (value === null || value === undefined) return null
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
  const minSafe = BigInt(Number.MIN_SAFE_INTEGER)
  if (value <= maxSafe && value >= minSafe) {
    return Number(value)
  }
  return value.toString()
}

export function withSerializedSize<T extends { size?: SerializableSize }>(obj: T): WithSerializedSize<T> {
  if (!Object.prototype.hasOwnProperty.call(obj, 'size')) {
    return obj as WithSerializedSize<T>
  }

  if (typeof obj.size === 'bigint') {
    return { ...obj, size: safeNumberFromBigInt(obj.size) }
  }

  return obj as WithSerializedSize<T>
}
