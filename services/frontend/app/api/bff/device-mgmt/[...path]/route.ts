import { proxyToBackend } from "@/lib/bff-proxy"
import { NextRequest } from "next/server"

const BASE_URL = process.env.DEVICE_MGMT_API_URL || "http://localhost:8001"

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxyToBackend(req, BASE_URL, path)
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE }
