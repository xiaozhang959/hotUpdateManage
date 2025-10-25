import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json(
        { error: '验证令牌无效' },
        { status: 400 }
      )
    }
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { verificationToken: token }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: '验证令牌无效或已过期' },
        { status: 400 }
      )
    }
    
    // 检查令牌是否过期
    if (user.verificationExpiry && user.verificationExpiry < new Date()) {
      return NextResponse.json(
        { error: '验证链接已过期，请重新注册' },
        { status: 400 }
      )
    }
    
    // 验证邮箱
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiry: null
      }
    })
    
    // 返回成功页面HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>邮箱验证成功</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #fef3c7, #fed7aa);
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          .success-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 1rem;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .success-icon svg {
            width: 32px;
            height: 32px;
            stroke: white;
            stroke-width: 3;
          }
          h1 {
            color: #1f2937;
            margin-bottom: 0.5rem;
          }
          p {
            color: #6b7280;
            margin-bottom: 1.5rem;
          }
          .button {
            display: inline-block;
            background: #f97316;
            color: white;
            padding: 0.75rem 2rem;
            text-decoration: none;
            border-radius: 0.5rem;
            font-weight: 500;
            transition: background 0.2s;
          }
          .button:hover {
            background: #ea580c;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">
            <svg fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1>邮箱验证成功！</h1>
          <p>您的邮箱地址已成功验证。现在您可以登录您的账号了。</p>
          <a href="/login" class="button">前往登录</a>
        </div>
      </body>
      </html>
    `
    
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  } catch (error) {
    console.error('邮箱验证失败:', error)
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>验证失败</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #fef3c7, #fed7aa);
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          .error-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 1rem;
            background: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .error-icon svg {
            width: 32px;
            height: 32px;
            stroke: white;
            stroke-width: 3;
          }
          h1 {
            color: #1f2937;
            margin-bottom: 0.5rem;
          }
          p {
            color: #6b7280;
            margin-bottom: 1.5rem;
          }
          .button {
            display: inline-block;
            background: #f97316;
            color: white;
            padding: 0.75rem 2rem;
            text-decoration: none;
            border-radius: 0.5rem;
            font-weight: 500;
            transition: background 0.2s;
          }
          .button:hover {
            background: #ea580c;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">
            <svg fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1>验证失败</h1>
          <p>验证您的邮箱时出现错误。链接可能已过期或无效。</p>
          <a href="/register" class="button">重新注册</a>
        </div>
      </body>
      </html>
    `
    return new NextResponse(errorHtml, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
}