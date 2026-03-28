import { NextResponse } from 'next/server'
import { getInitializationStatus } from '@/lib/server/init-state'
import { requireBootstrapToken } from '@/lib/security/bootstrap'

export async function GET(req: Request) {
  try {
    const bootstrapError = requireBootstrapToken(req)
    if (bootstrapError) {
      return NextResponse.json({ error: bootstrapError }, { status: 403 })
    }
    const status = await getInitializationStatus()

    return NextResponse.json({
      needsInit: !status.isInitialized,
      userCount: status.userCount,
      checkedAt: status.checkedAt,
    })
  } catch (error) {
    console.error('检查初始化状态失败:', error)
    // 如果出错，默认不需要初始化，避免阻塞正常访问
    return NextResponse.json({
      needsInit: false,
      error: '检查失败'
    })
  }
}
