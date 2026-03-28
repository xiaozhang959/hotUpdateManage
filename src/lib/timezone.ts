// Timezone helpers. Use unified timezone from env, default to Shanghai.

const DEFAULT_APP_TZ = 'Asia/Shanghai'

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone })
    return true
  } catch {
    return false
  }
}

export function normalizeTimeZone(
  value?: string | null,
  fallback = DEFAULT_APP_TZ,
): string {
  const candidate = value?.trim().replace(/^:/, '')

  if (candidate && isValidTimeZone(candidate)) {
    return candidate
  }

  if (fallback && isValidTimeZone(fallback)) {
    return fallback
  }

  return 'UTC'
}

export const APP_TZ = normalizeTimeZone(
  (typeof process !== 'undefined' &&
    (process.env?.NEXT_PUBLIC_TZ || process.env?.TZ)) ||
    DEFAULT_APP_TZ,
)

type DateInput = string | number | Date

function ensureDate(d: DateInput): Date {
  return d instanceof Date ? d : new Date(d)
}

export function formatInAppTimeZone(
  d: DateInput,
  options: Intl.DateTimeFormatOptions = {},
  locale = 'zh-CN',
) {
  const date = ensureDate(d)
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TZ,
  }).format(date)
}

export function formatDate(d: DateInput, locale = 'zh-CN') {
  return formatInAppTimeZone(
    d,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    locale,
  )
}

export function formatDateTime(d: DateInput, locale = 'zh-CN') {
  return formatInAppTimeZone(
    d,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    },
    locale,
  )
}

// Best-effort set Node tz (for Node environments where it's supported)
try {
  if (typeof process !== 'undefined') {
    process.env.TZ = normalizeTimeZone(
      process.env.TZ || process.env.NEXT_PUBLIC_TZ,
      APP_TZ,
    )
  }
} catch {}
