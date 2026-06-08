// API endpoint to store public receiving addresses
// This endpoint ONLY stores addresses - it never derives them
// The client is responsible for derivation

import { NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { requireOwnership } from "@/lib/auth-guard"
import { addressStoreSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/addresses")

export async function POST(request: Request) {
  const sql = getSql()

  try {
    const body = await request.json()
    const parsed = validate(addressStoreSchema, body)
    if (parsed.error) return parsed.error
    const { ownership_id, ownership_version, addresses } = parsed.data

    const auth = await requireOwnership(ownership_id)
    if (auth.error) return auth.error

    let insertedCount = 0
    for (const addr of addresses) {
      // First-write-wins per (ownership_id, chain): the address for a chain
      // is pinned by whoever stores it first. Addresses are deterministic, so
      // a re-store is a no-op and resolution stays single-valued per chain.
      // ON CONFLICT still absorbs concurrent identical inserts on the unique
      // (ownership_id, ownership_version, chain) key.
      const result = await sql`
        INSERT INTO ownership_public_addresses (ownership_id, ownership_version, chain, address)
        SELECT ${ownership_id}, ${ownership_version}, ${addr.chain}, ${addr.address}
        WHERE NOT EXISTS (
          SELECT 1 FROM ownership_public_addresses
          WHERE ownership_id = ${ownership_id} AND chain = ${addr.chain}
        )
        ON CONFLICT (ownership_id, ownership_version, chain) DO NOTHING
        RETURNING id
      `
      if (result.length > 0) insertedCount++
    }

    return NextResponse.json({
      success: true,
      message: insertedCount === 0 ? "Addresses already stored" : "Addresses stored successfully",
      count: insertedCount,
    })
  } catch (error) {
    log.error("Error storing addresses", error)
    return NextResponse.json({ error: "Failed to store addresses" }, { status: 500 })
  }
}
