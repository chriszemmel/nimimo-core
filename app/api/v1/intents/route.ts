import { NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { ensureMigrations } from "@/lib/db"
import { createIntentSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/v1/intents")

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
}

/** Default intent expiry: 1 hour from now */
const DEFAULT_EXPIRY_MS = 60 * 60 * 1000

/** Generate a prefixed random intent ID */
function generateIntentId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let id = "int_"
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

/**
 * OPTIONS /api/v1/intents - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/v1/intents - Create a new payment intent
 *
 * Body:
 *   {
 *     "from": "@agent_or_user",          // optional identifier
 *     "to": "@chris",                     // nimimo handle (required)
 *     "chain": "ethereum",               // bitcoin | ethereum | solana
 *     "asset": "ETH",                    // optional, inferred from chain
 *     "amount": "0.05",                  // human-readable amount
 *     "memo": "Design payment",          // optional
 *     "expires_at": "2026-04-13T12:00:00Z"  // optional, defaults to +1h
 *   }
 *
 * Response:
 *   {
 *     "intent_id": "int_9x21...",
 *     "status": "awaiting_signature",
 *     "to_handle": "@chris",
 *     "to_address": "0xabc...",
 *     "chain": "ethereum",
 *     "asset": "ETH",
 *     "amount": "0.05",
 *     "memo": "Design payment",
 *     "sign_url": "https://nimimo.com/sign/int_9x21...",
 *     "expires_at": "2026-04-13T12:00:00.000Z",
 *     "created_at": "2026-04-12T12:00:00.000Z"
 *   }
 */
export async function POST(request: Request) {
  await ensureMigrations()
  const sql = getSql()

  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: "invalid_body", message: "Request body must be valid JSON" },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const { data, error } = validate(createIntentSchema, body)
    if (error) return new NextResponse(error.body, { status: 400, headers: { ...Object.fromEntries(error.headers), ...CORS_HEADERS } })

    const CHAIN_ASSET: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL" }
    const from = data.from
    const to = data.to.toLowerCase().trim().replace(/^@/, "")
    const chain = data.chain
    const asset = data.asset ?? CHAIN_ASSET[chain] ?? "ETH"
    const amount = data.amount
    const memo = data.memo
    const expires_at = data.expires_at

    // Resolve the recipient handle to a chain address + avatar
    const registry = await sql`
      SELECT hr.ownership_id, i.avatar_url
      FROM handle_registry hr
      JOIN identities i ON i.ownership_id = hr.ownership_id AND i.status = 'active'
      WHERE hr.handle = ${to}
      LIMIT 1
    `

    const identities = registry.length > 0
      ? registry
      : await sql`
          SELECT ownership_id, avatar_url FROM identities
          WHERE handle = ${to} AND status = 'active'
          LIMIT 1
        `

    if (identities.length === 0) {
      return NextResponse.json(
        { error: "not_found", message: `Handle "@${to}" not found` },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    const { ownership_id, avatar_url } = identities[0]

    const rows = await sql`
      SELECT address
      FROM ownership_public_addresses
      WHERE ownership_id = ${ownership_id} AND chain = ${chain}
      ORDER BY created_at ASC
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "no_address", message: `No ${chain} address registered for "@${to}"` },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    const toAddress = rows[0].address as string
    const intentId = generateIntentId()
    const expiresAt = expires_at
      ? new Date(expires_at).toISOString()
      : new Date(Date.now() + DEFAULT_EXPIRY_MS).toISOString()

    await sql`
      INSERT INTO intents (id, from_identifier, to_handle, to_address, chain, asset, amount, memo, status, expires_at)
      VALUES (${intentId}, ${from ?? null}, ${to}, ${toAddress}, ${chain}, ${asset}, ${amount}, ${memo ?? null}, 'awaiting_signature', ${expiresAt})
    `

    const origin = new URL(request.url).origin

    return NextResponse.json(
      {
        intent_id: intentId,
        status: "awaiting_signature",
        to_handle: `@${to}`,
        to_address: toAddress,
        to_avatar: avatar_url ?? null,
        chain,
        asset,
        amount,
        memo: memo ?? null,
        sign_url: `${origin}/sign/${intentId}`,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      },
      { status: 201, headers: CORS_HEADERS },
    )
  } catch (error) {
    log.error("Intent creation failed", error)
    return NextResponse.json(
      { error: "internal_error", message: "Intent creation failed" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
