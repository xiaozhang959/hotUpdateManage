import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deleteProjectArchitecture, updateProjectArchitecture } from '@/lib/project-architecture-service'

function resolveErrorStatus(message: string) {
  if (message.includes('不存在')) return 404
  if (
    message.includes('请提供')
    || message.includes('已存在')
    || message.includes('无法删除')
    || message.includes('仍有关联产物')
    || message.includes('仅支持')
  ) {
    return 400
  }
  return 500
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; architectureId: string }> },
) {
  try {
    const session = await auth()
    const { id, architectureId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

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

    const payload = await req.json()
    const architecture = await prisma.$transaction((tx) => updateProjectArchitecture(tx, id, architectureId, payload))
    return NextResponse.json(architecture)
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新项目架构失败'
    console.error('更新项目架构失败:', error)
    return NextResponse.json({ error: message }, { status: resolveErrorStatus(message) })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; architectureId: string }> },
) {
  try {
    const session = await auth()
    const { id, architectureId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

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

    const architecture = await prisma.$transaction((tx) => deleteProjectArchitecture(tx, id, architectureId))
    return NextResponse.json({
      message: `架构 ${architecture.name} 已删除`,
      architecture,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除项目架构失败'
    console.error('删除项目架构失败:', error)
    return NextResponse.json({ error: message }, { status: resolveErrorStatus(message) })
  }
}
