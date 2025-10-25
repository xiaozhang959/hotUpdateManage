/**
 * 全局初始化状态管理
 * 在服务器启动时检查一次，然后保存在内存中
 */

import { prisma } from '@/lib/prisma'

class InitStateManager {
  private static instance: InitStateManager
  private isInitialized: boolean | null = null
  private checkPromise: Promise<boolean> | null = null

  private constructor() {}

  static getInstance(): InitStateManager {
    if (!InitStateManager.instance) {
      InitStateManager.instance = new InitStateManager()
    }
    return InitStateManager.instance
  }

  /**
   * 检查系统是否已初始化
   * 首次调用时会查询数据库，后续调用直接返回缓存值
   */
  async isSystemInitialized(): Promise<boolean> {
    // 如果已经有缓存值，直接返回
    if (this.isInitialized !== null) {
      return this.isInitialized
    }

    // 如果正在检查中，等待检查完成
    if (this.checkPromise) {
      return this.checkPromise
    }

    // 执行检查
    this.checkPromise = this.performCheck()
    const result = await this.checkPromise
    this.checkPromise = null
    
    return result
  }

  /**
   * 执行实际的初始化检查
   */
  private async performCheck(): Promise<boolean> {
    try {
      const userCount = await prisma.user.count()
      // 系统已初始化 = 至少有一个用户
      this.isInitialized = userCount > 0
      
      console.log(`[InitState] 系统初始化状态: ${this.isInitialized ? '已初始化' : '未初始化'}`)
      
      return this.isInitialized
    } catch (error) {
      console.error('[InitState] 检查初始化状态失败:', error)
      // 出错时假定系统已初始化，避免阻塞
      this.isInitialized = true
      return true
    }
  }

  /**
   * 标记系统已完成初始化
   * 在用户完成初始化设置后调用
   */
  markAsInitialized() {
    this.isInitialized = true
    console.log('[InitState] 系统已标记为初始化完成')
    // 在生产环境中，清理 Next.js 的缓存
    if (typeof globalThis.fetch !== 'undefined') {
      try {
        // 触发 revalidate
        fetch('/api/revalidate-init', { 
          method: 'POST',
          headers: { 'x-internal-revalidate': 'true' }
        }).catch(() => {})
      } catch {}
    }
  }

  /**
   * 重置初始化状态（用于测试或特殊情况）
   */
  reset() {
    this.isInitialized = null
    this.checkPromise = null
    console.log('[InitState] 初始化状态已重置')
  }
}

// 导出单例实例
export const initState = InitStateManager.getInstance()

/**
 * 便捷函数：检查系统是否需要初始化
 */
export async function needsInitialization(): Promise<boolean> {
  const isInitialized = await initState.isSystemInitialized()
  return !isInitialized
}