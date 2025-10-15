import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 内存缓存初始化状态，避免频繁调用API
let initStatusCache: { needsInit: boolean; checkedAt: number } | null = null
const CACHE_DURATION = 60000 // 缓存1分钟

// API请求记录的配置
const shouldLogRequest = (pathname: string) => {
  // 只记录核心API请求，排除一些不重要的请求
  const excludedPaths = [
    '/api/auth/',
    '/api/init/',
    '/api/system/',
    '/api/internal/', // 排除内部API防止循环
    '/_next/',
    '/favicon.ico'
  ]
  
  // 如果是排除的路径，不记录
  if (excludedPaths.some(path => pathname.startsWith(path))) {
    return false
  }
  
  // 如果是API路径，记录
  return pathname.startsWith('/api/')
}

// 异步记录API请求，不阻塞响应
async function logApiRequest(
  baseUrl: string,
  pathname: string,
  method: string,
  statusCode: number,
  responseTime: number,
  userAgent?: string | null,
  ipAddress?: string | null,
  projectId?: string | null
) {
  try {
    // 通过API调用记录请求（不会在edge runtime中使用Prisma）
    await fetch(`${baseUrl}/api/internal/log-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: pathname,
        method,
        statusCode,
        responseTime,
        userAgent,
        ipAddress,
        projectId
      })
    })
  } catch (error) {
    // 记录日志失败不应该影响正常请求
    console.error('Failed to log API request:', error)
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const startTime = Date.now()
  
  // 如枟是初始化页面或API，直接放行
  if (pathname.startsWith('/init') || pathname.startsWith('/api/init')) {
    // 清除缓存，确保初始化页面能获取最新状态
    if (pathname === '/init') {
      initStatusCache = null
    }
    return NextResponse.next()
  }

  // API路由处理：记录请求但不检查初始化状态
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next()
    
    // 异步记录API请求（不阻塞响应）
    if (shouldLogRequest(pathname)) {
      // 在后台记录请求
      setTimeout(async () => {
        const endTime = Date.now()
        const responseTime = endTime - startTime
        
        // 获取客户端信息
        const userAgent = request.headers.get('user-agent')
        const forwarded = request.headers.get('x-forwarded-for')
        const realIp = request.headers.get('x-real-ip')
        const ipAddress = forwarded?.split(',')[0] || realIp || request.ip || 'unknown'
        
        // 从 API-Key 头部获取项目信息（如果有的话）
        const apiKey = request.headers.get('api-key') || request.nextUrl.searchParams.get('api_key')
        
        await logApiRequest(
          request.nextUrl.origin,
          pathname,
          request.method,
          response.status,
          responseTime,
          userAgent,
          ipAddress,
          null // 先不处理projectId，在API中处理
        )
      }, 0)
    }
    
    return response
  }

  // 如果是静态资源或其他系统路径，直接放行
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/uploads')
  ) {
    return NextResponse.next()
  }

  try {
    // 检查缓存是否有效
    const now = Date.now()
    const needsCheck = !initStatusCache || (now - initStatusCache.checkedAt > CACHE_DURATION)
    
    let needsInit = false
    
    if (needsCheck) {
      // 缓存过期或不存在，调用API检查
      const checkUrl = new URL('/api/init/check', request.url)
      const checkResponse = await fetch(checkUrl, {
        headers: request.headers,
      })

      if (checkResponse.ok) {
        const data = await checkResponse.json()
        needsInit = data.needsInit
        
        // 更新缓存
        initStatusCache = {
          needsInit: data.needsInit,
          checkedAt: now
        }
      }
    } else {
      // 使用缓存的值
      needsInit = initStatusCache.needsInit
    }
    
    // 如果需要初始化且不在初始化页面，重定向到初始化页面
    if (needsInit && pathname !== '/init') {
      return NextResponse.redirect(new URL('/init', request.url))
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