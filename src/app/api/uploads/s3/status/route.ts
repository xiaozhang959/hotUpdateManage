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
  const meta = await loadSession(uploadId)
  if (meta.strategy !== 'S3_MULTIPART' || !meta.s3UploadId) return NextResponse.json({ error: '会话不是 S3 多段上传' }, { status: 400 })

  const cfgRec = meta.storageConfigId ? await prisma.storageConfig.findUnique({ where: { id: meta.storageConfigId } }) : null
  const cfg = cfgRec ? JSON.parse(cfgRec.configJson || '{}') : {}
  const { S3Client, ListPartsCommand } = await import('@aws-sdk/client-s3')
  const client = new S3Client({
    region: cfg.region,
    credentials: cfg.accessKeyId ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } : undefined,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle
  })
  const res = await client.send(new ListPartsCommand({ Bucket: cfg.bucket, Key: meta.objectKey!, UploadId: meta.s3UploadId! }))
  const uploaded = (res.Parts || []).map(p => ({ PartNumber: p.PartNumber!, ETag: p.ETag }))
  return NextResponse.json({ success: true, data: { uploaded } })
}

