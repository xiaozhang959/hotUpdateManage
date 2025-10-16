import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 简化的 middleware：只处理基本路由，不进行数据库查询
  // 初始化检查将在页面组件层面进行
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