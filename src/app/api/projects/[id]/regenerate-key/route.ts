import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/crypto'

// 重新生成项目API密钥
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 检查项目是否属于当前用户
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
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
      message: 'API密钥已重新生成',
      project: updatedProject
    })
  } catch (error) {
    console.error('重新生成API密钥失败:', error)
    return NextResponse.json(
      { error: '重新生成API密钥失败' },
      { status: 500 }
    )
  }
}