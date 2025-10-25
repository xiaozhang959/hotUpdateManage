import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getConfig } from '@/lib/system-config'

export async function POST(request: NextRequest) {
  try {
    const { account, password } = await request.json()
    
    if (!account || !password) {
      return NextResponse.json({ 
        success: false, 
        error: '请输入用户名/邮箱和密码' 
      })
    }
    
    // 查找用户
    let user = await prisma.user.findUnique({
      where: { email: account }
    })
    
    if (!user) {
      user = await prisma.user.findUnique({
        where: { username: account }
      })
    }
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: '用户名/邮箱或密码错误' 
      })
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json({ 
        success: false, 
        error: '用户名/邮箱或密码错误' 
      })
    }
    
    // 检查邮箱验证状态
    const requireEmailVerification = await getConfig('require_email_verification')
    if (requireEmailVerification && !user.emailVerified) {
      return NextResponse.json({ 
        success: false, 
        error: 'email_not_verified',
        message: '您的邮箱尚未验证，请先验证邮箱后再登录',
        email: user.email // 返回邮箱以便前端显示或重新发送验证邮件
      })
    }
    
    // 所有检查通过
    return NextResponse.json({ 
      success: true,
      message: '验证通过'
    })
    
  } catch (error) {
    console.error('Pre-check error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '服务器错误，请稍后重试' 
    }, { status: 500 })
  }
}