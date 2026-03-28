import { createHash } from 'crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { versionCache } from '@/lib/cache/version-cache'
import { deleteFile } from '@/lib/fileUtils'
import { prisma } from '@/lib/prisma'
import type { ResolvedArtifactInput } from '@/lib/version-artifacts'
import {
  DEFAULT_ARCHITECTURE_KEY,
  VersionPayloadCompat,
  ensureDefaultArchitecture,
  normalizeArchitectureKey,
  normalizeArtifactsPayload,
  normalizeProviderType,
  projectArchitectureOrder,
  projectWithVersionDetailsInclude,
  serializeVersionDetail,
  sortVersionsDesc,
  syncVersionCompatibilityFields,
  versionArtifactInclude,
  versionArtifactsOrder,
  versionWithArtifactsInclude,
} from '@/lib/version-artifacts'

type DbClient = PrismaClient | Prisma.TransactionClient

export const versionForMutationInclude = {
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
} satisfies Prisma.VersionInclude

export type ProjectDetailRecord = Prisma.ProjectGetPayload<{
  include: typeof projectWithVersionDetailsInclude
}>

export type VersionMutationRecord = Prisma.VersionGetPayload<{
  include: typeof versionForMutationInclude
}>

export interface VersionMutationPayload extends VersionPayloadCompat {
  isCurrent?: boolean | null
}

interface ArtifactCleanupEntry {
  downloadUrl: string
  storageProvider: string | null
  objectKey: string | null
  storageConfigId: string | null
}

function artifactCleanupIdentity(artifact: ArtifactCleanupEntry) {
  if (artifact.objectKey) {
    return `object:${artifact.storageProvider || ''}:${artifact.storageConfigId || ''}:${artifact.objectKey}`
  }
  return `url:${artifact.downloadUrl}`
}

function dedupeArtifactCleanupEntries(artifacts: ArtifactCleanupEntry[]) {
  const seen = new Set<string>()
  return artifacts.filter((artifact) => {
    const identity = artifactCleanupIdentity(artifact)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function serializeArchitecture(architecture: ProjectDetailRecord['architectures'][number]) {
  return {
    id: architecture.id,
    projectId: architecture.projectId,
    key: architecture.key,
    name: architecture.name,
    sortOrder: architecture.sortOrder,
    enabled: architecture.enabled,
    isDefault: architecture.isDefault,
    createdAt: architecture.createdAt,
    updatedAt: architecture.updatedAt,
  }
}

export function serializeProjectDetail(project: ProjectDetailRecord, requestedArchitectureKey?: string | null) {
  const versions = sortVersionsDesc(project.versions).map((version) => serializeVersionDetail(version, project.architectures, requestedArchitectureKey))
  return {
    ...project,
    architectures: project.architectures.map(serializeArchitecture),
    versions,
    _count: {
      versions: project.versions.length,
    },
  }
}

export function serializeProjectSummary(project: ProjectDetailRecord, requestedArchitectureKey?: string | null) {
  const detail = serializeProjectDetail(project, requestedArchitectureKey)
  return {
    ...detail,
    versions: detail.versions.slice(0, 1),
  }
}

function buildPlaceholderMd5(projectId: string, version: string) {
  return createHash('md5').update(`${projectId}:${version}:placeholder`).digest('hex')
}

function resolveDefaultArchitectureKey(
  providedKey: string | null | undefined,
  availableKeys: Set<string>,
  fallbackKey: string,
) {
  const normalized = normalizeArchitectureKey(providedKey)
  if (!normalized) return fallbackKey
  if (!availableKeys.has(normalized)) {
    throw new Error(`默认架构 ${normalized} 不存在，请先在项目中创建该架构`)
  }
  return normalized
}

function toArtifactCleanupEntries(version: Pick<VersionMutationRecord, 'artifacts'>): ArtifactCleanupEntry[] {
  return version.artifacts.map((artifact) => ({
    downloadUrl: artifact.downloadUrl,
    storageProvider: normalizeProviderType(artifact.storageProvider, artifact.downloadUrl),
    objectKey: artifact.objectKey,
    storageConfigId: artifact.storageConfigId,
  }))
}

function toArtifactCleanupEntriesFromResolved(artifacts: Pick<ResolvedArtifactInput, 'downloadUrl' | 'storageProvider' | 'objectKey' | 'storageConfigId'>[]) {
  return artifacts.map((artifact) => ({
    downloadUrl: artifact.downloadUrl,
    storageProvider: normalizeProviderType(artifact.storageProvider, artifact.downloadUrl),
    objectKey: artifact.objectKey,
    storageConfigId: artifact.storageConfigId,
  }))
}

function diffArtifactCleanupEntries(previousArtifacts: ArtifactCleanupEntry[], nextArtifacts: ArtifactCleanupEntry[]) {
  const nextIdentities = new Set(nextArtifacts.map(artifactCleanupIdentity))
  return dedupeArtifactCleanupEntries(
    previousArtifacts.filter((artifact) => !nextIdentities.has(artifactCleanupIdentity(artifact))),
  )
}

async function isArtifactStillReferenced(projectId: string, artifact: ArtifactCleanupEntry) {
  const where: Prisma.VersionArtifactWhereInput = artifact.objectKey
    ? {
      objectKey: artifact.objectKey,
      ...(artifact.storageConfigId !== null ? { storageConfigId: artifact.storageConfigId } : {}),
      ...(artifact.storageProvider !== null ? { storageProvider: artifact.storageProvider } : {}),
      version: {
        is: { projectId },
      },
    }
    : {
      downloadUrl: artifact.downloadUrl,
      version: {
        is: { projectId },
      },
    }

  const referencedArtifact = await prisma.versionArtifact.findFirst({
    where,
    select: { id: true },
  })

  return Boolean(referencedArtifact)
}

export async function cleanupArtifactFiles(projectId: string, projectUserId: string | null | undefined, artifacts: ArtifactCleanupEntry[]) {
  if (artifacts.length === 0) return

  let storageModule: typeof import('@/lib/storage') | null = null

  for (const artifact of dedupeArtifactCleanupEntries(artifacts)) {
    try {
      if (await isArtifactStillReferenced(projectId, artifact)) {
        continue
      }

      if (artifact.objectKey && artifact.storageProvider && artifact.storageProvider !== 'LINK') {
        storageModule ??= await import('@/lib/storage')
        let provider = artifact.storageConfigId ? await storageModule.getProviderByConfigId(artifact.storageConfigId) : null
        if (!provider) {
          const selection = await storageModule.getActiveStorageProvider(projectUserId)
          provider = selection.provider
        }
        if (provider && typeof provider.deleteObject === 'function') {
          await provider.deleteObject({ projectId, objectKey: artifact.objectKey })
          continue
        }
      }

      if (artifact.downloadUrl.startsWith('/uploads/')) {
        await deleteFile(artifact.downloadUrl)
      }
    } catch (error) {
      console.warn('清理版本产物失败（已忽略）:', error)
    }
  }
}

export async function refreshProjectVersionCache(projectId: string) {
  await versionCache.clearProjectCache(projectId)
  const currentVersion = await prisma.version.findFirst({
    where: { projectId, isCurrent: true },
  })
  if (currentVersion) {
    await versionCache.warmupCache(projectId, currentVersion)
  }
}

export async function setCurrentVersionById(tx: DbClient, projectId: string, versionId: string) {
  const target = await tx.version.findFirst({
    where: { id: versionId, projectId },
    select: { id: true, version: true },
  })

  if (!target) {
    throw new Error('版本不存在')
  }

  await tx.version.updateMany({
    where: {
      projectId,
      id: { not: versionId },
      isCurrent: true,
    },
    data: { isCurrent: false },
  })

  await tx.version.update({
    where: { id: versionId },
    data: {
      isCurrent: true,
      updatedAt: new Date(),
    },
  })

  await tx.project.update({
    where: { id: projectId },
    data: { currentVersion: target.version },
  })

  return target.version
}

export async function resetCurrentVersionAfterRemoval(tx: DbClient, projectId: string, excludedVersionId?: string) {
  const remainingVersions = await tx.version.findMany({
    where: {
      projectId,
      ...(excludedVersionId ? { id: { not: excludedVersionId } } : {}),
    },
    select: {
      id: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const nextVersion = sortVersionsDesc(remainingVersions)[0] || null

  if (!nextVersion) {
    await tx.version.updateMany({
      where: { projectId },
      data: { isCurrent: false },
    })
    await tx.project.update({
      where: { id: projectId },
      data: { currentVersion: null },
    })
    return null
  }

  await setCurrentVersionById(tx, projectId, nextVersion.id)
  return nextVersion.version
}

export async function createVersionWithArtifacts(tx: DbClient, projectId: string, payload: VersionMutationPayload) {
  const version = payload.version?.trim()
  if (!version) {
    throw new Error('请提供版本号')
  }

  const existing = await tx.version.findUnique({
    where: {
      projectId_version: {
        projectId,
        version,
      },
    },
    select: { id: true },
  })

  if (existing) {
    throw new Error('该版本号已存在')
  }

  const { architectures, defaultArchitecture } = await ensureDefaultArchitecture(tx, projectId)
  const resolvedArtifacts = await normalizeArtifactsPayload(tx, projectId, {
    ...payload,
    version,
  })
  const architectureKeys = new Set(architectures.map((architecture) => architecture.key))
  const defaultArchitectureKey = resolveDefaultArchitectureKey(
    payload.defaultArchitectureKey,
    architectureKeys,
    normalizeArchitectureKey(payload.defaultArchitectureKey)
      || resolvedArtifacts.find((artifact) => artifact.fileRole === 'PRIMARY')?.architectureKey
      || defaultArchitecture.key
      || DEFAULT_ARCHITECTURE_KEY,
  )
  const defaultArtifact = resolvedArtifacts.find(
    (artifact) => artifact.fileRole === 'PRIMARY' && artifact.architectureKey === defaultArchitectureKey,
  ) || resolvedArtifacts[0]
  const defaultForceUpdate = Boolean(payload.defaultForceUpdate ?? payload.forceUpdate ?? false)

  const createdVersion = await tx.version.create({
    data: {
      projectId,
      version,
      downloadUrl: defaultArtifact?.downloadUrl || '',
      downloadUrls: JSON.stringify(defaultArtifact ? [defaultArtifact.downloadUrl] : []),
      urlRotationIndex: 0,
      size: defaultArtifact?.size ?? null,
      md5: defaultArtifact?.md5 || buildPlaceholderMd5(projectId, version),
      md5Source: defaultArtifact?.md5Source || 'manual',
      storageProvider: defaultArtifact?.storageProvider || null,
      objectKey: defaultArtifact?.objectKey || null,
      storageConfigId: defaultArtifact?.storageConfigId || null,
      storageProviders: JSON.stringify(defaultArtifact?.storageProvider ? [defaultArtifact.storageProvider] : []),
      forceUpdate: defaultArtifact?.forceUpdateOverride ?? defaultForceUpdate,
      defaultForceUpdate,
      publishState: 'DRAFT',
      defaultArchitectureKey,
      changelog: payload.changelog?.trim() || '',
      isCurrent: false,
    },
    include: versionWithArtifactsInclude,
  })

  await tx.versionArtifact.createMany({
    data: resolvedArtifacts.map((artifact) => ({
      versionId: createdVersion.id,
      architectureId: artifact.architectureId,
      artifactType: artifact.artifactType,
      fileRole: artifact.fileRole,
      displayName: artifact.displayName,
      fileName: artifact.fileName,
      downloadUrl: artifact.downloadUrl,
      size: artifact.size,
      md5: artifact.md5,
      md5Source: artifact.md5Source,
      storageProvider: artifact.storageProvider,
      objectKey: artifact.objectKey,
      storageConfigId: artifact.storageConfigId,
      forceUpdateOverride: artifact.forceUpdateOverride,
      enabled: artifact.enabled,
      sortOrder: artifact.sortOrder,
    })),
  })

  const synced = await syncVersionCompatibilityFields(tx, createdVersion.id)

  if (payload.isCurrent ?? true) {
    await setCurrentVersionById(tx, projectId, createdVersion.id)
    const refreshed = await syncVersionCompatibilityFields(tx, createdVersion.id)
    return serializeVersionDetail(refreshed.version, refreshed.architectures, defaultArchitectureKey)
  }

  return serializeVersionDetail(synced.version, synced.architectures, defaultArchitectureKey)
}

export async function updateVersionWithArtifacts(tx: DbClient, projectId: string, versionId: string, payload: VersionMutationPayload) {
  const existingVersion = await tx.version.findFirst({
    where: {
      id: versionId,
      projectId,
    },
    include: versionForMutationInclude,
  })

  if (!existingVersion) {
    throw new Error('版本不存在')
  }

  const nextVersion = payload.version?.trim() || existingVersion.version
  if (nextVersion !== existingVersion.version) {
    const duplicateVersion = await tx.version.findUnique({
      where: {
        projectId_version: {
          projectId,
          version: nextVersion,
        },
      },
      select: { id: true },
    })
    if (duplicateVersion && duplicateVersion.id !== versionId) {
      throw new Error(`版本 ${nextVersion} 已存在`)
    }
  }

  const shouldReplaceArtifacts =
    payload.artifacts !== undefined
    || payload.downloadUrl !== undefined
    || payload.downloadUrls !== undefined

  const updateData: Prisma.VersionUpdateInput = {
    version: nextVersion,
  }

  if (payload.changelog !== undefined) {
    updateData.changelog = payload.changelog?.trim() || ''
  }

  if (payload.defaultForceUpdate !== undefined || payload.forceUpdate !== undefined) {
    updateData.defaultForceUpdate = Boolean(payload.defaultForceUpdate ?? payload.forceUpdate)
  }

  if (payload.defaultArchitectureKey !== undefined) {
    updateData.defaultArchitectureKey = normalizeArchitectureKey(payload.defaultArchitectureKey)
  }

  let removedArtifacts: ArtifactCleanupEntry[] = []

  await tx.version.update({
    where: { id: versionId },
    data: updateData,
  })

  if (shouldReplaceArtifacts) {
    const { architectures, defaultArchitecture } = await ensureDefaultArchitecture(tx, projectId)
    const architectureKeys = new Set(architectures.map((architecture) => architecture.key))
    const explicitDefaultArchitectureKey = payload.defaultArchitectureKey !== undefined
      ? payload.defaultArchitectureKey
      : existingVersion.defaultArchitectureKey

    const resolvedArtifacts = await normalizeArtifactsPayload(tx, projectId, {
      ...payload,
      version: nextVersion,
      defaultArchitectureKey: explicitDefaultArchitectureKey,
    })

    const effectiveDefaultArchitectureKey = resolveDefaultArchitectureKey(
      explicitDefaultArchitectureKey,
      architectureKeys,
      normalizeArchitectureKey(explicitDefaultArchitectureKey)
        || resolvedArtifacts.find((artifact) => artifact.fileRole === 'PRIMARY')?.architectureKey
        || defaultArchitecture.key
        || DEFAULT_ARCHITECTURE_KEY,
    )

    await tx.version.update({
      where: { id: versionId },
      data: {
        defaultArchitectureKey: effectiveDefaultArchitectureKey,
      },
    })

    await tx.versionArtifact.deleteMany({
      where: { versionId },
    })

    await tx.versionArtifact.createMany({
      data: resolvedArtifacts.map((artifact) => ({
        versionId,
        architectureId: artifact.architectureId,
        artifactType: artifact.artifactType,
        fileRole: artifact.fileRole,
        displayName: artifact.displayName,
        fileName: artifact.fileName,
        downloadUrl: artifact.downloadUrl,
        size: artifact.size,
        md5: artifact.md5,
        md5Source: artifact.md5Source,
        storageProvider: artifact.storageProvider,
        objectKey: artifact.objectKey,
        storageConfigId: artifact.storageConfigId,
        forceUpdateOverride: artifact.forceUpdateOverride,
        enabled: artifact.enabled,
        sortOrder: artifact.sortOrder,
      })),
    })

    removedArtifacts = diffArtifactCleanupEntries(
      toArtifactCleanupEntries(existingVersion),
      toArtifactCleanupEntriesFromResolved(resolvedArtifacts),
    )
  }

  let synced = await syncVersionCompatibilityFields(tx, versionId)

  if (payload.isCurrent === true) {
    await setCurrentVersionById(tx, projectId, versionId)
    synced = await syncVersionCompatibilityFields(tx, versionId)
  } else if (payload.isCurrent === false && existingVersion.isCurrent) {
    await tx.version.update({
      where: { id: versionId },
      data: { isCurrent: false },
    })
    await resetCurrentVersionAfterRemoval(tx, projectId, versionId)
    synced = await syncVersionCompatibilityFields(tx, versionId)
  } else if (existingVersion.isCurrent && nextVersion !== existingVersion.version) {
    await tx.project.update({
      where: { id: projectId },
      data: { currentVersion: nextVersion },
    })
  }

  return {
    serializedVersion: serializeVersionDetail(synced.version, synced.architectures, synced.version.defaultArchitectureKey),
    removedArtifacts,
  }
}

export async function deleteVersionWithArtifacts(tx: DbClient, projectId: string, versionId: string) {
  const version = await tx.version.findFirst({
    where: {
      id: versionId,
      projectId,
    },
    include: versionForMutationInclude,
  })

  if (!version) {
    throw new Error('版本不存在')
  }

  const removedArtifacts = toArtifactCleanupEntries(version)

  await tx.version.delete({
    where: { id: versionId },
  })

  if (version.isCurrent) {
    await resetCurrentVersionAfterRemoval(tx, projectId, versionId)
  }

  return {
    deletedVersion: version,
    removedArtifacts,
  }
}
