import { logger } from "@/lib/logger"

const log = logger("pricing")

export interface CryptoPrice {
  usd: number
  eur: number
}

export interface CryptoPrices {
  bitcoin: CryptoPrice
  ethereum: CryptoPrice
  solana: CryptoPrice
  // CoinGecko id: `usd-coin`. Optional so we fall back to a synthesized
  // $1 price if the upstream omits it (e.g. rate-limited).
  "usd-coin"?: CryptoPrice
}

export async function fetchCryptoPrices(): Promise<CryptoPrices | null> {
  try {
    const response = await fetch("/api/wallet/prices")

    if (!response.ok) {
      log.error("Failed to fetch crypto prices", undefined, { status: response.status })
      return null
    }

    const data = await response.json()
    if (!data) return null
    return data
  } catch (error) {
    log.error("Error fetching crypto prices", error)
    return null
  }
}

export function formatCurrency(amount: number, currency: "USD" | "EUR", locale?: string): string {
  const userLocale = locale || navigator.language

  const formatted = new Intl.NumberFormat(userLocale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  // Remove "US" prefix from USD formatting (e.g., "US$0.27" becomes "$0.27")
  return formatted.replace(/^US\$/, "$")
}

