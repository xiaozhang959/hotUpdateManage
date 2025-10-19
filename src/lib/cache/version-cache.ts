import NodeCache from 'node-cache';
import Redis from 'ioredis';
import { Version } from '@prisma/client';
import { CACHE_CONFIG, CACHE_KEYS } from './config';

interface CachedVersion {
  version: string;
  downloadUrl: string;
  downloadUrls?: string[];
  md5: string | null;
  forceUpdate: boolean;
  changelog: string | null;
  createdAt: Date;
  updatedAt?: Date; // 更新时间
  timestamp?: number; // 添加时间戳字段（Unix毫秒）
  isCurrent: boolean;
}

interface RotationState {
  index: number;
  lastUpdate: number;
}

class VersionCacheManager {
  private memoryCache: NodeCache;
  private redis?: Redis;
  private rotationIndexCache: Map<string, RotationState>;

  constructor() {
    // 初始化内存缓存
    this.memoryCache = new NodeCache({ 
      stdTTL: CACHE_CONFIG.version.ttl,
      checkperiod: CACHE_CONFIG.version.checkPeriod,
      useClones: false // 提高性能
    });
    
    // 初始化轮询索引缓存
    this.rotationIndexCache = new Map();
    
    // 尝试连接Redis（可选）
    this.initRedis();
  }

  private async initRedis() {
    try {
      // 从配置获取Redis URL
      const redisUrl = CACHE_CONFIG.redis.url;
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: CACHE_CONFIG.redis.maxRetries,
          enableReadyCheck: true,
          lazyConnect: true,
          connectTimeout: CACHE_CONFIG.redis.connectTimeout
        });
        
        await this.redis.connect();
        console.log('Redis连接成功，使用分布式缓存');
      }
    } catch (error) {
      console.log('Redis连接失败，使用内存缓存:', error);
      this.redis = undefined;
    }
  }

  /**
   * 获取缓存的版本信息
   */
  async getCachedVersion(projectId: string, versionKey: string): Promise<CachedVersion | null> {
    const cacheKey = CACHE_KEYS.version(projectId, versionKey);
    
    // 首先尝试从内存缓存获取
    const memoryCached = this.memoryCache.get<CachedVersion>(cacheKey);
    if (memoryCached) {
      return memoryCached;
    }
    
    // 如果有Redis，尝试从Redis获取
    if (this.redis) {
      try {
        const redisCached = await this.redis.get(cacheKey);
        if (redisCached) {
          const version = JSON.parse(redisCached) as CachedVersion;
          // 同步到内存缓存
          this.memoryCache.set(cacheKey, version);
          return version;
        }
      } catch (error) {
        console.error('Redis读取失败:', error);
      }
    }
    
    return null;
  }

  /**
   * 设置版本信息缓存
   */
  async setCachedVersion(projectId: string, versionKey: string, version: CachedVersion): Promise<void> {
    const cacheKey = CACHE_KEYS.version(projectId, versionKey);
    
    // 设置内存缓存
    this.memoryCache.set(cacheKey, version);
    
    // 如果有Redis，同步到Redis
    if (this.redis) {
      try {
        await this.redis.setex(
          cacheKey, 
          CACHE_CONFIG.version.ttl, 
          JSON.stringify(version)
        );
      } catch (error) {
        console.error('Redis写入失败:', error);
      }
    }
  }

  /**
   * 获取下一个轮询URL
   */
  async getNextRotationUrl(versionId: string, urls: string[]): Promise<{ url: string; shouldUpdateDb: boolean }> {
    if (!urls || urls.length === 0) {
      throw new Error('URLs数组不能为空');
    }
    
    if (urls.length === 1) {
      return { url: urls[0], shouldUpdateDb: false };
    }
    
    const rotationKey = CACHE_KEYS.rotation(versionId);
    
    // 尝试仍Redis获取轮询状态（如果有Redis）
    if (this.redis) {
      try {
        const currentIndex = await this.redis.incr(rotationKey);
        // 设置过期时间（24小时）
        await this.redis.expire(rotationKey, 86400);
        const index = (currentIndex - 1) % urls.length;
        
        // 每 ROTATION_BATCH_SIZE 次请求返回需要更新数据库的信号
        const shouldUpdateDb = currentIndex % CACHE_CONFIG.version.rotationBatchSize === 0;
        return { url: urls[index], shouldUpdateDb };
      } catch (error) {
        console.error('Redis轮询索引操作失败:', error);
      }
    }
    
    // 使用内存缓存作为后备方案
    let state = this.rotationIndexCache.get(rotationKey);
    if (!state) {
      state = { index: 0, lastUpdate: Date.now() };
      this.rotationIndexCache.set(rotationKey, state);
    }
    
    const url = urls[state.index];
    state.index = (state.index + 1) % urls.length;
    
    // 检查是否需要批量更新数据库
    const shouldUpdateDb = state.index === 0 && 
                          Date.now() - state.lastUpdate > 60000; // 每分钟最多更新一次
    
    if (shouldUpdateDb) {
      state.lastUpdate = Date.now();
    }
    
    return { url, shouldUpdateDb };
  }

  /**
   * 清除特定项目的缓存
   */
  async clearProjectCache(projectId: string): Promise<void> {
    // 清除内存缓存
    const keys = this.memoryCache.keys();
    for (const key of keys) {
      if (key.startsWith(`version:${projectId}:`)) {
        this.memoryCache.del(key);
      }
    }
    
    // 清除Redis缓存
    if (this.redis) {
      try {
        const pattern = `version:${projectId}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error('清除Redis缓存失败:', error);
      }
    }
    
    // 清除轮询索引缓存
    for (const [key] of this.rotationIndexCache) {
      if (key.includes(projectId)) {
        this.rotationIndexCache.delete(key);
      }
    }
  }

  /**
   * 预热缓存
   */
  async warmupCache(projectId: string, version: Version): Promise<void> {
    const cachedVersion: CachedVersion = {
      version: version.version,
      downloadUrl: version.downloadUrl,
      downloadUrls: version.downloadUrls ? JSON.parse(version.downloadUrls) : undefined,
      md5: version.md5,
      forceUpdate: version.forceUpdate,
      changelog: version.changelog,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
      isCurrent: version.isCurrent
    };
    
    await this.setCachedVersion(projectId, version.version, cachedVersion);
    await this.setCachedVersion(projectId, 'latest', cachedVersion);
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      memoryCache: {
        keys: this.memoryCache.keys().length,
        hits: this.memoryCache.getStats().hits,
        misses: this.memoryCache.getStats().misses,
        hitRate: this.memoryCache.getStats().hits / 
                (this.memoryCache.getStats().hits + this.memoryCache.getStats().misses)
      },
      rotationIndexes: this.rotationIndexCache.size,
      redisConnected: !!this.redis
    };
  }
}

// 创建单例实例
export const versionCache = new VersionCacheManager();