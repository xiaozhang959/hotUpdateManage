import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveProjectAccessContext } from '@/lib/project-access'
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

  // 检查是否允许上传
  const uploadEnabled = await getConfig('upload_enabled')
  if (!uploadEnabled) {
    return NextResponse.json({ error: '系统暂时关闭文件上传功能' }, { status: 403 })
  }

  let accessContext
  try {
    accessContext = await resolveProjectAccessContext({
      projectId,
      requesterUserId: session.user.id,
      requesterRole: session.user.role,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '项目不存在或无权限'
    return NextResponse.json({ error: message }, { status: message.includes('无权限') ? 403 : 404 })
  }

  try {
    const meta = await createSession({
      userId: session.user.id,
      storageOwnerUserId: accessContext.ownerUserId,
      projectId,
      fileName,
      fileSize,
      contentType,
      storageConfigId: storageConfigId || null,
      preferSingle: !!preferSingle
    })
    return NextResponse.json({ success: true, data: meta })
  } catch (error) {
    const message = error instanceof Error ? error.message : '初始化上传会话失败'
    return NextResponse.json(
      { error: message === 'invalid storageConfigId' ? '所选存储配置不存在或不可用于当前项目' : message },
      { status: message === 'invalid storageConfigId' ? 400 : 500 }
    )
  }
}
