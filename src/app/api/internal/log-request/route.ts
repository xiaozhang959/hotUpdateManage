import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const expected = (process.env.HOT_UPDATE_INTERNAL_TOKEN || '').trim()
    if (!expected) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }
    const provided = (request.headers.get('x-internal-token') || '').trim()
    if (!provided || provided !== expected) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    const {
      endpoint,
      method,
      statusCode,
      responseTime,
      userAgent,
      ipAddress,
      projectId
    } = await request.json()

    // 记录API请求到数据库
    await prisma.apiRequest.create({
      data: {
        endpoint,
        method,
        statusCode,
        responseTime,
        userAgent,
        ipAddress,
        projectId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log API request:', error)
    return NextResponse.json({ error: 'Failed to log request' }, { status: 500 })
  }
}
