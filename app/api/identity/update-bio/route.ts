import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { requireOwnership } from "@/lib/auth-guard"
import { bioUpdateSchema, validate } from "@/lib/validation"
import { ensureMigrations } from "@/lib/db"
import { logger } from "@/lib/logger"
import { invalidateCache } from "@/lib/adapters/cache"

const log = logger("api/identity")

export async function PATCH(request: NextRequest) {
  const db = getSql()
  await ensureMigrations()

  try {
    const body = await request.json()
    const parsed = validate(bioUpdateSchema, body)
    if (parsed.error) return parsed.error
    const { bio, ownership_id } = parsed.data

    const auth = await requireOwnership(ownership_id)
    if (auth.error) return auth.error

    const result = await db`
      UPDATE identities
      SET bio = ${bio || null}
      WHERE ownership_id = ${ownership_id}
      RETURNING handle, bio
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "No identity found" }, { status: 404 })
    }

    await invalidateCache(`profile:${ownership_id}`)
    return NextResponse.json({ handle: result[0].handle, bio: result[0].bio })
  } catch (error) {
    log.error("Error updating bio", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
