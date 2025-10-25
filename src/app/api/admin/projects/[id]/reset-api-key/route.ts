import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/crypto'

// 重置项目API密钥（仅管理员）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    // 检查项目是否存在
    const project = await prisma.project.findUnique({
      where: { id }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 生成新的API密钥
    const newApiKey = generateApiKey()

    // 更新项目的API密钥
    const updatedProject = await prisma.project.update({
      where: { id },
      data: { apiKey: newApiKey },
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
        },
        _count: {
          select: {
            versions: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'API密钥已重置',
      project: updatedProject
    })
  } catch (error) {
    console.error('重置API密钥失败:', error)
    return NextResponse.json(
      { error: '重置API密钥失败' },
      { status: 500 }
    )
  }
}