// Client-side Ethereum adapter for fallback
import rpcConfig from "@/rpc-config.json"
import type { Transaction } from "@/lib/wallet/types"
import { logger } from "@/lib/logger"

const log = logger("ethereum")

export async function getEthereumBalanceClient(address: string): Promise<string> {
  const endpoints = rpcConfig.ethereum.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [address, "latest"],
          id: 1,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)

      const balanceWei = BigInt(data.result)
      return (Number(balanceWei) / 1e18).toFixed(6)
    } catch (error) {
      log.error(`Client: ${endpoint.name} failed`, error)
      continue
    }
  }

  return "0.000000"
}

export async function getEthereumTransactionsClient(_address: string): Promise<Transaction[]> {
  // Public RPCs don't support transaction history well without API keys
  // This would require etherscan API or similar
  return []
}
