import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 公开的统计API，用于主页展示
export async function GET() {
  try {
    // 并行获取统计数据
    const [totalUsers, totalProjects] = await Promise.all([
      prisma.user.count(),
      prisma.project.count()
    ])

    return NextResponse.json({
      totalUsers,
      totalProjects
    })
  } catch (error) {
    console.error('获取公开统计数据失败:', error)
    // 如果获取失败，返回默认值
    return NextResponse.json({
      totalUsers: 0,
      totalProjects: 0
    })
  }
}