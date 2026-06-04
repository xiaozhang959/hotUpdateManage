import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createStorageProvider } from '@/lib/storage'
import { resolveLanzouDownloadUrl } from '@/lib/lanzou/client'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限访问' }, { status: 403 })
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
    // 轻量 PUT 测试（不保证删除成功；建议管理端定期清理 __test__）
    const result = await p.putObject({ projectId, fileName, buffer: buf, contentType: isLanzou ? 'application/zip' : 'text/plain' })
    if (isLanzou) {
      const directUrl = await resolveLanzouDownloadUrl(result.url, config)
      return NextResponse.json({ success: true, url: result.url, directUrl })
    }
    return NextResponse.json({ success: true, url: result.url })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '测试失败' }, { status: 200 })
  }
}
