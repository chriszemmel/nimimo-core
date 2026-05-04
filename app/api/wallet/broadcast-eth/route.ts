import { NextResponse } from "next/server"
import rpcConfig from "@/rpc-config.json"
import { requireAuth } from "@/lib/auth-guard"
import { broadcastEthSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"
import { resolveRPCEndpoint } from "@/lib/adapters/rpc-helpers"
import { invalidateCache } from "@/lib/adapters/cache"

const log = logger("api/wallet")

// POST /api/wallet/broadcast-eth
// Body: { tx: string }  - hex-encoded signed Ethereum transaction
// Broadcasts via eth_sendRawTransaction using configured RPC endpoints.

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const parsed = validate(broadcastEthSchema, body)
    if (parsed.error) return parsed.error
    const { tx, recipientAddress, senderAddress } = parsed.data

    const endpoints = [...rpcConfig.ethereum].sort((a, b) => a.priority - b.priority)
    let lastError = "All RPC endpoints failed"

    for (const ep of endpoints) {
      const target = resolveRPCEndpoint(ep)
      if (!target) continue

      try {
        const res = await fetch(target.url, {
          method: "POST",
          headers: target.headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_sendRawTransaction",
            params: [tx],
          }),
        })

        const data = await res.json()

        if (data.error) {
          lastError = data.error.message || JSON.stringify(data.error)
          const lower = lastError.toLowerCase()
          // Definitive errors: return sanitized user-facing message, log raw details
          if (lower.includes("insufficient funds")) {
            log.error("ETH broadcast rejected: insufficient funds", undefined, { raw: lastError })
            return NextResponse.json({ error: "Insufficient funds for this transaction" }, { status: 400 })
          }
          if (lower.includes("nonce too low")) {
            log.error("ETH broadcast rejected: nonce too low", undefined, { raw: lastError })
            return NextResponse.json({ error: "Transaction conflict - please retry" }, { status: 400 })
          }
          if (lower.includes("invalid sender")) {
            log.error("ETH broadcast rejected: invalid sender", undefined, { raw: lastError })
            return NextResponse.json({ error: "Invalid transaction signature" }, { status: 400 })
          }
          continue
        }

        const hash = data.result
        // Await invalidations so a fast-following balance fetch can't race.
        const busts: Promise<unknown>[] = []
        if (recipientAddress) {
          busts.push(invalidateCache(`bal:ethereum:${recipientAddress}`))
          busts.push(invalidateCache(`tx:ethereum:${recipientAddress}`))
        }
        if (senderAddress) {
          busts.push(invalidateCache(`bal:ethereum:${senderAddress}`))
          busts.push(invalidateCache(`tx:ethereum:${senderAddress}`))
        }
        await Promise.all(busts)
        return NextResponse.json({ hash })
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e)
        continue
      }
    }

    log.error("All ETH RPC endpoints failed", undefined, { lastError })
    return NextResponse.json({ error: "Transaction broadcast failed" }, { status: 502 })
  } catch (e: unknown) {
    log.error("ETH broadcast route error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
