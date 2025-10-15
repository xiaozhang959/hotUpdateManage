import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { initCache } from '@/lib/cache/init-cache'

export async function GET() {
  try {
    // 先检查缓存
    const cached = initCache.getStatus()
    if (cached && !initCache.isStale()) {
      return NextResponse.json({
        needsInit: cached.needsInit,
        userCount: cached.userCount,
        cached: true
      })
    }
    
    // 缓存未命中或已过期，查询数据库
    const userCount = await prisma.user.count()
    
    // 如果没有用户，需要初始化
    const needsInit = userCount === 0
    
    // 更新缓存
    initCache.setStatus({ needsInit, userCount })
    
    return NextResponse.json({
      needsInit,
      userCount,
      cached: false
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