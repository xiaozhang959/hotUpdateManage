import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取所有项目（仅管理员）
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    const projects = await prisma.project.findMany({
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
          take: 5  // 只获取最近5个版本
        },
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('获取项目列表失败:', error)
    return NextResponse.json(
      { error: '获取项目列表失败' },
      { status: 500 }
    )
  }
}