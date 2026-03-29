import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { parseInitEncryptedPayload } from '@/lib/server/auth-request-payloads'
import { requireBootstrapToken } from '@/lib/security/bootstrap'

export async function GET(req: Request) {
  try {
    const bootstrapError = requireBootstrapToken(req)
    if (bootstrapError) {
      return NextResponse.json({ error: bootstrapError }, { status: 403 })
    }
    // 检查是否已有管理员
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    })

    return NextResponse.json({
      hasAdmin: adminCount > 0,
      adminCount
    })
  } catch (error) {
    console.error('检查管理员失败:', error)
    return NextResponse.json(
      { error: '检查失败' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    let email: string
    let username: string
    let password: string
    let bootstrapToken: string | undefined

    try {
      ({ email, username, password, bootstrapToken } = parseInitEncryptedPayload(body.encryptedPayload))
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '初始化请求解密失败，请刷新页面后重试' },
        { status: 400 },
      )
    }

    const bootstrapError = requireBootstrapToken(req, bootstrapToken)
    if (bootstrapError) {
      return NextResponse.json({ error: bootstrapError }, { status: 403 })
    }

    // 检查是否已有管理员
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    })

    if (adminCount > 0) {
      return NextResponse.json(
        { error: '管理员已存在' },
        { status: 400 }
      )
    }

    // 验证输入
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: '所有字段都是必填的' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码至少需要6个字符' },
        { status: 400 }
      )
    }

    // 创建第一个管理员
    const hashedPassword = await bcrypt.hash(password, 10)

    const admin = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: 'ADMIN'
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true
      }
    })

    return NextResponse.json({
      message: '管理员创建成功',
      user: admin
    })
  } catch (error) {
    console.error('创建管理员失败:', error)
    return NextResponse.json(
      { error: '创建管理员失败' },
      { status: 500 }
    )
  }
}
