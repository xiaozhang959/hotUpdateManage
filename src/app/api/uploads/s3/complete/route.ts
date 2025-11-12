import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadSession, removeSession } from '@/lib/uploads/resumable'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })
  const body = await req.json()
  const { uploadId, parts } = body || {}
  if (!uploadId || !Array.isArray(parts) || !parts.length) return NextResponse.json({ error: '缺少参数' }, { status: 400 })
  const meta = await loadSession(uploadId)
  if (meta.strategy !== 'S3_MULTIPART' || !meta.s3UploadId) return NextResponse.json({ error: '会话不是 S3 多段上传' }, { status: 400 })

  const cfgRec = meta.storageConfigId ? await prisma.storageConfig.findUnique({ where: { id: meta.storageConfigId } }) : null
  const cfg = cfgRec ? JSON.parse(cfgRec.configJson || '{}') : {}
  const { S3Client, CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3')
  const client = new S3Client({
    region: cfg.region,
    credentials: cfg.accessKeyId ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } : undefined,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle
  })
  const resp = await client.send(new CompleteMultipartUploadCommand({
    Bucket: cfg.bucket,
    Key: meta.objectKey!,
    UploadId: meta.s3UploadId!,
    MultipartUpload: { Parts: parts.map((p: any) => ({ ETag: p.ETag, PartNumber: p.PartNumber })) }
  }))

  // 生成对外URL（沿用 provider 的规则）；此处简化为拼接 publicBaseUrl/endpoint 逻辑
  const publicBaseUrl = cfg.publicBaseUrl
  let url = ''
  if (publicBaseUrl) {
    url = `${publicBaseUrl.replace(/\/$/,'')}/${meta.objectKey}`
  } else if (cfg.endpoint) {
    const ep = cfg.endpoint.replace(/^https?:\/\//,'')
    if (cfg.forcePathStyle) url = `https://${ep}/${cfg.bucket}/${meta.objectKey}`
    else url = `https://${cfg.bucket}.${ep}/${meta.objectKey}`
  } else {
    url = `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${meta.objectKey}`
  }

  await removeSession(uploadId)
  return NextResponse.json({ success: true, data: {
    url,
    md5: resp.ETag?.replace(/\"/g, '') || '',
    storageProvider: 'S3',
    objectKey: meta.objectKey,
    storageConfigId: meta.storageConfigId || null,
    fileName: meta.fileName,
    originalName: meta.fileName,
    size: meta.fileSize,
    uploadedAt: new Date().toISOString()
  } })
}

