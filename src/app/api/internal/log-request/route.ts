import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
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