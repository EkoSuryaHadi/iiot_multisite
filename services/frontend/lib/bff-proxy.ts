import { authOptions } from "@/lib/auth-options"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

/** Proxy request dari browser ke backend FastAPI (device-mgmt / analytics-api),
 * menempelkan Bearer access token dari sesi NextAuth di server (token tidak
 * pernah dikirim ke browser secara langsung).
 */
export async function proxyToBackend(
  req: NextRequest,
  baseUrl: string,
  path: string[]
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
  }
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ detail: "Sesi kedaluwarsa, silakan login ulang" }, { status: 401 })
  }

  const url = new URL(`${baseUrl}/${path.join("/")}`)
  url.search = req.nextUrl.search

  const forwardedFor = req.headers.get("x-forwarded-for")
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  }
  if (forwardedFor) {
    headers["X-Forwarded-For"] = forwardedFor
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  }

  if (!["GET", "HEAD"].includes(req.method)) {
    const body = await req.text()
    if (body) init.body = body
  }

  let upstream: Response
  try {
    upstream = await fetch(url.toString(), init)
  } catch (error) {
    console.error("BFF proxy fetch error:", error)
    return NextResponse.json({ detail: "Backend tidak dapat dihubungi" }, { status: 502 })
  }

  // Status 204/205/304 dilarang memiliki body oleh spesifikasi Fetch API.
  if ([204, 205, 304].includes(upstream.status)) {
    return new NextResponse(null, { status: upstream.status })
  }

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  })
}
