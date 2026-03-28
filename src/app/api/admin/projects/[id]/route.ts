import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { versionCache } from '@/lib/cache/version-cache'
import { prisma } from '@/lib/prisma'
import { cleanupArtifactFiles, serializeProjectDetail, setCurrentVersionById } from '@/lib/project-version-service'
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

    const body = await req.json().catch(() => ({})) as { name?: string; currentVersion?: string | null }
    const name = body.name?.trim()
    const currentVersion = body.currentVersion === undefined ? undefined : (body.currentVersion?.trim() || null)

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
      if (name) {
        await tx.project.update({
          where: { id },
          data: { name },
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
    const message = error instanceof Error ? error.message : '更新项目失败'
    console.error('更新项目失败:', error)
    return NextResponse.json({ error: message }, { status: message.includes('不存在') ? 404 : 500 })
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
