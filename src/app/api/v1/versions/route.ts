import { NextRequest, NextResponse } from 'next/server'
import { validateBearerToken, validateApiKey } from '@/lib/auth-bearer'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { resolveMd5ForUrl, isUploadsUrl, resolveSizeForUrl } from '@/lib/remote-md5'
import { withSerializedSize } from '@/lib/server/serialize'
import { getConfig } from '@/lib/system-config'
import { getActiveStorageProvider } from '@/lib/storage'
// Keep encoding strictly for local file uploads; do not encode user-provided links

// GET /api/v1/versions - Get versions for a project
export async function GET(req: NextRequest) {
  try {
    const user = await validateBearerToken(req)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing bearer token' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    const versions = await prisma.version.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    })

    // 为每个版本添加时间戳
    const versionsWithTimestamp = versions.map(v => ({
      ...withSerializedSize(v),
      timestamp: new Date(v.createdAt).getTime()
    }))

    return NextResponse.json({
      success: true,
      data: versionsWithTimestamp
    })
  } catch (error) {
    console.error('Failed to fetch versions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/v1/versions - Create a new version
export async function POST(req: NextRequest) {
  try {
    const user = await validateBearerToken(req)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing bearer token' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const projectId = formData.get('projectId') as string
    const version = formData.get('version') as string
    const forceUpdate = formData.get('forceUpdate') === 'true'
    const changelog = formData.get('changelog') as string || ''
    const file = formData.get('file') as File | null
    const url = formData.get('url') as string | null
    const urls = formData.get('urls') as string | null
    const providedMd5 = (formData.get('md5') as string | null)?.toString().trim() || ''
    const providedSizeRaw = (formData.get('size') as string | null) || ''
    const providedSize = providedSizeRaw ? Number(providedSizeRaw) : NaN

    if (!projectId || !version) {
      return NextResponse.json(
        { error: 'Project ID and version are required' },
        { status: 400 }
      )
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: user.id
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Check if version already exists
    const existingVersion = await prisma.version.findUnique({
      where: {
        projectId_version: {
          projectId,
          version
        }
      }
    })

    if (existingVersion) {
      return NextResponse.json(
        { error: 'Version already exists for this project' },
        { status: 409 }
      )
    }

    let downloadUrl: string = ''
    let downloadUrls: string[] = []
    let md5: string = ''
    let md5Source: string = 'manual'
    let fileSizeBytes: number | null = null
    // 为文件上传分支准备的外部可见变量，便于在后续写入数据库
    let put: any = null
    let providerName: string | null = null
    let activeConfigId: string | null = null

    // 强制 MD5 配置
    const requireMd5 = (await getConfig('require_md5_for_link_uploads')) as boolean
    const isHexMd5 = (s: string) => /^[a-fA-F0-9]{32}$/.test(s)

    // Priority: file upload > urls > url
    if (file && file.size > 0) {
      // Handle file upload (highest priority)
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // 安全文件名 + 全局唯一
      const safeFileName = file.name
        .replace(/[<>:"|?*\\/]/g, '_')
        .replace(/\.{2,}/g, '_')
        .replace(/^\./g, '_')
      const fileName = `${version}_${Date.now()}_${safeFileName}`

      const ret = await getActiveStorageProvider(user.id)
      const provider = ret.provider
      activeConfigId = ret.configId || null
      put = await provider.putObject({ projectId, fileName, buffer, contentType: file.type || 'application/octet-stream' })
      providerName = provider.name
      downloadUrl = put.url
      downloadUrls = [downloadUrl]
      md5 = put.md5
      md5Source = 'local'
      // 允许调用方显式提供 size（优先）
      fileSizeBytes = Number.isFinite(providedSize) && providedSize > 0 ? providedSize : Number(file.size)
    } else if (urls) {
      // Handle multiple URLs (second priority)
      try {
        const parsedUrls = JSON.parse(urls)
        if (!Array.isArray(parsedUrls) || parsedUrls.length === 0) {
          throw new Error('Invalid URLs format')
        }
        // Do NOT encode user-provided URLs; keep them exactly as submitted
        downloadUrls = parsedUrls
        downloadUrl = downloadUrls[0]
        // 解析主链接的文件大小（优先 providedSize）
        if (Number.isFinite(providedSize) && providedSize > 0) {
          fileSizeBytes = providedSize
        } else {
          try { fileSizeBytes = await resolveSizeForUrl(downloadUrl) } catch {}
        }
        if (providedMd5) {
          if (requireMd5 && !isHexMd5(providedMd5)) {
            return NextResponse.json({ error: '已开启强制校验：请提供有效的32位十六进制MD5' }, { status: 400 })
          }
          md5 = providedMd5
          md5Source = 'manual'
        } else {
          const resolved = await resolveMd5ForUrl(downloadUrl)
          if (resolved?.md5) {
            md5 = resolved.md5
            md5Source = resolved.from || 'etag'
          } else {
            if (requireMd5 && !isUploadsUrl(downloadUrl)) {
              return NextResponse.json(
                { error: '系统已开启：链接上传必须提供有效MD5。请提供 md5 或确保链接返回 ETag/Content-MD5。' },
                { status: 400 }
              )
            }
            const randomString = `${projectId}-${version}-${Date.now()}-${Math.random()}`
            md5 = crypto.createHash('md5').update(randomString).digest('hex')
            md5Source = 'random'
          }
        }
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid URLs format. Must be a JSON array of strings' },
          { status: 400 }
        )
      }
    } else if (url) {
      // Handle single URL (lowest priority)
      // Do NOT encode user-provided URL; keep it exactly as submitted
      downloadUrl = url
      downloadUrls = [downloadUrl]
      // 解析主链接的文件大小（优先 providedSize）
      if (Number.isFinite(providedSize) && providedSize > 0) {
        fileSizeBytes = providedSize
      } else {
        try { fileSizeBytes = await resolveSizeForUrl(downloadUrl) } catch {}
      }
      if (providedMd5) {
        if (requireMd5 && !isHexMd5(providedMd5)) {
          return NextResponse.json({ error: '已开启强制校验：请提供有效的32位十六进制MD5' }, { status: 400 })
        }
        md5 = providedMd5
        md5Source = 'manual'
      } else {
        const resolved = await resolveMd5ForUrl(downloadUrl)
        if (resolved?.md5) {
          md5 = resolved.md5
          md5Source = resolved.from || 'etag'
        } else {
          if (requireMd5 && !isUploadsUrl(downloadUrl)) {
            return NextResponse.json(
              { error: '系统已开启：链接上传必须提供有效MD5。请提供 md5 或确保链接返回 ETag/Content-MD5。' },
              { status: 400 }
            )
          }
          const randomString = `${projectId}-${version}-${Date.now()}-${Math.random()}`
          md5 = crypto.createHash('md5').update(randomString).digest('hex')
          md5Source = 'random'
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Either file, url, or urls must be provided' },
        { status: 400 }
      )
    }

    // Create version in database
    const newVersion = await prisma.version.create({
      data: {
        projectId,
        version,
        downloadUrl,
        downloadUrls: JSON.stringify(downloadUrls),
        size: fileSizeBytes != null ? BigInt(fileSizeBytes) : null,
        md5,
        md5Source,
        storageProvider: providerName,
        objectKey: put?.objectKey ?? null,
        storageConfigId: activeConfigId,
        storageProviders: JSON.stringify(providerName ? [providerName] : []),
        forceUpdate,
        changelog,
        isCurrent: true
      }
    })

    // Update all other versions to not be current
    await prisma.version.updateMany({
      where: {
        projectId,
        id: { not: newVersion.id }
      },
      data: { isCurrent: false }
    })

    // Update project's current version
    await prisma.project.update({
      where: { id: projectId },
      data: { currentVersion: version }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...withSerializedSize(newVersion),
        timestamp: new Date(newVersion.createdAt).getTime() // 添加时间戳
      },
      message: 'Version created successfully'
    })
  } catch (error) {
    console.error('Failed to create version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

