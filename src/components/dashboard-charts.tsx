'use client'

import { useEffect, useState } from 'react'
import { ApiRequestsChart } from './charts/api-requests-chart'
import { ProjectsChart } from './charts/projects-chart'
import { UserGrowthChart } from './charts/user-growth-chart'
import { EmailStatsChart } from './charts/email-stats-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Activity, Mail, Package } from 'lucide-react'

interface StatsData {
  total: {
    users: number
    projects: number
    versions: number
    activeUsers: number
  }
  recent: {
    users: number
    projects: number
    versions: number
  }
  charts?: {
    apiRequests: Array<{ date: string; requests: number; successRate: number }>
    userGrowth: Array<{ date: string; newUsers: number; totalUsers: number }>
    projects: Array<{ name: string; versions: number; color: string }>
    emailStats: Array<{ date: string; sent: number; failed: number }>
  }
}

interface DashboardChartsProps {
  isAdmin?: boolean
}

export function DashboardCharts({ isAdmin = false }: DashboardChartsProps) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats?includeCharts=true')
        if (response.ok) {
          const data = await response.json()
          console.log('Stats API Response:', data) // 调试信息
          setStats(data)
        }
      } catch (error) {
        console.error('获取统计数据失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">加载中...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <div className="h-[250px] bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return <div>加载数据失败</div>
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总用户数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total.users}</div>
                <p className="text-xs text-muted-foreground">
                  最近7天: +{stats.recent.users}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总项目数</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total.projects}</div>
                <p className="text-xs text-muted-foreground">
                  最近7天: +{stats.recent.projects}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总版本数</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total.versions}</div>
                <p className="text-xs text-muted-foreground">
                  最近7天: +{stats.recent.versions}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total.activeUsers}</div>
                <p className="text-xs text-muted-foreground">
                  有项目的用户
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">我的项目</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(stats as any).myStats?.projects || 0}</div>
                <p className="text-xs text-muted-foreground">
                  项目数量
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">我的版本</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(stats as any).myStats?.versions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  版本数量
                </p>
              </CardContent>
            </Card>

            {(stats as any).myStats?.mostActiveProject && (
              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">最活跃项目</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{(stats as any).myStats.mostActiveProject.name}</div>
                  <p className="text-xs text-muted-foreground">
                    {(stats as any).myStats.mostActiveProject.versionCount} 个版本
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* 图表区域 - 仅管理员可见 */}
      {isAdmin && stats.charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ApiRequestsChart 
            data={stats.charts.apiRequests} 
            isLoading={false} 
          />
          <UserGrowthChart 
            data={stats.charts.userGrowth} 
            isLoading={false} 
          />
          <ProjectsChart 
            data={stats.charts.projects} 
            isLoading={false} 
          />
          <EmailStatsChart 
            data={stats.charts.emailStats} 
            isLoading={false} 
          />
        </div>
      )}
    </div>
  )
}