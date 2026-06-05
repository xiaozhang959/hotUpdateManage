import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadSession, removeSession } from '@/lib/uploads/resumable'
import { prisma } from '@/lib/prisma'

function buildPublicUrl(cfg: any, objectKey: string) {
  if (cfg.publicBaseUrl) {
    return `${String(cfg.publicBaseUrl).replace(/\/$/, '')}/${objectKey}`
  }
  if (cfg.endpoint) {
    const endpoint = String(cfg.endpoint).replace(/^https?:\/\//, '')
    return `https://${cfg.bucket}.${endpoint}/${objectKey}`
  }
  return `https://${cfg.bucket}.oss-${cfg.region}.aliyuncs.com/${objectKey}`
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const body = await req.json()
  const { uploadId, etag } = body || {}
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
  const url = buildPublicUrl(cfg, meta.objectKey)
  await removeSession(uploadId)

  return NextResponse.json({
    success: true,
    data: {
      url,
      md5: String(etag || '').replace(/\"/g, ''),
      storageProvider: 'OSS',
      objectKey: meta.objectKey,
      storageConfigId: meta.storageConfigId || null,
      fileName: meta.fileName,
      originalName: meta.fileName,
      size: meta.fileSize,
      uploadedAt: new Date().toISOString(),
    },
  })
}
