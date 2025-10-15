import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 删除版本（管理员）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const session = await auth()
    const { id, versionId } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    // 检查版本是否存在
    const version = await prisma.version.findFirst({
      where: {
        id: versionId,
        projectId: id
      }
    })

    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 })
    }

    // 如果删除的是当前版本，需要更新项目的当前版本
    if (version.isCurrent) {
      // 获取最新的其他版本
      const latestVersion = await prisma.version.findFirst({
        where: {
          projectId: id,
          id: { not: versionId }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // 更新项目的当前版本
      await prisma.project.update({
        where: { id },
        data: {
          currentVersion: latestVersion?.version || null
        }
      })

      // 如果有其他版本，将最新的设为当前版本
      if (latestVersion) {
        await prisma.version.update({
          where: { id: latestVersion.id },
          data: { isCurrent: true }
        })
      }
    }

    // 删除版本
    await prisma.version.delete({
      where: { id: versionId }
    })

    return NextResponse.json({ message: '版本已删除' })
  } catch (error) {
    console.error('删除版本失败:', error)
    return NextResponse.json(
      { error: '删除版本失败' },
      { status: 500 }
    )
  }
}