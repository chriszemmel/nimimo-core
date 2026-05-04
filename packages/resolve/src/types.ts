/** Supported blockchain networks */
export type Chain = "bitcoin" | "ethereum" | "solana"

/** Response when resolving a handle to all chains */
export interface ResolveAllResult {
  handle: string
  addresses: Partial<Record<Chain, string>>
}

/** Response when resolving a handle to a single chain */
export interface ResolveSingleResult {
  handle: string
  chain: Chain
  address: string
}

/** A payment-ready object for wallet integrations */
export interface PaymentIntent {
  /** Resolved blockchain address */
  to: string
  /** Amount in the chain's smallest unit (satoshis, wei, lamports) */
  value: string
  /** Original amount in native token (e.g. "0.05" ETH) */
  amount: string
  /** Which chain this payment targets */
  chain: Chain
  /** The nimimo handle this payment is for */
  handle: string
}

// ── Intent types ──────────────────────────────────────────────────────

/** Possible states of an intent */
export type IntentStatus =
  | "awaiting_signature"
  | "signed"
  | "completed"
  | "expired"
  | "cancelled"

/** Parameters for creating a new intent */
export interface CreateIntentParams {
  /** Identifier of the intent creator (handle, agent ID, etc.) */
  from?: string
  /** Recipient nimimo handle (with or without @) */
  to: string
  /** Which blockchain to use */
  chain: Chain
  /** Native asset symbol (inferred from chain if omitted) */
  asset?: "BTC" | "ETH" | "SOL"
  /** Human-readable amount (e.g. "0.05") */
  amount: string
  /** Optional memo / payment reference */
  memo?: string
  /** ISO-8601 expiry (defaults to +1h server-side) */
  expires_at?: string
}

/** Full intent object returned from the API */
export interface Intent {
  /** Prefixed intent ID (e.g. "int_9x21...") */
  intent_id: string
  /** Current status */
  status: IntentStatus
  /** Creator identifier, if provided */
  from: string | null
  /** Recipient handle (e.g. "@chris") */
  to_handle: string
  /** Resolved recipient address */
  to_address: string
  /** Blockchain */
  chain: Chain
  /** Native asset symbol */
  asset: string
  /** Human-readable amount */
  amount: string
  /** Optional memo */
  memo: string | null
  /** Transaction hash (set after broadcast) */
  tx_hash: string | null
  /** URL where the user can sign this intent */
  sign_url: string
  /** When this intent expires */
  expires_at: string
  /** When this intent was created */
  created_at: string
  /** When this intent was last updated */
  updated_at: string
}

/** Response from creating an intent (same shape as Intent) */
export type IntentResult = Intent

/** API error response shape */
export interface NimimoApiError {
  error: string
  message: string
}

/** Options for creating a NimimoClient */
export interface NimimoClientOptions {
  /** Base URL override (default: https://nimimo.com) */
  baseUrl?: string
  /** Max retries on 429 (default: 2) */
  maxRetries?: number
  /** Cache TTL in milliseconds (default: 30000, set to 0 to disable) */
  cacheTtl?: number
}
