/** Panggilan langsung (server-side) ke device-mgmt khusus untuk login & refresh token,
 * dipakai oleh NextAuth (lib/auth-options.ts). Request CRUD lain lewat BFF proxy
 * (app/api/bff/device-mgmt) supaya token tidak perlu diteruskan ke client.
 */
const DEVICE_MGMT_API_URL = process.env.DEVICE_MGMT_API_URL || "http://localhost:8001"

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export async function loginToDeviceMgmt(email: string, password: string): Promise<TokenPair | null> {
  const resp = await fetch(`${DEVICE_MGMT_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!resp.ok) return null
  return (await resp.json()) as TokenPair
}

export async function refreshDeviceMgmtToken(refreshToken: string): Promise<TokenPair | null> {
  const resp = await fetch(`${DEVICE_MGMT_API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!resp.ok) return null
  return (await resp.json()) as TokenPair
}
