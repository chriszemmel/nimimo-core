import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { broadcastBtcSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"
import { invalidateCache } from "@/lib/adapters/cache"

const log = logger("api/wallet")

// POST /api/wallet/broadcast-btc
// Body: { tx: string }  - hex-encoded signed Bitcoin transaction
// Broadcasts via Blockstream (with Blockcypher fallback).

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const parsed = validate(broadcastBtcSchema, body)
    if (parsed.error) return parsed.error
    const { tx, recipientAddress, senderAddress } = parsed.data

    async function invalidateRecipient() {
      if (!recipientAddress) return
      await Promise.all([
        invalidateCache(`bal:bitcoin:${recipientAddress}`),
        invalidateCache(`tx:bitcoin:${recipientAddress}`),
      ])
    }

    async function invalidateSender() {
      if (!senderAddress) return
      await Promise.all([
        invalidateCache(`bal:bitcoin:${senderAddress}`),
        invalidateCache(`tx:bitcoin:${senderAddress}`),
      ])
    }

    // Try Blockstream
    try {
      const res = await fetch("https://blockstream.info/api/tx", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: tx,
      })
      if (res.ok) {
        const txid = await res.text()
        await Promise.all([invalidateRecipient(), invalidateSender()])
        return NextResponse.json({ txid: txid.trim() })
      }
      const errText = await res.text()
      // Definitive broadcast errors - no point retrying
      if (res.status === 400) {
        const reason = errText.slice(0, 200)
        log.error("BTC Blockstream broadcast rejected", undefined, { raw: reason })
        return NextResponse.json({ error: `Transaction rejected: ${reason}` }, { status: 400 })
      }
    } catch {
      /* fall through */
    }

    // Fallback: Blockcypher
    try {
      const res = await fetch("https://api.blockcypher.com/v1/btc/main/txs/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx }),
      })
      const data = await res.json()
      if (res.ok && data.hash) {
        await Promise.all([invalidateRecipient(), invalidateSender()])
        return NextResponse.json({ txid: data.hash })
      }
      if (data.error) {
        log.error("BTC Blockcypher broadcast rejected", undefined, { raw: data.error })
        return NextResponse.json({ error: "Transaction rejected - check inputs and try again" }, { status: 400 })
      }
    } catch {
      /* fall through */
    }

    return NextResponse.json({ error: "All BTC broadcast endpoints failed" }, { status: 502 })
  } catch (e: unknown) {
    log.error("BTC broadcast route error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
