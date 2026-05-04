import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"

const log = logger("api/wallet")

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,usd-coin&vs_currencies=eur,usd"

// Cache prices for 60 seconds to avoid CoinGecko rate limits
let cachedPrices: { data: unknown; timestamp: number } | null = null
const CACHE_TTL_MS = 60_000

export async function GET() {
  const now = Date.now()

  if (cachedPrices && now - cachedPrices.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedPrices.data)
  }

  try {
    const response = await fetch(COINGECKO_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      log.error(`CoinGecko returned ${response.status}`)
      // Return stale cache if available
      if (cachedPrices) {
        return NextResponse.json(cachedPrices.data)
      }
      return NextResponse.json(null, { status: 502 })
    }

    const data = await response.json()

    // Validate expected shape
    if (!data?.bitcoin?.usd || !data?.ethereum?.usd || !data?.solana?.usd) {
      log.error("Unexpected CoinGecko response shape", undefined, { data })
      if (cachedPrices) {
        return NextResponse.json(cachedPrices.data)
      }
      return NextResponse.json(null, { status: 502 })
    }

    cachedPrices = { data, timestamp: now }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    })
  } catch (error) {
    log.error("Failed to fetch from CoinGecko", error)
    if (cachedPrices) {
      return NextResponse.json(cachedPrices.data)
    }
    return NextResponse.json(null, { status: 502 })
  }
}
