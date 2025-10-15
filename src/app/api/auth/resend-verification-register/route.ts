import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConfig } from '@/lib/system-config'
import { sendEmail, generateVerificationEmail } from '@/lib/mailer'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    
    if (!email) {
      return NextResponse.json(
        { error: '请提供邮箱地址' },
        { status: 400 }
      )
    }
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: '该邮箱尚未注册' },
        { status: 404 }
      )
    }
    
    if (user.emailVerified) {
      return NextResponse.json(
        { error: '该邮箱已经验证过了' },
        { status: 400 }
      )
    }
    
    // 检查上次发送时间（防止频繁发送）
    if (user.verificationExpiry) {
      const emailVerifyExpire = (await getConfig('email_verify_expire') as number) || 86400
      const lastSentTime = new Date(user.verificationExpiry.getTime() - emailVerifyExpire * 1000)
      const timeSinceLastSent = Date.now() - lastSentTime.getTime()
      const minInterval = 60 * 1000 // 60秒
      
      if (timeSinceLastSent < minInterval) {
        const waitTime = Math.ceil((minInterval - timeSinceLastSent) / 1000)
        return NextResponse.json(
          { error: `请等待 ${waitTime} 秒后再重新发送` },
          { status: 429 }
        )
      }
    }
    
    // 检查SMTP是否启用
    const smtpEnabled = await getConfig('smtp_enabled')
    if (!smtpEnabled) {
      return NextResponse.json(
        { error: '邮件服务暂不可用' },
        { status: 503 }
      )
    }
    
    // 生成新的验证令牌
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const emailVerifyExpire = (await getConfig('email_verify_expire') as number) || 86400
    const verificationExpiry = new Date(Date.now() + emailVerifyExpire * 1000)
    
    // 更新用户的验证信息
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
      to: email,
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
      message: '验证邮件已重新发送',
      email
    })
  } catch (error) {
    console.error('重新发送验证邮件失败:', error)
    return NextResponse.json(
      { error: '发送失败，请稍后重试' },
      { status: 500 }
    )
  }
}