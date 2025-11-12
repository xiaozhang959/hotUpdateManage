import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadSession, listUploadedParts } from '@/lib/uploads/resumable'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const uploadId = searchParams.get('uploadId')
  if (!uploadId) return NextResponse.json({ error: '缺少 uploadId' }, { status: 400 })
  const meta = await loadSession(uploadId)
  const uploaded = await listUploadedParts(uploadId)
  return NextResponse.json({ success: true, data: { meta, uploaded } })
}

