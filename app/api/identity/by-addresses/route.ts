import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { batchAddressLookupSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/identity")

// POST /api/identity/by-addresses
// Body: { addresses: string[] }
// Returns: { results: Record<string, { handle: string; avatar_url: string | null }> }
export async function POST(request: NextRequest) {
  const sql = getSql()
  try {
    const body = await request.json()
    const parsed = validate(batchAddressLookupSchema, body)
    if (parsed.error) return parsed.error

    const { addresses } = parsed.data

    // Deduplicate and normalize
    const normalized = [...new Set(addresses.map((a) => a.toLowerCase().trim()))]

    // Batch lookup: address → identity
    const rows = await sql`
      SELECT LOWER(opa.address) AS address, i.handle, i.avatar_url, i.ownership_id
      FROM ownership_public_addresses opa
      JOIN identities i ON i.ownership_id = opa.ownership_id
      WHERE LOWER(opa.address) = ANY(${normalized})
        AND i.status = 'active'
    `

    if (rows.length === 0) {
      return NextResponse.json({ results: {} })
    }

    // Fetch primary handles for all matched ownership_ids
    const ownershipIds = [...new Set(rows.map((r) => r.ownership_id as string))]
    const primaryRows = await sql`
      SELECT ownership_id, handle
      FROM handle_registry
      WHERE ownership_id = ANY(${ownershipIds}) AND type = 'primary'
    `

    // Build lookup map: ownership_id → primary handle
    const primaryMap = new Map<string, string>()
    for (const r of primaryRows) {
      primaryMap.set(r.ownership_id as string, r.handle as string)
    }

    // Build results (first match per address wins)
    const results: Record<string, { handle: string; avatar_url: string | null }> = {}
    for (const row of rows) {
      const addr = row.address as string
      if (!results[addr]) {
        const displayHandle = primaryMap.get(row.ownership_id as string) ?? (row.handle as string)
        results[addr] = { handle: displayHandle, avatar_url: (row.avatar_url as string) || null }
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    log.error("Batch address lookup error", error)
    return NextResponse.json({ error: "Batch lookup failed" }, { status: 500 })
  }
}
