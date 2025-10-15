import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { versionCache } from '@/lib/cache/version-cache'

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

    return NextResponse.json(versions)
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

    const { version, downloadUrl, downloadUrls, changelog, forceUpdate, md5: providedMd5 } = await req.json()

    // 兼容性处理：如果提供了downloadUrls数组，使用它；否则使用单个downloadUrl
    const urls = downloadUrls && downloadUrls.length > 0 ? downloadUrls : [downloadUrl]
    const primaryUrl = urls[0]

    if (!version || !primaryUrl) {
      return NextResponse.json(
        { error: '请提供版本号和下载链接' },
        { status: 400 }
      )
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

    // 使用提供的MD5或生成一个随机的MD5
    const md5Hash = providedMd5 || createHash('md5').update(primaryUrl + Date.now()).digest('hex')

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
          md5: md5Hash,
          changelog: changelog || '未提供更新日志',
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

    return NextResponse.json(newVersion)
  } catch (error) {
    console.error('创建版本失败:', error)
    return NextResponse.json(
      { error: '创建版本失败' },
      { status: 500 }
    )
  }
}