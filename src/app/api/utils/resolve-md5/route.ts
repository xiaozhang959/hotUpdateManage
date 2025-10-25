import { NextRequest, NextResponse } from 'next/server'
import { resolveMd5ForUrl } from '@/lib/remote-md5'
import { getConfig } from '@/lib/system-config'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const body = await req.json()
    const url = (body?.url || '').toString()
    if (!url) {
      return NextResponse.json({ error: 'url 参数必填' }, { status: 400 })
    }
    const maxBytes = (await getConfig('max_upload_size')) as number | null
    const limit = typeof maxBytes === 'number' && maxBytes > 0 ? maxBytes : 100 * 1024 * 1024
    const headOnly = Boolean(body?.headOnly)
    const result = headOnly ? await (async ()=>{ const h = await (await import('@/lib/remote-md5')).headForRemoteMd5(url); return h && { md5: h.md5, from: h.source as any } })() : await resolveMd5ForUrl(url, limit)
    if (!result?.md5) {
      return NextResponse.json({ success: false, message: '无法自动获取MD5（可能无可用ETag或文件过大）' }, { status: 200 })
    }
    return NextResponse.json({ success: true, md5: result.md5, from: result.from })
  } catch (e) {
    return NextResponse.json({ error: '解析MD5失败' }, { status: 500 })
  }
}
