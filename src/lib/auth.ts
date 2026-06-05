import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import type { Adapter } from "next-auth/adapters"
import { prisma } from "@/lib/prisma"
import { parseLoginEncryptedPayload } from "@/lib/server/auth-request-payloads"
import {
  shouldRequireEmailVerificationForRole,
  validateLoginCredentials,
} from "@/lib/server/login-auth"

const adapter = PrismaAdapter(prisma) as unknown as Adapter

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        encryptedPayload: { label: "Encrypted Payload", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.encryptedPayload) {
          return null
        }

        let decryptedCredentials: {
          account: string
          password: string
        }

        try {
          decryptedCredentials = await parseLoginEncryptedPayload(credentials.encryptedPayload)
        } catch {
          return null
        }

        const result = await validateLoginCredentials(
          decryptedCredentials.account,
          decryptedCredentials.password,
        )

        if (!result.success) {
          return null
        }

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.username,
          role: result.user.role,
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
          select: { emailVerified: true, role: true }
        })
        if (dbUser) {
          token.emailVerified = dbUser.emailVerified
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        // NextAuth's Session.user.emailVerified is typically Date | null; coerce boolean -> Date | null
        const requiresEmailVerification = await shouldRequireEmailVerificationForRole(session.user.role)
        session.user.emailVerified = token.emailVerified || !requiresEmailVerification ? new Date() : null
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
})
