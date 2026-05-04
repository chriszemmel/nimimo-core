import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { timingSafeEqual } from "crypto"
import { siteAuthSchema, validate } from "@/lib/validation"
import { siteConfig } from "@/lib/site-config"
import { logger } from "@/lib/logger"

const log = logger("api/site-auth")

function setAuthCookie(response: NextResponse) {
  response.cookies.set("protection-auth", "authenticated", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24, // 1 day
  })
  return response
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = validate(siteAuthSchema, body)
    if (parsed.error) return parsed.error
    const { password } = parsed.data
    const protectionPassword = siteConfig.protectionEnabled ? process.env.PROTECTION_PASSWORD : undefined

    // If protection is disabled or no password is set, allow access
    if (!protectionPassword) {
      return setAuthCookie(NextResponse.json({ success: true }))
    }

    // Timing-safe comparison to prevent character-by-character brute force
    const a = new Uint8Array(Buffer.from(password))
    const b = new Uint8Array(Buffer.from(protectionPassword))
    const match = a.length === b.length && timingSafeEqual(a as NodeJS.TypedArray, b as NodeJS.TypedArray)

    if (match) {
      return setAuthCookie(NextResponse.json({ success: true }))
    }

    return NextResponse.json({ success: false, error: "Incorrect password" }, { status: 401 })
  } catch (error) {
    log.error("Error in protection-auth", error)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
