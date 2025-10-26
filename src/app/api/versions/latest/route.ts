import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { versionCache } from '@/lib/cache/version-cache'
import { validateBearerToken } from '@/lib/auth-bearer'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // 检查速率限制
    const clientIp = getClientIp(req)
    const rateLimitResult = await checkRateLimit(clientIp, 'api/versions/latest')
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many requests',
          message: `速率限制：每分钟最多 ${rateLimitResult.limit} 次请求`,
          retryAfter: rateLimitResult.reset.toISOString()
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000).toString()
          }
        }
      )
    }
    let project: any = null
    const body = await req.json().catch(() => ({}))
    
    // Try Bearer token authentication first
    const user = await validateBearerToken(req)
    if (user) {
      // If using Bearer token, projectId must be provided in the request body
      const { projectId } = body
      
      if (!projectId) {
        return NextResponse.json(
          { error: 'Project ID is required when using Bearer token authentication' },
          { status: 400 }
        )
      }
      
      // Verify project ownership
      project = await prisma.project.findFirst({
        where: {
          id: projectId,
          userId: user.id
        },
        select: {
          id: true,
          currentVersion: true
        }
      })
      
      if (!project) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        )
      }
    } else {
      // Fall back to API key authentication
      const apiKeyFromHeader = req.headers.get('X-API-Key')
      const apiKey = apiKeyFromHeader || body.apiKey

      if (!apiKey) {
        return NextResponse.json(
          { error: 'Authentication required - provide Bearer token or API key' },
          { status: 401 }
        )
      }

      // 优化：只查询必要字段，使用索引查询
      project = await prisma.project.findUnique({
        where: { apiKey },
        select: {
          id: true,
          currentVersion: true
        }
      })

      if (!project) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        )
      }
    }

    // 尝试从缓存获取版本信息
    let cachedVersion = await versionCache.getCachedVersion(project.id, 'latest')
    
    if (!cachedVersion) {
      // 缓存未命中，从数据库获取
      let currentVersion = null

      if (project.currentVersion) {
        // 优化：使用复合索引查询，只选择需要的字段
        currentVersion = await prisma.version.findFirst({
          where: {
            projectId: project.id,
            version: project.currentVersion
          },
          select: {
            id: true,
            version: true,
            downloadUrl: true,
            downloadUrls: true,
            urlRotationIndex: true,
            md5: true,
            forceUpdate: true,
            changelog: true,
            isCurrent: true,
            storageProvider: true,
            objectKey: true,
            storageConfigId: true,
            storageProviders: true,
            createdAt: true,
            updatedAt: true
          }
        })
      }

      // 优化：如果没有设置当前版本或找不到，获取最新版本
      if (!currentVersion) {
        currentVersion = await prisma.version.findFirst({
          where: {
            projectId: project.id
          },
          select: {
            id: true,
            version: true,
            downloadUrl: true,
            downloadUrls: true,
            urlRotationIndex: true,
            md5: true,
            forceUpdate: true,
            changelog: true,
            isCurrent: true,
            storageProvider: true,
            objectKey: true,
            storageConfigId: true,
            storageProviders: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
      }

      if (!currentVersion) {
        return NextResponse.json(
          { error: '该项目暂无发布版本' },
          { status: 404 }
        )
      }

      // 准备缓存数据
      const downloadUrls = currentVersion.downloadUrls ? 
        JSON.parse(currentVersion.downloadUrls) : null
      
      cachedVersion = {
        id: currentVersion.id,
        version: currentVersion.version,
        downloadUrl: currentVersion.downloadUrl,
        downloadUrls: downloadUrls,
        md5: currentVersion.md5,
        forceUpdate: currentVersion.forceUpdate,
        changelog: currentVersion.changelog,
        createdAt: currentVersion.createdAt,
        updatedAt: currentVersion.updatedAt,
        timestamp: new Date(currentVersion.updatedAt).getTime(), // 基于updatedAt计算时间戳
        isCurrent: currentVersion.isCurrent,
        _provider: currentVersion.storageProvider,
        _objectKey: currentVersion.objectKey,
        _configId: currentVersion.storageConfigId,
        _providers: currentVersion.storageProviders || '[]'
      }
      
      // 存入缓存
      await versionCache.setCachedVersion(project.id, 'latest', cachedVersion)
      
      // 如果这个版本有特定的版本号，也缓存一份
      await versionCache.setCachedVersion(project.id, currentVersion.version, cachedVersion)
    }

    // 处理多链接轮询
    let selectedUrl = cachedVersion.downloadUrl // 默认使用主链接
    
    // 如果存在多个下载链接
    if (cachedVersion.downloadUrls && Array.isArray(cachedVersion.downloadUrls) && 
        cachedVersion.downloadUrls.length > 0) {
      // 使用缓存的轮询机制
      const rotation = await versionCache.getNextRotationUrl(
        `${project.id}:${cachedVersion.version}`,
        cachedVersion.downloadUrls
      )
      selectedUrl = rotation.url
      
      // 只有在需要时才批量更新数据库（减少数据库写操作）
      if (rotation.shouldUpdateDb) {
        // 异步更新数据库，不阻塞响应
        prisma.version.updateMany({
          where: {
            projectId: project.id,
            version: cachedVersion.version
          },
          data: {
            urlRotationIndex: 0 // 重置索引，实际轮询状态由缓存管理
          }
        }).catch(err => {
          console.error('批量更新轮询索引失败:', err)
        })
      }
    }

    // 针对对象存储：优先返回可稳定访问的下载入口（带轮询索引），避免直链 403/404
    // 只有纯“LINK”类型时才返回直链
    if (Array.isArray(cachedVersion.downloadUrls) && cachedVersion.downloadUrls.length > 0) {
      const urls = cachedVersion.downloadUrls as string[]
      const idx = urls.indexOf(selectedUrl)
      const providersRaw = (cachedVersion as any)._providers || '[]'
      let providers: any[] = []
      try { providers = JSON.parse(providersRaw) } catch { providers = [] }
      const type = (providers[idx]?.type || providers[idx] || '').toString().toUpperCase()
      const isLink = type === 'LINK'
      // 如果当前选中的链接不是 LINK（即需要签名/代理/本地流式）则返回 /download?i=idx
      if (!isLink) {
        const safeIdx = idx >= 0 ? idx : 0
        let vid = (cachedVersion as any).id
        if (!vid) {
          // 缓存里可能没有 id，回退到数据库取一次
          try {
            const found = await prisma.version.findFirst({
              where: { version: cachedVersion.version, projectId: project.id },
              select: { id: true }
            })
            vid = found?.id
          } catch {}
        }
        if (vid) {
          selectedUrl = `/api/versions/${vid}/download?i=${safeIdx}`
        }
      }
    }

    // 统一返回“绝对URL”，便于客户端直接使用（KISS）
    const absoluteUrl = toAbsoluteUrl(req, selectedUrl)

    return NextResponse.json({
      success: true,
      data: {
        version: cachedVersion.version,
        downloadUrl: absoluteUrl, // 返回可直接访问的绝对链接
        md5: cachedVersion.md5,
        forceUpdate: cachedVersion.forceUpdate,
        changelog: cachedVersion.changelog,
        createdAt: cachedVersion.createdAt,
        updatedAt: cachedVersion.updatedAt,
        timestamp: cachedVersion.timestamp || new Date(cachedVersion.updatedAt || cachedVersion.createdAt).getTime(), // 基于updatedAt计算时间戳
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
