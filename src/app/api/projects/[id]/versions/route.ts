import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { versionCache } from '@/lib/cache/version-cache'
import { resolveMd5ForUrl, isUploadsUrl, resolveSizeForUrl } from '@/lib/remote-md5'
import { withSerializedSize } from '@/lib/server/serialize'
import { getConfig } from '@/lib/system-config'

// 获取项目的所有版本
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 验证项目所有权
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const versions = await prisma.version.findMany({
      where: {
        projectId: id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 为每个版本添加时间戳字段并序列化 BigInt
    const versionsWithTimestamp = versions.map(v => ({
      ...withSerializedSize(v),
      timestamp: new Date(v.createdAt).getTime()
    }))

    return NextResponse.json(versionsWithTimestamp)
  } catch (error) {
    console.error('获取版本列表失败:', error)
    return NextResponse.json(
      { error: '获取版本列表失败' },
      { status: 500 }
    )
  }
}

// 创建新版本
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 验证项目所有权
    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const { version, downloadUrl, downloadUrls, changelog, forceUpdate, md5: providedMd5, size: providedSize, storageProvider, objectKey, storageConfigId, storageProviders } = await req.json()
    let fileSizeBytes: number | null = null

    // 兼容性处理：如果提供了downloadUrls数组，使用它；否则使用单个downloadUrl
    const urls = downloadUrls && downloadUrls.length > 0 ? downloadUrls : [downloadUrl]
    const primaryUrl = urls[0]

    if (!version || !primaryUrl) {
      return NextResponse.json(
        { error: '请提供版本号和下载链接' },
        { status: 400 }
      )
    }

    // 解析主链接的文件大小（优先请求体提供的 size，其次自动探测）
    if (Number.isFinite(Number(providedSize)) && Number(providedSize) > 0) {
      fileSizeBytes = Number(providedSize)
    } else {
      try { fileSizeBytes = await resolveSizeForUrl(primaryUrl) } catch {}
    }

    // 检查版本号是否已存在
    const existingVersion = await prisma.version.findUnique({
      where: {
        projectId_version: {
          projectId: id,
          version
        }
      }
    })

    if (existingVersion) {
      return NextResponse.json(
        { error: '该版本号已存在' },
        { status: 400 }
      )
    }

    // 读取是否强制链接上传提供有效MD5
    const requireMd5 = (await getConfig('require_md5_for_link_uploads')) as boolean

    // 使用提供的MD5或自动解析远程/本地MD5（优先ETag），必要时根据开关决定是否兜底
    let md5Hash: string | null = null
    let md5Source: string = 'manual'
    const isHexMd5 = (s: string) => /^[a-fA-F0-9]{32}$/.test(s)
    if (providedMd5 && typeof providedMd5 === 'string' && providedMd5.trim()) {
      const trimmed = providedMd5.trim()
      if (requireMd5 && !isHexMd5(trimmed) && !isUploadsUrl(primaryUrl)) {
        return NextResponse.json(
          { error: '已开启强制校验：请提供有效的32位十六进制MD5' },
          { status: 400 }
        )
      }
      md5Hash = trimmed
      md5Source = 'manual'
    } else {
      try {
        const resolved = await resolveMd5ForUrl(primaryUrl)
        if (resolved?.md5) {
          md5Hash = resolved.md5
          md5Source = resolved.from || 'etag'
        }
      } catch (e) {
        // ignore, fallback below
      }
      if (!md5Hash) {
        if (requireMd5 && !isUploadsUrl(primaryUrl)) {
          return NextResponse.json(
            { error: '系统已开启：链接上传必须提供有效MD5。请手动填写或确保链接返回 ETag/Content-MD5。' },
            { status: 400 }
          )
        }
        // 保持向后兼容的兜底（不建议依赖）
        md5Hash = createHash('md5').update(primaryUrl + Date.now()).digest('hex')
        md5Source = 'random'
        console.warn('[versions.create] 未能自动获取MD5，已使用随机MD5作为兜底')
      }
    }

    // 使用事务确保数据一致性
    const newVersion = await prisma.$transaction(async (tx) => {
      // 先将所有版本的isCurrent设为false
      await tx.version.updateMany({
        where: { projectId: id },
        data: { isCurrent: false }
      })

      // 创建新版本并设为当前版本
      const createdVersion = await tx.version.create({
        data: {
          projectId: id,
          version,
          downloadUrl: primaryUrl, // 主链接，用于向后兼容
          downloadUrls: JSON.stringify(urls), // 存储所有链接
          size: fileSizeBytes != null ? BigInt(fileSizeBytes) : null,
          md5: md5Hash!,
          md5Source,
          storageProvider: storageProvider || null,
          objectKey: objectKey || null,
          storageConfigId: storageConfigId || null,
          storageProviders: storageProviders ? JSON.stringify(storageProviders) : '[]',
          changelog: changelog || '',
          forceUpdate: forceUpdate || false,
          isCurrent: true
        }
      })

      // 更新项目的当前版本
      await tx.project.update({
        where: { id: id },
        data: { currentVersion: createdVersion.version }
      })

      return createdVersion
    })

    // 清理该项目的缓存，确保下次请求获取最新数据
    await versionCache.clearProjectCache(id)
    
    // 预热缓存（可选）
    await versionCache.warmupCache(id, newVersion)

    // 返回带时间戳的版本信息
    return NextResponse.json({
      ...withSerializedSize(newVersion),
      timestamp: new Date(newVersion.createdAt).getTime()
    })
  } catch (error) {
    console.error('创建版本失败:', error)
    return NextResponse.json(
      { error: '创建版本失败' },
      { status: 500 }
    )
  }
}
