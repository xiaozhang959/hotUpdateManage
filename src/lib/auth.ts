import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getConfig } from "@/lib/system-config"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // email 字段实际上可能包含用户名或邮箱
        const account = credentials.email as string
        
        // 首先尝试通过邮箱查找
        let user = await prisma.user.findUnique({
          where: { email: account }
        })
        
        // 如果通过邮箱找不到，尝试通过用户名查找
        if (!user) {
          user = await prisma.user.findUnique({
            where: { username: account }
          })
        }

        // 验证密码
        if (!user || !await bcrypt.compare(credentials.password as string, user.password)) {
          return null
        }
        
        // 检查是否需要邮箱验证
        const requireEmailVerification = await getConfig('require_email_verification')
        if (requireEmailVerification && !user.emailVerified) {
          // 返回 null 并通过 error 参数传递消息
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          role: user.role
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      // 每次都获取最新的邮箱验证状态
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { emailVerified: true }
        })
        if (dbUser) {
          token.emailVerified = dbUser.emailVerified
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        // NextAuth's Session.user.emailVerified is typically Date | null; coerce boolean -> Date | null
        session.user.emailVerified = token.emailVerified ? new Date() : null
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
})