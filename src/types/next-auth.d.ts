import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      emailVerified?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    emailVerified?: boolean
  }
}
