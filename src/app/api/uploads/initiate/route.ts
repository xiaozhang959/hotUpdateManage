import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getConfig } from '@/lib/system-config'
import { createSession } from '@/lib/uploads/resumable'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })
  const body = await req.json()
  const { projectId, fileName, fileSize, contentType, storageConfigId, preferSingle } = body || {}
  if (!projectId || !fileName || !fileSize) return NextResponse.json({ error: '参数不完整' }, { status: 400 })

  // 校验最大体积
  const maxUploadSize = (await getConfig('max_upload_size')) as number || (100 * 1024 * 1024)
  if (fileSize > maxUploadSize) {
    const sizeMB = Math.round(maxUploadSize / 1024 / 1024)
    return NextResponse.json({ error: `文件大小不能超过${sizeMB}MB` }, { status: 400 })
  }

  const meta = await createSession({
    userId: session.user.id,
    projectId,
    fileName,
    fileSize,
    contentType,
    storageConfigId: storageConfigId || null,
    preferSingle: !!preferSingle
  })
  return NextResponse.json({ success: true, data: meta })
}
