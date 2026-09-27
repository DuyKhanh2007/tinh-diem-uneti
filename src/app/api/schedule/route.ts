import { NextRequest, NextResponse } from "next/server"
import { verifyAndUnpackShieldToken } from "@/lib/shield"

// In-memory Nonce Cache on Next.js server to prevent Replay Attacks
const serverUsedNonces = new Map<string, number>()

function checkAndStoreNonce(nonce: string): boolean {
  const now = Date.now()
  // Clean up expired nonces (> 2 minutes)
  for (const [key, exp] of serverUsedNonces.entries()) {
    if (now > exp) {
      serverUsedNonces.delete(key)
    }
  }

  if (serverUsedNonces.has(nonce)) {
    return false // Replay attack!
  }

  serverUsedNonces.set(nonce, now + 120000)
  return true
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenFromQuery = searchParams.get("token")
  const tokenFromHeader = request.headers.get("X-Shield-Token") || request.headers.get("x-shield-token")
  const rawToken = tokenFromHeader || tokenFromQuery

  // If a Bot or Postman calls without the encrypted dynamic X-Shield-Token -> REJECT 403!
  if (!rawToken) {
    return NextResponse.json(
      {
        error: "403 Forbidden: Yêu cầu bị chặn bởi Hệ Thống Anti-Bot Shield",
        reason: "Missing dynamic encrypted X-Shield-Token header. Direct API scrapers and Postman calls are blocked.",
        tip: "Please access via the official web application UI."
      },
      { status: 403 }
    )
  }

  // Verify and unpack the client token
  const verified = await verifyAndUnpackShieldToken(rawToken)
  if (!verified.valid || !verified.studentId || !verified.nonce) {
    return NextResponse.json(
      {
        error: "403 Forbidden: Chữ ký bảo mật không hợp lệ",
        reason: verified.error || "Invalid or tampered client token"
      },
      { status: 403 }
    )
  }

  // Replay Attack Check
  if (!checkAndStoreNonce(verified.nonce)) {
    return NextResponse.json(
      {
        error: "403 Forbidden: Phát hiện chữ ký phát lại (Replay Attack Detected)",
        reason: "This dynamic token has already been consumed."
      },
      { status: 403 }
    )
  }

  try {
    const upstreamUrl = `https://vicnsc24ncv.dichvuright.com/schedule?id=${encodeURIComponent(verified.studentId)}&t=${verified.timestamp}&nonce=${verified.nonce}&sig=${verified.signature}`

    const response = await fetch(upstreamUrl, {
      headers: {
        "X-Client-Signature": verified.signature || "",
        "X-Client-Timestamp": String(verified.timestamp || ""),
        "X-Client-Nonce": verified.nonce || "",
        "Accept": "application/json",
      },
      next: { revalidate: 300 }
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errData.error || `Lỗi máy chủ UNETI (${response.status})` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Không thể kết nối đến máy chủ thời khóa biểu" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
