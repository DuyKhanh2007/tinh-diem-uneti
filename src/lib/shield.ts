// Dynamic Cryptographic Shield for UNETI Client & Server
const SHIELD_SECRET = "dichvudark_uneti_shield_v2_9a8f4c2e1b"

/**
 * Generate HMAC-SHA256 signature
 */
export async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  )

  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Encode payload with dynamic time-salted XOR + Base64 obfuscation
 */
export function obfuscatePayload(data: object, timestamp: number): string {
  const jsonStr = JSON.stringify(data)
  const keyStr = `${SHIELD_SECRET}_${timestamp}`
  
  let result = ""
  for (let i = 0; i < jsonStr.length; i++) {
    const charCode = jsonStr.charCodeAt(i) ^ keyStr.charCodeAt(i % keyStr.length)
    result += String.fromCharCode(charCode)
  }

  // Base64 encode
  if (typeof window !== "undefined") {
    return btoa(unescape(encodeURIComponent(result)))
  } else {
    return Buffer.from(result, 'binary').toString('base64')
  }
}

/**
 * Decode obfuscated payload
 */
export function deobfuscatePayload(obfuscatedStr: string, timestamp: number): any {
  let rawStr = ""
  try {
    if (typeof window !== "undefined") {
      rawStr = decodeURIComponent(escape(atob(obfuscatedStr)))
    } else {
      rawStr = Buffer.from(obfuscatedStr, 'base64').toString('binary')
    }
  } catch {
    return null
  }

  const keyStr = `${SHIELD_SECRET}_${timestamp}`
  let jsonStr = ""
  for (let i = 0; i < rawStr.length; i++) {
    const charCode = rawStr.charCodeAt(i) ^ keyStr.charCodeAt(i % keyStr.length)
    jsonStr += String.fromCharCode(charCode)
  }

  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

/**
 * Client-Side: Create signed and obfuscated shield token
 */
export async function createClientShieldToken(studentId: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  
  // 16-hex random nonce
  const randomBytes = new Uint8Array(8)
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(randomBytes)
  } else {
    for (let i = 0; i < 8; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }
  }
  const nonce = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  // Compute HMAC signature: "studentId:timestamp:nonce"
  const message = `${studentId}:${timestamp}:${nonce}`
  const signature = await computeHmacSha256(SHIELD_SECRET, message)

  const payloadObj = {
    id: studentId,
    t: timestamp,
    nonce: nonce,
    sig: signature,
  }

  const obfuscated = obfuscatePayload(payloadObj, timestamp)
  // Format: timestamp.obfuscated
  return `${timestamp}.${obfuscated}`
}

/**
 * Server-Side: Verify and unpack client shield token
 */
export async function verifyAndUnpackShieldToken(token: string): Promise<{
  valid: boolean
  error?: string
  studentId?: string
  timestamp?: number
  nonce?: string
  signature?: string
}> {
  if (!token || !token.includes('.')) {
    return { valid: false, error: "Thiếu hoặc sai định dạng X-Shield-Token" }
  }

  const [tsStr, obfuscated] = token.split('.')
  const timestamp = parseInt(tsStr, 10)
  if (isNaN(timestamp)) {
    return { valid: false, error: "Timestamp token không hợp lệ" }
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const drift = Math.abs(nowSec - timestamp)
  if (drift > 60) {
    return { valid: false, error: `Token đã hết hạn (${drift}s > 60s)` }
  }

  const unpacked = deobfuscatePayload(obfuscated, timestamp)
  if (!unpacked || !unpacked.id || !unpacked.nonce || !unpacked.sig) {
    return { valid: false, error: "Không thể giải mã hoặc payload không hợp lệ" }
  }

  // Verify HMAC signature
  const message = `${unpacked.id}:${unpacked.t}:${unpacked.nonce}`
  const expectedSig = await computeHmacSha256(SHIELD_SECRET, message)

  if (unpacked.sig !== expectedSig) {
    return { valid: false, error: "Chữ ký bảo mật không hợp lệ (Signature mismatch)" }
  }

  return {
    valid: true,
    studentId: unpacked.id,
    timestamp: unpacked.t,
    nonce: unpacked.nonce,
    signature: unpacked.sig,
  }
}
