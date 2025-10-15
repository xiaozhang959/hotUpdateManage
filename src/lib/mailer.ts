import { getConfig } from '@/lib/system-config'
import { prisma } from '@/lib/prisma'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: {
    name: string
    address: string
  }
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  type?: string // 邮件类型：'verification', 'reset_password', 'notification'
}

// 获取SMTP配置
async function getSMTPConfig(): Promise<EmailConfig | null> {
  try {
    const smtpEnabled = await getConfig('smtp_enabled')
    if (!smtpEnabled) {
    // console.log('SMTP服务未启用')
      return null
    }

    const host = await getConfig('smtp_host') as string
    const port = await getConfig('smtp_port') as number
    const secure = await getConfig('smtp_secure') as boolean
    const user = await getConfig('smtp_user') as string
    const pass = await getConfig('smtp_password') as string
    const fromEmail = await getConfig('smtp_from_email') as string
    const fromName = await getConfig('smtp_from_name') as string

    if (!host || !user || !pass || !fromEmail) {
      console.error('SMTP配置不完整', {
        host: !!host,
        user: !!user,
        pass: !!pass,
        fromEmail: !!fromEmail
      })
      return null
    }
    
    // 清理空格
    const cleanHost = host.trim()
    const cleanUser = user.trim()
    const cleanFromEmail = fromEmail.trim()
    
    // console.log('SMTP配置加载成功:', {
    //   host: cleanHost,
    //   port: port || 587,
    //   user: cleanUser,
    //   fromEmail: cleanFromEmail
    // })

    return {
      host: cleanHost,
      port: port || 587,
      secure: secure ?? false, // 默认不使用SSL
      auth: { user: cleanUser, pass: pass },
      from: {
        name: fromName || '热更新管理系统',
        address: cleanFromEmail
      }
    }
  } catch (error) {
    console.error('获取SMTP配置失败:', error)
    return null
  }
}

// 创建邮件传输器
async function createTransporter() {
  const config = await getSMTPConfig()
  if (!config) return null
  
  // 动态导入nodemailer
  const nodemailer = await import('nodemailer')
  
  // 根据端口自动判断安全设置
  // 465: SSL/TLS (secure: true)
  // 587/25: STARTTLS (secure: false)
  const isSecurePort = config.port === 465
  
  const transporterConfig: any = {
    host: config.host,
    port: config.port,
    secure: isSecurePort, // 465端口使用true，其他端口使用false
    auth: config.auth
  }
  
  // 对于非465端口，需要STARTTLS
  if (!isSecurePort) {
    transporterConfig.requireTLS = true
    transporterConfig.tls = {
      rejectUnauthorized: false, // 允许自签名证书
      minVersion: 'TLSv1.2' // 使用更安全的TLS版本
    }
  } else {
    // 对于465端口
    transporterConfig.tls = {
      rejectUnauthorized: false
    }
  }
  
  // 调试日志（已禁用）
  // console.log('SMTP配置:', {
  //   host: config.host,
  //   port: config.port,
  //   secure: transporterConfig.secure,
  //   user: config.auth.user
  // })
  
  const nm: any = (nodemailer as any).default || (nodemailer as any)
  return nm.createTransport(transporterConfig)
}

// 发送邮件
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  let success = false
  let error = null
  
  try {
    const transporter = await createTransporter()
    if (!transporter) {
      console.error('无法创建邮件传输器')
      error = '无法创建邮件传输器'
      return false
    }

    const config = await getSMTPConfig()
    if (!config) {
      error = 'SMTP配置不存在'
      return false
    }

    const mailOptions = {
      from: `"${config.from.name}" <${config.from.address}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '') // 简单移除HTML标签
    }

    const info = await transporter.sendMail(mailOptions)
    // console.log('邮件发送成功:', info.messageId)
    success = true
  } catch (err) {
    console.error('发送邮件失败:', err)
    error = err instanceof Error ? err.message : String(err)
  } finally {
    // 记录邮件发送日志
    try {
      await prisma.emailLog.create({
        data: {
          toEmail: options.to,
          subject: options.subject,
          type: options.type || 'notification',
          status: success ? 'sent' : 'failed',
          error: error
        }
      })
    } catch (logError) {
      console.error('记录邮件日志失败:', logError)
    }
  }
  
  return success
}

// 生成邮箱验证邮件内容
export function generateVerificationEmail(
  username: string,
  verificationUrl: string
): { subject: string; html: string } {
  const subject = '验证您的邮箱地址'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #fb923c, #f97316); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>欢迎加入热更新管理系统</h1>
        </div>
        <div class="content">
          <h2>您好，${username}！</h2>
          <p>感谢您注册热更新管理系统。请点击下面的按钮验证您的邮箱地址：</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">验证邮箱</a>
          </div>
          <p>或者复制以下链接到浏览器中打开：</p>
          <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
            ${verificationUrl}
          </p>
          <p><strong>注意：</strong>此链接将在24小时后失效。</p>
        </div>
        <div class="footer">
          <p>如果您没有注册热更新管理系统账号，请忽略此邮件。</p>
          <p>&copy; 2024 热更新管理系统. 保留所有权利。</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

// 生成密码重置邮件内容
export function generatePasswordResetEmail(
  username: string,
  resetUrl: string
): { subject: string; html: string } {
  const subject = '重置您的密码'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #fb923c, #f97316); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>密码重置请求</h1>
        </div>
        <div class="content">
          <h2>您好，${username}！</h2>
          <p>我们收到了您的密码重置请求。点击下面的按钮重置您的密码：</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">重置密码</a>
          </div>
          <p>或者复制以下链接到浏览器中打开：</p>
          <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">
            ${resetUrl}
          </p>
          <div class="warning">
            <strong>⚠️ 安全提示：</strong>
            <ul>
              <li>此链接将在1小时后失效</li>
              <li>如果您没有请求重置密码，请忽略此邮件</li>
              <li>您的密码不会改变，除非您点击上面的链接并创建新密码</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          <p>为了账户安全，请勿将此邮件转发给他人。</p>
          <p>&copy; 2024 热更新管理系统. 保留所有权利。</p>
        </div>
      </div>
    </body>
    </html>
  `
  return { subject, html }
}

// 测试SMTP连接
export async function testSMTPConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const config = await getSMTPConfig()
    if (!config) {
      return { success: false, message: 'SMTP服务未启用或配置不完整' }
    }

    // 动态导入nodemailer
    const nodemailer = await import('nodemailer')
    
    // 根据端口自动判断安全设置
    const isSecurePort = config.port === 465
    
    const transporterConfig: any = {
      host: config.host,
      port: config.port,
      secure: isSecurePort,
      auth: config.auth,
      logger: false, // 禁用日志
      debug: false   // 禁用调试
    }
    
    // 对于非465端口，需要STARTTLS
    if (!isSecurePort) {
      transporterConfig.requireTLS = true
      transporterConfig.tls = {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      }
    } else {
      transporterConfig.tls = {
        rejectUnauthorized: false
      }
    }
    
    // console.log('测试SMTP连接，配置:', {
    //   host: config.host,
    //   port: config.port,
    //   secure: isSecurePort,
    //   user: config.auth.user
    // })
    
    const nm: any = (nodemailer as any).default || (nodemailer as any)
    const transporter = nm.createTransport(transporterConfig)
    
    await transporter.verify()
    return { success: true, message: 'SMTP连接测试成功' }
  } catch (error: any) {
    console.error('SMTP连接测试失败:', error)
    
    // 提供更详细的错误信息
    let errorMessage = 'SMTP连接失败'
    
    if (error.code === 'ESOCKET') {
      errorMessage = `无法连接到邮件服务器 ${error.host}:${error.port}，请检查服务器地址和端口`
    } else if (error.code === 'EAUTH') {
      errorMessage = '认证失败，请检查用户名和密码'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return { 
      success: false, 
      message: errorMessage
    }
  }
}