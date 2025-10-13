import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 如果是初始化页面或API，直接放行
  if (pathname.startsWith('/init') || pathname.startsWith('/api/init')) {
    return NextResponse.next()
  }

  // 如果是静态资源或其他系统路径，直接放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next()
  }

  try {
    // 检查系统是否需要初始化（调用API检查）
    const checkUrl = new URL('/api/init/check', request.url)
    const checkResponse = await fetch(checkUrl, {
      headers: request.headers,
    })

    if (checkResponse.ok) {
      const data = await checkResponse.json()
      
      // 如果需要初始化且不在初始化页面，重定向到初始化页面
      if (data.needsInit && pathname !== '/init') {
        return NextResponse.redirect(new URL('/init', request.url))
      }
      
      // 如果已经初始化但在初始化页面，重定向到登录页
      if (!data.needsInit && pathname === '/init') {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }
  } catch (error) {
    console.error('初始化检查失败:', error)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了：
     * - api/auth (认证API)
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (图标)
     * - 公共文件 (public folder)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*|uploads).*)',
  ],
}