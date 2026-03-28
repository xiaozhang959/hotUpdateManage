import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  cleanupArtifactFiles,
  deleteVersionWithArtifacts,
  refreshProjectVersionCache,
  updateVersionWithArtifacts,
} from '@/lib/project-version-service'

function resolveErrorStatus(message: string) {
  if (message.includes('不存在')) return 404
  if (
    message.includes('已存在')
    || message.includes('请提供')
    || message.includes('至少需要')
    || message.includes('缺失')
    || message.includes('非法')
    || message.includes('必须')
  ) {
    return 400
  }
  return 500
}

// 更新版本（管理员）
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const session = await auth()
    const { id, versionId } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
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

    const payload = await req.json()
    const result = await prisma.$transaction((tx) => updateVersionWithArtifacts(tx, id, versionId, payload))

    await cleanupArtifactFiles(id, project.userId, result.removedArtifacts)
    await refreshProjectVersionCache(id)

    return NextResponse.json({
      message: '版本更新成功',
      version: result.serializedVersion,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新版本失败'
    console.error('更新版本失败:', error)
    return NextResponse.json({ error: message }, { status: resolveErrorStatus(message) })
  }
}

// 删除版本（管理员）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const session = await auth()
    const { id, versionId } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
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

    const result = await prisma.$transaction((tx) => deleteVersionWithArtifacts(tx, id, versionId))

    await cleanupArtifactFiles(id, project.userId, result.removedArtifacts)
    await refreshProjectVersionCache(id)

    return NextResponse.json({ message: '版本已删除' })
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除版本失败'
    console.error('删除版本失败:', error)
    return NextResponse.json({ error: message }, { status: resolveErrorStatus(message) })
  }
}
