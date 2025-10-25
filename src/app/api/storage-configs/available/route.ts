import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  try {
    const userId = session.user.id
    const [userItems, globalItems] = await Promise.all([
      (prisma as any).storageConfig.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      (prisma as any).storageConfig.findMany({ where: { userId: null }, orderBy: { createdAt: 'desc' } })
    ])
    const all = [...userItems, ...globalItems]
    const userDefault = userItems.find((x:any)=>x.isDefault)
    const globalDefault = globalItems.find((x:any)=>x.isDefault)
    const defaultId = userDefault?.id || globalDefault?.id || null

    const items = all.map((i:any)=>({ id: i.id, name: i.name, provider: i.provider, isDefault: Boolean(i.isDefault), scope: i.userId ? 'user':'global' }))

    // 本地回退（仅当没有任何默认时作为默认）
    if (!defaultId) {
      items.unshift({ id: null as any, name: '本地存储(内置)', provider: 'LOCAL', isDefault: true, scope: 'fallback' })
    } else {
      items.unshift({ id: null as any, name: '本地存储(内置)', provider: 'LOCAL', isDefault: false, scope: 'fallback' })
    }

    return NextResponse.json({ success: true, items, defaultId })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || '获取可用存储失败' }, { status: 500 })
  }
}
