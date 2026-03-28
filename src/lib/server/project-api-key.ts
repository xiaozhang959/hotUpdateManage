import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/crypto'

export const PROJECT_API_KEY_CONFLICT_MESSAGE = 'API Key 已存在，请更换后重试'
export const PROJECT_API_KEY_REQUIRED_MESSAGE = 'API Key 不能为空'
export const PROJECT_API_KEY_WHITESPACE_MESSAGE = 'API Key 不能包含空白字符'
export const PROJECT_API_KEY_TOO_LONG_MESSAGE = 'API Key 长度不能超过 128 个字符'

const PROJECT_API_KEY_MAX_LENGTH = 128

export function normalizeProjectApiKey(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }

  const apiKey = input.trim()
  return apiKey.length > 0 ? apiKey : null
}

export function validateProjectApiKey(apiKey: string): string | null {
  if (!apiKey) {
    return PROJECT_API_KEY_REQUIRED_MESSAGE
  }

  if (/\s/.test(apiKey)) {
    return PROJECT_API_KEY_WHITESPACE_MESSAGE
  }

  if (apiKey.length > PROJECT_API_KEY_MAX_LENGTH) {
    return PROJECT_API_KEY_TOO_LONG_MESSAGE
  }

  return null
}

export async function isProjectApiKeyTaken(
  apiKey: string,
  excludeProjectId?: string,
): Promise<boolean> {
  const existingProject = await prisma.project.findFirst({
    where: {
      apiKey,
      ...(excludeProjectId
        ? {
            NOT: {
              id: excludeProjectId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  })

  return Boolean(existingProject)
}

export async function generateAvailableProjectApiKey(
  excludeProjectId?: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateApiKey()
    if (!(await isProjectApiKeyTaken(candidate, excludeProjectId))) {
      return candidate
    }
  }

  throw new Error('生成唯一 API Key 失败，请稍后重试')
}

export function isProjectApiKeyUniqueConstraintError(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    (error as { code?: unknown }).code !== 'P2002'
  ) {
    return false
  }

  const target = (error as { meta?: { target?: unknown } }).meta?.target
  if (!target) {
    return true
  }

  return JSON.stringify(target).includes('apiKey')
}
