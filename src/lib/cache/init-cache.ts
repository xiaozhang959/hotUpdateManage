import NodeCache from 'node-cache';
import { CACHE_CONFIG, CACHE_KEYS } from './config';

interface InitStatus {
  needsInit: boolean;
  userCount: number;
  checkedAt: number;
}

class InitStatusCache {
  private cache: NodeCache;
  private static instance: InitStatusCache;
  
  private constructor() {
    this.cache = new NodeCache({
      stdTTL: CACHE_CONFIG.init.ttl,
      checkperiod: CACHE_CONFIG.init.checkPeriod,
      useClones: false
    });
  }
  
  static getInstance(): InitStatusCache {
    if (!InitStatusCache.instance) {
      InitStatusCache.instance = new InitStatusCache();
    }
    return InitStatusCache.instance;
  }
  
  /**
   * 获取初始化状态
   */
  getStatus(): InitStatus | null {
    return this.cache.get<InitStatus>(CACHE_KEYS.init) || null;
  }
  
  /**
   * 设置初始化状态
   */
  setStatus(status: Omit<InitStatus, 'checkedAt'>): void {
    const fullStatus: InitStatus = {
      ...status,
      checkedAt: Date.now()
    };
    this.cache.set(CACHE_KEYS.init, fullStatus);
  }
  
  /**
   * 清除缓存（当用户注册或系统配置改变时调用）
   */
  clearCache(): void {
    this.cache.del(CACHE_KEYS.init);
  }
  
  /**
   * 检查缓存是否过期或需要刷新
   * @param maxAge 最大缓存年龄（毫秒），默认使用配置
   */
  isStale(maxAge: number = CACHE_CONFIG.init.staleTime): boolean {
    const status = this.getStatus();
    if (!status) return true;
    return Date.now() - status.checkedAt > maxAge;
  }
}

export const initCache = InitStatusCache.getInstance();