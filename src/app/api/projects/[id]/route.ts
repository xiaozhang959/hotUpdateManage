import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { versionCache } from '@/lib/cache/version-cache'
import { prisma } from '@/lib/prisma'
import { cleanupArtifactFiles, serializeProjectDetail } from '@/lib/project-version-service'
import {
  isProjectApiKeyTaken,
  isProjectApiKeyUniqueConstraintError,
  normalizeProjectApiKey,
  PROJECT_API_KEY_CONFLICT_MESSAGE,
  PROJECT_API_KEY_REQUIRED_MESSAGE,
  validateProjectApiKey,
} from '@/lib/server/project-api-key'
import { projectWithVersionDetailsInclude, versionArtifactInclude, versionArtifactsOrder } from '@/lib/version-artifacts'

// 获取项目详情
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params
    const architecture = new URL(req.url).searchParams.get('architecture')

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: projectWithVersionDetailsInclude,
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

// 更新项目
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as {
      name?: string
      apiKey?: string
    }
    const name = body.name?.trim()
    const hasApiKeyField = Object.prototype.hasOwnProperty.call(body, 'apiKey')
    const apiKey = normalizeProjectApiKey(body.apiKey)

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

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(apiKey ? { apiKey } : {}),
      },
      include: projectWithVersionDetailsInclude,
    })

    return NextResponse.json(serializeProjectDetail(updatedProject))
  } catch (error) {
    console.error('更新项目失败:', error)
    if (isProjectApiKeyUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: PROJECT_API_KEY_CONFLICT_MESSAGE },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: '更新项目失败' }, { status: 500 })
  }
}

// 删除项目
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
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
    await cleanupArtifactFiles(id, session.user.id, artifacts)
    await versionCache.clearProjectCache(id)

    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除项目失败:', error)
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 })
  }
}
