import { redirect } from 'next/navigation'
import { needsInitialization } from '@/lib/server/init-state'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export default async function InitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 服务端双重检查：确保系统真的需要初始化
  const needsInit = await needsInitialization()
  
  if (!needsInit) {
    // 如果系统已经初始化，禁止访问此页面
    redirect('/login')
  }

  return <>{children}</>
}