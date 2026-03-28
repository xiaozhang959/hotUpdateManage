import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  markInitializationCompleted,
  needsInitialization,
} from '@/lib/server/init-state'
import { revalidatePath } from 'next/cache'
import { requireBootstrapToken } from '@/lib/security/bootstrap'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, username, password, bootstrapToken } = body || {}

    const bootstrapError = requireBootstrapToken(request, bootstrapToken)
    if (bootstrapError) {
      return NextResponse.json({ error: bootstrapError }, { status: 403 })
    }

    // 三重检查：确保系统真的需要初始化
    // 1. 使用全局状态检查
    const needsInit = await needsInitialization()
    if (!needsInit) {
      return NextResponse.json(
        { error: '系统已经初始化，禁止重复初始化' },
        { status: 403 }
      )
    }
    
    // 2. 直接查询数据库再次确认
    const userCount = await prisma.user.count()
    if (userCount > 0) {
      markInitializationCompleted(userCount)
      return NextResponse.json(
        { error: '系统已经初始化' },
        { status: 400 }
      )
    }

    // 验证必填字段
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: '请填写所有必填字段' },
        { status: 400 }
      )
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '请输入有效的邮箱地址' },
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

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建第一个管理员用户
    const admin = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: 'ADMIN', // 设置为管理员角色
      },
    })

    // 当前实例已明确完成初始化，直接提升为已初始化快照
    markInitializationCompleted(1)

    // 重新验证所有路径的缓存
    revalidatePath('/', 'layout')
    revalidatePath('/init', 'layout')
    revalidatePath('/login', 'layout')

    // 返回成功消息（不返回密码）
    return NextResponse.json({
      success: true,
      message: '管理员账户创建成功',
      redirectTo: '/login',
      user: {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        role: admin.role,
      }
    })
  } catch (error: any) {
    console.error('初始化管理员失败:', error)
    
    // 处理唯一性约束错误
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0]
      if (field === 'email') {
        return NextResponse.json(
          { error: '邮箱已被使用' },
          { status: 400 }
        )
      }
      if (field === 'username') {
        return NextResponse.json(
          { error: '用户名已被使用' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: '创建管理员失败' },
      { status: 500 }
    )
  }
}
