import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 根据用户角色返回不同的统计数据
    const isAdmin = session.user.role === 'ADMIN'

    if (isAdmin) {
      // 管理员可以看到全部统计
      const [totalUsers, totalProjects, totalVersions, activeUsers] = await Promise.all([
        prisma.user.count(),
        prisma.project.count(),
        prisma.version.count(),
        prisma.user.count({
          where: {
            projects: {
              some: {}
            }
          }
        })
      ])

      // 最近7天的数据
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const [recentUsers, recentProjects, recentVersions] = await Promise.all([
        prisma.user.count({
          where: {
            createdAt: {
              gte: sevenDaysAgo
            }
          }
        }),
        prisma.project.count({
          where: {
            createdAt: {
              gte: sevenDaysAgo
            }
          }
        }),
        prisma.version.count({
          where: {
            createdAt: {
              gte: sevenDaysAgo
            }
          }
        })
      ])

      return NextResponse.json({
        total: {
          users: totalUsers,
          projects: totalProjects,
          versions: totalVersions,
          activeUsers
        },
        recent: {
          users: recentUsers,
          projects: recentProjects,
          versions: recentVersions
        }
      })
    } else {
      // 普通用户只能看到自己的统计
      const [myProjects, myVersions] = await Promise.all([
        prisma.project.count({
          where: { userId: session.user.id }
        }),
        prisma.version.count({
          where: {
            project: {
              userId: session.user.id
            }
          }
        })
      ])

      // 最活跃的项目
      const mostActiveProject = await prisma.project.findFirst({
        where: { userId: session.user.id },
        orderBy: {
          versions: {
            _count: 'desc'
          }
        },
        include: {
          _count: {
            select: {
              versions: true
            }
          }
        }
      })

      return NextResponse.json({
        myStats: {
          projects: myProjects,
          versions: myVersions,
          mostActiveProject: mostActiveProject ? {
            name: mostActiveProject.name,
            versionCount: mostActiveProject._count.versions
          } : null
        }
      })
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    )
  }
}