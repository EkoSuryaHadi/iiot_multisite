import { proxyToBackend } from "@/lib/bff-proxy"
import { NextRequest } from "next/server"

const BASE_URL = process.env.ANALYTICS_API_URL || "http://localhost:8003"

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxyToBackend(req, BASE_URL, path)
}

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE }
