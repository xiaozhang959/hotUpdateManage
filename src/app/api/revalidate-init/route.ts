import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { initState } from '@/lib/server/init-state'

export async function POST(request: NextRequest) {
  // 验证内部请求
  const isInternal = request.headers.get('x-internal-revalidate') === 'true'
  if (!isInternal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    // 重置内存缓存
    initState.reset()
    
    // 重新验证所有相关路径
    revalidatePath('/', 'layout')
    revalidatePath('/init', 'layout')
    revalidatePath('/login', 'layout')
    revalidateTag('init-state')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Revalidate init state error:', error)
    return NextResponse.json({ error: 'Failed to revalidate' }, { status: 500 })
  }
}