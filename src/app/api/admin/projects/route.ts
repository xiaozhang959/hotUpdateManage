import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializeProjectSummary } from '@/lib/project-version-service'
import { projectArchitectureOrder, versionArtifactInclude, versionArtifactsOrder } from '@/lib/version-artifacts'

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
            email: true,
          },
        },
        architectures: {
          orderBy: projectArchitectureOrder,
        },
        versions: {
          include: {
            artifacts: {
              include: versionArtifactInclude,
              orderBy: versionArtifactsOrder,
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return NextResponse.json(projects.map((project) => serializeProjectSummary(project)))
  } catch (error) {
    console.error('获取项目列表失败:', error)
    return NextResponse.json({ error: '获取项目列表失败' }, { status: 500 })
  }
}
