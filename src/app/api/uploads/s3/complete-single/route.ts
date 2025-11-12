import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadSession, removeSession } from '@/lib/uploads/resumable'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })
  const body = await req.json()
  const { uploadId, etag } = body || {}
  if (!uploadId) return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 })
  const meta = await loadSession(uploadId)
  if (meta.strategy !== 'S3_SINGLE') return NextResponse.json({ error: '会话不是 S3 单次直传' }, { status: 400 })
  const cfgRec = meta.storageConfigId ? await prisma.storageConfig.findUnique({ where: { id: meta.storageConfigId } }) : null
  const cfg = cfgRec ? JSON.parse(cfgRec.configJson || '{}') : {}
  const publicBaseUrl = cfg.publicBaseUrl
  let url = ''
  if (publicBaseUrl) url = `${publicBaseUrl.replace(/\/$/,'')}/${meta.objectKey}`
  else if (cfg.endpoint) {
    const ep = cfg.endpoint.replace(/^https?:\/\//,'')
    if (cfg.forcePathStyle) url = `https://${ep}/${cfg.bucket}/${meta.objectKey}`
    else url = `https://${cfg.bucket}.${ep}/${meta.objectKey}`
  } else {
    url = `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${meta.objectKey}`
  }
  await removeSession(uploadId)
  return NextResponse.json({ success: true, data: {
    url,
    md5: (etag || '').replace(/\"/g, ''),
    storageProvider: 'S3',
    objectKey: meta.objectKey,
    storageConfigId: meta.storageConfigId || null,
    fileName: meta.fileName,
    originalName: meta.fileName,
    size: meta.fileSize,
    uploadedAt: new Date().toISOString()
  }})
}

