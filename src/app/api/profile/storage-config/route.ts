import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  const items = await (prisma as any).storageConfig.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ success: true, data: items })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  const body = await req.json()
  const { id, name, provider, isDefault = false, config } = body || {}
  if (!name || !provider) {
    return NextResponse.json({ error: 'name 与 provider 必填' }, { status: 400 })
  }

  if (isDefault) {
    await (prisma as any).storageConfig.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } })
  }

  const data = {
    name,
    provider,
    userId: session.user.id,
    isDefault: Boolean(isDefault),
    configJson: JSON.stringify(config || {})
  }
  let saved
  if (id) {
    saved = await (prisma as any).storageConfig.update({ where: { id, }, data })
  } else {
    saved = await (prisma as any).storageConfig.create({ data })
  }
  return NextResponse.json({ success: true, data: saved })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 })
  await (prisma as any).storageConfig.delete({ where: { id, userId: session.user.id } }).catch(() => {})
  return NextResponse.json({ success: true })
}
