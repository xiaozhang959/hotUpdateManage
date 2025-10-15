import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { getConfig } from '@/lib/system-config'

// 获取用户的所有项目
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 优化查询：只选择需要的字段，减少数据传输
    const projects = await prisma.project.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        currentVersion: true,
        createdAt: true,
        updatedAt: true,
        // 只获取最新版本的基本信息
        versions: {
          select: {
            id: true,
            version: true,
            createdAt: true,
            isCurrent: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        // 统计版本数量
        _count: {
          select: {
            versions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('获取项目失败:', error)
    return NextResponse.json(
      { error: '获取项目失败' },
      { status: 500 }
    )
  }
}

// 创建项目
export async function POST(req: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }
    
    
    const { name } = await req.json()
    
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: '项目名称不能为空' },
        { status: 400 }
      )
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        apiKey: generateApiKey(),
        userId: session.user.id
      },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        _count: {
          select: {
            versions: true
          }
        }
      }
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('创建项目失败:', error)
    return NextResponse.json(
      { error: '创建项目失败' },
      { status: 500 }
    )
  }
}

// 生成 API Key
function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}
