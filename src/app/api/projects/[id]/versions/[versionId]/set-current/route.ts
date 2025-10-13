import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 设置当前活跃版本
export async function POST(
  req: Request,
  { params }: { params: { id: string, versionId: string } }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 验证项目所有权
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 验证版本是否存在
    const version = await prisma.version.findFirst({
      where: {
        id: params.versionId,
        projectId: params.id
      }
    })

    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 })
    }

    // 使用事务确保数据一致性
    await prisma.$transaction(async (tx) => {
      // 先将所有版本的isCurrent设为false
      await tx.version.updateMany({
        where: { projectId: params.id },
        data: { isCurrent: false }
      })

      // 设置选中版本为当前版本
      await tx.version.update({
        where: { id: params.versionId },
        data: { isCurrent: true }
      })

      // 更新项目的当前版本
      await tx.project.update({
        where: { id: params.id },
        data: { currentVersion: version.version }
      })
    })

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