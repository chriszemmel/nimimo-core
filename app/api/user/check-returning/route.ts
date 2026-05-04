import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { requireAuth } from "@/lib/auth-guard"
import { logger } from "@/lib/logger"

const log = logger("api/user")

export async function GET(_request: NextRequest) {
  const sql = getSql()
  const auth = await requireAuth()
  if (auth.error) return auth.error

  // Use session email - prevents user enumeration
  const email = auth.session.user.email

  try {
    const result = await sql`
      SELECT id, email, has_identity
      FROM users
      WHERE email = ${email}
    `

    if (result.length === 0) {
      return NextResponse.json({ isReturning: false, isNewUser: true, hasIdentity: false })
    }

    const user = result[0]
    const hasIdentity = user.has_identity === true

    // Simple logic: has_identity is the sole signal
    // - New user: hasn't created an identity yet
    // - Returning user: has created an identity before
    const response = {
      isReturning: hasIdentity,
      isNewUser: !hasIdentity,
      hasIdentity,
    }

    return NextResponse.json(response)
  } catch (error) {
    log.error("Error checking returning user", error)
    return NextResponse.json({ isReturning: false, isNewUser: false, hasIdentity: false })
  }
}
