import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getConfig } from '@/lib/system-config'
import { markInitializationCompleted } from '@/lib/server/init-state'
import { parseRegisterEncryptedPayload } from '@/lib/server/auth-request-payloads'
import { sendEmail, generateVerificationEmail } from '@/lib/mailer'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    // 检查是否允许注册
    const registrationEnabled = await getConfig('registration_enabled')
    if (!registrationEnabled) {
      return NextResponse.json(
        { error: '系统暂时关闭注册功能' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))

    let email: string
    let username: string
    let password: string

    try {
      ({ email, username, password } = parseRegisterEncryptedPayload(body.encryptedPayload))
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '注册请求解密失败，请刷新页面后重试' },
        { status: 400 },
      )
    }

    // 验证输入
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: '所有字段都是必填的' },
        { status: 400 }
      )
    }

    // 检查邮箱是否已存在
    const existingEmail = await prisma.user.findUnique({
      where: { email }
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: '邮箱已被注册' },
        { status: 400 }
      )
    }

    // 检查用户名是否已存在
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    })

    if (existingUsername) {
      return NextResponse.json(
        { error: '用户名已被使用' },
        { status: 400 }
      )
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 检查是否需要邮箱验证
    const requireEmailVerification = await getConfig('require_email_verification')
    const smtpEnabled = await getConfig('smtp_enabled')
    
    let verificationToken: string | null = null
    let verificationExpiry: Date | null = null
    
    if (requireEmailVerification && smtpEnabled) {
      // 生成验证令牌
      verificationToken = crypto.randomBytes(32).toString('hex')
      const emailVerifyExpire = (await getConfig('email_verify_expire') as number) || 86400
      verificationExpiry = new Date(Date.now() + emailVerifyExpire * 1000)
    }

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: 'USER',
        emailVerified: !requireEmailVerification || !smtpEnabled, // 如果不需要验证，直接标记为已验证
        verificationToken,
        verificationExpiry
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        emailVerified: true
      }
    })
    
    // 创建任意用户后，当前实例即可视为已初始化
    markInitializationCompleted()
    
    // 发送验证邮件
    if (requireEmailVerification && smtpEnabled && verificationToken) {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`
      
      const { subject, html } = generateVerificationEmail(username, verificationUrl)
      const emailSent = await sendEmail({
        to: email,
        subject,
        html,
        type: 'verification'
      })
      
      if (!emailSent) {
        console.error('发送验证邮件失败')
        // 继续注册流程，但记录邮件发送失败
      }
      
      return NextResponse.json({
        message: '注册成功！请查看您的邮箱并验证您的账号。',
        user,
        requireEmailVerification: true
      })
    }

    return NextResponse.json({
      message: '注册成功',
      user,
      requireEmailVerification: false
    })
  } catch (error) {
    console.error('注册错误:', error)
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    )
  }
}
