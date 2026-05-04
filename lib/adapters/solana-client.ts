// Client-side Solana adapter for fallback
import rpcConfig from "@/rpc-config.json"
import type { Transaction } from "@/lib/wallet/types"
import { logger } from "@/lib/logger"

const log = logger("solana")

export async function getSolanaBalanceClient(address: string): Promise<string> {
  const endpoints = rpcConfig.solana.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "getBalance",
          params: [address],
          id: 1,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)

      const balanceLamports = data.result?.value || 0
      return (balanceLamports / 1e9).toFixed(6)
    } catch (error) {
      log.error(`Client: ${endpoint.name} failed`, error)
      continue
    }
  }

  return "0.000000"
}

export async function getSolanaTransactionsClient(address: string): Promise<Transaction[]> {
  const endpoints = rpcConfig.solana.sort((a, b) => a.priority - b.priority)

  const TRANSACTION_LIMIT = 5

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "getSignaturesForAddress",
          params: [address, { limit: TRANSACTION_LIMIT }],
          id: 1,
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)

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

      const batchResponse = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchRequests),
      })

      if (!batchResponse.ok) throw new Error(`HTTP ${batchResponse.status}`)

      const batchData = await batchResponse.json()
      const transactions: Transaction[] = []

      // Process batch results
      for (let i = 0; i < batchData.length; i++) {
        const txData = batchData[i]
        const sig = signatures[i]

        if (!txData.result) continue

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
            timestamp: sig.blockTime ? sig.blockTime * 1000 : Date.now(),
            status: sig.err ? "failed" : "success",
            blockNumber: sig.slot,
            direction,
          })
        } catch (txError) {
          log.error(`Client: Failed to process tx ${i + 1}`, txError)
          continue
        }
      }

      return transactions
    } catch (error) {
      log.error(`Client: ${endpoint.name} transactions failed`, error)
      continue
    }
  }

  return []
}
