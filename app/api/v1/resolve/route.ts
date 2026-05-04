import { NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { logger } from "@/lib/logger"

const log = logger("api/v1/resolve")

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
}

/**
 * OPTIONS /api/v1/resolve - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * GET /api/v1/resolve?handle=cool-water
 * GET /api/v1/resolve?handle=cool-water&chain=bitcoin
 *
 * Public handle resolution API for third-party integrations.
 * Resolves a nimimo handle to its blockchain addresses.
 *
 * Response (all chains):
 *   { "handle": "cool-water", "addresses": { "bitcoin": "bc1q...", "ethereum": "0x...", "solana": "..." } }
 *
 * Response (single chain):
 *   { "handle": "cool-water", "chain": "bitcoin", "address": "bc1q..." }
 *
 * Response (not found):
 *   { "error": "not_found", "message": "Handle not found" }
 */
export async function GET(request: Request) {
  const sql = getSql()

  try {
    const { searchParams } = new URL(request.url)
    const handle = (searchParams.get("handle") ?? "").toLowerCase().trim()
    const chain = searchParams.get("chain")?.toLowerCase().trim() || null

    if (!handle || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(handle)) {
      return NextResponse.json(
        { error: "invalid_handle", message: "Handle must be lowercase alphanumeric with optional hyphens" },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    if (chain && !["bitcoin", "ethereum", "solana"].includes(chain)) {
      return NextResponse.json(
        { error: "invalid_chain", message: "Supported chains: bitcoin, ethereum, solana" },
        { status: 400, headers: CORS_HEADERS },
      )
    }
    const dbChain = chain

    // 1. Check handle_registry first (covers upgraded handles + aliases)
    const registry = await sql`
      SELECT hr.ownership_id
      FROM handle_registry hr
      JOIN identities i ON i.ownership_id = hr.ownership_id AND i.status = 'active'
      WHERE hr.handle = ${handle}
      LIMIT 1
    `

    // 2. Fall back to identities.handle (non-upgraded users)
    let identities = registry.length > 0
      ? registry
      : await sql`
          SELECT ownership_id FROM identities
          WHERE handle = ${handle} AND status = 'active'
          LIMIT 1
        `

    if (identities.length === 0) {
      return NextResponse.json(
        { error: "not_found", message: "Handle not found" },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    const { ownership_id } = identities[0]

    if (dbChain) {
      const rows = await sql`
        SELECT address
        FROM ownership_public_addresses
        WHERE ownership_id = ${ownership_id} AND chain = ${dbChain}
        ORDER BY created_at ASC
        LIMIT 1
      `

      if (rows.length === 0) {
        return NextResponse.json(
          { error: "no_address", message: `No ${chain} address registered for this handle` },
          { status: 404, headers: CORS_HEADERS },
        )
      }

      return NextResponse.json(
        { handle, chain: dbChain, address: rows[0].address },
        { headers: CORS_HEADERS },
      )
    }

    // All chains
    const rows = await sql`
      SELECT DISTINCT ON (chain) chain, address
      FROM ownership_public_addresses
      WHERE ownership_id = ${ownership_id}
        AND chain IN ('bitcoin', 'ethereum', 'solana')
      ORDER BY chain ASC, created_at ASC
    `

    const addresses: Record<string, string> = {}
    for (const row of rows) {
      addresses[row.chain as string] = row.address as string
    }

    return NextResponse.json(
      { handle, addresses },
      { headers: CORS_HEADERS },
    )
  } catch (error) {
    log.error("Handle resolution failed", error)
    return NextResponse.json(
      { error: "internal_error", message: "Resolution failed" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
