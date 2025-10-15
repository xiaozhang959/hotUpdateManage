import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      // Support both NextAuth's Date | null and our boolean schema
      emailVerified?: boolean | Date | null
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    // Match adapter's Date | null while allowing boolean in app code
    emailVerified?: boolean | Date | null
  }
}
