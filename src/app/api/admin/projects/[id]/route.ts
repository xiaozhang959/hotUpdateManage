import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { versionCache } from '@/lib/cache/version-cache'
import { prisma } from '@/lib/prisma'
import { cleanupArtifactFiles, serializeProjectDetail, setCurrentVersionById } from '@/lib/project-version-service'
import {
  isProjectApiKeyTaken,
  isProjectApiKeyUniqueConstraintError,
  normalizeProjectApiKey,
  PROJECT_API_KEY_CONFLICT_MESSAGE,
  PROJECT_API_KEY_REQUIRED_MESSAGE,
  validateProjectApiKey,
} from '@/lib/server/project-api-key'
import { projectArchitectureOrder, versionArtifactInclude, versionArtifactsOrder } from '@/lib/version-artifacts'

// 更新项目（仅管理员）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({})) as {
      name?: string
      apiKey?: string
      currentVersion?: string | null
    }
    const name = body.name?.trim()
    const hasApiKeyField = Object.prototype.hasOwnProperty.call(body, 'apiKey')
    const apiKey = normalizeProjectApiKey(body.apiKey)
    const currentVersion = body.currentVersion === undefined ? undefined : (body.currentVersion?.trim() || null)

    if (hasApiKeyField) {
      if (!apiKey) {
        return NextResponse.json(
          { error: PROJECT_API_KEY_REQUIRED_MESSAGE },
          { status: 400 },
        )
      }

      const apiKeyError = validateProjectApiKey(apiKey)
      if (apiKeyError) {
        return NextResponse.json({ error: apiKeyError }, { status: 400 })
      }

      if (await isProjectApiKeyTaken(apiKey, id)) {
        return NextResponse.json(
          { error: PROJECT_API_KEY_CONFLICT_MESSAGE },
          { status: 409 },
        )
      }
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      const projectChanges = {
        ...(name ? { name } : {}),
        ...(apiKey ? { apiKey } : {}),
      }

      if (Object.keys(projectChanges).length > 0) {
        await tx.project.update({
          where: { id },
          data: projectChanges,
        })
      }

      if (currentVersion !== undefined) {
        if (!currentVersion) {
          await tx.version.updateMany({
            where: { projectId: id },
            data: { isCurrent: false },
          })
          await tx.project.update({
            where: { id },
            data: { currentVersion: null },
          })
        } else {
          const target = await tx.version.findUnique({
            where: {
              projectId_version: {
                projectId: id,
                version: currentVersion,
              },
            },
            select: { id: true },
          })
          if (!target) {
            throw new Error('指定的当前版本不存在')
          }
          await setCurrentVersionById(tx, id, target.id)
        }
      }
    })

    const updatedProject = await prisma.project.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        architectures: {
          orderBy: projectArchitectureOrder,
        },
        versions: {
          include: {
            artifacts: {
              include: versionArtifactInclude,
              orderBy: versionArtifactsOrder,
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        },
      },
    })

    await versionCache.clearProjectCache(id)

    return NextResponse.json(updatedProject ? serializeProjectDetail(updatedProject) : null)
  } catch (error) {
    console.error('更新项目失败:', error)
    if (isProjectApiKeyUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: PROJECT_API_KEY_CONFLICT_MESSAGE },
        { status: 409 },
      )
    }

    const message = error instanceof Error ? error.message : '更新项目失败'
    return NextResponse.json(
      { error: message },
      { status: message.includes('不存在') ? 404 : 500 },
    )
  }
}

// 删除项目（仅管理员）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        versions: {
          include: {
            artifacts: {
              include: versionArtifactInclude,
              orderBy: versionArtifactsOrder,
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const artifacts = project.versions.flatMap((version) =>
      version.artifacts.map((artifact) => ({
        downloadUrl: artifact.downloadUrl,
        storageProvider: artifact.storageProvider,
        objectKey: artifact.objectKey,
        storageConfigId: artifact.storageConfigId,
      })),
    )

    await prisma.project.delete({ where: { id } })
    await cleanupArtifactFiles(id, project.userId, artifacts)
    await versionCache.clearProjectCache(id)

    return NextResponse.json({ message: '项目已删除' })
  } catch (error) {
    console.error('删除项目失败:', error)
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 })
  }
}

// 获取项目详情（仅管理员）
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params
    const architecture = new URL(req.url).searchParams.get('architecture')

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        architectures: {
          orderBy: projectArchitectureOrder,
        },
        versions: {
          include: {
            artifacts: {
              include: versionArtifactInclude,
              orderBy: versionArtifactsOrder,
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    return NextResponse.json(serializeProjectDetail(project, architecture))
  } catch (error) {
    console.error('获取项目详情失败:', error)
    return NextResponse.json({ error: '获取项目详情失败' }, { status: 500 })
  }
}
