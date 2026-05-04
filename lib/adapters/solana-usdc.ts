// Solana SPL-token USDC adapter.
//
// USDC on Solana is an SPL token (mint `EPjFW…`) living in Associated
// Token Accounts owned by the user's wallet address. Balance and history
// can't be read from the wallet address directly the way native SOL can;
// we have to ask the RPC for token accounts filtered by mint, then sum
// (there is normally exactly one ATA per mint, but the API returns a list).

import rpcConfig from "@/rpc-config.json"
import type { Transaction } from "@/lib/wallet/types"
import { logger } from "@/lib/logger"
import { fetchWithTimeout } from "./fetch-timeout"
import { resolveRPCEndpoint } from "./rpc-helpers"

const log = logger("solana-usdc")

/** Mainnet USDC mint. Circle's canonical SPL deployment. */
export const USDC_MINT_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

/** USDC has 6 decimals on Solana (same as Ethereum). */
export const USDC_DECIMALS = 6

const TRANSACTION_LIMIT = 10

export async function getSolanaUsdcBalance(address: string): Promise<string> {
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
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            address,
            { mint: USDC_MINT_SOLANA },
            { encoding: "jsonParsed" },
          ],
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (data.error) throw new Error(data.error.message)

      const accounts = (data.result?.value ?? []) as Array<{
        account: { data: { parsed: { info: { tokenAmount: { amount: string; decimals: number } } } } }
      }>

      // Sum across any token accounts the user owns for this mint (usually 1).
      let totalRaw = 0n
      for (const acc of accounts) {
        const amt = acc.account?.data?.parsed?.info?.tokenAmount?.amount
        if (amt) totalRaw += BigInt(amt)
      }

      const whole = totalRaw / 10n ** BigInt(USDC_DECIMALS)
      const frac = totalRaw % 10n ** BigInt(USDC_DECIMALS)
      const fracStr = frac.toString().padStart(USDC_DECIMALS, "0")
      // Return with fixed 6 decimals to keep parsing predictable.
      return `${whole}.${fracStr}`
    } catch (error) {
      log.error(`${endpoint.name} USDC balance failed`, error)
      continue
    }
  }

  return "0.000000"
}

/**
 * Fetch recent SPL-token transfers for the user's USDC ATA on Solana.
 *
 * Strategy: find the user's ATA via `getTokenAccountsByOwner`, then use
 * `getSignaturesForAddress` on the ATA and parse each tx for token
 * transfer instructions. We mirror the shape of native Solana
 * transactions so the UI renders them identically.
 */
export async function getSolanaUsdcTransactions(address: string): Promise<Transaction[]> {
  const endpoints = rpcConfig.solana.sort((a, b) => a.priority - b.priority)

  for (const endpoint of endpoints) {
    try {
      const target = resolveRPCEndpoint(endpoint)
      if (!target) continue

      // 1. Resolve the user's USDC token accounts (usually exactly one ATA).
      const accountsRes = await fetchWithTimeout(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [address, { mint: USDC_MINT_SOLANA }, { encoding: "jsonParsed", commitment: "confirmed" }],
        }),
      })
      if (!accountsRes.ok) throw new Error(`HTTP ${accountsRes.status}`)
      const accountsData = await accountsRes.json()
      if (accountsData.error) throw new Error(accountsData.error.message)

      const tokenAccounts = (accountsData.result?.value ?? []) as Array<{ pubkey: string }>
      if (tokenAccounts.length === 0) return []

      // 2. For each ATA, fetch recent signatures.
      const seen = new Set<string>()
      const signatures: Array<{ signature: string; slot: number; blockTime: number | null; err: unknown }> = []
      for (const acc of tokenAccounts) {
        const sigRes = await fetchWithTimeout(target.url, {
          method: "POST",
          headers: target.headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getSignaturesForAddress",
            params: [acc.pubkey, { limit: TRANSACTION_LIMIT }],
          }),
        })
        if (!sigRes.ok) continue
        const sigData = await sigRes.json()
        for (const sig of (sigData.result ?? []) as Array<{ signature: string; slot: number; blockTime: number | null; err: unknown }>) {
          if (seen.has(sig.signature)) continue
          seen.add(sig.signature)
          signatures.push(sig)
        }
      }

      if (signatures.length === 0) return []

      // Trim to limit after dedup, ordered newest first by slot.
      signatures.sort((a, b) => b.slot - a.slot)
      const top = signatures.slice(0, TRANSACTION_LIMIT)

      // 3. Batch-fetch the transaction details and diff token balances.
      const batchRequests = top.map((sig, index) => ({
        jsonrpc: "2.0",
        method: "getTransaction",
        params: [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }],
        id: index + 2,
      }))

      const batchRes = await fetchWithTimeout(target.url, {
        method: "POST",
        headers: target.headers,
        body: JSON.stringify(batchRequests),
      })
      if (!batchRes.ok) throw new Error(`HTTP ${batchRes.status}`)
      const batch = await batchRes.json()

      const transactions: Transaction[] = []
      for (let i = 0; i < batch.length; i++) {
        const result = batch[i]?.result
        const sig = top[i]
        if (!result) continue

        try {
          const meta = result.meta
          const pre = (meta?.preTokenBalances ?? []) as Array<{
            owner?: string
            mint: string
            uiTokenAmount: { amount: string; decimals: number }
          }>
          const post = (meta?.postTokenBalances ?? []) as Array<{
            owner?: string
            mint: string
            uiTokenAmount: { amount: string; decimals: number }
          }>

          // Find user-owned USDC balances before and after.
          const preUser = pre.find((b) => b.owner === address && b.mint === USDC_MINT_SOLANA)
          const postUser = post.find((b) => b.owner === address && b.mint === USDC_MINT_SOLANA)
          const preRaw = preUser ? BigInt(preUser.uiTokenAmount.amount) : 0n
          const postRaw = postUser ? BigInt(postUser.uiTokenAmount.amount) : 0n
          const delta = postRaw - preRaw

          if (delta === 0n) continue

          const direction: "incoming" | "outgoing" = delta > 0n ? "incoming" : "outgoing"
          const absDelta = delta < 0n ? -delta : delta
          const whole = absDelta / 10n ** BigInt(USDC_DECIMALS)
          const frac = absDelta % 10n ** BigInt(USDC_DECIMALS)
          const value = `${whole}.${frac.toString().padStart(USDC_DECIMALS, "0")}`

          // Find counterparty: the USDC owner on the other side of the diff.
          let counterparty = "Unknown"
          if (direction === "incoming") {
            const sender = pre.find((b) => b.owner && b.owner !== address && b.mint === USDC_MINT_SOLANA)
            if (sender?.owner) counterparty = sender.owner
          } else {
            const receiver = post.find((b) => b.owner && b.owner !== address && b.mint === USDC_MINT_SOLANA)
            if (receiver?.owner) counterparty = receiver.owner
          }

          transactions.push({
            hash: sig.signature,
            from: direction === "incoming" ? counterparty : address,
            to: direction === "incoming" ? address : counterparty,
            value,
            timestamp: sig.blockTime ? sig.blockTime * 1000 : Date.now(),
            status: sig.err ? "failed" : "success",
            blockNumber: sig.slot,
            direction,
          })
        } catch (txError) {
          log.error(`Failed to parse USDC tx ${i + 1}`, txError)
          continue
        }
      }

      return transactions
    } catch (error) {
      log.error(`${endpoint.name} USDC transactions failed`, error)
      continue
    }
  }

  return []
}
