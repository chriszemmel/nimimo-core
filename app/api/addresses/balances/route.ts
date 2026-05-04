import { type NextRequest, NextResponse } from "next/server"
import { sql as getSql } from "@/lib/db"
import { getBitcoinBalance, getBitcoinTransactions } from "@/lib/adapters/bitcoin"
import { getEthereumBalance, getEthereumTransactions } from "@/lib/adapters/ethereum"
import { getSolanaBalance, getSolanaTransactions } from "@/lib/adapters/solana"
import { getSolanaUsdcBalance, getSolanaUsdcTransactions } from "@/lib/adapters/solana-usdc"
import { cached, invalidateCache } from "@/lib/adapters/cache"
import type { Balance, Transaction } from "@/lib/wallet/types"
import { getChainConfig } from "@/lib/ownership/v1/chains"
import { requireOwnership } from "@/lib/auth-guard"
import { ownershipIdQuerySchema, validate } from "@/lib/validation"
import { logger } from "@/lib/logger"

const log = logger("api/addresses")

export async function GET(request: NextRequest) {
  const sql = getSql()

  try {
    const searchParams = request.nextUrl.searchParams
    const parsed = validate(ownershipIdQuerySchema, { ownership_id: searchParams.get("ownership_id") ?? "" })
    if (parsed.error) return parsed.error
    const { ownership_id } = parsed.data
    // `?fresh=1` bypasses the 60s Redis cache so the manual refresh button
    // on the wallet page actually reflects on-chain state (incoming
    // transfers from outside nimimo don't trigger the broadcast-route
    // cache invalidation hooks).
    const fresh = searchParams.get("fresh") === "1"

    const auth = await requireOwnership(ownership_id)
    if (auth.error) return auth.error

    const addresses = await sql`
      SELECT DISTINCT ON (chain) chain, address
      FROM ownership_public_addresses
      WHERE ownership_id = ${ownership_id}
      ORDER BY chain, created_at DESC
    `

    if (!addresses || addresses.length === 0) {
      return NextResponse.json({ balances: [] })
    }

    // Each chain produces one native balance entry. Solana additionally
    // produces a USDC SPL-token entry that shares the same wallet address.
    // Token entries are distinguished by `balance.token` ("USDC"), while
    // native entries leave `token` undefined.
    const balancePromises = (addresses as { chain: string; address: string }[]).flatMap((addr) => {
      const chainConfig = getChainConfig(addr.chain)
      if (!chainConfig) return []

      const fetchNative = async (): Promise<Balance | null> => {
        let balance = "0"
        let transactions: Transaction[] = []
        try {
          const balKey = `bal:${addr.chain}:${addr.address}`
          const txKey = `tx:${addr.chain}:${addr.address}`
          if (fresh) await Promise.all([invalidateCache(balKey), invalidateCache(txKey)])

          if (addr.chain === "bitcoin") {
            balance = await cached(balKey, 60, () => getBitcoinBalance(addr.address))
            transactions = await cached(txKey, 60, () => getBitcoinTransactions(addr.address))
          } else if (addr.chain === "ethereum") {
            balance = await cached(balKey, 60, () => getEthereumBalance(addr.address))
            transactions = await cached(txKey, 60, () => getEthereumTransactions(addr.address))
          } else if (addr.chain === "solana") {
            balance = await cached(balKey, 60, () => getSolanaBalance(addr.address))
            transactions = await cached(txKey, 60, () => getSolanaTransactions(addr.address))
          }
        } catch (error) {
          log.error(`Error fetching ${addr.chain} native data`, error)
        }
        return {
          chain: addr.chain,
          symbol: chainConfig.symbol,
          name: chainConfig.name,
          address: addr.address,
          balance,
          logo: chainConfig.logo,
          transactions,
        }
      }

      const fetchSolanaUsdc = async (): Promise<Balance | null> => {
        let balance = "0.000000"
        let transactions: Transaction[] = []
        try {
          const balKey = `bal:solana:usdc:${addr.address}`
          const txKey = `tx:solana:usdc:${addr.address}`
          if (fresh) await Promise.all([invalidateCache(balKey), invalidateCache(txKey)])
          balance = await cached(balKey, 60, () => getSolanaUsdcBalance(addr.address))
          transactions = await cached(txKey, 60, () => getSolanaUsdcTransactions(addr.address))
        } catch (error) {
          log.error("Error fetching Solana USDC data", error)
        }
        return {
          chain: "solana",
          token: "USDC",
          symbol: "USDC",
          name: "USDC",
          address: addr.address,
          balance,
          logo: "/logos/usdc.svg",
          transactions,
        }
      }

      return addr.chain === "solana" ? [fetchNative(), fetchSolanaUsdc()] : [fetchNative()]
    })

    const balances = (await Promise.all(balancePromises)).filter(
      (b): b is Balance => b !== null,
    )

    return NextResponse.json({ balances })
  } catch (error) {
    log.error("Error in balances API", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
