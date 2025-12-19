
export default {
  async fetch(request, env) {
    try {

      /* ---------- Parse params ---------- */
      const url = new URL(request.url)
      const key = url.searchParams.get("key")
      const exp = Number(url.searchParams.get("exp"))
      const sig = url.searchParams.get("sig")

      if (!key || !exp || !sig) {
        return jsonError(400, "missing_parameters", "Required query parameters are missing")
      }

      /* ---------- Path traversal protection ---------- */
      if (key.includes("..")) {
        return jsonError(400, "invalid_key", "Invalid object key")
      }

      /* ---------- Expiry validation ---------- */
      const now = Math.floor(Date.now() / 1000)

      const MAX_EXPIRY = 15 * 60 // 15 minutes
      if (exp - now > MAX_EXPIRY) {
        return jsonError(400, "expiry_too_long", "Expiry exceeds maximum allowed duration")
      }

      if (now > exp) {
        return jsonError(403, "url_expired", "The signed URL has expired")
      }

      /* ---------- Signature validation ---------- */
      const expectedSig = await sign(`${key}:${exp}`, env.SIGNING_SECRET)
      if (!timingSafeEqual(sig, expectedSig)) {
        return jsonError(403, "invalid_signature", "The signed URL is invalid")
      }

      /* ---------- Fetch from R2 ---------- */
      const object = await env.R2_BUCKET.get(key)
      if (!object) {
        return jsonError(404, "file_not_found", "Requested file does not exist")
      }

      /* ---------- Headers ---------- */
      const headers = new Headers()

      const contentType =
        object.httpMetadata?.contentType ||
        guessContentTypeFromKey(key) ||
        "application/octet-stream"

      headers.set("Content-Type", contentType)

      if (!contentType.startsWith("image/")) {
        headers.set(
          "Content-Disposition",
          `attachment; filename="${key.split("/").pop()}"`
        )
      }

      headers.set("Cache-Control", "no-store")
      headers.set("Access-Control-Allow-Origin", "*")

      return new Response(object.body, { headers })

    } catch (err) {
      return jsonError(500, "internal_error", "Unexpected server error")
    }
  }
}

/* ---------------- helpers ---------------- */

async function sign(data, secret) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function guessContentTypeFromKey(key) {
  if (key.endsWith(".png")) return "image/png"
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg"
  if (key.endsWith(".webp")) return "image/webp"
  if (key.endsWith(".gif")) return "image/gif"
  if (key.endsWith(".svg")) return "image/svg+xml"
  if (key.endsWith(".pdf")) return "application/pdf"
  return null
}

function jsonError(status, code, message) {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      }
    }
  )
}
