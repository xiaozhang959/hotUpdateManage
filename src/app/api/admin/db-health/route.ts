import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { dbMonitor } from '@/lib/db-monitor'
import { initializeSQLiteOptimizations, performDatabaseMaintenance } from '@/lib/db-config'
import { prisma } from '@/lib/prisma'

// GET /api/admin/db-health - 获取数据库健康状态
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      )
    }

    // 获取健康检查结果
    const health = await dbMonitor.checkHealth()
    
    // 获取数据库统计
    const stats = await dbMonitor.getDatabaseStats()
    
    // 获取查询分析报告
    const analysis = await dbMonitor.getQueryAnalysisReport()

    return NextResponse.json({
      success: true,
      data: {
        health,
        stats,
        analysis,
        metrics: dbMonitor.getMetrics()
      }
    })
  } catch (error) {
    console.error('Failed to get database health:', error)
    return NextResponse.json(
      { error: '获取数据库健康状态失败' },
      { status: 500 }
    )
  }
}

// POST /api/admin/db-health/optimize - 执行数据库优化
export async function POST(req: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { action } = body

    let result = null

    switch (action) {
      case 'optimize':
        // 应用SQLite优化
        await initializeSQLiteOptimizations(prisma)
        result = { message: 'SQLite优化已应用' }
        break

      case 'maintenance':
        // 执行维护任务
        await performDatabaseMaintenance(prisma)
        result = { message: '数据库维护已完成' }
        break

      case 'analyze':
        // 更新统计信息
        await prisma.$executeRawUnsafe('ANALYZE;')
        result = { message: '统计信息已更新' }
        break

      case 'vacuum':
        // 执行VACUUM
        await prisma.$executeRawUnsafe('VACUUM;')
        result = { message: 'VACUUM已执行' }
        break

      case 'reset-metrics':
        // 重置监控指标
        dbMonitor.resetMetrics()
        result = { message: '监控指标已重置' }
        break

      default:
        return NextResponse.json(
          { error: '未知操作' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Database optimization failed:', error)
    return NextResponse.json(
      { error: '数据库优化失败' },
      { status: 500 }
    )
  }
}