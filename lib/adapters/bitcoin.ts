import rpcConfig from "@/rpc-config.json"
import type { Transaction } from "@/lib/wallet/types"
import { logger } from "@/lib/logger"
import { fetchWithTimeout } from "./fetch-timeout"
import { resolveRPCEndpoint } from "./rpc-helpers"

const log = logger("bitcoin")

export async function getBitcoinBalance(address: string): Promise<string> {
  const endpoints = rpcConfig.bitcoin.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      const target = resolveRPCEndpoint(endpoint)
      if (!target) continue
      const rpcUrl = target.url

      if (endpoint.name === "Blockstream") {
        const response = await fetchWithTimeout(`${rpcUrl}/address/${address}`, {
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        const balanceSatoshis = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
        const balanceBTC = (balanceSatoshis / 100000000).toFixed(8)

        return balanceBTC
      }

      if (endpoint.name === "Blockcypher") {
        const response = await fetchWithTimeout(`${rpcUrl}/addrs/${address}/balance`)

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        const balanceBTC = ((data.final_balance || 0) / 100000000).toFixed(8)

        return balanceBTC
      }
    } catch (error) {
      log.error(`${endpoint.name} balance failed`, error)
      continue
    }
  }

  return "0.00000000"
}

export async function getBitcoinTransactions(address: string): Promise<Transaction[]> {
  const endpoints = rpcConfig.bitcoin.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      const target = resolveRPCEndpoint(endpoint)
      if (!target) continue
      const rpcUrl = target.url

      if (endpoint.name === "Blockstream") {
        const response = await fetchWithTimeout(`${rpcUrl}/address/${address}/txs`, {
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const txs = await response.json()

        // Get last 10 transactions
        const recentTxs = txs.slice(0, 10)

        const transactions: Transaction[] = recentTxs.map((tx: Record<string, unknown>) => {
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

        return transactions
      }

      if (endpoint.name === "Blockcypher") {
        const response = await fetchWithTimeout(`${rpcUrl}/addrs/${address}?limit=10`)

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json()
        const txRefs = data.txrefs || []

        const transactions: Transaction[] = txRefs.map((tx: { tx_hash: string; tx_output_n: number; value?: number; confirmed: string; confirmations: number; block_height: number }) => {
          const direction: "incoming" | "outgoing" = tx.tx_output_n >= 0 ? "incoming" : "outgoing"

          return {
            hash: tx.tx_hash,
            from: "Unknown",
            to: "Unknown",
            value: ((tx.value || 0) / 100000000).toFixed(8),
            timestamp: new Date(tx.confirmed).getTime(),
            status: tx.confirmations > 0 ? "success" : "pending",
            blockNumber: tx.block_height,
            direction,
          }
        })

        return transactions
      }
    } catch (error) {
      log.error(`${endpoint.name} transactions failed`, error)
      continue
    }
  }

  return []
}
