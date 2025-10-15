import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getConfig } from '@/lib/system-config'
import { sendEmail, generatePasswordResetEmail } from '@/lib/mailer'
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
    
    // 检查SMTP是否启用
    const smtpEnabled = await getConfig('smtp_enabled')
    if (!smtpEnabled) {
      return NextResponse.json(
        { error: '邮件服务未启用，请联系管理员' },
        { status: 503 }
      )
    }
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    })
    
    // 无论用户是否存在，都返回相同的响应（安全考虑）
    if (!user) {
      return NextResponse.json({
        message: '如果该邮箱已注册，我们已发送密码重置邮件。请查看您的收件箱。'
      })
    }
    
    // 生成重置令牌
    const resetToken = crypto.randomBytes(32).toString('hex')
    const passwordResetExpire = (await getConfig('password_reset_expire') as number) || 3600
    const resetTokenExpiry = new Date(Date.now() + passwordResetExpire * 1000)
    
    // 更新用户记录
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry
      }
    })
    
    // 发送重置邮件
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`
    
    const { subject, html } = generatePasswordResetEmail(user.username, resetUrl)
    const emailSent = await sendEmail({
      to: email,
      subject,
      html,
      type: 'reset_password'
    })
    
    if (!emailSent) {
      console.error('发送密码重置邮件失败')
      return NextResponse.json(
        { error: '发送邮件失败，请稍后重试' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: '如果该邮箱已注册，我们已发送密码重置邮件。请查看您的收件箱。'
    })
  } catch (error) {
    console.error('密码重置请求失败:', error)
    return NextResponse.json(
      { error: '处理请求失败，请稍后重试' },
      { status: 500 }
    )
  }
}