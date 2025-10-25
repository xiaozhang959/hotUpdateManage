import { redirect } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { prisma } from '@/lib/prisma'

interface InitCheckerProps {
  children: React.ReactNode
  pathname: string
}

/**
 * 服务端组件：在应用根部检查初始化状态
 * 这个组件运行在 Node.js 环境中，可以安全使用 Prisma
 */
export default async function InitChecker({ children, pathname }: InitCheckerProps) {
  // 禁用缓存，确保每次都获取最新状态
  noStore()
  
  // 特殊路径直接放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return <>{children}</>
  }

  // 检查是否需要初始化（直接查数据库，避免内存缓存失效问题）
  const userCount = await prisma.user.count()
  const needsInit = userCount === 0

  // 如果在初始化页面
  if (pathname.startsWith('/init')) {
    if (!needsInit) {
      // 系统已初始化，不允许访问初始化页面
      redirect('/login')
    }
    // 需要初始化，允许访问
    return <>{children}</>
  }

  // 如果需要初始化但不在初始化页面，重定向
  if (needsInit) {
    redirect('/init')
  }

  // 正常访问
  return <>{children}</>
}