import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { versionCache } from '@/lib/cache/version-cache'

export async function POST(req: Request) {
  try {
    // 从请求头或请求体获取API密钥
    const apiKeyFromHeader = req.headers.get('X-API-Key')
    const body = await req.json().catch(() => ({}))
    const apiKey = apiKeyFromHeader || body.apiKey

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API密钥缺失' },
        { status: 401 }
      )
    }

    // 优化：只查询必要字段，使用索引查询
    const project = await prisma.project.findUnique({
      where: { apiKey },
      select: {
        id: true,
        currentVersion: true
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'API密钥无效' },
        { status: 401 }
      )
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
            createdAt: true
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
            createdAt: true
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
        version: currentVersion.version,
        downloadUrl: currentVersion.downloadUrl,
        downloadUrls: downloadUrls,
        md5: currentVersion.md5,
        forceUpdate: currentVersion.forceUpdate,
        changelog: currentVersion.changelog,
        createdAt: currentVersion.createdAt,
        isCurrent: currentVersion.isCurrent
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

    return NextResponse.json({
      success: true,
      data: {
        version: cachedVersion.version,
        downloadUrl: selectedUrl, // 返回轮询选择的链接
        md5: cachedVersion.md5,
        forceUpdate: cachedVersion.forceUpdate,
        changelog: cachedVersion.changelog,
        createdAt: cachedVersion.createdAt,
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