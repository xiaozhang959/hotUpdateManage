import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { testSMTPConnection, sendEmail } from '@/lib/mailer'

export async function POST(req: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }
    
    const { testEmail } = await req.json()
    
    // 测试SMTP连接
    const connectionTest = await testSMTPConnection()
    
    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        message: connectionTest.message
      })
    }
    
    // 如果提供了测试邮箱，发送测试邮件
    if (testEmail) {
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #fb923c, #f97316); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success { color: #10b981; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SMTP测试邮件</h1>
            </div>
            <div class="content">
              <p class="success">✅ SMTP配置成功！</p>
              <p>这是一封测试邮件，用于验证您的SMTP配置是否正确。</p>
              <p>如果您收到了这封邮件，说明邮件服务配置正常工作。</p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">
                发送时间：${new Date().toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </body>
        </html>
      `
      
      const emailSent = await sendEmail({
        to: testEmail,
        subject: '热更新管理系统 - SMTP测试邮件',
        html: testHtml,
        type: 'notification'
      })
      
      if (!emailSent) {
        return NextResponse.json({
          success: false,
          message: 'SMTP连接成功，但发送测试邮件失败'
        })
      }
      
      return NextResponse.json({
        success: true,
        message: `测试邮件已发送到 ${testEmail}`
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'SMTP连接测试成功'
    })
  } catch (error) {
    console.error('SMTP测试失败:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'SMTP测试失败'
      },
      { status: 500 }
    )
  }
}