import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createStorageProvider } from '@/lib/storage'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  try {
    const { provider, config } = await req.json()
    if (!provider) return NextResponse.json({ error: 'provider 必填' }, { status: 400 })
    const buf = Buffer.from('test-connectivity')
    const isLanzou = provider === 'LANZOU'
    const fileName = `connectivity_${Date.now()}_${Math.random().toString(36).slice(2)}.${isLanzou ? 'zip' : 'txt'}`
    const projectId = '__test__'

    const p = createStorageProvider(provider, config)
    if (!p) return NextResponse.json({ error: '未知 provider' }, { status: 400 })
    const result = await p.putObject({ projectId, fileName, buffer: buf, contentType: isLanzou ? 'application/zip' : 'text/plain' })
    return NextResponse.json({ success: true, url: result.url })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '测试失败' }, { status: 200 })
  }
}
