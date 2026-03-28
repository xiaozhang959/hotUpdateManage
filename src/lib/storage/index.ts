import { prisma } from '@/lib/prisma'
import { createLocalProvider } from './local'
import { createWebDAVProvider } from './webdav'
import { createS3Provider } from './s3'
import { createOSSProvider } from './oss'
import type { StorageProvider, ProviderConfig } from './types'

export interface ActiveStorageSelection {
  scope: 'user' | 'global' | 'fallback'
  provider: StorageProvider
  configId?: string | null
}

export interface AvailableStorageConfigItem {
  id: string
  name: string
  provider: string
  userId: string | null
  isDefault: boolean
  createdAt: Date
}

export async function listAvailableStorageConfigs(ownerUserId?: string | null) {
  const [ownerItems, globalItems] = await Promise.all([
    ownerUserId
      ? (prisma as any).storageConfig.findMany({
          where: { userId: ownerUserId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        })
      : Promise.resolve([]),
    (prisma as any).storageConfig.findMany({
      where: { userId: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }),
  ])

  const typedOwnerItems = ownerItems as AvailableStorageConfigItem[]
  const typedGlobalItems = globalItems as AvailableStorageConfigItem[]
  const defaultId = typedOwnerItems.find((item) => item.isDefault)?.id
    || typedGlobalItems.find((item) => item.isDefault)?.id
    || null

  return {
    ownerItems: typedOwnerItems,
    globalItems: typedGlobalItems,
    defaultId,
  }
}

export async function getActiveStorageProvider(userId?: string | null): Promise<ActiveStorageSelection> {
  // 用户级默认
  try {
    if (userId) {
      const userCfg = await (prisma as any).storageConfig.findFirst({
        where: { userId, isDefault: true }
      })
      if (userCfg) {
        return { scope: 'user', provider: buildProvider(userCfg.provider, userCfg.configJson), configId: userCfg.id }
      }
    }
  } catch {
    // ignore, fallthrough
  }

  // 全局默认
  try {
    const globalCfg = await (prisma as any).storageConfig.findFirst({
      where: { userId: null, isDefault: true }
    })
    if (globalCfg) {
      return { scope: 'global', provider: buildProvider(globalCfg.provider, globalCfg.configJson), configId: globalCfg.id }
    }
  } catch {
    // ignore
  }

  // 兜底：本地
  return { scope: 'fallback', provider: createLocalProvider(), configId: null }
}

function buildProvider(name: string, json: string): StorageProvider {
  const cfg = parseConfig(json)
  switch (name) {
    case 'LOCAL':
      return createLocalProvider(cfg as any)
    case 'WEBDAV':
      return createWebDAVProvider(cfg as any)
    case 'S3':
      return createS3Provider(cfg as any)
    case 'OSS':
      return createOSSProvider(cfg as any)
    default:
      return createLocalProvider()
  }
}

function parseConfig(json: string): ProviderConfig {
  try {
    return json ? JSON.parse(json) : {}
  } catch {
    return {}
  }
}

export async function getStorageConfigById(id: string, ownerUserId?: string | null) {
  try {
    const cfg = await (prisma as any).storageConfig.findUnique({ where: { id } })
    if (!cfg) return null
    if (ownerUserId !== undefined && cfg.userId !== null && cfg.userId !== ownerUserId) {
      return null
    }
    return cfg
  } catch {
    return null
  }
}

export async function getProviderByConfigId(id: string, ownerUserId?: string | null): Promise<StorageProvider | null> {
  try {
    const cfg = await getStorageConfigById(id, ownerUserId)
    if (!cfg) return null
    return buildProvider(cfg.provider, cfg.configJson)
  } catch {
    return null
  }
}
