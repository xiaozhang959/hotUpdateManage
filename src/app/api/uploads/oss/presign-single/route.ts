import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadSession } from '@/lib/uploads/resumable'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const uploadId = searchParams.get('uploadId')
  if (!uploadId) return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 })

  let meta: any
  try {
    meta = await loadSession(uploadId, session.user.id)
  } catch (e: any) {
    if (e?.message === 'forbidden') return NextResponse.json({ error: '无权限访问该上传会话' }, { status: 403 })
    return NextResponse.json({ error: '上传会话不存在或已过期' }, { status: 404 })
  }

  if (meta.strategy !== 'OSS_SINGLE') return NextResponse.json({ error: '会话不是 OSS 单次直传' }, { status: 400 })
  if (!meta.storageConfigId) return NextResponse.json({ error: 'OSS 直传缺少存储配置' }, { status: 400 })

  const cfgRec = await prisma.storageConfig.findUnique({ where: { id: meta.storageConfigId } })
  const cfg = cfgRec ? JSON.parse(cfgRec.configJson || '{}') : {}
  const OSS = (await import('ali-oss')).default
  const client = new OSS({
    region: cfg.region,
    bucket: cfg.bucket,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    endpoint: cfg.endpoint,
    secure: cfg.secure !== false,
  })
  const contentType = meta.contentType || 'application/octet-stream'
  const url = client.signatureUrl(meta.objectKey!, {
    expires: 3600,
    method: 'PUT',
    'Content-Type': contentType,
  })

  return NextResponse.json({ success: true, data: { url, headers: { 'Content-Type': contentType } } })
}
