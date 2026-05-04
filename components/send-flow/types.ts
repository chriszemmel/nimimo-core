// Types, constants, and localStorage helpers for the send flow.

export interface SendableBalance {
  chain: string
  /** Token id within the chain. Undefined = native (SOL/ETH/BTC). Non-native (e.g. "USDC") are SPL / ERC-20 tokens - send support lands in v1.3.1. */
  token?: string
  symbol: string
  name: string
  logo: string
  address: string
  balance: string
  balanceFiatEUR?: number
  balanceFiatUSD?: number
  priceEUR?: number
  priceUSD?: number
}

export interface RecipientResult {
  input: string
  type: "handle" | "address"
  handle?: string
  chain?: string
  addresses: { chain: string; address: string }[]
  /** Nimimo handle discovered via reverse address lookup, if the address belongs to a registered user */
  nimimoHandle?: string
  /** Avatar URL if the recipient has a custom avatar */
  avatarUrl?: string | null
}

export type Step = "recipient" | "amount" | "confirm" | "done"
export type SendStatus = "idle" | "signing" | "broadcasting" | "success" | "error"
export type ChainType = "solana" | "ethereum" | "bitcoin"

export interface RecentRecipient extends RecipientResult {
  timestamp: number
  savedChain?: string
}

export interface SendFlowProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ownershipId: string
  balances: SendableBalance[]
  /** Pre-fill recipient handle and skip to amount step */
  prefillHandle?: string
  /** Pre-select chain when prefilling */
  prefillChain?: ChainType
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const RECENT_KEY = "nimimo:recent-recipients"
export const FLOW_STEPS: Step[] = ["recipient", "amount", "confirm"]
export const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"]

// ── localStorage helpers ──────────────────────────────────────────────────────

export function getRecentRecipients(): RecentRecipient[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveRecentRecipient(r: RecipientResult, chain?: string | null) {
  try {
    const recent = getRecentRecipients()
    const filtered = recent.filter((x) => x.input !== r.input)
    const updated = [
      { ...r, timestamp: Date.now(), savedChain: chain ?? undefined },
      ...filtered,
    ].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch {
    /* ignore */
  }
}
