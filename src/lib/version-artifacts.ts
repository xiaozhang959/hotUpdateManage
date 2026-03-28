import { createHash } from 'crypto'
import path from 'path'
import { Prisma, PrismaClient, ProjectArchitecture } from '@prisma/client'
import { getConfig } from '@/lib/system-config'
import { isUploadsUrl, resolveMd5ForUrl, resolveSizeForUrl } from '@/lib/remote-md5'
import { safeNumberFromBigInt } from '@/lib/server/serialize'

export const DEFAULT_ARCHITECTURE_KEY = 'default'
export const VERSION_PUBLISH_STATES = {
  DRAFT: 'DRAFT',
  PARTIAL: 'PARTIAL',
  READY: 'READY',
} as const

export const ARTIFACT_TYPES = {
  BINARY: 'BINARY',
  FILE: 'FILE',
} as const

export const ARTIFACT_FILE_ROLES = {
  PRIMARY: 'PRIMARY',
  EXTRA: 'EXTRA',
} as const

export type ArtifactType = (typeof ARTIFACT_TYPES)[keyof typeof ARTIFACT_TYPES]
export type ArtifactFileRole = (typeof ARTIFACT_FILE_ROLES)[keyof typeof ARTIFACT_FILE_ROLES]
export type PublishState = (typeof VERSION_PUBLISH_STATES)[keyof typeof VERSION_PUBLISH_STATES]

type DbClient = PrismaClient | Prisma.TransactionClient

export const projectArchitectureOrder: Prisma.ProjectArchitectureOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
]
export const versionArtifactsOrder: Prisma.VersionArtifactOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
]

export const versionArtifactInclude = {
  architecture: true,
} satisfies Prisma.VersionArtifactInclude

export const versionWithArtifactsInclude = {
  artifacts: {
    include: versionArtifactInclude,
    orderBy: versionArtifactsOrder,
  },
} satisfies Prisma.VersionInclude

export const projectWithVersionDetailsInclude = {
  architectures: {
    orderBy: projectArchitectureOrder,
  },
  versions: {
    include: versionWithArtifactsInclude,
    orderBy: [{ createdAt: 'desc' }],
  },
} satisfies Prisma.ProjectInclude

export type VersionArtifactRecord = Prisma.VersionArtifactGetPayload<{
  include: typeof versionArtifactInclude
}>

export type VersionWithArtifactsRecord = Prisma.VersionGetPayload<{
  include: typeof versionWithArtifactsInclude
}>

export type ProjectWithVersionDetailsRecord = Prisma.ProjectGetPayload<{
  include: typeof projectWithVersionDetailsInclude
}>

export interface VersionArtifactInput {
  id?: string
  architectureKey?: string | null
  artifactType?: string | null
  fileRole?: string | null
  displayName?: string | null
  fileName?: string | null
  downloadUrl?: string | null
  size?: number | string | null
  md5?: string | null
  md5Source?: string | null
  storageProvider?: string | null
  objectKey?: string | null
  storageConfigId?: string | null
  forceUpdateOverride?: boolean | null
  enabled?: boolean | null
  sortOrder?: number | null
}

export interface VersionPayloadCompat {
  version?: string
  changelog?: string | null
  defaultForceUpdate?: boolean | null
  forceUpdate?: boolean | null
  defaultArchitectureKey?: string | null
  isCurrent?: boolean | null
  artifacts?: VersionArtifactInput[] | null
  downloadUrl?: string | null
  downloadUrls?: string[] | null
  size?: number | string | null
  md5?: string | null
  storageProvider?: string | null
  objectKey?: string | null
  storageConfigId?: string | null
  architectureKey?: string | null
  displayName?: string | null
}

export interface ResolvedArtifactInput {
  id?: string
  architectureId: string | null
  architectureKey: string | null
  artifactType: ArtifactType
  fileRole: ArtifactFileRole
  displayName: string
  fileName: string | null
  downloadUrl: string
  size: bigint | null
  md5: string
  md5Source: string
  storageProvider: string | null
  objectKey: string | null
  storageConfigId: string | null
  forceUpdateOverride: boolean | null
  enabled: boolean
  sortOrder: number
}

export interface SerializedVersionArtifact {
  id: string
  architectureKey: string | null
  architectureName: string | null
  artifactType: ArtifactType
  fileRole: ArtifactFileRole
  displayName: string
  fileName: string | null
  downloadUrl: string
  rawDownloadUrl: string
  size: number | string | null
  md5: string
  md5Source: string
  forceUpdate: boolean
  forceUpdateOverride: boolean | null
  enabled: boolean
  isDefault: boolean
  storageProvider: string | null
  objectKey: string | null
  storageConfigId: string | null
  createdAt: Date
  updatedAt: Date
}

function versionTokenize(input: string): Array<number | string> {
  return input
    .split(/[^0-9A-Za-z]+/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()))
}

export function compareVersionStrings(a: string, b: string): number {
  const aa = versionTokenize(a)
  const bb = versionTokenize(b)
  const len = Math.max(aa.length, bb.length)
  for (let i = 0; i < len; i += 1) {
    const left = aa[i]
    const right = bb[i]
    if (left === undefined && right === undefined) return 0
    if (left === undefined) return -1
    if (right === undefined) return 1
    if (typeof left === 'number' && typeof right === 'number') {
      if (left !== right) return left > right ? 1 : -1
      continue
    }
    const leftStr = String(left)
    const rightStr = String(right)
    if (leftStr === rightStr) continue
    return leftStr > rightStr ? 1 : -1
  }
  return 0
}

export function sortVersionsDesc<T extends { version: string; updatedAt?: Date | string; createdAt?: Date | string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const byVersion = compareVersionStrings(right.version, left.version)
    if (byVersion !== 0) return byVersion
    const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime()
    const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
    return rightTime - leftTime
  })
}

export function normalizeArchitectureKey(value?: string | null): string | null {
  const raw = value?.trim()
  return raw ? raw : null
}

export function normalizeProviderType(storageProvider?: string | null, downloadUrl?: string | null): string | null {
  const raw = storageProvider?.trim().toUpperCase()
  if (raw) return raw
  const url = (downloadUrl || '').trim()
  if (!url) return null
  if (isUploadsUrl(url)) return 'LOCAL'
  if (/^https?:\/\//i.test(url)) return 'LINK'
  if (url.startsWith('/api/') || url.startsWith('/uploads/')) return 'LOCAL'
  return 'LINK'
}

function isHexMd5(value?: string | null): value is string {
  return !!value && /^[a-fA-F0-9]{32}$/.test(value)
}

function toBigIntOrNull(value: unknown): bigint | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'bigint') return value
  const numeric = typeof value === 'string' ? Number(value) : Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return BigInt(Math.floor(numeric))
}

function deriveFileNameFromUrl(downloadUrl: string): string | null {
  try {
    const url = downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://')
      ? new URL(downloadUrl)
      : new URL(downloadUrl, 'http://localhost')
    const baseName = path.basename(decodeURIComponent(url.pathname))
    return baseName && baseName !== '/' ? baseName : null
  } catch {
    return null
  }
}

function defaultArtifactDisplayName(version: string | undefined, architecture: ProjectArchitecture | null, artifactType: ArtifactType, fileRole: ArtifactFileRole, index: number) {
  const versionLabel = version?.trim() ? `版本 ${version}` : '版本文件'
  const archLabel = architecture?.name || architecture?.key || '通用'
  if (fileRole === ARTIFACT_FILE_ROLES.PRIMARY) {
    return `${versionLabel} ${archLabel} 主程序`
  }
  if (artifactType === ARTIFACT_TYPES.BINARY) {
    return `${versionLabel} ${archLabel} 额外二进制 ${index + 1}`
  }
  return `${versionLabel} ${archLabel} 附件 ${index + 1}`
}

function getEnabledArtifacts(version: VersionWithArtifactsRecord) {
  return version.artifacts.filter((artifact) => artifact.enabled)
}

function pickFallbackArchitecture(architectures: ProjectArchitecture[]) {
  return architectures.find((architecture) => architecture.isDefault && architecture.enabled)
    || architectures.find((architecture) => architecture.enabled)
    || architectures.find((architecture) => architecture.isDefault)
    || architectures[0]
    || null
}

function isEnabledArchitectureKey(architectures: ProjectArchitecture[], architectureKey?: string | null) {
  const normalizedKey = normalizeArchitectureKey(architectureKey)
  if (!normalizedKey) return false
  const matchedArchitecture = architectures.find((architecture) => architecture.key === normalizedKey)
  return matchedArchitecture ? matchedArchitecture.enabled : true
}

function dedupeLegacyUrls(downloadUrl?: string | null, downloadUrls?: string[] | null) {
  const seen = new Set<string>()
  return [downloadUrl, ...(downloadUrls || [])]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .filter((item) => {
      if (seen.has(item)) {
        return false
      }
      seen.add(item)
      return true
    })
}

export function getPrimaryArtifacts(version: VersionWithArtifactsRecord) {
  return getEnabledArtifacts(version).filter(
    (artifact) => artifact.artifactType === ARTIFACT_TYPES.BINARY && artifact.fileRole === ARTIFACT_FILE_ROLES.PRIMARY,
  )
}

export function getVersionCoverage(version: VersionWithArtifactsRecord, architectures: ProjectArchitecture[]) {
  const enabledArchitectures = architectures.filter((architecture) => architecture.enabled)
  const publishedKeys = new Set(
    getPrimaryArtifacts(version)
      .map((artifact) => artifact.architecture?.key || null)
      .filter((key): key is string => Boolean(key)),
  )
  return {
    total: enabledArchitectures.length,
    published: enabledArchitectures.filter((architecture) => publishedKeys.has(architecture.key)).length,
    missingKeys: enabledArchitectures.filter((architecture) => !publishedKeys.has(architecture.key)).map((architecture) => architecture.key),
  }
}

export function calculatePublishState(version: VersionWithArtifactsRecord, architectures: ProjectArchitecture[]): PublishState {
  const primaryArtifacts = getPrimaryArtifacts(version)
  if (primaryArtifacts.length === 0) return VERSION_PUBLISH_STATES.DRAFT
  const coverage = getVersionCoverage(version, architectures)
  if (coverage.total === 0 || coverage.published >= coverage.total) {
    return VERSION_PUBLISH_STATES.READY
  }
  return VERSION_PUBLISH_STATES.PARTIAL
}

export function effectiveForceUpdate(version: Pick<VersionWithArtifactsRecord, 'defaultForceUpdate' | 'forceUpdate'>, artifact?: Pick<VersionArtifactRecord, 'forceUpdateOverride'> | null) {
  if (artifact?.forceUpdateOverride !== null && artifact?.forceUpdateOverride !== undefined) {
    return artifact.forceUpdateOverride
  }
  return version.defaultForceUpdate ?? version.forceUpdate ?? false
}

export function pickVersionArtifact(
  version: VersionWithArtifactsRecord,
  architectures: ProjectArchitecture[],
  requestedArchitectureKey?: string | null,
): VersionArtifactRecord | null {
  const primaryArtifacts = getPrimaryArtifacts(version)
  const allEnabledArtifacts = getEnabledArtifacts(version)
  if (requestedArchitectureKey) {
    const directMatch = primaryArtifacts.find((artifact) => artifact.architecture?.key === requestedArchitectureKey)
    if (directMatch) return directMatch
  }
  const versionDefault = normalizeArchitectureKey(version.defaultArchitectureKey)
  if (versionDefault && isEnabledArchitectureKey(architectures, versionDefault)) {
    const versionDefaultArtifact = primaryArtifacts.find((artifact) => artifact.architecture?.key === versionDefault)
    if (versionDefaultArtifact) return versionDefaultArtifact
  }
  const projectDefault = pickFallbackArchitecture(architectures)
  if (projectDefault) {
    const projectDefaultArtifact = primaryArtifacts.find((artifact) => artifact.architecture?.key === projectDefault.key)
    if (projectDefaultArtifact) return projectDefaultArtifact
  }
  return primaryArtifacts[0] || allEnabledArtifacts[0] || null
}

export function buildArtifactDownloadUrl(artifact: Pick<VersionArtifactRecord, 'id' | 'downloadUrl' | 'storageProvider'>) {
  const provider = normalizeProviderType(artifact.storageProvider, artifact.downloadUrl)
  if (!provider || provider === 'LINK') {
    return artifact.downloadUrl
  }
  return `/api/version-artifacts/${artifact.id}/download`
}

export function serializeArtifact(
  version: Pick<VersionWithArtifactsRecord, 'defaultForceUpdate' | 'forceUpdate'>,
  artifact: VersionArtifactRecord,
  defaultArtifactId?: string | null,
): SerializedVersionArtifact {
  return {
    id: artifact.id,
    architectureKey: artifact.architecture?.key || null,
    architectureName: artifact.architecture?.name || null,
    artifactType: artifact.artifactType as ArtifactType,
    fileRole: artifact.fileRole as ArtifactFileRole,
    displayName: artifact.displayName,
    fileName: artifact.fileName,
    downloadUrl: buildArtifactDownloadUrl(artifact),
    rawDownloadUrl: artifact.downloadUrl,
    size: safeNumberFromBigInt(artifact.size),
    md5: artifact.md5,
    md5Source: artifact.md5Source,
    forceUpdate: effectiveForceUpdate(version, artifact),
    forceUpdateOverride: artifact.forceUpdateOverride ?? null,
    enabled: artifact.enabled,
    isDefault: defaultArtifactId === artifact.id,
    storageProvider: normalizeProviderType(artifact.storageProvider, artifact.downloadUrl),
    objectKey: artifact.objectKey,
    storageConfigId: artifact.storageConfigId,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  }
}

export function serializeVersionDetail(
  version: VersionWithArtifactsRecord,
  architectures: ProjectArchitecture[],
  requestedArchitectureKey?: string | null,
) {
  const defaultArtifact = pickVersionArtifact(version, architectures, requestedArchitectureKey)
  const artifacts = version.artifacts.map((artifact) => serializeArtifact(version, artifact, defaultArtifact?.id))
  const compatibilityArtifact = defaultArtifact ? serializeArtifact(version, defaultArtifact, defaultArtifact.id) : null
  const coverage = getVersionCoverage(version, architectures)
  return {
    id: version.id,
    projectId: version.projectId,
    version: version.version,
    changelog: version.changelog,
    defaultForceUpdate: version.defaultForceUpdate,
    publishState: calculatePublishState(version, architectures),
    defaultArchitectureKey: normalizeArchitectureKey(version.defaultArchitectureKey),
    isCurrent: version.isCurrent,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    timestamp: new Date(version.updatedAt ?? version.createdAt).getTime(),
    architectureCoverage: coverage,
    artifacts,
    artifact: compatibilityArtifact,
    downloadUrls: version.downloadUrls,
    downloadUrl: compatibilityArtifact?.downloadUrl || version.downloadUrl,
    md5: compatibilityArtifact?.md5 || version.md5,
    md5Source: compatibilityArtifact?.md5Source || version.md5Source,
    size: compatibilityArtifact?.size ?? safeNumberFromBigInt(version.size),
    forceUpdate: compatibilityArtifact?.forceUpdate ?? version.defaultForceUpdate ?? version.forceUpdate,
    storageProvider: compatibilityArtifact?.storageProvider || normalizeProviderType(version.storageProvider, version.downloadUrl),
    objectKey: compatibilityArtifact?.objectKey || version.objectKey,
    storageConfigId: compatibilityArtifact?.storageConfigId || version.storageConfigId,
    storageProviders: version.storageProviders,
  }
}

export async function ensureDefaultArchitecture(tx: DbClient, projectId: string) {
  const existing = await tx.projectArchitecture.findMany({
    where: { projectId },
    orderBy: projectArchitectureOrder,
  })
  if (existing.length === 0) {
    const created = await tx.projectArchitecture.create({
      data: {
        projectId,
        key: DEFAULT_ARCHITECTURE_KEY,
        name: '默认架构',
        sortOrder: 0,
        enabled: true,
        isDefault: true,
      },
    })
    return {
      architectures: [created],
      defaultArchitecture: created,
    }
  }
  let defaultArchitecture = pickFallbackArchitecture(existing)
  if (!defaultArchitecture) {
    defaultArchitecture = await tx.projectArchitecture.update({
      where: { id: existing[0].id },
      data: { isDefault: true },
    })
    return {
      architectures: [defaultArchitecture, ...existing.slice(1)],
      defaultArchitecture,
    }
  }
  if (!existing.some((architecture) => architecture.isDefault)) {
    const promotedDefaultArchitecture = await tx.projectArchitecture.update({
      where: { id: defaultArchitecture.id },
      data: { isDefault: true },
    })
    return {
      architectures: existing.map((architecture) => (
        architecture.id === promotedDefaultArchitecture.id ? promotedDefaultArchitecture : architecture
      )),
      defaultArchitecture: promotedDefaultArchitecture,
    }
  }
  return {
    architectures: existing,
    defaultArchitecture,
  }
}

export async function normalizeArtifactsPayload(
  tx: DbClient,
  projectId: string,
  payload: VersionPayloadCompat,
): Promise<ResolvedArtifactInput[]> {
  const { architectures, defaultArchitecture } = await ensureDefaultArchitecture(tx, projectId)
  const architectureMap = new Map(architectures.map((architecture) => [architecture.key, architecture]))
  const rawArtifacts = Array.isArray(payload.artifacts) ? payload.artifacts : []
  const legacyUrls = dedupeLegacyUrls(payload.downloadUrl, payload.downloadUrls)

  const normalizedInputs: VersionArtifactInput[] = rawArtifacts.length > 0
    ? rawArtifacts
    : legacyUrls.map((downloadUrl, index) => ({
        architectureKey: normalizeArchitectureKey(payload.architectureKey) || defaultArchitecture.key,
        artifactType: ARTIFACT_TYPES.BINARY,
        fileRole: index === 0 ? ARTIFACT_FILE_ROLES.PRIMARY : ARTIFACT_FILE_ROLES.EXTRA,
        displayName:
          index === 0
            ? payload.displayName || `${payload.version || '未命名版本'} 主程序`
            : `${payload.version || '未命名版本'} 额外下载源 ${index}`,
        downloadUrl,
        size: payload.size,
        md5: payload.md5,
        storageProvider: payload.storageProvider,
        objectKey: payload.objectKey,
        storageConfigId: payload.storageConfigId,
        forceUpdateOverride: index === 0 ? payload.forceUpdate ?? null : null,
        sortOrder: index,
      }))

  const filteredInputs = normalizedInputs
    .map((item) => ({ ...item, downloadUrl: item.downloadUrl?.trim() || '' }))
    .filter((item) => item.downloadUrl)

  if (filteredInputs.length === 0) {
    throw new Error('至少需要提供一个可下载产物')
  }

  const requireMd5 = Boolean(await getConfig('require_md5_for_link_uploads'))
  const primaryKeys = new Set<string>()
  const resolvedArtifacts: ResolvedArtifactInput[] = []

  for (let index = 0; index < filteredInputs.length; index += 1) {
    const item = filteredInputs[index]
    const artifactType = String(item.artifactType || ARTIFACT_TYPES.BINARY).toUpperCase() as ArtifactType
    const fileRole = String(item.fileRole || (artifactType === ARTIFACT_TYPES.BINARY ? ARTIFACT_FILE_ROLES.PRIMARY : ARTIFACT_FILE_ROLES.EXTRA)).toUpperCase() as ArtifactFileRole
    const preferredArchitectureKey = normalizeArchitectureKey(item.architectureKey) || (artifactType === ARTIFACT_TYPES.BINARY && fileRole === ARTIFACT_FILE_ROLES.PRIMARY ? defaultArchitecture.key : null)
    const architecture = preferredArchitectureKey ? architectureMap.get(preferredArchitectureKey) || null : null

    if (preferredArchitectureKey && !architecture) {
      throw new Error(`架构 ${preferredArchitectureKey} 不存在，请先在项目中创建该架构`)
    }
    if (fileRole === ARTIFACT_FILE_ROLES.PRIMARY && artifactType !== ARTIFACT_TYPES.BINARY) {
      throw new Error('主产物必须是二进制文件')
    }

    const provider = normalizeProviderType(item.storageProvider, item.downloadUrl)
    const primaryKey = fileRole === ARTIFACT_FILE_ROLES.PRIMARY ? architecture?.key || preferredArchitectureKey || '__null__' : null
    if (primaryKey) {
      if (primaryKeys.has(primaryKey)) {
        throw new Error(`架构 ${primaryKey} 只能有一个主二进制产物`)
      }
      primaryKeys.add(primaryKey)
    }

    const resolvedSize = toBigIntOrNull(item.size) ?? toBigIntOrNull(await resolveSizeForUrl(item.downloadUrl!))

    let md5 = item.md5?.trim() || ''
    let md5Source = item.md5Source?.trim() || 'manual'
    if (md5) {
      if (requireMd5 && provider === 'LINK' && !isUploadsUrl(item.downloadUrl!) && !isHexMd5(md5)) {
        throw new Error('已开启强制校验：请为外链产物提供有效的 32 位十六进制 MD5')
      }
    } else {
      const resolvedMd5 = await resolveMd5ForUrl(item.downloadUrl!)
      if (resolvedMd5?.md5) {
        md5 = resolvedMd5.md5
        md5Source = resolvedMd5.from
      } else if (requireMd5 && provider === 'LINK' && !isUploadsUrl(item.downloadUrl!)) {
        throw new Error('系统已开启链接上传必须提供 MD5，请手动填写或确保链接返回 ETag/Content-MD5')
      } else {
        md5 = createHash('md5').update(`${projectId}:${item.downloadUrl}:${Date.now()}:${index}`).digest('hex')
        md5Source = 'random'
      }
    }

    resolvedArtifacts.push({
      id: item.id,
      architectureId: architecture?.id || null,
      architectureKey: architecture?.key || preferredArchitectureKey || null,
      artifactType,
      fileRole,
      displayName: item.displayName?.trim() || defaultArtifactDisplayName(payload.version, architecture, artifactType, fileRole, index),
      fileName: item.fileName?.trim() || deriveFileNameFromUrl(item.downloadUrl!),
      downloadUrl: item.downloadUrl!,
      size: resolvedSize,
      md5,
      md5Source,
      storageProvider: provider,
      objectKey: item.objectKey?.trim() || null,
      storageConfigId: item.storageConfigId?.trim() || null,
      forceUpdateOverride:
        item.forceUpdateOverride === null || item.forceUpdateOverride === undefined
          ? null
          : Boolean(item.forceUpdateOverride),
      enabled: item.enabled === null || item.enabled === undefined ? true : Boolean(item.enabled),
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
    })
  }

  return resolvedArtifacts
}

export async function syncVersionCompatibilityFields(tx: DbClient, versionId: string) {
  const version = await tx.version.findUnique({
    where: { id: versionId },
    include: {
      artifacts: {
        include: versionArtifactInclude,
        orderBy: versionArtifactsOrder,
      },
      project: {
        include: {
          architectures: {
            orderBy: projectArchitectureOrder,
          },
        },
      },
    },
  })

  if (!version) {
    throw new Error('版本不存在，无法同步兼容字段')
  }

  const selectedArtifact = pickVersionArtifact(version, version.project.architectures)
  const publishState = calculatePublishState(version, version.project.architectures)
  const versionDefaultArchitectureKey = normalizeArchitectureKey(version.defaultArchitectureKey)
  const fallbackArchitecture = pickFallbackArchitecture(version.project.architectures)
  const defaultArchitectureKey =
    (versionDefaultArchitectureKey && isEnabledArchitectureKey(version.project.architectures, versionDefaultArchitectureKey)
      ? versionDefaultArchitectureKey
      : null) ||
    selectedArtifact?.architecture?.key ||
    fallbackArchitecture?.key ||
    null

  const updatedVersion = await tx.version.update({
    where: { id: versionId },
    data: {
      downloadUrl: selectedArtifact?.downloadUrl || version.downloadUrl || '',
      downloadUrls: JSON.stringify(selectedArtifact ? [selectedArtifact.downloadUrl] : []),
      urlRotationIndex: 0,
      size: selectedArtifact?.size ?? version.size ?? null,
      md5: selectedArtifact?.md5 || version.md5,
      md5Source: selectedArtifact?.md5Source || version.md5Source,
      storageProvider: normalizeProviderType(selectedArtifact?.storageProvider, selectedArtifact?.downloadUrl) || null,
      objectKey: selectedArtifact?.objectKey || null,
      storageConfigId: selectedArtifact?.storageConfigId || null,
      storageProviders: JSON.stringify(selectedArtifact ? [normalizeProviderType(selectedArtifact.storageProvider, selectedArtifact.downloadUrl)] : []),
      forceUpdate: effectiveForceUpdate(version, selectedArtifact),
      publishState,
      defaultArchitectureKey,
    },
    include: versionWithArtifactsInclude,
  })

  return {
    version: updatedVersion,
    architectures: version.project.architectures,
  }
}

export async function getLatestAvailableVersionForArchitecture(
  tx: DbClient,
  projectId: string,
  requestedArchitectureKey?: string | null,
  currentVersion?: string | null,
) {
  const { architectures, defaultArchitecture } = await ensureDefaultArchitecture(tx, projectId)
  const fallbackArchitecture = pickFallbackArchitecture(architectures) || defaultArchitecture
  const targetArchitectureKey = normalizeArchitectureKey(requestedArchitectureKey) || fallbackArchitecture.key
  const architectureExists = architectures.some((architecture) => architecture.key === targetArchitectureKey)
  const versions = await tx.version.findMany({
    where: { projectId },
    include: versionWithArtifactsInclude,
  })
  const sortedVersions = sortVersionsDesc(versions)
  const latestLogicalVersion = sortedVersions.find((version) => version.isCurrent) || sortedVersions[0] || null
  const availableVersions = sortedVersions
    .map((version) => ({
      version,
      artifact: getPrimaryArtifacts(version).find((artifact) => artifact.architecture?.key === targetArchitectureKey) || null,
    }))
    .filter((item): item is { version: VersionWithArtifactsRecord; artifact: VersionArtifactRecord } => Boolean(item.artifact))

  const latestAvailable = availableVersions[0] || null
  const nextAvailable = currentVersion
    ? availableVersions.find((item) => compareVersionStrings(item.version.version, currentVersion) > 0) || null
    : latestAvailable

  return {
    architectures,
    defaultArchitecture,
    targetArchitectureKey,
    architectureExists,
    latestLogicalVersion,
    latestAvailable,
    nextAvailable,
  }
}
