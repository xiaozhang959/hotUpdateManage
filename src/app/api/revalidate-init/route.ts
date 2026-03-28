import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { refreshInitializationState } from '@/lib/server/init-state'

export async function POST(request: NextRequest) {
  // 验证内部请求
  const isInternal = request.headers.get('x-internal-revalidate') === 'true'
  if (!isInternal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const status = await refreshInitializationState()
    
    // 重新验证所有相关路径
    revalidatePath('/', 'layout')
    revalidatePath('/init', 'layout')
    revalidatePath('/login', 'layout')
    
    return NextResponse.json({
      success: true,
      needsInit: !status.isInitialized,
      userCount: status.userCount,
      checkedAt: status.checkedAt,
    })
  } catch (error) {
    console.error('Revalidate init state error:', error)
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 })
  }
}
