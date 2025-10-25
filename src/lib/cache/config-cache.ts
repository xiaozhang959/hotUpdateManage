import NodeCache from 'node-cache'
import Redis from 'ioredis'
import { CACHE_CONFIG } from './config'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CONFIGS } from '@/lib/system-config'

interface CachedConfig {
  value: string | number | boolean
  type: 'string' | 'number' | 'boolean'
  updatedAt: number
}

class SystemConfigCache {
  private memoryCache: NodeCache
  private redis?: Redis
  private static instance: SystemConfigCache
  
  private constructor() {
    // 初始化内存缓存，配置缓存时间较长（5分钟）
    this.memoryCache = new NodeCache({
      stdTTL: 300, // 5分钟
      checkperiod: 600, // 10分钟检查一次过期
      useClones: false
    })
    
    // 尝试连接 Redis
    this.initRedis()
  }
  
  private async initRedis() {
    try {
      const redisUrl = CACHE_CONFIG.redis?.url || process.env.REDIS_URL
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
          connectTimeout: 5000
        })
        
        await this.redis.connect()
        console.log('[ConfigCache] Redis连接成功，使用分布式配置缓存')
      }
    } catch (error) {
      console.log('[ConfigCache] Redis连接失败，使用内存配置缓存')
      this.redis = undefined
    }
  }
  
  static getInstance(): SystemConfigCache {
    if (!SystemConfigCache.instance) {
      SystemConfigCache.instance = new SystemConfigCache()
    }
    return SystemConfigCache.instance
  }
  
  /**
   * 获取配置值（优先从缓存读取）
   */
  async getConfig(key: string): Promise<string | number | boolean | null> {
    const cacheKey = `config:${key}`
    
    // 1. 尝试从内存缓存获取
    const memoryCached = this.memoryCache.get<CachedConfig>(cacheKey)
    if (memoryCached) {
      return memoryCached.value
    }
    
    // 2. 尝试从 Redis 获取
    if (this.redis) {
      try {
        const redisCached = await this.redis.get(cacheKey)
        if (redisCached) {
          const config = JSON.parse(redisCached) as CachedConfig
          // 同步到内存缓存
          this.memoryCache.set(cacheKey, config)
          return config.value
        }
      } catch (error) {
        console.error('[ConfigCache] Redis读取失败:', error)
      }
    }
    
    // 3. 从数据库获取并缓存
    try {
      const dbConfig = await prisma.systemConfig.findUnique({
        where: { key }
      })
      
      let value: string | number | boolean | null = null
      let type: 'string' | 'number' | 'boolean' = 'string'
      
      if (dbConfig) {
        // 从数据库获取
        type = dbConfig.type as 'string' | 'number' | 'boolean'
        switch (dbConfig.type) {
          case 'boolean':
            value = dbConfig.value === 'true'
            break
          case 'number':
            value = parseInt(dbConfig.value, 10)
            break
          default:
            value = dbConfig.value
        }
      } else {
        // 使用默认值
        const defaultConfig = DEFAULT_CONFIGS.find(c => c.key === key)
        if (defaultConfig) {
          value = defaultConfig.value
          type = defaultConfig.type
        }
      }
      
      if (value !== null) {
        // 缓存配置
        const cachedConfig: CachedConfig = {
          value,
          type,
          updatedAt: Date.now()
        }
        
        await this.setConfig(key, cachedConfig)
      }
      
      return value
    } catch (error) {
      console.error(`[ConfigCache] 获取配置失败 [${key}]:`, error)
      // 返回默认值
      const defaultConfig = DEFAULT_CONFIGS.find(c => c.key === key)
      return defaultConfig?.value ?? null
    }
  }
  
  /**
   * 设置配置缓存
   */
  private async setConfig(key: string, config: CachedConfig): Promise<void> {
    const cacheKey = `config:${key}`
    
    // 设置内存缓存
    this.memoryCache.set(cacheKey, config)
    
    // 设置 Redis 缓存
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, 300, JSON.stringify(config))
      } catch (error) {
        console.error('[ConfigCache] Redis写入失败:', error)
      }
    }
  }
  
  /**
   * 批量获取配置
   */
  async getConfigs(keys: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {}
    
    // 使用 Promise.all 并行获取
    const values = await Promise.all(
      keys.map(key => this.getConfig(key))
    )
    
    keys.forEach((key, index) => {
      result[key] = values[index]
    })
    
    return result
  }
  
  /**
   * 清除指定配置的缓存
   */
  async invalidateConfig(key: string): Promise<void> {
    const cacheKey = `config:${key}`
    
    // 清除内存缓存
    this.memoryCache.del(cacheKey)
    
    // 清除 Redis 缓存
    if (this.redis) {
      try {
        await this.redis.del(cacheKey)
      } catch (error) {
        console.error('[ConfigCache] Redis删除失败:', error)
      }
    }
  }
  
  /**
   * 批量清除配置缓存
   */
  async invalidateConfigs(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.invalidateConfig(key)
    }
  }
  
  /**
   * 清除所有配置缓存
   */
  async invalidateAll(): Promise<void> {
    // 清除内存缓存中的所有配置
    const keys = this.memoryCache.keys()
    for (const key of keys) {
      if (key.startsWith('config:')) {
        this.memoryCache.del(key)
      }
    }
    
    // 清除 Redis 中的所有配置
    if (this.redis) {
      try {
        const redisKeys = await this.redis.keys('config:*')
        if (redisKeys.length > 0) {
          await this.redis.del(...redisKeys)
        }
      } catch (error) {
        console.error('[ConfigCache] Redis清理失败:', error)
      }
    }
  }
  
  /**
   * 根据类别清除缓存
   */
  async invalidateCategory(category: string): Promise<void> {
    const configsToInvalidate = DEFAULT_CONFIGS
      .filter(c => c.category === category)
      .map(c => c.key)
    
    await this.invalidateConfigs(configsToInvalidate)
  }
  
  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      type: this.redis ? 'redis' : 'memory',
      memoryKeys: this.memoryCache.keys().filter(k => k.startsWith('config:')),
      stats: this.memoryCache.getStats()
    }
  }
}

// 导出单例实例
export const configCache = SystemConfigCache.getInstance()