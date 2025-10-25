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

    // 安全地解析请求体
    let body: any = {}
    try {
      const text = await req.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch (e) {
      console.error('解析请求体失败:', e)
      return NextResponse.json({ error: '无效的请求体' }, { status: 400 })
    }

    const { name } = body

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
      include: { versions: { select: { downloadUrl: true, storageProvider: true, objectKey: true, storageConfigId: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 收集所有版本的对象并尝试删除
    try {
      const { getProviderByConfigId, getActiveStorageProvider } = await import('@/lib/storage')
      for (const v of project.versions as any[]) {
        if (v.objectKey && v.storageProvider) {
          let provider = null
          if (v.storageConfigId) provider = await getProviderByConfigId(v.storageConfigId)
          if (!provider) {
            const sel = await getActiveStorageProvider(project.userId)
            provider = sel.provider
          }
          if (provider && typeof (provider as any).deleteObject === 'function') {
            await (provider as any).deleteObject({ projectId: id, objectKey: v.objectKey })
          }
        }
      }
    } catch (e) { console.warn('远程对象清理失败（已忽略）：', e) }

    // 同步清理本地 uploads 目录（兼容旧数据）
    const fileUrls = project.versions
      .map((v:any) => v.downloadUrl)
      .filter((url:any) => url && url.startsWith('/uploads/'))
    if (fileUrls.length > 0) {
      const deletedCount = await deleteFiles(fileUrls)
      console.log(`删除了 ${deletedCount} 个本地文件`)
    }
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