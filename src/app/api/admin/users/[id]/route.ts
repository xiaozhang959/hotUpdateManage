import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 更新用户角色（仅管理员）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    const { role, username, password } = await req.json()

    // 不允许修改自己的角色
    if (id === session.user.id && role && role !== session.user.role) {
      return NextResponse.json(
        { error: '不能修改自己的角色' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (role) updateData.role = role
    if (username) updateData.username = username
    if (password) updateData.password = await bcrypt.hash(password, 10)

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        role: true
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('更新用户失败:', error)
    return NextResponse.json(
      { error: '更新用户失败' },
      { status: 500 }
    )
  }
}

// 删除用户（仅管理员）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 })
    }

    // 不允许删除自己
    if (id === session.user.id) {
      return NextResponse.json(
        { error: '不能删除自己的账号' },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id }
    })

    return NextResponse.json({ message: '用户已删除' })
  } catch (error) {
    console.error('删除用户失败:', error)
    return NextResponse.json(
      { error: '删除用户失败' },
      { status: 500 }
    )
  }
}