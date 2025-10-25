import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getConfig } from '@/lib/system-config'
import { sendEmail, generateVerificationEmail } from '@/lib/mailer'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      )
    }
    
    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }
    
    // 检查是否已经验证
    if (user.emailVerified) {
      return NextResponse.json(
        { error: '邮箱已经验证过了' },
        { status: 400 }
      )
    }
    
    // 检查是否启用了邮箱验证
    const requireEmailVerification = await getConfig('require_email_verification')
    const smtpEnabled = await getConfig('smtp_enabled')
    
    if (!requireEmailVerification || !smtpEnabled) {
      return NextResponse.json(
        { error: '邮箱验证功能未启用' },
        { status: 400 }
      )
    }
    
    // 检查上次发送时间，防止频繁发送
    if (user.verificationExpiry) {
      const emailVerifyExpire = (await getConfig('email_verify_expire') as number) || 86400
      const lastSentTime = new Date(user.verificationExpiry).getTime() - emailVerifyExpire * 1000
      const now = Date.now()
      const timeSinceLastSent = now - lastSentTime
      const minInterval = 60 * 1000 // 最少间隔1分钟
      
      if (timeSinceLastSent < minInterval) {
        const waitTime = Math.ceil((minInterval - timeSinceLastSent) / 1000)
        return NextResponse.json(
          { error: `请等待 ${waitTime} 秒后再重新发送` },
          { status: 429 }
        )
      }
    }
    
    // 生成新的验证令牌
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const emailVerifyExpire = (await getConfig('email_verify_expire') as number) || 86400
    const verificationExpiry = new Date(Date.now() + emailVerifyExpire * 1000)
    
    // 更新用户的验证令牌
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpiry
      }
    })
    
    // 发送验证邮件
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`
    
    const { subject, html } = generateVerificationEmail(user.username, verificationUrl)
    const emailSent = await sendEmail({
      to: user.email,
      subject,
      html,
      type: 'verification'
    })
    
    if (!emailSent) {
      return NextResponse.json(
        { error: '发送邮件失败，请稍后重试' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: '验证邮件已发送，请查看您的邮箱',
      email: user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') // 部分隐藏邮箱
    })
  } catch (error) {
    console.error('重新发送验证邮件失败:', error)
    return NextResponse.json(
      { error: '发送失败，请稍后重试' },
      { status: 500 }
    )
  }
}