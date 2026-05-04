import { NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { ensureMigrations } from "@/lib/db"
import { updateIntentSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/v1/intents/[id]")

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
}

/**
 * OPTIONS /api/v1/intents/[id] - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * GET /api/v1/intents/[id] - Get intent status and details
 *
 * Response:
 *   {
 *     "intent_id": "int_9x21...",
 *     "status": "awaiting_signature",
 *     "from": "@agent",
 *     "to_handle": "@chris",
 *     "to_address": "0xabc...",
 *     "chain": "ethereum",
 *     "asset": "ETH",
 *     "amount": "0.05",
 *     "memo": "Design payment",
 *     "tx_hash": null,
 *     "sign_url": "https://nimimo.com/sign/int_9x21...",
 *     "expires_at": "...",
 *     "created_at": "...",
 *     "updated_at": "..."
 *   }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureMigrations()
  const sql = getSql()
  const { id } = await params

  try {
    if (!id || !id.startsWith("int_")) {
      return NextResponse.json(
        { error: "invalid_id", message: "Intent ID must start with int_" },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const rows = await sql`
      SELECT int.id, int.from_identifier, int.to_handle, int.to_address, int.chain, int.asset,
             int.amount, int.memo, int.status, int.tx_hash, int.expires_at, int.created_at, int.updated_at,
             i.avatar_url
      FROM intents int
      LEFT JOIN identities i ON i.handle = int.to_handle AND i.status = 'active'
      WHERE int.id = ${id}
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "not_found", message: "Intent not found" },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    const intent = rows[0]

    // Auto-expire if past expiry and still awaiting
    if (intent.status === "awaiting_signature" && new Date(intent.expires_at as string) < new Date()) {
      await sql`
        UPDATE intents SET status = 'expired', updated_at = now()
        WHERE id = ${id} AND status = 'awaiting_signature'
      `
      intent.status = "expired"
    }

    const origin = new URL(request.url).origin

    return NextResponse.json(
      {
        intent_id: intent.id,
        status: intent.status,
        from: intent.from_identifier ?? null,
        to_handle: `@${intent.to_handle}`,
        to_address: intent.to_address,
        to_avatar: intent.avatar_url ?? null,
        chain: intent.chain,
        asset: intent.asset,
        amount: intent.amount,
        memo: intent.memo ?? null,
        tx_hash: intent.tx_hash ?? null,
        sign_url: `${origin}/sign/${intent.id}`,
        expires_at: intent.expires_at,
        created_at: intent.created_at,
        updated_at: intent.updated_at,
      },
      { headers: CORS_HEADERS },
    )
  } catch (error) {
    log.error("Intent lookup failed", error)
    return NextResponse.json(
      { error: "internal_error", message: "Intent lookup failed" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}

/**
 * PATCH /api/v1/intents/[id] - Update intent status
 *
 * Body:
 *   { "status": "signed" | "completed" | "cancelled", "tx_hash": "0x..." }
 *
 * Transitions:
 *   awaiting_signature → signed | cancelled
 *   signed → completed | cancelled
 *   (expired/completed/cancelled are terminal)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureMigrations()
  const sql = getSql()
  const { id } = await params

  try {
    if (!id || !id.startsWith("int_")) {
      return NextResponse.json(
        { error: "invalid_id", message: "Intent ID must start with int_" },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: "invalid_body", message: "Request body must be valid JSON" },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const { data, error } = validate(updateIntentSchema, body)
    if (error) return new NextResponse(error.body, { status: 400, headers: { ...Object.fromEntries(error.headers), ...CORS_HEADERS } })

    const { status: newStatus, tx_hash } = data

    // Fetch current intent
    const rows = await sql`
      SELECT id, status, expires_at FROM intents WHERE id = ${id} LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "not_found", message: "Intent not found" },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    const intent = rows[0]
    const currentStatus = intent.status as string

    // Check expiry
    if (currentStatus === "awaiting_signature" && new Date(intent.expires_at as string) < new Date()) {
      await sql`
        UPDATE intents SET status = 'expired', updated_at = now()
        WHERE id = ${id} AND status = 'awaiting_signature'
      `
      return NextResponse.json(
        { error: "intent_expired", message: "This intent has expired" },
        { status: 410, headers: CORS_HEADERS },
      )
    }

    // Validate state transitions
    const VALID_TRANSITIONS: Record<string, string[]> = {
      awaiting_signature: ["signed", "cancelled"],
      signed: ["completed", "cancelled"],
    }

    const allowed = VALID_TRANSITIONS[currentStatus]
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Cannot transition from "${currentStatus}" to "${newStatus}"`,
        },
        { status: 409, headers: CORS_HEADERS },
      )
    }

    // Apply the update
    if (tx_hash) {
      await sql`
        UPDATE intents SET status = ${newStatus}, tx_hash = ${tx_hash}, updated_at = now()
        WHERE id = ${id}
      `
    } else {
      await sql`
        UPDATE intents SET status = ${newStatus}, updated_at = now()
        WHERE id = ${id}
      `
    }

    // Return the updated intent
    const updated = await sql`
      SELECT int.id, int.from_identifier, int.to_handle, int.to_address, int.chain, int.asset,
             int.amount, int.memo, int.status, int.tx_hash, int.expires_at, int.created_at, int.updated_at,
             i.avatar_url
      FROM intents int
      LEFT JOIN identities i ON i.handle = int.to_handle AND i.status = 'active'
      WHERE int.id = ${id}
      LIMIT 1
    `

    const result = updated[0]
    const origin = new URL(request.url).origin

    return NextResponse.json(
      {
        intent_id: result.id,
        status: result.status,
        from: result.from_identifier ?? null,
        to_handle: `@${result.to_handle}`,
        to_address: result.to_address,
        to_avatar: result.avatar_url ?? null,
        chain: result.chain,
        asset: result.asset,
        amount: result.amount,
        memo: result.memo ?? null,
        tx_hash: result.tx_hash ?? null,
        sign_url: `${origin}/sign/${result.id}`,
        expires_at: result.expires_at,
        created_at: result.created_at,
        updated_at: result.updated_at,
      },
      { headers: CORS_HEADERS },
    )
  } catch (error) {
    log.error("Intent update failed", error)
    return NextResponse.json(
      { error: "internal_error", message: "Intent update failed" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
