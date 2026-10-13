import NextAuth from "next-auth"

export type UserRole = "superadmin" | "tenant_admin" | "operator" | "viewer"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      tenantId: string | null
    }
    accessToken: string
    error?: "RefreshAccessTokenError"
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    role: UserRole
    tenantId: string | null
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    tenantId: string | null
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    error?: "RefreshAccessTokenError"
  }
}
