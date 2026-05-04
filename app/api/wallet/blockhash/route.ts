import { NextResponse } from "next/server"
import rpcConfig from "@/rpc-config.json"
import { requireAuth } from "@/lib/auth-guard"
import { resolveRPCEndpoint } from "@/lib/adapters/rpc-helpers"

// GET /api/wallet/blockhash - returns the latest confirmed blockhash via the best available RPC

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const endpoints = [...rpcConfig.solana].sort((a, b) => a.priority - b.priority)

  for (const ep of endpoints) {
    const target = resolveRPCEndpoint(ep)
    if (!target) continue

    try {
      const res = await fetch(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "getLatestBlockhash",
          params: [{ commitment: "confirmed" }],
        }),
      })
      const data = await res.json()
      const blockhash = data.result?.value?.blockhash
      if (blockhash) return NextResponse.json({ blockhash })
    } catch { continue }
  }

  return NextResponse.json({ error: "Could not fetch blockhash" }, { status: 502 })
}
