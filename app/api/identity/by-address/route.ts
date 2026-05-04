import { NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { addressLookupSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/identity")

// GET /api/identity/by-address?address=0x...
// Reverse-lookup: find the nimimo handle that owns a given public address.
export async function GET(request: Request) {
  const sql = getSql()
  try {
    const { searchParams } = new URL(request.url)
    const parsed = validate(addressLookupSchema, { address: searchParams.get("address") ?? "" })
    if (parsed.error) return parsed.error
    const { address } = parsed.data

    const rows = await sql`
      SELECT i.handle, i.avatar_url, i.ownership_id
      FROM ownership_public_addresses opa
      JOIN identities i ON i.ownership_id = opa.ownership_id
      WHERE LOWER(opa.address) = LOWER(${address})
        AND i.status = 'active'
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json({ found: false })
    }

    // Display handle: primary from registry, or identities.handle
    const primaryRow = await sql`
      SELECT handle FROM handle_registry
      WHERE ownership_id = ${rows[0].ownership_id} AND type = 'primary'
      LIMIT 1
    `
    const displayHandle = primaryRow.length > 0
      ? primaryRow[0].handle as string
      : rows[0].handle as string

    return NextResponse.json({ found: true, handle: displayHandle, avatar_url: rows[0].avatar_url || null })
  } catch (error) {
    log.error("Error in by-address lookup", error)
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }
}
