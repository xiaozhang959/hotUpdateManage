/**
 * 缓存配置中心
 */
export const CACHE_CONFIG = {
  // 版本信息缓存配置
  version: {
    ttl: parseInt(process.env.VERSION_CACHE_TTL || '60'), // 秒
    rotationBatchSize: parseInt(process.env.ROTATION_BATCH_SIZE || '100'),
    checkPeriod: 120 // 秒
  },
  
  // 初始化状态缓存配置
  init: {
    ttl: parseInt(process.env.INIT_CACHE_TTL || '3600'), // 秒（默认1小时）
    staleTime: parseInt(process.env.INIT_CACHE_STALE || '300000'), // 毫秒（默认5分钟）
    checkPeriod: 3600 // 秒
  },
  
  // Redis配置
  redis: {
    url: process.env.REDIS_URL,
    maxRetries: 3,
    connectTimeout: 5000 // 毫秒
  }
}

/**
 * 获取缓存键前缀
 */
export const CACHE_KEYS = {
  version: (projectId: string, version: string) => `version:${projectId}:${version}`,
  rotation: (versionId: string) => `rotation:${versionId}`,
  init: 'system:init:status'
}

/**
 * 缓存性能监控配置
 */
export const CACHE_MONITORING = {
  enabled: process.env.CACHE_MONITORING_ENABLED === 'true',
  logLevel: process.env.CACHE_LOG_LEVEL || 'info',
  metricsInterval: 60000 // 毫秒
}