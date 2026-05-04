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
      const result = await sql`
        INSERT INTO ownership_public_addresses (ownership_id, ownership_version, chain, address)
        VALUES (${ownership_id}, ${ownership_version}, ${addr.chain}, ${addr.address})
        ON CONFLICT (ownership_id, ownership_version, chain) DO NOTHING
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
