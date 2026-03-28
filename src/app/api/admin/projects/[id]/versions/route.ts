import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createVersionWithArtifacts, refreshProjectVersionCache } from '@/lib/project-version-service'

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

// 添加新版本（管理员）
export async function POST(
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
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const payload = await req.json()
    const createdVersion = await prisma.$transaction((tx) =>
      createVersionWithArtifacts(tx, id, {
        ...payload,
        isCurrent: payload?.isCurrent ?? true,
      }),
    )

    await refreshProjectVersionCache(id)

    return NextResponse.json({
      message: '版本创建成功',
      version: createdVersion,
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建版本失败'
    console.error('创建版本失败:', error)
    return NextResponse.json({ error: message }, { status: resolveErrorStatus(message) })
  }
}
