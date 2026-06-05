import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shouldRequireEmailVerificationForRole } from './login-auth'

const { getConfigMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/system-config', () => ({
  getConfig: getConfigMock,
}))

function mockConfigs(configs: Record<string, boolean | null>) {
  getConfigMock.mockImplementation(async (key: string) => configs[key] ?? null)
}

describe('shouldRequireEmailVerificationForRole', () => {
  beforeEach(() => {
    getConfigMock.mockReset()
  })

  it('does not require verification when global email verification is disabled', async () => {
    mockConfigs({
      require_email_verification: false,
      admin_require_email_verification: true,
    })

    await expect(shouldRequireEmailVerificationForRole('USER')).resolves.toBe(false)
    await expect(shouldRequireEmailVerificationForRole('ADMIN')).resolves.toBe(false)
  })

  it('requires verification for regular users when global email verification is enabled', async () => {
    mockConfigs({
      require_email_verification: true,
      admin_require_email_verification: false,
    })

    await expect(shouldRequireEmailVerificationForRole('USER')).resolves.toBe(true)
  })

  it('lets admins skip verification when admin verification is disabled', async () => {
    mockConfigs({
      require_email_verification: true,
      admin_require_email_verification: false,
    })

    await expect(shouldRequireEmailVerificationForRole('ADMIN')).resolves.toBe(false)
  })

  it('requires verification for admins by default when global email verification is enabled', async () => {
    mockConfigs({
      require_email_verification: true,
      admin_require_email_verification: null,
    })

    await expect(shouldRequireEmailVerificationForRole('ADMIN')).resolves.toBe(true)
  })
})
