import { prisma } from '@/lib/prisma'
import { createLocalProvider } from './local'
import { createWebDAVProvider } from './webdav'
import { createS3Provider } from './s3'
import type { S3Config } from './s3'
import { createOSSProvider } from './oss'
import type { OSSConfig } from './oss'
import { createLanzouProvider } from './lanzou'
import type { LanzouConfig } from './lanzou'
import type { StorageProvider, ProviderConfig, LocalConfig, WebDAVConfig } from './types'

export type StorageProviderFactory = (config: ProviderConfig) => StorageProvider

const storageProviderFactories = new Map<string, StorageProviderFactory>()
let builtInStorageProvidersRegistered = false

export function registerStorageProvider(name: string, factory: StorageProviderFactory) {
  const normalized = name.trim().toUpperCase()
  if (!normalized) throw new Error('storage provider name is required')
  storageProviderFactories.set(normalized, factory)
}

export function listRegisteredStorageProviders() {
  ensureBuiltInStorageProvidersRegistered()
  return Array.from(storageProviderFactories.keys())
}

export function createStorageProvider(name: string, config: ProviderConfig = {}): StorageProvider | null {
  ensureBuiltInStorageProvidersRegistered()
  const factory = storageProviderFactories.get(name.trim().toUpperCase())
  return factory ? factory(config) : null
}

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
      ? prisma.storageConfig.findMany({
          where: { userId: ownerUserId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        })
      : Promise.resolve([]),
    prisma.storageConfig.findMany({
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
      const userCfg = await prisma.storageConfig.findFirst({
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
    const globalCfg = await prisma.storageConfig.findFirst({
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
  return createStorageProvider(name, cfg) || createLocalProvider()
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
    const cfg = await prisma.storageConfig.findUnique({ where: { id } })
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

function ensureBuiltInStorageProvidersRegistered() {
  if (builtInStorageProvidersRegistered) return
  builtInStorageProvidersRegistered = true

  registerStorageProvider('LOCAL', (cfg) => createLocalProvider(cfg as LocalConfig))
  registerStorageProvider('WEBDAV', (cfg) => createWebDAVProvider(cfg as WebDAVConfig))
  registerStorageProvider('S3', (cfg) => createS3Provider(cfg as Partial<S3Config>))
  registerStorageProvider('OSS', (cfg) => createOSSProvider(cfg as Partial<OSSConfig>))
  registerStorageProvider('LANZOU', (cfg) => createLanzouProvider(cfg as Partial<LanzouConfig>))
}
