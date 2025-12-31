/**
 * 数据库性能监控服务
 */

import { prisma } from './prisma'
import { monitoringConfig } from './db-config'

interface QueryMetrics {
  queryCount: number
  slowQueryCount: number
  errorCount: number
  avgDuration: number
  maxDuration: number
  minDuration: number
  cacheHits: number
  cacheMisses: number
}

interface DatabaseStats {
  tableStats: {
    users: number
    projects: number
    versions: number
    configs: number
  }
  storageInfo: {
    size: number
    pageCount?: number
    pageSize?: number
  }
  performance: QueryMetrics
  timestamp: Date
}

class DatabaseMonitor {
  private metrics: QueryMetrics = {
    queryCount: 0,
    slowQueryCount: 0,
    errorCount: 0,
    avgDuration: 0,
    maxDuration: 0,
    minDuration: Infinity,
    cacheHits: 0,
    cacheMisses: 0,
  }

  private durations: number[] = []
  private readonly maxDurationSamples = 1000

  /**
   * 记录查询执行
   */
  recordQuery(duration: number, isError: boolean = false, isCacheHit: boolean = false) {
    this.metrics.queryCount++

    if (isError) {
      this.metrics.errorCount++
      return
    }

    if (isCacheHit) {
      this.metrics.cacheHits++
    } else {
      this.metrics.cacheMisses++
    }

    // 更新持续时间统计
    this.durations.push(duration)
    if (this.durations.length > this.maxDurationSamples) {
      this.durations.shift()
    }

    if (duration > monitoringConfig.alerts.slowQueryThreshold) {
      this.metrics.slowQueryCount++
    }

    this.metrics.maxDuration = Math.max(this.metrics.maxDuration, duration)
    this.metrics.minDuration = Math.min(this.metrics.minDuration, duration)
    this.metrics.avgDuration = this.durations.reduce((a, b) => a + b, 0) / this.durations.length
  }

  /**
   * 获取当前指标
   */
  getMetrics(): QueryMetrics {
    return { ...this.metrics }
  }

  /**
   * 重置指标
   */
  resetMetrics() {
    this.metrics = {
      queryCount: 0,
      slowQueryCount: 0,
      errorCount: 0,
      avgDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      cacheHits: 0,
      cacheMisses: 0,
    }
    this.durations = []
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      // 获取表统计
      const [userCount, projectCount, versionCount, configCount] = await Promise.all([
        prisma.user.count(),
        prisma.project.count(),
        prisma.version.count(),
        prisma.systemConfig.count(),
      ])

      // 获取SQLite特定的统计信息
      const pageCount = await prisma.$queryRaw<any>`PRAGMA page_count;`
      const pageSize = await prisma.$queryRaw<any>`PRAGMA page_size;`
      await prisma.$queryRaw<any>`PRAGMA wal_checkpoint(TRUNCATE);`

      const dbSize = pageCount?.[0]?.page_count * pageSize?.[0]?.page_size || 0

      return {
        tableStats: {
          users: userCount,
          projects: projectCount,
          versions: versionCount,
          configs: configCount,
        },
        storageInfo: {
          size: dbSize,
          pageCount: pageCount?.[0]?.page_count,
          pageSize: pageSize?.[0]?.page_size,
        },
        performance: this.getMetrics(),
        timestamp: new Date(),
      }
    } catch (error) {
      console.error('Failed to get database stats:', error)
      throw error
    }
  }

  /**
   * 检查数据库健康状态
   */
  async checkHealth(): Promise<{
    healthy: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // 检查数据库连接
      await prisma.$queryRaw`SELECT 1;`

      // 获取统计信息
      const stats = await this.getDatabaseStats()
      const metrics = this.getMetrics()

      // 检查错误率
      const errorRate = metrics.queryCount > 0 
        ? metrics.errorCount / metrics.queryCount 
        : 0

      if (errorRate > monitoringConfig.alerts.errorRateThreshold) {
        issues.push(`高错误率: ${(errorRate * 100).toFixed(2)}%`)
        recommendations.push('检查应用日志以识别错误来源')
      }

      // 检查慢查询
      const slowQueryRate = metrics.queryCount > 0
        ? metrics.slowQueryCount / metrics.queryCount
        : 0

      if (slowQueryRate > 0.1) {
        issues.push(`慢查询率过高: ${(slowQueryRate * 100).toFixed(2)}%`)
        recommendations.push('优化慢查询，考虑添加索引或重写查询')
      }

      // 检查缓存命中率
      const cacheHitRate = (metrics.cacheHits + metrics.cacheMisses) > 0
        ? metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
        : 0

      if (cacheHitRate < 0.7 && metrics.queryCount > 100) {
        recommendations.push(`缓存命中率较低: ${(cacheHitRate * 100).toFixed(2)}%，考虑优化缓存策略`)
      }

      // 检查数据库大小
      if (stats.storageInfo.size > 100 * 1024 * 1024) { // 100MB
        recommendations.push('数据库大小超过100MB，考虑清理旧数据或迁移到更强大的数据库系统')
      }

      // 检查表大小
      if (stats.tableStats.versions > 10000) {
        recommendations.push('版本表记录数较多，考虑归档旧版本')
      }

      return {
        healthy: issues.length === 0,
        issues,
        recommendations,
      }
    } catch (error) {
      return {
        healthy: false,
        issues: ['数据库连接失败: ' + error],
        recommendations: ['检查数据库连接配置和服务状态'],
      }
    }
  }

  /**
   * 获取查询分析报告
   */
  async getQueryAnalysisReport(): Promise<{
    topSlowQueries: any[]
    indexUsage: any[]
    queryPlan: any[]
  }> {
    try {
      // 获取SQLite查询统计
      const stats = await prisma.$queryRaw<any>`
        SELECT 
          sql,
          SUM(time) as total_time,
          COUNT(*) as count,
          AVG(time) as avg_time
        FROM sqlite_stat1
        GROUP BY sql
        ORDER BY total_time DESC
        LIMIT 10;
      `.catch(() => [])

      // 获取索引使用情况
      const indexUsage = await prisma.$queryRaw<any>`
        SELECT 
          name,
          tbl_name,
          sql
        FROM sqlite_master
        WHERE type = 'index'
        ORDER BY name;
      `

      return {
        topSlowQueries: stats || [],
        indexUsage: indexUsage || [],
        queryPlan: [],
      }
    } catch (error) {
      console.error('Failed to get query analysis:', error)
      return {
        topSlowQueries: [],
        indexUsage: [],
        queryPlan: [],
      }
    }
  }
}

// 创建单例实例
export const dbMonitor = new DatabaseMonitor()

// 监控中间件
export function createMonitoringMiddleware() {
  return {
    async before(params: any, next: any) {
      const start = Date.now()
      
      try {
        const result = await next(params)
        const duration = Date.now() - start
        
        dbMonitor.recordQuery(duration, false, false)
        
        if (duration > monitoringConfig.alerts.slowQueryThreshold) {
          console.warn(`Slow query detected (${duration}ms):`, {
            model: params.model,
            action: params.action,
          })
        }
        
        return result
      } catch (error) {
        const duration = Date.now() - start
        dbMonitor.recordQuery(duration, true, false)
        throw error
      }
    }
  }
}

// 定期报告任务
export async function startPeriodicReporting(intervalMinutes: number = 60) {
  setInterval(async () => {
    if (!monitoringConfig.enabled) return

    try {
      const health = await dbMonitor.checkHealth()
      const stats = await dbMonitor.getDatabaseStats()

      console.log('📊 Database Performance Report:', {
        timestamp: new Date().toISOString(),
        healthy: health.healthy,
        stats: {
          queries: stats.performance.queryCount,
          slowQueries: stats.performance.slowQueryCount,
          errors: stats.performance.errorCount,
          avgDuration: `${stats.performance.avgDuration.toFixed(2)}ms`,
          cacheHitRate: `${((stats.performance.cacheHits / (stats.performance.cacheHits + stats.performance.cacheMisses)) * 100).toFixed(2)}%`,
        },
        storage: {
          size: `${(stats.storageInfo.size / (1024 * 1024)).toFixed(2)}MB`,
          tables: stats.tableStats,
        },
        issues: health.issues,
        recommendations: health.recommendations,
      })

      // 重置短期指标
      if (stats.performance.queryCount > 10000) {
        dbMonitor.resetMetrics()
      }
    } catch (error) {
      console.error('Failed to generate performance report:', error)
    }
  }, intervalMinutes * 60 * 1000)
}