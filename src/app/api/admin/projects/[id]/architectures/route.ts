import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createProjectArchitecture, listProjectArchitectures } from '@/lib/project-architecture-service'

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

export async function GET(
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

    const architectures = await prisma.$transaction((tx) => listProjectArchitectures(tx, id))
    return NextResponse.json(architectures)
  } catch (error) {
    console.error('获取项目架构失败:', error)
    return NextResponse.json({ error: '获取项目架构失败' }, { status: 500 })
  }
}

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
    const architecture = await prisma.$transaction((tx) => createProjectArchitecture(tx, id, payload))
    return NextResponse.json(architecture, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建项目架构失败'
    console.error('创建项目架构失败:', error)
    return NextResponse.json({ error: message }, { status: resolveErrorStatus(message) })
  }
}
