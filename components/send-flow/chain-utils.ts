// Chain-agnostic utilities: unit conversion, formatting, fee estimation.
// No React, safe to import anywhere.

import { LAMPORTS_PER_SOL, SOL_FEE_LAMPORTS } from "@/lib/wallet/solana-send"
import { estimateBtcFee, SATS_PER_BTC } from "@/lib/wallet/bitcoin-send"
import { ETH_GAS_LIMIT } from "@/lib/wallet/ethereum-send"

const ETH_DEFAULT_GAS_PRICE = 20_000_000_000n  // 20 Gwei

export const CHAIN_FEE_ESTIMATE: Record<string, bigint> = {
  solana: SOL_FEE_LAMPORTS,
  bitcoin: estimateBtcFee(1, 5),
  ethereum: ETH_GAS_LIMIT * ETH_DEFAULT_GAS_PRICE,
}

export const CHAIN_SYMBOL: Record<string, string> = {
  solana: "SOL",
  bitcoin: "BTC",
  ethereum: "ETH",
}

export const CHAIN_EXPLORER: Record<string, string> = {
  solana: "https://explorer.solana.com/tx/",
  bitcoin: "https://blockstream.info/tx/",
  ethereum: "https://etherscan.io/tx/",
}

// ── Unit conversion ───────────────────────────────────────────────────────────

/** Convert a human-readable amount string to the chain's native integer units. */
export function amountToChainUnits(amountStr: string, chain: string): bigint {
  const f = parseFloat(amountStr) || 0
  if (chain === "solana") return BigInt(Math.round(f * LAMPORTS_PER_SOL))
  if (chain === "bitcoin") return BigInt(Math.round(f * SATS_PER_BTC))
  // Ethereum: avoid floating-point precision issues with 1e18
  // Convert to Gwei (safe integer range), then to Wei with BigInt
  return BigInt(Math.round(f * 1e9)) * 1_000_000_000n
}

/** Format native chain units as a human-readable decimal string. */
export function formatChainUnits(units: bigint, chain: string): string {
  let amount: number
  if (chain === "solana") {
    amount = Number(units) / LAMPORTS_PER_SOL
  } else if (chain === "bitcoin") {
    amount = Number(units) / SATS_PER_BTC
  } else {
    // Ethereum: wei → ETH via intermediate Gwei to stay in safe integer range
    amount = Number(units / 1_000_000_000n) / 1e9
  }
  return amount.toFixed(8).replace(/\.?0+$/, "") || "0"
}

// ── Asset-level helpers ───────────────────────────────────────────────────────

/** Asset identifier: undefined/missing token = the chain's native asset. */
export interface Asset {
  chain: string
  token?: string
}

export function assetSymbol(asset: Asset): string {
  if (asset.token === "USDC") return "USDC"
  return CHAIN_SYMBOL[asset.chain] ?? "?"
}

export function assetMaxInputDecimals(asset: Asset): number {
  if (asset.token === "USDC") return 2
  return 9
}

export function assetDisplayDecimals(asset: Asset): number {
  if (asset.token === "USDC") return 2
  if (asset.chain === "bitcoin") return 6
  if (asset.chain === "ethereum") return 5
  if (asset.chain === "solana") return 4
  return 4
}

export function assetAmountToRawUnits(amountStr: string, asset: Asset): bigint {
  const f = parseFloat(amountStr) || 0
  if (asset.token === "USDC") {
    return BigInt(Math.round(f * 1_000_000))
  }
  return amountToChainUnits(amountStr, asset.chain)
}

export function assetFormatRawUnits(units: bigint, asset: Asset): string {
  if (asset.token === "USDC") {
    const whole = units / 1_000_000n
    const frac = units % 1_000_000n
    const cents = Number(frac) / 1_000_000
    return (Number(whole) + cents).toFixed(2)
  }
  return formatChainUnits(units, asset.chain)
}

// ── QR helpers ────────────────────────────────────────────────────────────────

/**
 * Strips crypto URI prefixes from a QR-decoded string to extract a bare address.
 */
export function extractAddressFromQR(data: string): string {
  const cleaned = data.trim()
  const match = cleaned.match(/^(?:bitcoin|ethereum|solana):([^?]+)/)
  return match ? match[1].trim() : cleaned
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return addr.slice(0, 6) + "…" + addr.slice(-6)
}
