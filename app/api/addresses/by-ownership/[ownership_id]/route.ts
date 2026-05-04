// API endpoint to get public addresses for an ownership
// Used by wallet client for balance fetching

import { NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { requireOwnership } from "@/lib/auth-guard"
import { ownershipIdQuerySchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/addresses")

export async function GET(request: Request, { params }: { params: Promise<{ ownership_id: string }> }) {
  const sql = getSql()

  try {
    const { ownership_id: rawId } = await params
    const parsed = validate(ownershipIdQuerySchema, { ownership_id: rawId ?? "" })
    if (parsed.error) return parsed.error
    const { ownership_id } = parsed.data

    const auth = await requireOwnership(ownership_id)
    if (auth.error) return auth.error

    const addresses = await sql`
      SELECT chain, address, created_at 
      FROM ownership_public_addresses 
      WHERE ownership_id = ${ownership_id}
      ORDER BY chain ASC
    `

    return NextResponse.json({
      success: true,
      addresses,
    })
  } catch (error) {
    log.error("Error fetching addresses", error)
    return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 })
  }
}
