import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadSession, writeChunk } from '@/lib/uploads/resumable'
import { Readable } from 'stream'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: '未授权' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const uploadId = searchParams.get('uploadId')
  const idxStr = searchParams.get('index')
  if (!uploadId || idxStr === null) return NextResponse.json({ error: '缺少 uploadId/index' }, { status: 400 })
  const index = parseInt(idxStr, 10)
  if (isNaN(index) || index < 0) return NextResponse.json({ error: 'index 非法' }, { status: 400 })
  const meta = await loadSession(uploadId)
  if (index >= meta.totalParts) return NextResponse.json({ error: 'index 超出范围' }, { status: 400 })
  const body = req.body
  if (!body) return NextResponse.json({ error: '缺少请求体' }, { status: 400 })
  const nodeStream = Readable.fromWeb(body as any)
  await writeChunk(uploadId, index, nodeStream)
  return NextResponse.json({ success: true })
}

