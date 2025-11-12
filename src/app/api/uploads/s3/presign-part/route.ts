import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadSession } from '@/lib/uploads/resumable'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const uploadId = searchParams.get('uploadId')
  const partNumber = parseInt(searchParams.get('partNumber') || '', 10)
  if (!uploadId || !partNumber) return NextResponse.json({ error: '缺少参数' }, { status: 400 })
  const meta = await loadSession(uploadId)
  if (meta.strategy !== 'S3_MULTIPART' || !meta.s3UploadId) return NextResponse.json({ error: '会话不是 S3 多段上传' }, { status: 400 })

  const cfgRec = meta.storageConfigId ? await prisma.storageConfig.findUnique({ where: { id: meta.storageConfigId } }) : null
  const cfg = cfgRec ? JSON.parse(cfgRec.configJson || '{}') : {}
  const { S3Client, UploadPartCommand } = await import('@aws-sdk/client-s3')
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
  const client = new S3Client({
    region: cfg.region,
    credentials: cfg.accessKeyId ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } : undefined,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle
  })
  const cmd = new UploadPartCommand({
    Bucket: cfg.bucket,
    Key: meta.objectKey!,
    UploadId: meta.s3UploadId!,
    PartNumber: partNumber
  })
  const url = await getSignedUrl(client, cmd, { expiresIn: 3600 })
  return NextResponse.json({ success: true, data: { url } })
}

