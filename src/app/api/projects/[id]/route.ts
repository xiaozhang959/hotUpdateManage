import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { versionCache } from '@/lib/cache/version-cache'
import { prisma } from '@/lib/prisma'
import { cleanupArtifactFiles, serializeProjectDetail } from '@/lib/project-version-service'
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

    const body = await req.json().catch(() => ({})) as { name?: string }
    const name = body.name?.trim()

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
      },
      include: projectWithVersionDetailsInclude,
    })

    return NextResponse.json(serializeProjectDetail(updatedProject))
  } catch (error) {
    console.error('更新项目失败:', error)
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
