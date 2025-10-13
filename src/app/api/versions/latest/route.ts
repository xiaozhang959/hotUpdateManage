import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    // 从请求头或请求体获取API密钥
    const apiKeyFromHeader = req.headers.get('X-API-Key')
    const body = await req.json().catch(() => ({}))
    const apiKey = apiKeyFromHeader || body.apiKey

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API密钥缺失' },
        { status: 401 }
      )
    }

    // 查找对应的项目
    const project = await prisma.project.findUnique({
      where: { apiKey }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'API密钥无效' },
        { status: 401 }
      )
    }

    // 获取当前活跃版本
    let currentVersion = null

    if (project.currentVersion) {
      // 如果项目设置了当前版本，获取该版本
      currentVersion = await prisma.version.findFirst({
        where: {
          projectId: project.id,
          version: project.currentVersion
        }
      })
    }

    // 如果没有设置当前版本或找不到，获取最新版本
    if (!currentVersion) {
      currentVersion = await prisma.version.findFirst({
        where: {
          projectId: project.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    }

    if (!currentVersion) {
      return NextResponse.json(
        { error: '该项目暂无发布版本' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        version: currentVersion.version,
        downloadUrl: currentVersion.downloadUrl,
        md5: currentVersion.md5,
        forceUpdate: currentVersion.forceUpdate,
        changelog: currentVersion.changelog,
        createdAt: currentVersion.createdAt,
        isCurrent: currentVersion.isCurrent
      }
    })
  } catch (error) {
    console.error('获取当前版本失败:', error)
    return NextResponse.json(
      { error: '获取当前版本失败' },
      { status: 500 }
    )
  }
}