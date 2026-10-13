import { loginToDeviceMgmt, refreshDeviceMgmtToken } from "@/lib/device-mgmt-auth"
import { decodeJwtPayload } from "@/lib/jwt"
import { loginSchema } from "@/lib/zod"
import type { JWT } from "next-auth/jwt"
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const refreshed = await refreshDeviceMgmtToken(token.refreshToken)
  if (!refreshed) {
    return { ...token, error: "RefreshAccessTokenError" }
  }
  const claims = decodeJwtPayload(refreshed.access_token)
  return {
    ...token,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    accessTokenExpires: claims.exp * 1000,
    error: undefined,
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-key-change-in-production",
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null
          }

          const { email, password } = await loginSchema.parseAsync(credentials)
          const tokens = await loginToDeviceMgmt(email, password)
          if (!tokens) return null

          const claims = decodeJwtPayload(tokens.access_token)

          return {
            id: claims.sub,
            email,
            name: email,
            role: claims.role,
            tenantId: claims.tenant_id,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessTokenExpires: claims.exp * 1000,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Login awal - salin semua klaim dari authorize() ke token.
      if (user) {
        return {
          ...token,
          id: user.id,
          role: user.role,
          tenantId: user.tenantId,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: user.accessTokenExpires,
        }
      }

      // Access token masih berlaku (beri jeda 30s sebelum benar-benar expired).
      if (Date.now() < token.accessTokenExpires - 30_000) {
        return token
      }

      // Access token (hampir) expired - refresh otomatis lewat device-mgmt.
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      session.user.tenantId = token.tenantId
      session.accessToken = token.accessToken
      session.error = token.error
      return session
    },
  },
}
