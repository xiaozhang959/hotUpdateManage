import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadSession, removeSession } from '@/lib/uploads/resumable'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })
  const body = await req.json()
  const { uploadId } = body || {}
  if (!uploadId) return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 })
  try {
    await loadSession(uploadId, session.user.id)
    // 直接删除会话目录
    await removeSession(uploadId)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e?.message === 'forbidden') return NextResponse.json({ error: '无权限访问该上传会话' }, { status: 403 })
    return NextResponse.json({ success: true })
  }
}
