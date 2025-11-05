import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeNumberFromBigInt } from '@/lib/server/serialize'
import { validateBearerToken } from '@/lib/auth-bearer'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { versionCache } from '@/lib/cache/version-cache'

export async function POST(req: NextRequest) {
  try {
    // 简单限流
    const clientIp = getClientIp(req)
    const rate = await checkRateLimit(clientIp, 'api/versions/latest')
    if (!rate.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: rate.reset.toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rate.limit.toString(),
            'X-RateLimit-Remaining': rate.remaining.toString(),
            'X-RateLimit-Reset': rate.reset.toISOString(),
          },
        },
      )
    }

    // 认证：优先 Bearer，再退回 API Key
    const body = await req.json().catch(() => ({}))
    let project: { id: string; currentVersion: string | null } | null = null

    const user = await validateBearerToken(req)
    if (user) {
      const { projectId } = body || {}
      if (!projectId) {
        return NextResponse.json(
          { error: 'Project ID is required when using Bearer token' },
          { status: 400 },
        )
      }
      project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
        select: { id: true, currentVersion: true },
      })
    } else {
      const apiKeyFromHeader = req.headers.get('X-API-Key') || undefined
      const apiKey = apiKeyFromHeader || (body?.apiKey as string | undefined)
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Authentication required - provide Bearer token or X-API-Key' },
          { status: 401 },
        )
      }
      project = await prisma.project.findUnique({
        where: { apiKey },
        select: { id: true, currentVersion: true },
      })
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 })
    }

    // 优先尝试缓存 latest
    const cached = await versionCache.getCachedVersion(project.id, 'latest')
    if (cached) {
      const urls = Array.isArray(cached.downloadUrls) ? cached.downloadUrls : []
      let selected = cached.downloadUrl
      let idx = 0
      if (urls.length > 0 && cached.id) {
        try {
          const rot = await versionCache.getNextRotationUrl(cached.id, urls)
          selected = rot.url
          const found = urls.indexOf(selected)
          idx = found >= 0 ? found : 0
        } catch {
          selected = urls[0]
          idx = 0
        }
      }
      const providersRaw = (cached as any)._providers || '[]'
      if (!isLinkType(providersRaw, idx)) {
        selected = `/api/versions/${cached.id}/download?i=${idx}`
      }
      return NextResponse.json({
        success: true,
        data: {
          version: cached.version,
          downloadUrl: selected,
          md5: cached.md5,
          size: cached.size ?? null,
          forceUpdate: cached.forceUpdate,
          changelog: cached.changelog,
          createdAt: cached.createdAt as any,
          updatedAt: cached.updatedAt as any,
          timestamp: (cached.updatedAt ? new Date(cached.updatedAt as any) : new Date(cached.createdAt as any)).getTime(),
          isCurrent: true,
        },
      })
    }

    // 读取当前版本（优先 currentVersion，其次按时间最新）
    let version = project.currentVersion
      ? await prisma.version.findFirst({
          where: { projectId: project.id, version: project.currentVersion },
          select: baseSelect,
        })
      : null
    if (!version) {
      version = await prisma.version.findFirst({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' },
        select: baseSelect,
      })
    }
    if (!version) {
      return NextResponse.json({ error: 'No versions available' }, { status: 404 })
    }

    // 选择下载链接（相对路径策略）：
    const urls = safeParseArray(version.downloadUrls)
    const idx = Math.max(0, Math.min(urls.length - 1, version.urlRotationIndex || 0))
    let selected = urls.length > 0 ? urls[idx] : version.downloadUrl

    // 非 LINK 类型（本地/S3/OSS/WebDAV等）统一通过代理下载路由，返回相对路径
    if (!isLinkType(version.storageProviders, idx)) {
      selected = `/api/versions/${version.id}/download?i=${idx}`
    }

    return NextResponse.json({
      success: true,
      data: {
        version: version.version,
        downloadUrl: selected, // 仅返回相对路径或原始外链
        md5: version.md5,
        size: safeNumberFromBigInt((version as any).size ?? null as any),
        forceUpdate: version.forceUpdate,
        changelog: version.changelog,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        timestamp:
          (version.updatedAt ? new Date(version.updatedAt) : new Date(version.createdAt)).getTime(),
        isCurrent: version.isCurrent,
      },
    })
  } catch (error) {
    console.error('Failed to get latest version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const baseSelect = {
  id: true,
  version: true,
  downloadUrl: true,
  downloadUrls: true,
  urlRotationIndex: true,
  md5: true,
  size: true,
  forceUpdate: true,
  changelog: true,
  isCurrent: true,
  storageProviders: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<string, boolean>

function safeParseArray(json: any): string[] {
  try {
    const arr = typeof json === 'string' ? JSON.parse(json) : json
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function isLinkType(storageProviders: any, index: number): boolean {
  try {
    const arr = typeof storageProviders === 'string' ? JSON.parse(storageProviders) : storageProviders
    if (!Array.isArray(arr)) return false
    const cur = arr[index]
    if (typeof cur === 'string') return cur.toUpperCase() === 'LINK'
    if (cur && typeof cur === 'object') return String(cur.type || '').toUpperCase() === 'LINK'
    return false
  } catch {
    return false
  }
}

export const runtime = 'nodejs'
