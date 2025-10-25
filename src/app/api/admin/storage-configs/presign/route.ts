import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '无权限访问' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const versionId = searchParams.get('versionId')
  const key = searchParams.get('key')
  const expires = parseInt(searchParams.get('expires') || '900', 10) // seconds

  try {
    let objectKey = key || ''
    let providerName: string | null = null
    let configId: string | null = null

    if (versionId) {
      const { prisma } = await import('@/lib/prisma')
      const v = await prisma.version.findUnique({ where: { id: versionId } })
      if (!v) return NextResponse.json({ error: '版本不存在' }, { status: 404 })
      if (!v.objectKey || !v.storageProvider) return NextResponse.json({ error: '该版本不是由对象存储上传，无法预签名' }, { status: 400 })
      objectKey = v.objectKey
      providerName = v.storageProvider
      configId = v.storageConfigId
    }

    if (!objectKey) return NextResponse.json({ error: '缺少 object key' }, { status: 400 })

    // 选择 provider（优先使用版本存储配置）
    const { getProviderByConfigId } = await import('@/lib/storage')

    // 暂时仅支持 S3/OSS 生成预签名
    if (!providerName) providerName = 'S3'

    if (providerName === 'S3') {
      // 使用 configId 构建 S3 客户端
      const cfgRec = configId ? await (await import('@/lib/prisma')).prisma.storageConfig.findUnique({ where: { id: configId } }) : null
      const cfg = cfgRec ? JSON.parse(cfgRec.configJson || '{}') : {}
      const bucket = cfg.bucket
      if (!bucket) return NextResponse.json({ error: 'S3 配置缺少 bucket' }, { status: 400 })
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const client = new S3Client({
        region: cfg.region,
        credentials: cfg.accessKeyId ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } : undefined,
        endpoint: cfg.endpoint,
        forcePathStyle: cfg.forcePathStyle
      })
      const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: Math.min(Math.max(expires, 60), 3600) })
      return NextResponse.json({ success: true, url })
    }

    if (providerName === 'OSS') {
      const cfgRec = configId ? await (await import('@/lib/prisma')).prisma.storageConfig.findUnique({ where: { id: configId } }) : null
      const cfg = cfgRec ? JSON.parse(cfgRec.configJson || '{}') : {}
      const OSS = (await import('ali-oss')).default
      const client = new OSS({
        region: cfg.region,
        bucket: cfg.bucket,
        accessKeyId: cfg.accessKeyId,
        accessKeySecret: cfg.accessKeySecret,
        endpoint: cfg.endpoint,
        secure: cfg.secure !== false
      })
      const url = client.signatureUrl(objectKey, { expires: Math.min(Math.max(expires, 60), 3600) })
      return NextResponse.json({ success: true, url })
    }

    return NextResponse.json({ error: '当前仅支持 S3 与 OSS 预签名' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '预签名失败' }, { status: 500 })
  }
}
