import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateMD5, generateRandomMD5 } from '@/lib/crypto'

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

    const { version, downloadUrl, changelog, forceUpdate, isUrl } = await req.json()

    if (!version || !downloadUrl || !changelog) {
      return NextResponse.json(
        { error: '版本号、下载链接和更新日志为必填项' },
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

    // 如果是URL链接，生成随机MD5；如果是文件，后续会计算真实MD5
    const md5 = isUrl ? generateRandomMD5() : generateRandomMD5() // 暂时都用随机MD5

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
          downloadUrl,
          md5,
          changelog,
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

    return NextResponse.json(newVersion)
  } catch (error) {
    console.error('创建版本失败:', error)
    return NextResponse.json(
      { error: '创建版本失败' },
      { status: 500 }
    )
  }
}