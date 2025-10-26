import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限访问' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') // 'global' | 'user'
  let userId = searchParams.get('userId') || undefined
  // 便捷：scope=user 且未显式传入 userId，则使用当前管理员ID
  if (scope === 'user' && !userId) userId = session.user.id

  const where: any = {}
  if (scope === 'global') where.userId = null
  if (scope === 'user' && userId) where.userId = userId

  const items = await (prisma as any).storageConfig.findMany({ where, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ success: true, data: items })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限访问' }, { status: 403 })
  }
  const body = await req.json()
  const { id, name, provider, userId = null, isDefault = false, config } = body || {}

  if (!name || !provider) {
    return NextResponse.json({ error: 'name 与 provider 必填' }, { status: 400 })
  }

  // 解析作用域：'self' 表示仅管理员本人使用
  const ownerId = userId === 'self' ? session.user.id : userId

  // 若设为默认，取消同作用域其他默认
  if (isDefault) {
    await (prisma as any).storageConfig.updateMany({ where: { userId: ownerId }, data: { isDefault: false } })
  }

  const data = {
    name,
    provider,
    userId: ownerId,
    isDefault: Boolean(isDefault),
    configJson: JSON.stringify(config || {})
  }

  let saved
  if (id) {
    saved = await (prisma as any).storageConfig.update({ where: { id }, data })
  } else {
    saved = await (prisma as any).storageConfig.create({ data })
  }
  return NextResponse.json({ success: true, data: saved })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限访问' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })
  await (prisma as any).storageConfig.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ success: true })
}
