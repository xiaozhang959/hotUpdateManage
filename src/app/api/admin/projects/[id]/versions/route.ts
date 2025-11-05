import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { resolveSizeForUrl } from '@/lib/remote-md5'
import { withSerializedSize } from '@/lib/server/serialize'

// 添加新版本（管理员）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    const { version, downloadUrl, downloadUrls, changelog, forceUpdate, md5, size: providedSize } = await req.json()
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

    // 检查项目是否存在
    const project = await prisma.project.findUnique({
      where: { id }
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    // 检查版本是否已存在
    const existingVersion = await prisma.version.findFirst({
      where: {
        projectId: id,
        version: version
      }
    })

    if (existingVersion) {
      return NextResponse.json(
        { error: '该版本号已存在' },
        { status: 400 }
      )
    }

    // 获取文件大小（优先请求体提供的 size，其次自动解析）
    if (Number.isFinite(Number(providedSize)) && Number(providedSize) > 0) {
      fileSizeBytes = Number(providedSize)
    } else {
      try { fileSizeBytes = await resolveSizeForUrl(primaryUrl) } catch {}
    }

    // 使用传入的MD5或生成一个默认值
    const finalMd5 = md5 || createHash('md5').update(primaryUrl).digest('hex')

    // 创建新版本
    const newVersion = await prisma.version.create({
      data: {
        version,
        downloadUrl: primaryUrl, // 主链接，用于向后兼容
        downloadUrls: JSON.stringify(urls), // 存储所有链接
        size: fileSizeBytes != null ? BigInt(fileSizeBytes) : null,
        md5: finalMd5,
        changelog: changelog || '',
        forceUpdate: forceUpdate || false,
        isCurrent: true,
        projectId: id
      }
    })

    // 将其他版本设置为非当前版本
    await prisma.version.updateMany({
      where: {
        projectId: id,
        id: { not: newVersion.id }
      },
      data: {
        isCurrent: false
      }
    })

    // 更新项目的当前版本
    await prisma.project.update({
      where: { id },
      data: {
        currentVersion: version
      }
    })

    return NextResponse.json({
      message: '版本创建成功',
      version: {
        ...withSerializedSize(newVersion),
        timestamp: new Date(newVersion.createdAt).getTime() // 添加时间戳
      }
    })
  } catch (error) {
    console.error('创建版本失败:', error)
    return NextResponse.json(
      { error: '创建版本失败' },
      { status: 500 }
    )
  }
}
