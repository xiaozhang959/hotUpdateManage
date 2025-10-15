import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeCharts = searchParams.get('includeCharts') === 'true'

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

      let chartData = {}
      
      if (includeCharts) {
        // 生成过去30天的图表数据
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        // API请求统计（从数据库读取真实数据）
        const apiRequestsData = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
          
          const [totalRequests, successRequests] = await Promise.all([
            prisma.apiRequest.count({
              where: {
                createdAt: {
                  gte: startOfDay,
                  lt: endOfDay
                }
              }
            }),
            prisma.apiRequest.count({
              where: {
                createdAt: {
                  gte: startOfDay,
                  lt: endOfDay
                },
                statusCode: {
                  gte: 200,
                  lt: 400
                }
              }
            })
          ])
          
          apiRequestsData.push({
            date: date.toISOString().split('T')[0],
            requests: totalRequests,
            successRate: totalRequests > 0 ? (successRequests / totalRequests * 100) : 100
          })
        }
        
        // 用户增长数据
        const userGrowthData = []
        let cumulativeUsers = 0
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          
          const dailyUsers = await prisma.user.count({
            where: {
              createdAt: {
                gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
              }
            }
          })
          
          cumulativeUsers += dailyUsers
          
          userGrowthData.push({
            date: date.toISOString().split('T')[0],
            newUsers: dailyUsers,
            totalUsers: await prisma.user.count({
              where: {
                createdAt: {
                  lte: date
                }
              }
            })
          })
        }
        
        // 项目版本分布
        const projectsWithVersions = await prisma.project.findMany({
          include: {
            _count: {
              select: {
                versions: true
              }
            }
          },
          orderBy: {
            versions: {
              _count: 'desc'
            }
          },
          take: 6
        })
        
        const projectsData = projectsWithVersions.map(project => ({
          name: project.name,
          versions: project._count.versions,
          color: ''
        }))
        
        // 邮件统计数据（从数据库读取真实数据）
        const emailStatsData = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
          
          const [sent, failed] = await Promise.all([
            prisma.emailLog.count({
              where: {
                createdAt: {
                  gte: startOfDay,
                  lt: endOfDay
                },
                status: 'sent'
              }
            }),
            prisma.emailLog.count({
              where: {
                createdAt: {
                  gte: startOfDay,
                  lt: endOfDay
                },
                status: 'failed'
              }
            })
          ])
          
          emailStatsData.push({
            date: date.toISOString().split('T')[0],
            sent,
            failed
          })
        }
        
        chartData = {
          apiRequests: apiRequestsData,
          userGrowth: userGrowthData,
          projects: projectsData,
          emailStats: emailStatsData
        }
      }

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
        },
        charts: chartData
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