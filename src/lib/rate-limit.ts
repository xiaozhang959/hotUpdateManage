import NodeCache from 'node-cache'
import Redis from 'ioredis'
import { CACHE_CONFIG } from '@/lib/cache/config'
import { configCache } from '@/lib/cache/config-cache'

// 速率限制缓存管理器
class RateLimitManager {
  private memoryCache: NodeCache
  private redis?: Redis
  private static instance: RateLimitManager

  private constructor() {
    // 初始化内存缓存
    this.memoryCache = new NodeCache({
      stdTTL: 60, // 默认 60 秒过期
      checkperiod: 120, // 每 120 秒清理过期键
      deleteOnExpire: true
    })

    // 尝试连接 Redis（如果配置了）
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
        console.log('[RateLimit] Redis连接成功，使用分布式速率限制')
      }
    } catch (error) {
      console.log('[RateLimit] Redis连接失败，使用内存速率限制:', error)
      this.redis = undefined
    }
  }

  static getInstance(): RateLimitManager {
    if (!RateLimitManager.instance) {
      RateLimitManager.instance = new RateLimitManager()
    }
    return RateLimitManager.instance
  }

  /**
   * 获取请求记录
   */
  async getRequests(key: string): Promise<number[]> {
    // 优先使用 Redis
    if (this.redis) {
      try {
        const data = await this.redis.get(key)
        return data ? JSON.parse(data) : []
      } catch (error) {
        console.error('[RateLimit] Redis读取失败:', error)
      }
    }

    // 回退到内存缓存
    return this.memoryCache.get<number[]>(key) || []
  }

  /**
   * 设置请求记录
   */
  async setRequests(key: string, requests: number[], ttl: number = 60): Promise<void> {
    // 优先使用 Redis
    if (this.redis) {
      try {
        await this.redis.setex(key, ttl, JSON.stringify(requests))
        return
      } catch (error) {
        console.error('[RateLimit] Redis写入失败:', error)
      }
    }

    // 回退到内存缓存
    this.memoryCache.set(key, requests, ttl)
  }

  /**
   * 清理所有速率限制缓存
   */
  async flushAll(): Promise<void> {
    // 清理内存缓存
    this.memoryCache.flushAll()

    // 清理 Redis 缓存
    if (this.redis) {
      try {
        const keys = await this.redis.keys('ratelimit:*')
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      } catch (error) {
        console.error('[RateLimit] Redis清理失败:', error)
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      type: this.redis ? 'redis' : 'memory',
      memoryKeys: this.memoryCache.keys(),
      memoryStats: this.memoryCache.getStats()
    }
  }
}

// 导出单例
const rateLimitManager = RateLimitManager.getInstance()

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
}

/**
 * 检查 IP 地址的速率限制
 * @param identifier IP 地址或其他唯一标识符
 * @param apiPath API 路径，用于区分不同的限制规则
 * @returns 速率限制检查结果
 */
export async function checkRateLimit(
  identifier: string,
  apiPath?: string
): Promise<RateLimitResult> {
  try {
    // 从缓存获取速率限制值（避免频繁查询数据库）
    const limit = (await configCache.getConfig('api_rate_limit')) as number || 100
    
    // 构建缓存键，添加前缀以区分速率限制缓存
    const key = `ratelimit:${apiPath ? `${identifier}:${apiPath}` : identifier}`
    const now = new Date()
    const windowStart = new Date(now.getTime() - 60000) // 60 秒窗口
    
    // 获取当前窗口的请求记录
    let requests = await rateLimitManager.getRequests(key)
    
    // 过滤出当前窗口内的请求
    requests = requests.filter(timestamp => timestamp > windowStart.getTime())
    
    // 检查是否超出限制
    if (requests.length >= limit) {
      const oldestRequest = Math.min(...requests)
      const reset = new Date(oldestRequest + 60000)
      
      return {
        success: false,
        limit,
        remaining: 0,
        reset
      }
    }
    
    // 添加当前请求时间戳
    requests.push(now.getTime())
    
    // 更新缓存
    await rateLimitManager.setRequests(key, requests, 60)
    
    // 计算重置时间
    const reset = new Date(now.getTime() + 60000)
    
    return {
      success: true,
      limit,
      remaining: limit - requests.length,
      reset
    }
  } catch (error) {
    console.error('[RateLimit] 检查失败:', error)
    // 出错时允许请求通过，避免影响服务
    return {
      success: true,
      limit: 100,
      remaining: 99,
      reset: new Date(Date.now() + 60000)
    }
  }
}

/**
 * 获取客户端 IP 地址
 * @param request NextRequest 对象
 * @returns IP 地址字符串
 */
export function getClientIp(request: Request): string {
  const headers = request.headers
  
  // 尝试从各种头部获取真实 IP
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  // 默认返回一个标识
  return 'unknown'
}

/**
 * 清理速率限制缓存（可选，用于管理员重置）
 */
export async function clearRateLimitCache(): Promise<void> {
  await rateLimitManager.flushAll()
}

/**
 * 获取速率限制统计信息（可选，用于监控）
 */
export function getRateLimitStats() {
  return rateLimitManager.getStats()
}
