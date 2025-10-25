import { redirect } from 'next/navigation'
import { checkNeedsInit } from '@/lib/init-check'

/**
 * 服务端组件，检查是否需要初始化
 * 如果需要初始化，自动重定向到初始化页面
 */
export default async function InitRedirect() {
  const needsInit = await checkNeedsInit()
  
  if (needsInit) {
    redirect('/init')
  }
  
  return null
}