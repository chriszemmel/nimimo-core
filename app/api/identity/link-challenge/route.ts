import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql, ensureMigrations } from "@/lib/db"
import { requireAuth } from "@/lib/auth-guard"
import { linkChallengeSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/identity")

/** Short window in which a freshly issued challenge can be redeemed. */
const NONCE_TTL_MS = 5 * 60 * 1000

export async function POST(request: NextRequest) {
  const sql = getSql()
  const auth = await requireAuth()
  if (auth.error) return auth.error

  await ensureMigrations()

  try {
    const body = await request.json()
    const parsed = validate(linkChallengeSchema, body)
    if (parsed.error) return parsed.error
    const { ownership_id } = parsed.data

    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString()

    await sql`
      INSERT INTO link_challenges (nonce, ownership_id, expires_at)
      VALUES (${nonce}, ${ownership_id}, ${expiresAt})
    `

    return NextResponse.json({ nonce })
  } catch (error) {
    log.error("Link challenge error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
