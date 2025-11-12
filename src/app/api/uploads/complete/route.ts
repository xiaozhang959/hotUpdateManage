import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { assembleAndStore, loadSession, removeSession, listUploadedParts } from '@/lib/uploads/resumable'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })
  const body = await req.json()
  const { uploadId } = body || {}
  if (!uploadId) return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 })
  const meta = await loadSession(uploadId)
  const uploaded = await listUploadedParts(uploadId)
  if (uploaded.length !== meta.totalParts) {
    return NextResponse.json({ error: '分片未上传完整', uploaded }, { status: 400 })
  }
  const put = await assembleAndStore(uploadId)
  await removeSession(uploadId)
  return NextResponse.json({ success: true, data: {
    url: put.url,
    md5: put.md5,
    storageProvider: meta.providerName,
    objectKey: put.objectKey,
    storageConfigId: meta.storageConfigId || null,
    fileName: meta.fileName,
    originalName: meta.fileName,
    size: meta.fileSize,
    uploadedAt: new Date().toISOString()
  }})
}

