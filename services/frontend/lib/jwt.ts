/** Decode payload JWT tanpa verifikasi signature (dipakai hanya untuk membaca
 * klaim role/tenant_id dari token yang baru diterbitkan device-mgmt - verifikasi
 * signature tetap dilakukan backend setiap request).
 */
export interface AccessTokenClaims {
  sub: string
  tenant_id: string | null
  role: "superadmin" | "tenant_admin" | "operator" | "viewer"
  type: "access" | "refresh"
  iat: number
  exp: number
}

export function decodeJwtPayload<T = AccessTokenClaims>(token: string): T {
  const [, payload] = token.split(".")
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  const json = Buffer.from(padded, "base64").toString("utf-8")
  return JSON.parse(json) as T
}
