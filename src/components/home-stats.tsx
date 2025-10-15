'use client'

import { useEffect, useState } from 'react'
import { Users, FolderOpen } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface Stats {
  totalUsers: number
  totalProjects: number
}

export default function HomeStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/public/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
      // 设置默认值
      setStats({ totalUsers: 0, totalProjects: 0 })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-orange-100 dark:border-gray-700">
          <Skeleton className="h-12 w-12 rounded mb-3" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-orange-100 dark:border-gray-700">
          <Skeleton className="h-12 w-12 rounded mb-3" />
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-orange-100 dark:border-gray-700 transition-all hover:shadow-md">
        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg mb-3">
          <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          {stats?.totalUsers.toLocaleString() || '0'}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          已注册用户
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-orange-100 dark:border-gray-700 transition-all hover:shadow-md">
        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg mb-3">
          <FolderOpen className="h-6 w-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          {stats?.totalProjects.toLocaleString() || '0'}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          累计项目
        </div>
      </div>
    </div>
  )
}