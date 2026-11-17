import { NextRequest, NextResponse } from "next/server"

const DEVICE_MGMT_API_URL = process.env.DEVICE_MGMT_API_URL || "http://localhost:8001"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resp = await fetch(`${DEVICE_MGMT_API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: body?.identifier ?? "" }),
    })
    const data = await resp.json().catch(() => ({}))
    return NextResponse.json(data, { status: resp.status })
  } catch {
    return NextResponse.json(
      { detail: "Gagal menghubungi layanan autentikasi" },
      { status: 502 }
    )
  }
}
