import { type NextRequest, NextResponse } from "next/server"
import rpcConfig from "@/rpc-config.json"
import { requireAuth } from "@/lib/auth-guard"
import { resolveRPCEndpoint } from "@/lib/adapters/rpc-helpers"
import { isValidSolanaAddressServer } from "@/lib/adapters/solana-address"

// GET /api/wallet/account-info?address=…
// Lightweight proxy over Solana's `getAccountInfo` for use by the send flow's
// pre-flight ATA existence check. Returns `{ exists: boolean }`. The client
// uses this to disclose the ~0.002 SOL ATA rent cost when sending USDC to a
// recipient whose USDC token account hasn't been initialised yet.

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const address = request.nextUrl.searchParams.get("address") ?? ""
  if (!isValidSolanaAddressServer(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 })
  }

  const endpoints = [...rpcConfig.solana].sort((a, b) => a.priority - b.priority)

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
          method: "getAccountInfo",
          params: [address, { encoding: "base64", commitment: "confirmed" }],
        }),
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.error) continue
      // Solana returns `result.value = null` when the account doesn't exist.
      const exists = data.result?.value != null
      return NextResponse.json({ exists })
    } catch {
      continue
    }
  }

  return NextResponse.json({ error: "RPC unavailable" }, { status: 502 })
}
