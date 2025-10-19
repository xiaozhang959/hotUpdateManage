import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteFiles, deleteProjectUploadDir } from '@/lib/fileUtils'

// 获取项目详情
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id
      },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('获取项目详情失败:', error)
    return NextResponse.json(
      { error: '获取项目详情失败' },
      { status: 500 }
    )
  }
}

// 更新项目
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { name } = await req.json()

    // 注意：绝不要允许修改项目ID，因为文件存储路径依赖于它
    // 只允许修改项目名称等安全字段
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const updatedProject = await prisma.project.update({
      where: { id: id },
      data: { name }
    })

    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error('更新项目失败:', error)
    return NextResponse.json(
      { error: '更新项目失败' },
      { status: 500 }
    )
  }
}

// 删除项目
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id
      },
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

    // 删除项目（会级联删除所有版本）
    await prisma.project.delete({
      where: { id: id }
    })

    // 删除所有关联的文件
    if (fileUrls.length > 0) {
      const deletedCount = await deleteFiles(fileUrls)
      console.log(`删除了 ${deletedCount} 个文件`)
    }

    // 尝试删除项目的整个上传目录
    await deleteProjectUploadDir(id)

    return NextResponse.json({ message: '删除成功' })
  } catch (error) {
    console.error('删除项目失败:', error)
    return NextResponse.json(
      { error: '删除项目失败' },
      { status: 500 }
    )
  }
}