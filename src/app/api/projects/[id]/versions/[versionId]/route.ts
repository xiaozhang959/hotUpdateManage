import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteFile } from '@/lib/fileUtils'
import { versionCache } from '@/lib/cache/version-cache'

// 删除版本
export async function DELETE(
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

    // 保存文件URL用于删除
    const fileUrlToDelete = version.downloadUrl

    // 如果删除的是当前版本，需要更新项目的当前版本
    if (version.isCurrent || project.currentVersion === version.version) {
      // 获取其他版本
      const otherVersion = await prisma.version.findFirst({
        where: {
          projectId: params.id,
          id: { not: params.versionId }
        },
        orderBy: { createdAt: 'desc' }
      })

      // 使用事务更新
      await prisma.$transaction(async (tx) => {
        // 删除版本
        await tx.version.delete({
          where: { id: params.versionId }
        })

        // 如果有其他版本，设置最新的为当前版本
        if (otherVersion) {
          await tx.version.update({
            where: { id: otherVersion.id },
            data: { isCurrent: true }
          })
          await tx.project.update({
            where: { id: params.id },
            data: { currentVersion: otherVersion.version }
          })
        } else {
          // 没有其他版本了，清空当前版本
          await tx.project.update({
            where: { id: params.id },
            data: { currentVersion: null }
          })
        }
      })
    } else {
      // 不是当前版本，直接删除
      await prisma.version.delete({
        where: { id: params.versionId }
      })
    }

    // 删除关联的文件
    if (fileUrlToDelete) {
      await deleteFile(fileUrlToDelete)
    }
    
    // 清理项目缓存
    await versionCache.clearProjectCache(params.id)

    return NextResponse.json({ message: '版本已删除' })
  } catch (error) {
    console.error('删除版本失败:', error)
    return NextResponse.json(
      { error: '删除版本失败' },
      { status: 500 }
    )
  }
}