// Timezone helpers. Use unified timezone from env, default to Shanghai.

export const APP_TZ = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TZ) || 'Asia/Shanghai'

type DateInput = string | number | Date

function ensureDate(d: DateInput): Date {
  return d instanceof Date ? d : new Date(d)
}

export function formatDate(d: DateInput, locale = 'zh-CN') {
  const date = ensureDate(d)
  return new Intl.DateTimeFormat(locale, { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function formatDateTime(d: DateInput, locale = 'zh-CN') {
  const date = ensureDate(d)
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date)
}

// Best-effort set Node tz (for Node environments where it's supported)
try {
  if (typeof process !== 'undefined' && (!process.env.TZ || process.env.TZ.length === 0)) {
    process.env.TZ = APP_TZ
  }
} catch {}

