import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { requireAuth } from "@/lib/auth-guard"
import { logger } from "@/lib/logger"

const log = logger("api/identity")

// POST /api/identity/handles-by-ownership
// Body: { ownership_ids: string[] }
// Returns: { handles: Record<string, string | null> }
export async function POST(request: NextRequest) {
  const sql = getSql()
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { ownership_ids } = body

    if (!Array.isArray(ownership_ids) || ownership_ids.length === 0 || ownership_ids.length > 20) {
      return NextResponse.json({ error: "ownership_ids must be an array of 1-20 items" }, { status: 400 })
    }

    // Get identity handles (original assigned handles)
    const rows = await sql`
      SELECT ownership_id, handle
      FROM identities
      WHERE ownership_id = ANY(${ownership_ids}) AND status = 'active'
    `

    // Get primary handles from registry (upgraded users)
    const primaryRows = await sql`
      SELECT ownership_id, handle
      FROM handle_registry
      WHERE ownership_id = ANY(${ownership_ids}) AND type = 'primary'
    `

    const handles: Record<string, string | null> = {}
    for (const id of ownership_ids) {
      // Prefer registry primary handle, fall back to identities.handle
      const primary = primaryRows.find((r) => r.ownership_id === id)
      const identity = rows.find((r) => r.ownership_id === id)
      handles[id] = primary ? primary.handle : (identity ? identity.handle : null)
    }

    return NextResponse.json({ handles })
  } catch (error) {
    log.error("Batch handle lookup error", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
