"use client"

import type { WalletData, Transaction } from "./types"
import { apiFetch } from "@/lib/api-fetch"
import { logger } from "@/lib/logger"

const log = logger("wallet")
import { getBitcoinBalanceClient, getBitcoinTransactionsClient } from "@/lib/adapters/bitcoin-client"
import { getEthereumBalanceClient, getEthereumTransactionsClient } from "@/lib/adapters/ethereum-client"
import { getSolanaBalanceClient, getSolanaTransactionsClient } from "@/lib/adapters/solana-client"
import { getChainConfig } from "@/lib/ownership/v1/chains"
import { fetchCryptoPrices, formatCurrency } from "./pricing"

export class WalletClient {
  async getBalances(ownership_id: string, opts?: { fresh?: boolean }): Promise<WalletData> {
    try {
      const qs = new URLSearchParams({ ownership_id })
      if (opts?.fresh) qs.set("fresh", "1")
      const response = await apiFetch(`/api/addresses/balances?${qs.toString()}`)

      if (!response.ok) {
        return await this.getBalancesClientSide(ownership_id)
      }

      const data = await response.json()

      return await this.enrichWithPrices(data)
    } catch (error) {
      log.error("API balance fetch failed, trying client-side", error)
      return await this.getBalancesClientSide(ownership_id)
    }
  }

  private async enrichWithPrices(walletData: WalletData): Promise<WalletData> {
    try {
      const prices = await fetchCryptoPrices()
      if (!prices) return walletData

      let totalFiatEUR = 0

      const enrichedBalances = walletData.balances.map((balance) => {
        // USDC is priced as its own asset (CoinGecko `usd-coin`). If the
        // upstream omitted it we fall back to a synthesized ~$1 price
        // derived from the fact that 1 USDC ≡ 1 USD by design, with the
        // EUR rate inferred from any present USD/EUR pair.
        let assetPrice: { usd: number; eur: number } | undefined
        if (balance.token === "USDC") {
          const coingecko = prices["usd-coin"]
          if (coingecko) {
            assetPrice = coingecko
          } else {
            const ref = prices.bitcoin ?? prices.ethereum ?? prices.solana
            const usdToEur = ref && ref.usd > 0 ? ref.eur / ref.usd : 0.93
            assetPrice = { usd: 1, eur: usdToEur }
          }
        } else {
          assetPrice = prices[balance.chain as keyof typeof prices] as { usd: number; eur: number } | undefined
        }
        if (!assetPrice) return balance

        const balanceNum = Number.parseFloat(balance.balance)
        const fiatValueEUR = balanceNum * assetPrice.eur
        const fiatValueUSD = balanceNum * assetPrice.usd

        totalFiatEUR += fiatValueEUR

        return {
          ...balance,
          balanceFiatEUR: fiatValueEUR,
          balanceFiatUSD: fiatValueUSD,
          priceEUR: assetPrice.eur,
          priceUSD: assetPrice.usd,
          // Keep legacy balanceFiat for backward compatibility
          balanceFiat: formatCurrency(fiatValueEUR, "EUR"),
        }
      })

      return {
        balances: enrichedBalances,
        totalUSD: walletData.totalUSD,
        totalFiat: formatCurrency(totalFiatEUR, "EUR"),
      }
    } catch (error) {
      log.error("Price enrichment failed", error)
      return walletData
    }
  }

  private async getBalancesClientSide(ownership_id: string): Promise<WalletData> {
    try {
      // Fetch addresses from database
      const addressResponse = await apiFetch(`/api/addresses/by-ownership/${ownership_id}`)

      if (!addressResponse.ok) {
        log.error("Failed to fetch addresses for client-side fallback")
        return { balances: [] }
      }

      const addressData = await addressResponse.json()
      const addresses = addressData.addresses || []

      // Get unique addresses per chain
      const uniqueAddresses = new Map<string, string>()
      for (const addr of addresses) {
        if (!uniqueAddresses.has(addr.chain)) {
          uniqueAddresses.set(addr.chain, addr.address)
        }
      }

      // Fetch balances directly from blockchain
      const balancePromises = Array.from(uniqueAddresses.entries()).map(async ([chain, address]) => {
        const chainConfig = getChainConfig(chain)
        if (!chainConfig) return null

        let balance = "0"
        let transactions: Transaction[] = []

        try {
          if (chain === "bitcoin") {
            balance = await getBitcoinBalanceClient(address)
            transactions = await getBitcoinTransactionsClient(address)
          } else if (chain === "ethereum") {
            balance = await getEthereumBalanceClient(address)
            transactions = await getEthereumTransactionsClient(address)
          } else if (chain === "solana") {
            balance = await getSolanaBalanceClient(address)
            transactions = await getSolanaTransactionsClient(address)
          }
        } catch (error) {
          log.error(`Client-side ${chain} data fetch failed`, error)
        }

        return {
          chain,
          symbol: chainConfig.symbol,
          name: chainConfig.name,
          address,
          balance,
          logo: chainConfig.logo,
          transactions,
        }
      })

      const balances = (await Promise.all(balancePromises)).filter((b): b is NonNullable<typeof b> => Boolean(b))

      return await this.enrichWithPrices({ balances })
    } catch (error) {
      log.error("Client-side fallback completely failed", error)
      return { balances: [] }
    }
  }
}
