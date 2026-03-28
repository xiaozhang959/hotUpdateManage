import { Prisma, PrismaClient } from '@prisma/client'
import { ensureDefaultArchitecture, projectArchitectureOrder } from '@/lib/version-artifacts'

type DbClient = PrismaClient | Prisma.TransactionClient

export interface ArchitectureMutationPayload {
  key?: string | null
  name?: string | null
  sortOrder?: number | null
  enabled?: boolean | null
  isDefault?: boolean | null
}

function normalizeArchitectureKeyValue(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

function normalizeArchitectureName(value?: string | null) {
  return value?.trim() || null
}

function serializeArchitecture(architecture: {
  id: string
  projectId: string
  key: string
  name: string
  sortOrder: number
  enabled: boolean
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}) {
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

export async function listProjectArchitectures(tx: DbClient, projectId: string) {
  const { architectures } = await ensureDefaultArchitecture(tx, projectId)
  return architectures.map(serializeArchitecture)
}

export async function createProjectArchitecture(tx: DbClient, projectId: string, payload: ArchitectureMutationPayload) {
  const key = normalizeArchitectureKeyValue(payload.key)
  const name = normalizeArchitectureName(payload.name)

  if (!key) {
    throw new Error('请提供架构 key')
  }
  if (!/^[a-z0-9._-]+$/.test(key)) {
    throw new Error('架构 key 仅支持小写字母、数字、点、下划线和中划线')
  }
  if (!name) {
    throw new Error('请提供架构名称')
  }

  const existing = await tx.projectArchitecture.findUnique({
    where: {
      projectId_key: {
        projectId,
        key,
      },
    },
    select: { id: true },
  })
  if (existing) {
    throw new Error(`架构 ${key} 已存在`)
  }

  const existingArchitectures = await tx.projectArchitecture.findMany({
    where: { projectId },
    orderBy: projectArchitectureOrder,
  })
  const shouldBeDefault = payload.isDefault === true || existingArchitectures.length === 0
  const sortOrder = Number.isFinite(Number(payload.sortOrder))
    ? Number(payload.sortOrder)
    : existingArchitectures.length

  if (shouldBeDefault) {
    await tx.projectArchitecture.updateMany({
      where: { projectId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const created = await tx.projectArchitecture.create({
    data: {
      projectId,
      key,
      name,
      sortOrder,
      enabled: payload.enabled === null || payload.enabled === undefined ? true : Boolean(payload.enabled),
      isDefault: shouldBeDefault,
    },
  })

  return serializeArchitecture(created)
}

export async function updateProjectArchitecture(
  tx: DbClient,
  projectId: string,
  architectureId: string,
  payload: ArchitectureMutationPayload,
) {
  const architecture = await tx.projectArchitecture.findFirst({
    where: {
      id: architectureId,
      projectId,
    },
  })

  if (!architecture) {
    throw new Error('架构不存在')
  }

  const nextKey = payload.key !== undefined ? normalizeArchitectureKeyValue(payload.key) : architecture.key
  const nextName = payload.name !== undefined ? normalizeArchitectureName(payload.name) : architecture.name

  if (!nextKey) {
    throw new Error('请提供架构 key')
  }
  if (!/^[a-z0-9._-]+$/.test(nextKey)) {
    throw new Error('架构 key 仅支持小写字母、数字、点、下划线和中划线')
  }
  if (!nextName) {
    throw new Error('请提供架构名称')
  }

  if (nextKey !== architecture.key) {
    const duplicate = await tx.projectArchitecture.findUnique({
      where: {
        projectId_key: {
          projectId,
          key: nextKey,
        },
      },
      select: { id: true },
    })
    if (duplicate && duplicate.id !== architectureId) {
      throw new Error(`架构 ${nextKey} 已存在`)
    }
  }

  const shouldBeDefault = payload.isDefault === true
  if (shouldBeDefault) {
    await tx.projectArchitecture.updateMany({
      where: {
        projectId,
        isDefault: true,
        id: { not: architectureId },
      },
      data: { isDefault: false },
    })
  }

  const updated = await tx.projectArchitecture.update({
    where: { id: architectureId },
    data: {
      key: nextKey,
      name: nextName,
      ...(payload.sortOrder !== undefined ? { sortOrder: Number(payload.sortOrder) || 0 } : {}),
      ...(payload.enabled !== undefined ? { enabled: Boolean(payload.enabled) } : {}),
      ...(payload.isDefault !== undefined ? { isDefault: Boolean(payload.isDefault) } : {}),
    },
  })

  if (nextKey !== architecture.key) {
    await tx.version.updateMany({
      where: {
        projectId,
        defaultArchitectureKey: architecture.key,
      },
      data: { defaultArchitectureKey: nextKey },
    })
  }

  if (architecture.isDefault && payload.isDefault === false) {
    const replacement = await tx.projectArchitecture.findFirst({
      where: {
        projectId,
        id: { not: architectureId },
      },
      orderBy: projectArchitectureOrder,
    })
    if (replacement) {
      await tx.projectArchitecture.update({
        where: { id: replacement.id },
        data: { isDefault: true },
      })
      await tx.version.updateMany({
        where: {
          projectId,
          defaultArchitectureKey: nextKey,
        },
        data: { defaultArchitectureKey: replacement.key },
      })
    }
  }

  return serializeArchitecture(updated)
}

export async function deleteProjectArchitecture(tx: DbClient, projectId: string, architectureId: string) {
  const architectures = await tx.projectArchitecture.findMany({
    where: { projectId },
    orderBy: projectArchitectureOrder,
  })
  const architecture = architectures.find((item) => item.id === architectureId)

  if (!architecture) {
    throw new Error('架构不存在')
  }
  if (architectures.length <= 1) {
    throw new Error('至少保留一个架构，无法删除最后一个架构')
  }

  const artifactCount = await tx.versionArtifact.count({
    where: { architectureId },
  })
  if (artifactCount > 0) {
    throw new Error('该架构下仍有关联产物，请先移除相关版本产物后再删除')
  }

  await tx.projectArchitecture.delete({ where: { id: architectureId } })

  if (architecture.isDefault) {
    const replacement = architectures.find((item) => item.id !== architectureId)
    if (replacement) {
      await tx.projectArchitecture.update({
        where: { id: replacement.id },
        data: { isDefault: true },
      })
      await tx.version.updateMany({
        where: {
          projectId,
          defaultArchitectureKey: architecture.key,
        },
        data: { defaultArchitectureKey: replacement.key },
      })
    }
  }

  return serializeArchitecture(architecture)
}
