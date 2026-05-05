import { NextResponse } from "next/server"
import rpcConfig from "@/rpc-config.json"
import { requireAuth } from "@/lib/auth-guard"
import { addressQuerySchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"
import { resolveRPCEndpoint } from "@/lib/adapters/rpc-helpers"

const log = logger("api/wallet")

// GET /api/wallet/eth-tx-params?address=<eth_address>
// Returns nonce + EIP-1559 fee params for building an ETH transaction.

const CHAIN_ID = 1  // Ethereum mainnet
const PRIORITY_FEE_WEI = 1_500_000_000n  // 1.5 Gwei tip

async function rpcCall(url: string, headers: Record<string, string>, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
  return data.result
}

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const parsed = validate(addressQuerySchema, { address: searchParams.get("address") ?? "" })
  if (parsed.error) return parsed.error
  const { address } = parsed.data

  const endpoints = [...rpcConfig.ethereum].sort((a, b) => a.priority - b.priority)
  let lastError = "All RPC endpoints failed"

  for (const ep of endpoints) {
    const target = resolveRPCEndpoint(ep)
    if (!target) continue

    try {
      const [nonceHex, block] = await Promise.all([
        rpcCall(target.url, target.headers, "eth_getTransactionCount", [address, "latest"]),
        rpcCall(target.url, target.headers, "eth_getBlockByNumber", ["latest", false]),
      ])

      const nonce = parseInt(nonceHex, 16)
      const baseFeePerGas = BigInt(block.baseFeePerGas ?? "0x0")

      // maxFeePerGas = 2× baseFee + priority tip (standard recommendation)
      const maxFeePerGas = baseFeePerGas * 2n + PRIORITY_FEE_WEI

      return NextResponse.json({
        nonce,
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: PRIORITY_FEE_WEI.toString(),
        chainId: CHAIN_ID,
      })
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e)
      continue
    }
  }

  log.error("All ETH RPC endpoints failed for tx params", undefined, { lastError })
  return NextResponse.json({ error: "Failed to fetch transaction parameters" }, { status: 502 })
}
