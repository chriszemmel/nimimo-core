import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { requireOwnership } from "@/lib/auth-guard"
import { ownershipIdQuerySchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/identity")

export async function GET(request: NextRequest, { params }: { params: Promise<{ ownership_id: string }> }) {
  const sql = getSql()

  try {
    const { ownership_id: rawId } = await params
    const parsed = validate(ownershipIdQuerySchema, { ownership_id: rawId ?? "" })
    if (parsed.error) return parsed.error
    const { ownership_id } = parsed.data

    const auth = await requireOwnership(ownership_id)
    if (auth.error) return auth.error

    const result = await sql`
      SELECT identity_id, handle, status, created_at, profile_template, profile_palette, badges
      FROM identities
      WHERE ownership_id = ${ownership_id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Identity not found for this ownership" }, { status: 404 })
    }

    // Display handle: primary from handle_registry, or identities.handle for non-upgraded users
    const primaryRow = await sql`
      SELECT handle FROM handle_registry
      WHERE ownership_id = ${ownership_id} AND type = 'primary'
      LIMIT 1
    `
    const displayHandle = primaryRow.length > 0
      ? primaryRow[0].handle as string
      : result[0].handle as string

    return NextResponse.json({
      identity_id: result[0].identity_id,
      handle: displayHandle,
      has_custom_handle: primaryRow.length > 0,
      status: result[0].status,
      created_at: result[0].created_at,
      profile_template: result[0].profile_template ?? "classic",
      profile_palette: result[0].profile_palette ?? "default",
      badges: Array.isArray(result[0].badges) ? result[0].badges : [],
    })
  } catch (error) {
    log.error("Identity lookup error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
