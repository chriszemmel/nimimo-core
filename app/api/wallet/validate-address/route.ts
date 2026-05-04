import { NextResponse } from "next/server"
import rpcConfig from "@/rpc-config.json"
import { requireAuth } from "@/lib/auth-guard"
import { ethAddressQuerySchema, validate } from "@/lib/validation"
import { resolveRPCEndpoint } from "@/lib/adapters/rpc-helpers"

// GET /api/wallet/validate-address?address=<base58>
// Validates a Solana address by calling getAccountInfo on the RPC.
// Invalid addresses cause the RPC to return an error code -32602 (Invalid param).
// Valid addresses return a result (even if the account doesn't exist on-chain yet).

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const parsed = validate(ethAddressQuerySchema, { address: searchParams.get("address") ?? "" })
  if (parsed.error) return parsed.error
  const { address } = parsed.data

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
          method: "getAccountInfo",
          params: [address, { encoding: "base58" }],
        }),
      })
      const data = await res.json()

      // RPC error code -32602 = Invalid param (bad address format)
      if (data.error) {
        const code = data.error?.code
        if (code === -32602) return NextResponse.json({ valid: false })
        // Other errors (rate limit, network) - try next endpoint
        continue
      }

      // result.value === null means valid address but account not yet on-chain
      const isNew = data.result?.value === null
      return NextResponse.json({ valid: true, isNew })
    } catch {
      continue
    }
  }

  // All RPCs failed - fall back to accepting the address (format-checked client-side)
  return NextResponse.json({ valid: true, isNew: false })
}
