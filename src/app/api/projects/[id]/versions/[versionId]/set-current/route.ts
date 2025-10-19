import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { versionCache } from '@/lib/cache/version-cache'

// 设置当前活跃版本
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string, versionId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id, versionId } = await params

    // 验证项目所有权
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 验证版本是否存在
    const version = await prisma.version.findFirst({
      where: {
        id: versionId,
        projectId: id
      }
    })

    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 })
    }

    // 使用事务确保数据一致性
    await prisma.$transaction(async (tx) => {
      // 先将所有版本的isCurrent设为false
      await tx.version.updateMany({
        where: { projectId: id },
        data: { isCurrent: false }
      })

      // 设置选中版本为当前版本，并更新时间戳
      // 重新选择其它版本设为当前版本时需要修改updatedAt时间戳
      // 否则会导致基于时间戳检测的热更新失败
      await tx.version.update({
        where: { id: versionId },
        data: { 
          isCurrent: true,
          updatedAt: new Date() // 强制更新updatedAt时间戳
        }
      })

      // 更新项目的当前版本
      await tx.project.update({
        where: { id },
        data: { currentVersion: version.version }
      })
    })

    // 清理项目缓存，确保下次请求获取最新的当前版本
    await versionCache.clearProjectCache(id)
    
    // 预热缓存，缓存新的当前版本
    const updatedVersion = await prisma.version.findUnique({
      where: { id: versionId }
    })
    if (updatedVersion) {
      await versionCache.warmupCache(id, updatedVersion)
    }

    return NextResponse.json({
      message: '当前版本已设置为 ' + version.version
    })
  } catch (error) {
    console.error('设置当前版本失败:', error)
    return NextResponse.json(
      { error: '设置当前版本失败' },
      { status: 500 }
    )
  }
}