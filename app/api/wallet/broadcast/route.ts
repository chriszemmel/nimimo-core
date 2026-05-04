import { NextResponse } from "next/server"
import rpcConfig from "@/rpc-config.json"
import { requireAuth } from "@/lib/auth-guard"
import { broadcastSolSchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"
import { resolveRPCEndpoint } from "@/lib/adapters/rpc-helpers"
import { invalidateCache } from "@/lib/adapters/cache"

const log = logger("api/wallet")

// POST /api/wallet/broadcast
// Body: { tx: string }  - base64-encoded signed transaction
// Broadcasts via the best available Solana RPC (server-side, avoids CORS/rate-limit issues).

export async function POST(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const parsed = validate(broadcastSolSchema, body)
    if (parsed.error) return parsed.error
    const { tx, recipientAddress, senderAddress } = parsed.data

    const endpoints = [...rpcConfig.solana].sort((a, b) => a.priority - b.priority)
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
            method: "sendTransaction",
            params: [
              tx,
              { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed" },
            ],
          }),
        })

        const data = await res.json()

        if (data.error) {
          lastError = data.error.message || JSON.stringify(data.error)
          const lower = lastError.toLowerCase()
          // Definitive errors: return sanitized user-facing message, log raw details
          if (lower.includes("simulation failed") || lower.includes("insufficient")) {
            log.error("SOL broadcast rejected", undefined, { raw: lastError })
            return NextResponse.json({ error: "Transaction simulation failed - check balance and try again" }, { status: 400 })
          }
          if (lower.includes("signature")) {
            log.error("SOL broadcast rejected: signature error", undefined, { raw: lastError })
            return NextResponse.json({ error: "Invalid transaction signature" }, { status: 400 })
          }
          continue
        }

        const signature = data.result
        // Invalidate both native SOL and SPL-USDC caches on every Solana
        // broadcast. SPL transfers always debit SOL from the sender too
        // (tx fee + possible ATA rent), so the native cache needs a bust
        // regardless. Invalidating the USDC cache on a pure-SOL send is
        // a harmless no-op if no cache entry exists.
        //
        // Awaited before the response so a fast-following balance fetch
        // from the client can't race the invalidation. The send flow
        // also passes `?fresh=1` on its post-broadcast polling as a
        // second line of defence against stale Redis entries.
        const invalidateBoth = (addr: string) => Promise.all([
          invalidateCache(`bal:solana:${addr}`),
          invalidateCache(`tx:solana:${addr}`),
          invalidateCache(`bal:solana:usdc:${addr}`),
          invalidateCache(`tx:solana:usdc:${addr}`),
        ])
        const busts: Promise<unknown>[] = []
        if (recipientAddress) busts.push(invalidateBoth(recipientAddress))
        if (senderAddress) busts.push(invalidateBoth(senderAddress))
        await Promise.all(busts)
        return NextResponse.json({ signature })
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e)
        continue
      }
    }

    log.error("All Solana RPC endpoints failed", undefined, { lastError })
    return NextResponse.json({ error: "Transaction broadcast failed" }, { status: 502 })
  } catch (e: unknown) {
    log.error("Broadcast route error", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
