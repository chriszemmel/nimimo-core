import rpcConfig from "@/rpc-config.json"
import type { Transaction } from "@/lib/wallet/types"
import { blockTimeToMs } from "@/lib/wallet/utils"
import { logger } from "@/lib/logger"
import { fetchWithTimeout } from "./fetch-timeout"
import { resolveRPCEndpoint } from "./rpc-helpers"

const log = logger("solana")

interface SolanaBatchTx {
  transaction?: { message?: { accountKeys?: Array<{ pubkey: string } | string> } }
  meta?: { preBalances?: number[]; postBalances?: number[] }
}

/** What the wallet transaction list reads off a `getTransaction` result. */
type SolanaTxData = SolanaBatchTx

export async function getSolanaBalance(address: string): Promise<string> {
  const endpoints = rpcConfig.solana.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      const target = resolveRPCEndpoint(endpoint)
      if (!target) continue

      const response = await fetchWithTimeout(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "getBalance",
          params: [address],
          id: 1,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      const balanceLamports = data.result?.value || 0
      const balanceSOL = (balanceLamports / 1e9).toFixed(6)

      return balanceSOL
    } catch (error) {
      log.error(`${endpoint.name} balance failed`, error)
      continue
    }
  }

  return "0.000000"
}

export async function getSolanaTransactions(address: string): Promise<Transaction[]> {
  const endpoints = rpcConfig.solana.sort((a, b) => a.priority - b.priority)

  const TRANSACTION_LIMIT = 10

  for (const endpoint of endpoints) {
    try {
      const target = resolveRPCEndpoint(endpoint)
      if (!target) continue

      const response = await fetchWithTimeout(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "getSignaturesForAddress",
          params: [address, { limit: TRANSACTION_LIMIT }],
          id: 1,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      const signatures = data.result || []

      if (signatures.length === 0) {
        return []
      }

      const batchRequests = signatures.map((sig: { signature: string }, index: number) => ({
        jsonrpc: "2.0",
        method: "getTransaction",
        params: [
          sig.signature,
          {
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 0,
          },
        ],
        id: index + 2,
      }))

      const batchResponse = await fetchWithTimeout(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify(batchRequests),
      })

      if (!batchResponse.ok) throw new Error(`HTTP ${batchResponse.status}`)

      const batchData = await batchResponse.json()
      const transactions: Transaction[] = []

      // Keyed on the JSON-RPC `id`, not on array position: pairing
      // `batchData[i]` with `signatures[i]` assumes the provider preserves
      // batch order, which JSON-RPC does not require. A reordering provider
      // would show one transaction's amount under another's hash and
      // timestamp. `id` is set to `index + 2` when the batch is built.
      const txByIndex = new Map<number, { result?: SolanaTxData }>()
      for (const entry of batchData as Array<{ id?: number; result?: SolanaTxData }>) {
        if (typeof entry?.id === "number") txByIndex.set(entry.id - 2, entry)
      }

      for (let i = 0; i < signatures.length; i++) {
        const txData = txByIndex.get(i)
        const sig = signatures[i]

        if (!txData?.result) continue

        try {
          const tx = txData.result
          const meta = tx.meta
          const message = tx.transaction?.message

          let amount = 0
          let from = "Unknown"
          let to = "Unknown"
          let direction: "incoming" | "outgoing" = "incoming"

          const accountKeys = message?.accountKeys || []
          const preBalances = meta?.preBalances || []
          const postBalances = meta?.postBalances || []

          const userAccountIndex = accountKeys.findIndex(
            (key: string | { pubkey: string }) => (typeof key === "string" ? key : key.pubkey) === address,
          )

          if (userAccountIndex !== -1) {
            const preBalance = preBalances[userAccountIndex] || 0
            const postBalance = postBalances[userAccountIndex] || 0
            const balanceChange = postBalance - preBalance

            amount = Math.abs(balanceChange) / 1e9
            direction = balanceChange >= 0 ? "incoming" : "outgoing"
          }

          if (accountKeys.length > 0) {
            from = typeof accountKeys[0] === "string" ? accountKeys[0] : accountKeys[0]?.pubkey || "Unknown"
          }
          if (accountKeys.length > 1) {
            to = typeof accountKeys[1] === "string" ? accountKeys[1] : accountKeys[1]?.pubkey || "Unknown"
          }

          transactions.push({
            hash: sig.signature,
            from,
            to,
            value: amount.toFixed(6),
            timestamp: blockTimeToMs(sig.blockTime),
            status: sig.err ? "failed" : "success",
            blockNumber: sig.slot,
            direction,
          })
        } catch (txError) {
          log.error(`Failed to process transaction ${i + 1}`, txError)
          continue
        }
      }

      return transactions
    } catch (error) {
      log.error(`${endpoint.name} transactions failed`, error)
      continue
    }
  }

  return []
}
