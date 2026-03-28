import { getInitializationStatus, revalidateInitializationState } from '@/lib/server/init-state'

/**
 * 检查系统是否需要初始化
 * 这个函数只能在服务端使用（可以访问数据库）
 */
export async function checkNeedsInit(): Promise<boolean> {
  try {
    const status = await getInitializationStatus()
    return !status.isInitialized
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
  revalidateInitializationState()
}
