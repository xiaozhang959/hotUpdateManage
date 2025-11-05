import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withSerializedSize } from '@/lib/server/serialize'
import { deleteFiles, deleteProjectUploadDir } from '@/lib/fileUtils'

// 更新项目（仅管理员）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    const { name, currentVersion } = await req.json()

    // 注意：绝不要允许修改项目ID，因为文件存储路径依赖于它
    const updateData: any = {}
    if (name) updateData.name = name
    if (currentVersion !== undefined) updateData.currentVersion = currentVersion

    // 如果更新了当前版本，需要同步更新版本表
    if (currentVersion !== undefined) {
      // 先将所有版本设置为非当前版本
      await prisma.version.updateMany({
        where: { projectId: id },
        data: { isCurrent: false }
      })

      // 设置新的当前版本
      if (currentVersion) {
        await prisma.version.updateMany({
          where: { 
            projectId: id,
            version: currentVersion
          },
          data: { isCurrent: true }
        })
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        versions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 5
        }
      }
    })

    const serialized = project && {
      ...project,
      versions: project.versions.map((v: any) => withSerializedSize(v))
    }
    return NextResponse.json(serialized)
  } catch (error) {
    console.error('更新项目失败:', error)
    return NextResponse.json(
      { error: '更新项目失败' },
      { status: 500 }
    )
  }
}

// 删除项目（仅管理员）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    // 先获取项目的所有版本文件URL
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        versions: {
          select: {
            downloadUrl: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 收集所有版本的文件URL
    const fileUrls = project.versions
      .map(v => v.downloadUrl)
      .filter(url => url && url.startsWith('/uploads/'))

    // 删除项目（版本会级联删除）
    await prisma.project.delete({
      where: { id }
    })

    // 删除所有关联的文件
    if (fileUrls.length > 0) {
      const deletedCount = await deleteFiles(fileUrls)
      console.log(`管理员删除项目 ${id}，删除了 ${deletedCount} 个文件`)
    }

    // 尝试删除项目的整个上传目录
    await deleteProjectUploadDir(id)

    return NextResponse.json({ message: '项目已删除' })
  } catch (error) {
    console.error('删除项目失败:', error)
    return NextResponse.json(
      { error: '删除项目失败' },
      { status: 500 }
    )
  }
}

// 获取项目详情（仅管理员）
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        versions: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            versions: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const serialized = project && {
      ...project,
      versions: project.versions.map((v: any) => withSerializedSize(v))
    }
    return NextResponse.json(serialized)
  } catch (error) {
    console.error('获取项目详情失败:', error)
    return NextResponse.json(
      { error: '获取项目详情失败' },
      { status: 500 }
    )
  }
}
