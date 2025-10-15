import { NextResponse } from 'next/server'
import { versionCache } from '@/lib/cache/version-cache'

export async function GET() {
  try {
    const stats = versionCache.getStats()
    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('获取缓存统计失败:', error)
    return NextResponse.json(
      { error: '获取缓存统计失败' },
      { status: 500 }
    )
  }
}