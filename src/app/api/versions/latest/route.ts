import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { versionCache } from '@/lib/cache/version-cache'
import { validateBearerToken } from '@/lib/auth-bearer'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: {
        version: cachedVersion.version,
        downloadUrl: selectedUrl,
        md5: cachedVersion.md5,
        forceUpdate: cachedVersion.forceUpdate,
        changelog: cachedVersion.changelog,
        createdAt: cachedVersion.createdAt,
        updatedAt: cachedVersion.updatedAt,
        timestamp: cachedVersion.timestamp || new Date(cachedVersion.updatedAt || cachedVersion.createdAt).getTime(),
        isCurrent: cachedVersion.isCurrent
      }
    })
  } catch (error) {
    console.error('获取当前版本失败:', error)
    return NextResponse.json(
      { error: '获取当前版本失败' },
      { status: 500 }
    )
  }
}

// 将相对路径转换为绝对URL（支持反向代理）
function toAbsoluteUrl(req: NextRequest, url: string) {
  try {
    // 已是绝对地址
    if (/^https?:\/\//i.test(url)) return url

    // Next 提供的 origin 能较好适配本地/生产与代理
    const origin = req.nextUrl?.origin
    return new URL(url, origin).toString()
  } catch {
    // 兜底：localhost（YAGNI：不引入额外配置，尽量简单）
    return `http://localhost:3000${url}`
  }
}
