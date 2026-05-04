// Client-side Bitcoin adapter for fallback
import rpcConfig from "@/rpc-config.json"
import type { Transaction } from "@/lib/wallet/types"
import { logger } from "@/lib/logger"

const log = logger("bitcoin")

export async function getBitcoinBalanceClient(address: string): Promise<string> {
  const endpoints = rpcConfig.bitcoin.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      if (endpoint.name === "Blockstream") {
        const response = await fetch(`${endpoint.url}/address/${address}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        const balanceSatoshis = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
        return (balanceSatoshis / 100000000).toFixed(8)
      }

      if (endpoint.name === "Blockcypher") {
        const response = await fetch(`${endpoint.url}/addrs/${address}/balance`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        return ((data.final_balance || 0) / 100000000).toFixed(8)
      }
    } catch (error) {
      log.error(`Client: ${endpoint.name} failed`, error)
      continue
    }
  }

  return "0.00000000"
}

export async function getBitcoinTransactionsClient(address: string): Promise<Transaction[]> {
  const endpoints = rpcConfig.bitcoin.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      if (endpoint.name === "Blockstream") {
        const response = await fetch(`${endpoint.url}/address/${address}/txs`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const txs = await response.json()
        const recentTxs = txs.slice(0, 10)

        return recentTxs.map((tx: Record<string, unknown>) => {
          const vinArray = tx.vin as Array<{ prevout?: { scriptpubkey_address?: string; value?: number } }>
          const voutArray = tx.vout as Array<{ scriptpubkey_address?: string; value?: number }>

          const inputValue = vinArray
            .filter((vin) => vin.prevout?.scriptpubkey_address === address)
            .reduce((sum: number, vin) => sum + (vin.prevout?.value || 0), 0)

          const outputValue = voutArray
            .filter((vout) => vout.scriptpubkey_address === address)
            .reduce((sum: number, vout) => sum + (vout.value || 0), 0)

          const value = Math.abs(outputValue - inputValue) / 100000000
          const direction: "incoming" | "outgoing" = outputValue > inputValue ? "incoming" : "outgoing"

          return {
            hash: tx.txid as string,
            from: vinArray[0]?.prevout?.scriptpubkey_address || "Unknown",
            to: voutArray[0]?.scriptpubkey_address || "Unknown",
            value: value.toFixed(8),
            timestamp: ((tx.status as Record<string, unknown>)?.block_time as number) * 1000,
            status: (tx.status as Record<string, unknown>)?.confirmed ? "success" : "pending",
            blockNumber: (tx.status as Record<string, unknown>)?.block_height as number,
            direction,
          }
        })
      }
    } catch (error) {
      log.error(`Client: ${endpoint.name} transactions failed`, error)
      continue
    }
  }

  return []
}
