import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { refreshProjectVersionCache, setCurrentVersionById } from '@/lib/project-version-service'

// 设置当前活跃版本
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const session = await auth()
    const { id, versionId } = await params

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const project = await prisma.project.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const currentVersion = await prisma.$transaction((tx) => setCurrentVersionById(tx, id, versionId))
    await refreshProjectVersionCache(id)

    return NextResponse.json({
      message: `当前版本已设置为 ${currentVersion}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '设置当前版本失败'
    console.error('设置当前版本失败:', error)
    return NextResponse.json({ error: message }, { status: message.includes('不存在') ? 404 : 500 })
  }
}
