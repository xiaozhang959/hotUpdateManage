import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()
    
    if (!token || !password) {
      return NextResponse.json(
        { error: '令牌和新密码都是必填项' },
        { status: 400 }
      )
    }
    
    // 验证密码强度
    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少为6个字符' },
        { status: 400 }
      )
    }
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { resetToken: token }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: '重置令牌无效或已过期' },
        { status: 400 }
      )
    }
    
    // 检查令牌是否过期
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      return NextResponse.json(
        { error: '重置链接已过期，请重新申请' },
        { status: 400 }
      )
    }
    
    // 加密新密码
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // 更新用户密码并清除重置令牌
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    })
    
    return NextResponse.json({
      message: '密码重置成功，请使用新密码登录'
    })
  } catch (error) {
    console.error('密码重置失败:', error)
    return NextResponse.json(
      { error: '密码重置失败，请稍后重试' },
      { status: 500 }
    )
  }
}

// GET方法用于验证令牌是否有效
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json(
        { error: '缺少重置令牌' },
        { status: 400 }
      )
    }
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { resetToken: token },
      select: {
        id: true,
        email: true,
        resetTokenExpiry: true
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: '重置令牌无效' },
        { status: 400 }
      )
    }
    
    // 检查令牌是否过期
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      return NextResponse.json(
        { error: '重置链接已过期' },
        { status: 400 }
      )
    }
    
    return NextResponse.json({
      valid: true,
      email: user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') // 部分隐藏邮箱
    })
  } catch (error) {
    console.error('验证重置令牌失败:', error)
    return NextResponse.json(
      { error: '验证失败' },
      { status: 500 }
    )
  }
}