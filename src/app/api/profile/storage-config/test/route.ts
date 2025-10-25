import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLocalProvider } from '@/lib/storage/local'
import { createWebDAVProvider } from '@/lib/storage/webdav'
import { createS3Provider } from '@/lib/storage/s3'
import { createOSSProvider } from '@/lib/storage/oss'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }
  try {
    const { provider, config } = await req.json()
    if (!provider) return NextResponse.json({ error: 'provider 必填' }, { status: 400 })
    const buf = Buffer.from('test-connectivity')
    const fileName = `connectivity_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`
    const projectId = '__test__'

    let p
    switch (provider) {
      case 'LOCAL': p = createLocalProvider(config); break
      case 'WEBDAV': p = createWebDAVProvider(config); break
      case 'S3': p = createS3Provider(config); break
      case 'OSS': p = createOSSProvider(config); break
      default: return NextResponse.json({ error: '未知 provider' }, { status: 400 })
    }
    const result = await p.putObject({ projectId, fileName, buffer: buf, contentType: 'text/plain' })
    return NextResponse.json({ success: true, url: result.url })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '测试失败' }, { status: 200 })
  }
}

