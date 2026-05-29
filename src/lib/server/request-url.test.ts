import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBaseUrl } from './request-url'

const BASE_URL_ENV_KEYS = [
  'APP_URL',
  'NEXTAUTH_URL',
  'AUTH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
]

function clearBaseUrlEnv() {
  for (const key of BASE_URL_ENV_KEYS) {
    vi.stubEnv(key, '')
  }
}

describe('getBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers explicitly configured app url', () => {
    clearBaseUrlEnv()
    vi.stubEnv('APP_URL', 'https://example.com/')

    expect(getBaseUrl()).toBe('https://example.com')
  })

  it('adds https protocol for Vercel host env', () => {
    clearBaseUrlEnv()
    vi.stubEnv('VERCEL_URL', 'demo.vercel.app')

    expect(getBaseUrl()).toBe('https://demo.vercel.app')
  })

  it('falls back to request forwarded headers', () => {
    clearBaseUrlEnv()
    const req = new Request('http://internal.local/api/auth/register', {
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'app.example.com',
      },
    })

    expect(getBaseUrl(req)).toBe('https://app.example.com')
  })

  it('keeps local ip request protocol', () => {
    clearBaseUrlEnv()
    const req = new Request('http://192.168.2.1:3000/api/auth/register', {
      headers: {
        host: '192.168.2.1:3000',
      },
    })

    expect(getBaseUrl(req)).toBe('http://192.168.2.1:3000')
  })
})
