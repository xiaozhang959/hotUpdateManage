import { prisma } from '@/lib/prisma'
import { initCache } from '@/lib/cache/init-cache'

/**
 * 检查系统是否需要初始化
 * 这个函数只能在服务端使用（可以访问数据库）
 */
export async function checkNeedsInit(): Promise<boolean> {
  try {
    // 先检查缓存
    const cached = initCache.getStatus()
    if (cached && !initCache.isStale()) {
      return cached.needsInit
    }
    
    // 缓存未命中或已过期，查询数据库
    const userCount = await prisma.user.count()
    
    // 如果没有用户，需要初始化
    const needsInit = userCount === 0
    
    // 更新缓存
    initCache.setStatus({ needsInit, userCount })
    
    return needsInit
  } catch (error) {
    console.error('检查初始化状态失败:', error)
    // 如果出错，默认不需要初始化，避免阻塞正常访问
    return false
  }
}

/**
 * 清除初始化缓存
 * 在用户完成初始化后调用
 */
export function clearInitCache() {
  initCache.clearCache()
}
