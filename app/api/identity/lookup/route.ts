import { NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { handleLookupSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/identity")

// GET /api/identity/lookup?handle=wisepond
// Returns the identity and all public addresses for a handle
export async function GET(request: Request) {
  const sql = getSql()
  try {
    const { searchParams } = new URL(request.url)
    const parsed = validate(handleLookupSchema, { handle: searchParams.get("handle") ?? "" })
    if (parsed.error) return parsed.error
    const { handle } = parsed.data

    // 1. Check handle_registry (covers upgraded handles + aliases)
    const registry = await sql`
      SELECT hr.ownership_id, hr.type
      FROM handle_registry hr
      JOIN identities i ON i.ownership_id = hr.ownership_id AND i.status = 'active'
      WHERE hr.handle = ${handle}
      LIMIT 1
    `

    let ownershipId: string
    let isAlias = false

    if (registry.length > 0) {
      ownershipId = registry[0].ownership_id as string
      isAlias = registry[0].type === "alias"
    } else {
      // 2. Fall back to identities.handle (non-upgraded users)
      const direct = await sql`
        SELECT ownership_id FROM identities
        WHERE handle = ${handle} AND status = 'active'
        LIMIT 1
      `
      if (direct.length === 0) {
        return NextResponse.json({ found: false })
      }
      ownershipId = direct[0].ownership_id as string
    }

    // Get the display handle (primary from registry, or identities.handle)
    const primaryRow = await sql`
      SELECT handle FROM handle_registry
      WHERE ownership_id = ${ownershipId} AND type = 'primary'
      LIMIT 1
    `
    const identity = await sql`
      SELECT handle, avatar_url FROM identities
      WHERE ownership_id = ${ownershipId} AND status = 'active'
      LIMIT 1
    `
    const displayHandle = primaryRow.length > 0
      ? primaryRow[0].handle as string
      : identity[0]?.handle as string

    const addresses = await sql`
      SELECT DISTINCT ON (chain) chain, address
      FROM ownership_public_addresses
      WHERE ownership_id = ${ownershipId}
      ORDER BY chain ASC, created_at ASC
    `

    return NextResponse.json({
      found: true,
      handle: displayHandle,
      avatar_url: identity[0]?.avatar_url || null,
      addresses,
      ...(isAlias ? { alias: handle } : {}),
    })
  } catch (error) {
    log.error("Error in identity lookup", error)
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }
}
