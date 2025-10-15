/**
 * 数据库配置和优化设置
 */

// SQLite 性能优化配置
export const sqliteOptimizations = {
  // WAL模式配置
  journal_mode: 'WAL', // Write-Ahead Logging，提高并发性能
  
  // 缓存配置
  cache_size: -64000, // 64MB缓存（负数表示KB）
  
  // 页面大小（字节）
  page_size: 4096,
  
  // 临时存储
  temp_store: 'MEMORY', // 使用内存作为临时存储
  
  // 同步模式
  synchronous: 'NORMAL', // 平衡性能和安全性
  
  // MMAP大小（内存映射I/O）
  mmap_size: 268435456, // 256MB
  
  // 锁定模式
  locking_mode: 'NORMAL',
  
  // 分析配置
  analysis_limit: 1000,
  
  // 忙碌超时（毫秒）
  busy_timeout: 5000,
}

// 连接池配置（用于未来迁移到PostgreSQL/MySQL）
export const connectionPoolConfig = {
  // 最小连接数
  min: 2,
  
  // 最大连接数
  max: 10,
  
  // 连接超时（毫秒）
  acquireTimeoutMillis: 30000,
  
  // 空闲连接超时（毫秒）
  idleTimeoutMillis: 10000,
  
  // 连接最大生命周期（毫秒）
  maxLifetimeMillis: 1800000, // 30分钟
  
  // 连接验证间隔（毫秒）
  testOnBorrow: true,
}

// 查询优化配置
export const queryOptimizationConfig = {
  // 批量查询大小
  batchSize: 100,
  
  // 默认分页大小
  defaultPageSize: 20,
  
  // 最大分页大小
  maxPageSize: 100,
  
  // 查询超时（毫秒）
  queryTimeout: 5000,
  
  // 慢查询阈值（毫秒）
  slowQueryThreshold: 100,
  
  // 是否启用查询缓存
  enableQueryCache: true,
  
  // 缓存TTL（秒）
  cacheTimeToLive: 300, // 5分钟
}

// 数据库维护配置
export const maintenanceConfig = {
  // 自动VACUUM间隔（小时）
  vacuumInterval: 24,
  
  // 自动分析间隔（小时）
  analyzeInterval: 12,
  
  // 自动优化索引
  optimizeIndexes: true,
  
  // 备份配置
  backup: {
    enabled: true,
    interval: 24, // 小时
    retention: 7, // 保留天数
    path: './backups',
  },
}

// 监控配置
export const monitoringConfig = {
  // 是否启用性能监控
  enabled: process.env.NODE_ENV === 'production',
  
  // 监控指标
  metrics: {
    queryCount: true,
    queryDuration: true,
    connectionCount: true,
    errorCount: true,
    cacheHitRate: true,
  },
  
  // 报警阈值
  alerts: {
    slowQueryThreshold: 1000, // 毫秒
    errorRateThreshold: 0.01, // 1%
    connectionPoolThreshold: 0.8, // 80%使用率
  },
}

/**
 * 初始化SQLite性能优化
 * 在应用启动时执行
 */
export async function initializeSQLiteOptimizations(prisma: any) {
  try {
    // 执行PRAGMA命令优化SQLite性能
    await prisma.$executeRawUnsafe(`PRAGMA journal_mode = ${sqliteOptimizations.journal_mode};`)
    await prisma.$executeRawUnsafe(`PRAGMA cache_size = ${sqliteOptimizations.cache_size};`)
    await prisma.$executeRawUnsafe(`PRAGMA page_size = ${sqliteOptimizations.page_size};`)
    await prisma.$executeRawUnsafe(`PRAGMA temp_store = ${sqliteOptimizations.temp_store};`)
    await prisma.$executeRawUnsafe(`PRAGMA synchronous = ${sqliteOptimizations.synchronous};`)
    await prisma.$executeRawUnsafe(`PRAGMA mmap_size = ${sqliteOptimizations.mmap_size};`)
    await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = ${sqliteOptimizations.busy_timeout};`)
    await prisma.$executeRawUnsafe(`PRAGMA analysis_limit = ${sqliteOptimizations.analysis_limit};`)
    
    // 运行ANALYZE命令更新统计信息
    await prisma.$executeRawUnsafe('ANALYZE;')
    
    console.log('✅ SQLite optimizations applied successfully')
  } catch (error) {
    console.error('❌ Failed to apply SQLite optimizations:', error)
  }
}

/**
 * 执行数据库维护任务
 */
export async function performDatabaseMaintenance(prisma: any) {
  try {
    // 执行VACUUM命令清理数据库
    await prisma.$executeRawUnsafe('VACUUM;')
    
    // 更新统计信息
    await prisma.$executeRawUnsafe('ANALYZE;')
    
    // 检查数据库完整性
    const integrityCheck = await prisma.$queryRawUnsafe('PRAGMA integrity_check;')
    
    console.log('✅ Database maintenance completed', { integrityCheck })
  } catch (error) {
    console.error('❌ Database maintenance failed:', error)
  }
}