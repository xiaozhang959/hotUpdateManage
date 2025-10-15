import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/user/token/delete - Delete API token
export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        apiToken: null,
        apiTokenCreatedAt: null
      }
    })

    return NextResponse.json({
      success: true,
      message: 'API Token已删除'
    })
  } catch (error) {
    console.error('删除API Token失败:', error)
    return NextResponse.json(
      { error: '删除API Token失败' },
      { status: 500 }
    )
  }
}