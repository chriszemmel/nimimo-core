import type {
  Chain,
  ResolveAllResult,
  ResolveSingleResult,
  PaymentIntent,
  NimimoApiError,
  NimimoClientOptions,
  CreateIntentParams,
  Intent,
  IntentResult,
} from "./types"
import {
  NimimoError,
  HandleNotFound,
  NoAddress,
  InvalidHandle,
  InvalidChain,
  IntentNotFound,
  IntentExpired,
  InvalidTransition,
  RateLimited,
} from "./errors"

const DEFAULT_BASE_URL = "https://nimimo.com"
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_CACHE_TTL = 30_000

const DECIMALS: Record<Chain, number> = {
  bitcoin: 8,
  ethereum: 18,
  solana: 9,
}

interface CacheEntry<T> {
  data: T
  expires: number
}

export class NimimoClient {
  private readonly baseUrl: string
  private readonly maxRetries: number
  private readonly cacheTtl: number
  private readonly cache = new Map<string, CacheEntry<unknown>>()

  constructor(options: NimimoClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL
  }

  // #region resolve
  /**
   * Resolve a handle to all registered blockchain addresses.
   *
   * ```ts
   * const { addresses } = await nimimo.resolve("cool-water")
   * console.log(addresses.bitcoin)  // "bc1q..."
   * ```
   */
  async resolve(handle: string): Promise<ResolveAllResult>

  /**
   * Resolve a handle to a specific chain address.
   *
   * ```ts
   * const { address } = await nimimo.resolve("cool-water", "bitcoin")
   * console.log(address)  // "bc1q..."
   * ```
   */
  async resolve(handle: string, chain: Chain): Promise<ResolveSingleResult>

  async resolve(
    handle: string,
    chain?: Chain,
  ): Promise<ResolveAllResult | ResolveSingleResult> {
    const params = new URLSearchParams({ handle })
    if (chain) params.set("chain", chain)

    const url = `${this.baseUrl}/api/v1/resolve?${params}`
    return this.fetchWithRetry(url)
  }
  // #endregion resolve

  /**
   * Resolve multiple handles in parallel.
   *
   * ```ts
   * const results = await nimimo.resolveMany(["cool-water", "lucky-fox"])
   * ```
   */
  async resolveMany(handles: string[]): Promise<ResolveAllResult[]> {
    return Promise.all(handles.map((h) => this.resolve(h)))
  }

  /**
   * Check if a handle exists.
   *
   * ```ts
   * const exists = await nimimo.exists("cool-water")  // true
   * ```
   */
  async exists(handle: string): Promise<boolean> {
    try {
      await this.resolve(handle)
      return true
    } catch (e) {
      if (e instanceof HandleNotFound) return false
      throw e
    }
  }

  /**
   * Create a payment-ready object for a handle.
   * The SDK resolves the address - your wallet signs.
   *
   * ```ts
   * const intent = await nimimo.paymentIntent("cool-water", {
   *   chain: "ethereum",
   *   amount: "0.05",
   * })
   * // Use with any wallet:
   * await signer.sendTransaction({ to: intent.to, value: intent.value })
   * ```
   */
  async paymentIntent(
    handle: string,
    options: { chain: Chain; amount: string },
  ): Promise<PaymentIntent> {
    const { chain, amount } = options
    const result = await this.resolve(handle, chain)

    const decimals = DECIMALS[chain]
    const value = toSmallestUnit(amount, decimals)

    return {
      to: result.address,
      value,
      amount,
      chain,
      handle,
    }
  }

  /**
   * Generate a nimimo pay URL. No SDK needed on the receiving end.
   *
   * ```ts
   * const url = nimimo.payUrl("cool-water", { chain: "ethereum", amount: "0.05" })
   * // "https://nimimo.com/@cool-water?pay=0.05&chain=ethereum"
   * ```
   */
  payUrl(
    handle: string,
    options?: { chain?: Chain; amount?: string; currency?: string },
  ): string {
    const params = new URLSearchParams()
    if (options?.amount) params.set("pay", options.amount)
    if (options?.chain) params.set("chain", options.chain)
    if (options?.currency) params.set("currency", options.currency)

    const query = params.toString()
    return `${this.baseUrl}/@${handle}${query ? `?${query}` : ""}`
  }

  // ── Intents ──────────────────────────────────────────────────────────

  /**
   * Create a payment intent. The server resolves the handle,
   * stores the intent, and returns a sign URL for the user.
   *
   * ```ts
   * const intent = await nimimo.createIntent({
   *   to: "@chris",
   *   chain: "ethereum",
   *   amount: "0.05",
   *   memo: "Design payment",
   * })
   * console.log(intent.sign_url)   // "https://nimimo.com/sign/int_..."
   * console.log(intent.status)     // "awaiting_signature"
   * ```
   */
  async createIntent(params: CreateIntentParams): Promise<IntentResult> {
    const url = `${this.baseUrl}/api/v1/intents`
    return this.postJson(url, {
      from: params.from,
      to: params.to,
      chain: params.chain,
      asset: params.asset,
      amount: params.amount,
      memo: params.memo,
      expires_at: params.expires_at,
    })
  }

  /**
   * Get the current status and details of an intent.
   *
   * ```ts
   * const intent = await nimimo.getIntent("int_9x21...")
   * if (intent.status === "completed") {
   *   console.log("Paid!", intent.tx_hash)
   * }
   * ```
   */
  async getIntent(intentId: string): Promise<Intent> {
    const url = `${this.baseUrl}/api/v1/intents/${encodeURIComponent(intentId)}`
    return this.fetchIntent(url)
  }

  /**
   * Cancel a pending intent.
   *
   * ```ts
   * await nimimo.cancelIntent("int_9x21...")
   * ```
   */
  async cancelIntent(intentId: string): Promise<Intent> {
    const url = `${this.baseUrl}/api/v1/intents/${encodeURIComponent(intentId)}`
    return this.patchJson(url, { status: "cancelled" })
  }

  /** Clear the internal cache */
  clearCache(): void {
    this.cache.clear()
  }

  // ── Internal ──────────────────────────────────────────────────────

  private async postJson<T>(url: string, body: unknown): Promise<T> {
    return this.mutate("POST", url, body)
  }

  private async patchJson<T>(url: string, body: unknown): Promise<T> {
    return this.mutate("PATCH", url, body)
  }

  private async mutate<T>(
    method: "POST" | "PATCH",
    url: string,
    body: unknown,
  ): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) return (await res.json()) as T

    const data = (await res.json().catch(() => null)) as NimimoApiError | null
    const code = data?.error ?? "unknown"
    const message = data?.message ?? `Request failed with status ${res.status}`

    switch (code) {
      case "not_found":
        throw new IntentNotFound(url.split("/").pop() ?? "")
      case "intent_expired":
        throw new IntentExpired(url.split("/").pop() ?? "")
      case "invalid_transition":
        throw new InvalidTransition("", message)
      case "no_address":
        throw new NoAddress("", "")
      case "invalid_handle":
        throw new InvalidHandle("")
      case "rate_limited":
        throw new RateLimited()
      default:
        throw new NimimoError(message, code, res.status)
    }
  }

  /** GET for intent endpoints - uses intent-specific error mapping */
  private async fetchIntent<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (res.ok) return (await res.json()) as T

    const data = (await res.json().catch(() => null)) as NimimoApiError | null
    const code = data?.error ?? "unknown"
    const message = data?.message ?? `Request failed with status ${res.status}`

    switch (code) {
      case "not_found":
        throw new IntentNotFound(url.split("/").pop() ?? "")
      case "intent_expired":
        throw new IntentExpired(url.split("/").pop() ?? "")
      case "rate_limited":
        throw new RateLimited()
      default:
        throw new NimimoError(message, code, res.status)
    }
  }

  private async fetchWithRetry<T>(url: string): Promise<T> {
    // Check cache
    if (this.cacheTtl > 0) {
      const cached = this.cache.get(url) as CacheEntry<T> | undefined
      if (cached && cached.expires > Date.now()) {
        return cached.data
      }
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(2000 * 2 ** (attempt - 1), 8000)
        await sleep(delay)
      }

      const res = await fetch(url)

      if (res.ok) {
        const data = (await res.json()) as T
        // Cache successful responses
        if (this.cacheTtl > 0) {
          this.cache.set(url, { data, expires: Date.now() + this.cacheTtl })
        }
        return data
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After")
        if (attempt === this.maxRetries) {
          throw new RateLimited(retryAfter ? Number(retryAfter) : null)
        }
        lastError = new RateLimited(retryAfter ? Number(retryAfter) : null)
        continue
      }

      // Non-retryable errors
      const body = (await res.json().catch(() => null)) as NimimoApiError | null
      const code = body?.error ?? "unknown"
      const message = body?.message ?? `Request failed with status ${res.status}`

      switch (code) {
        case "not_found":
          throw new HandleNotFound(new URL(url).searchParams.get("handle") ?? "")
        case "no_address":
          throw new NoAddress(
            new URL(url).searchParams.get("handle") ?? "",
            new URL(url).searchParams.get("chain") ?? "",
          )
        case "invalid_handle":
          throw new InvalidHandle(new URL(url).searchParams.get("handle") ?? "")
        case "invalid_chain":
          throw new InvalidChain(new URL(url).searchParams.get("chain") ?? "")
        default:
          throw new NimimoError(message, code, res.status)
      }
    }

    throw lastError ?? new NimimoError("Request failed", "unknown", 500)
  }
}

// ── Utilities ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function toSmallestUnit(amount: string, decimals: number): string {
  const [whole = "0", frac = ""] = amount.split(".")
  const padded = frac.padEnd(decimals, "0").slice(0, decimals)
  const raw = whole + padded
  // Strip leading zeros but keep at least "0"
  return raw.replace(/^0+/, "") || "0"
}
