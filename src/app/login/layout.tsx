import { needsInitialization } from '@/lib/server/init-state'
import { redirect } from 'next/navigation'

// 强制动态渲染
export const dynamic = 'force-dynamic'

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 检查是否需要初始化
  const needsInit = await needsInitialization()
  
  if (needsInit) {
    redirect('/init')
  }

  return <>{children}</>
}