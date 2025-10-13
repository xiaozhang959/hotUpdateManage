import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 检查数据库中是否有任何用户
    const userCount = await prisma.user.count()
    
    // 如果没有用户，需要初始化
    const needsInit = userCount === 0
    
    return NextResponse.json({
      needsInit,
      userCount
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