import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
})

// Semua route di bawah grup (dashboard) butuh login. Halaman auth, landing,
// dan asset Next.js sengaja dikecualikan.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tenants/:path*",
    "/sites/:path*",
    "/devices/:path*",
    "/users/:path*",
    "/telemetry/:path*",
  ],
}
