import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Get current user's API token
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        apiToken: true,
        apiTokenCreatedAt: true
      }
    })

    return NextResponse.json({
      token: user?.apiToken,
      createdAt: user?.apiTokenCreatedAt
    })
  } catch (error) {
    console.error('获取API Token失败:', error)
    return NextResponse.json(
      { error: '获取API Token失败' },
      { status: 500 }
    )
  }
}

// Generate or regenerate API token
export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // Generate a new token
    const token = generateApiToken()

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        apiToken: token,
        apiTokenCreatedAt: new Date()
      },
      select: {
        apiToken: true,
        apiTokenCreatedAt: true
      }
    })

    return NextResponse.json({
      token: user.apiToken,
      createdAt: user.apiTokenCreatedAt,
      message: 'API Token已生成'
    })
  } catch (error) {
    console.error('生成API Token失败:', error)
    return NextResponse.json(
      { error: '生成API Token失败' },
      { status: 500 }
    )
  }
}


function generateApiToken(): string {
  // Generate a secure random token with prefix
  const randomBytes = crypto.randomBytes(32).toString('hex')
  return `hot_${randomBytes}`
}