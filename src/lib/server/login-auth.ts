import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getConfig } from '@/lib/system-config'

export interface LoginVerifiedUser {
  id: string
  email: string
  username: string
  role: string
}

export type LoginValidationResult =
  | {
      success: true
      user: LoginVerifiedUser
    }
  | {
      success: false
      code: 'INVALID_CREDENTIALS' | 'EMAIL_NOT_VERIFIED'
      message: string
      email?: string
    }

export async function findUserByAccount(account: string) {
  const normalizedAccount = account.trim()
  if (!normalizedAccount) {
    return null
  }

  const userByEmail = await prisma.user.findUnique({
    where: { email: normalizedAccount },
  })

  if (userByEmail) {
    return userByEmail
  }

  return prisma.user.findUnique({
    where: { username: normalizedAccount },
  })
}

export async function validateLoginCredentials(
  account: string,
  password: string,
): Promise<LoginValidationResult> {
  const normalizedAccount = account.trim()

  if (!normalizedAccount || !password) {
    return {
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: '请输入用户名/邮箱和密码',
    }
  }

  const user = await findUserByAccount(normalizedAccount)
  if (!user) {
    return {
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: '用户名/邮箱或密码错误',
    }
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return {
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: '用户名/邮箱或密码错误',
    }
  }

  const requireEmailVerification = await getConfig('require_email_verification')
  if (requireEmailVerification && !user.emailVerified) {
    return {
      success: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: '您的邮箱尚未验证，请先验证邮箱后再登录',
      email: user.email,
    }
  }

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
  }
}
