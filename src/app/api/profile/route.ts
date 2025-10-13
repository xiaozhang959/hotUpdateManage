import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 更新个人信息
export async function PATCH(req: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { username, currentPassword, newPassword } = await req.json()

    // 如果要修改密码，需要验证当前密码
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: '请输入当前密码' },
          { status: 400 }
        )
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return NextResponse.json(
          { error: '当前密码错误' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    if (username) updateData.username = username
    if (newPassword) updateData.password = await bcrypt.hash(newPassword, 10)

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        role: true
      }
    })

    return NextResponse.json({
      message: '个人信息已更新',
      user: updatedUser
    })
  } catch (error) {
    console.error('更新个人信息失败:', error)
    return NextResponse.json(
      { error: '更新个人信息失败' },
      { status: 500 }
    )
  }
}