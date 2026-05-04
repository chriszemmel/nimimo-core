import { describe, it, expect, vi, beforeEach } from "vitest"
import { NimimoClient } from "../client"
import {
  HandleNotFound,
  InvalidHandle,
  InvalidChain,
  RateLimited,
  NoAddress,
  IntentNotFound,
  IntentExpired,
} from "../errors"

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(data),
  }
}

describe("NimimoClient", () => {
  let client: NimimoClient

  beforeEach(() => {
    client = new NimimoClient({ baseUrl: "https://nimimo.com", cacheTtl: 0 })
    mockFetch.mockReset()
  })

  // ── resolve (all chains) ──────────────────────────────────────────

  describe("resolve (all chains)", () => {
    it("resolves a handle to all addresses", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          handle: "cool-water",
          addresses: { bitcoin: "bc1q...", ethereum: "0x...", solana: "5Z..." },
        }),
      )

      const result = await client.resolve("cool-water")
      expect(result.handle).toBe("cool-water")
      expect(result.addresses).toEqual({
        bitcoin: "bc1q...",
        ethereum: "0x...",
        solana: "5Z...",
      })
      expect(mockFetch).toHaveBeenCalledWith(
        "https://nimimo.com/api/v1/resolve?handle=cool-water",
      )
    })

    it("throws HandleNotFound for unknown handle", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "not_found", message: "Handle not found" }, 404),
      )

      await expect(client.resolve("ghost")).rejects.toThrow(HandleNotFound)
    })

    it("throws InvalidHandle for bad format", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "invalid_handle", message: "Bad format" }, 400),
      )

      await expect(client.resolve("123-bad")).rejects.toThrow(InvalidHandle)
    })
  })

  // ── resolve (single chain) ────────────────────────────────────────

  describe("resolve (single chain)", () => {
    it("resolves a handle to a single chain address", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          handle: "cool-water",
          chain: "bitcoin",
          address: "bc1q...",
        }),
      )

      const result = await client.resolve("cool-water", "bitcoin")
      expect(result.address).toBe("bc1q...")
      expect(mockFetch).toHaveBeenCalledWith(
        "https://nimimo.com/api/v1/resolve?handle=cool-water&chain=bitcoin",
      )
    })

    it("throws NoAddress when chain has no address", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "no_address", message: "No bitcoin address" }, 404),
      )

      await expect(client.resolve("cool-water", "bitcoin")).rejects.toThrow(NoAddress)
    })

    it("throws InvalidChain for unsupported chain", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "invalid_chain", message: "Unsupported" }, 400),
      )

      await expect(
        client.resolve("cool-water", "dogecoin" as never),
      ).rejects.toThrow(InvalidChain)
    })
  })

  // ── resolveMany ───────────────────────────────────────────────────

  describe("resolveMany", () => {
    it("resolves multiple handles in parallel", async () => {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ handle: "cool-water", addresses: { bitcoin: "bc1q..." } }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ handle: "lucky-fox", addresses: { ethereum: "0x..." } }),
        )

      const results = await client.resolveMany(["cool-water", "lucky-fox"])
      expect(results).toHaveLength(2)
      expect(results[0].handle).toBe("cool-water")
      expect(results[1].handle).toBe("lucky-fox")
    })
  })

  // ── exists ────────────────────────────────────────────────────────

  describe("exists", () => {
    it("returns true for existing handle", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ handle: "cool-water", addresses: {} }),
      )

      expect(await client.exists("cool-water")).toBe(true)
    })

    it("returns false for missing handle", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "not_found", message: "Not found" }, 404),
      )

      expect(await client.exists("ghost")).toBe(false)
    })
  })

  // ── paymentIntent ─────────────────────────────────────────────────

  describe("paymentIntent", () => {
    it("creates a payment intent for ethereum", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ handle: "cool-water", chain: "ethereum", address: "0xABC" }),
      )

      const intent = await client.paymentIntent("cool-water", {
        chain: "ethereum",
        amount: "0.05",
      })

      expect(intent.to).toBe("0xABC")
      expect(intent.value).toBe("50000000000000000")
      expect(intent.amount).toBe("0.05")
      expect(intent.chain).toBe("ethereum")
      expect(intent.handle).toBe("cool-water")
    })

    it("creates a payment intent for bitcoin", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ handle: "cool-water", chain: "bitcoin", address: "bc1q..." }),
      )

      const intent = await client.paymentIntent("cool-water", {
        chain: "bitcoin",
        amount: "0.001",
      })

      expect(intent.value).toBe("100000") // 0.001 BTC = 100,000 satoshis
    })

    it("creates a payment intent for solana", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ handle: "cool-water", chain: "solana", address: "5Z..." }),
      )

      const intent = await client.paymentIntent("cool-water", {
        chain: "solana",
        amount: "1.5",
      })

      expect(intent.value).toBe("1500000000") // 1.5 SOL = 1,500,000,000 lamports
    })
  })

  // ── payUrl ────────────────────────────────────────────────────────

  describe("payUrl", () => {
    it("generates a basic profile URL", () => {
      expect(client.payUrl("cool-water")).toBe("https://nimimo.com/@cool-water")
    })

    it("generates a pay URL with amount and chain", () => {
      const url = client.payUrl("cool-water", { chain: "ethereum", amount: "0.05" })
      expect(url).toBe("https://nimimo.com/@cool-water?pay=0.05&chain=ethereum")
    })

    it("generates a pay URL with fiat currency", () => {
      const url = client.payUrl("cool-water", {
        chain: "ethereum",
        amount: "10",
        currency: "eur",
      })
      expect(url).toContain("pay=10")
      expect(url).toContain("chain=ethereum")
      expect(url).toContain("currency=eur")
    })
  })

  // ── retry on 429 ─────────────────────────────────────────────────

  describe("retry on 429", () => {
    it("retries on rate limit then succeeds", async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({}, 429, { "Retry-After": "1" }))
        .mockResolvedValueOnce(
          jsonResponse({ handle: "cool-water", addresses: { bitcoin: "bc1q..." } }),
        )

      const result = await client.resolve("cool-water")
      expect(result.handle).toBe("cool-water")
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it("throws RateLimited after max retries", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}, 429))

      await expect(client.resolve("cool-water")).rejects.toThrow(RateLimited)
      expect(mockFetch).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
    })
  })

  // ── caching ───────────────────────────────────────────────────────

  describe("caching", () => {
    it("caches responses when cacheTtl > 0", async () => {
      const cachedClient = new NimimoClient({ baseUrl: "https://nimimo.com", cacheTtl: 60000 })

      mockFetch.mockResolvedValueOnce(
        jsonResponse({ handle: "cool-water", addresses: { bitcoin: "bc1q..." } }),
      )

      await cachedClient.resolve("cool-water")
      await cachedClient.resolve("cool-water") // should hit cache

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("clearCache invalidates all entries", async () => {
      const cachedClient = new NimimoClient({ baseUrl: "https://nimimo.com", cacheTtl: 60000 })

      mockFetch.mockResolvedValue(
        jsonResponse({ handle: "cool-water", addresses: {} }),
      )

      await cachedClient.resolve("cool-water")
      cachedClient.clearCache()
      await cachedClient.resolve("cool-water")

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // ── createIntent ──────────────────────────────────────────────────

  describe("createIntent", () => {
    const mockIntent = {
      intent_id: "int_abc123def456gh",
      status: "awaiting_signature",
      from: "@agent",
      to_handle: "@chris",
      to_address: "0xABC123",
      chain: "ethereum",
      asset: "ETH",
      amount: "0.05",
      memo: "Design payment",
      tx_hash: null,
      sign_url: "https://nimimo.com/sign/int_abc123def456gh",
      expires_at: "2026-04-13T12:00:00.000Z",
      created_at: "2026-04-12T12:00:00.000Z",
      updated_at: "2026-04-12T12:00:00.000Z",
    }

    it("creates an intent and returns the result", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(mockIntent, 201))

      const result = await client.createIntent({
        from: "@agent",
        to: "@chris",
        chain: "ethereum",
        amount: "0.05",
        memo: "Design payment",
      })

      expect(result.intent_id).toBe("int_abc123def456gh")
      expect(result.status).toBe("awaiting_signature")
      expect(result.to_handle).toBe("@chris")
      expect(result.to_address).toBe("0xABC123")
      expect(result.sign_url).toContain("/sign/int_abc123def456gh")
      expect(mockFetch).toHaveBeenCalledWith(
        "https://nimimo.com/api/v1/intents",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      )
    })

    it("creates an intent without optional fields", async () => {
      const minimalIntent = { ...mockIntent, from: null, memo: null }
      mockFetch.mockResolvedValueOnce(jsonResponse(minimalIntent, 201))

      const result = await client.createIntent({
        to: "chris",
        chain: "bitcoin",
        amount: "0.001",
      })

      expect(result.intent_id).toBe("int_abc123def456gh")
      expect(result.from).toBeNull()
    })

    it("throws IntentNotFound for unknown handle", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "not_found", message: "Handle not found" }, 404),
      )

      await expect(
        client.createIntent({ to: "ghost", chain: "ethereum", amount: "0.05" }),
      ).rejects.toThrow(IntentNotFound)
    })
  })

  // ── getIntent ─────────────────────────────────────────────────────

  describe("getIntent", () => {
    it("fetches an intent by ID", async () => {
      const intent = {
        intent_id: "int_abc123def456gh",
        status: "awaiting_signature",
        from: null,
        to_handle: "@chris",
        to_address: "0xABC",
        chain: "ethereum",
        asset: "ETH",
        amount: "0.05",
        memo: null,
        tx_hash: null,
        sign_url: "https://nimimo.com/sign/int_abc123def456gh",
        expires_at: "2026-04-13T12:00:00.000Z",
        created_at: "2026-04-12T12:00:00.000Z",
        updated_at: "2026-04-12T12:00:00.000Z",
      }

      mockFetch.mockResolvedValueOnce(jsonResponse(intent))

      const result = await client.getIntent("int_abc123def456gh")
      expect(result.intent_id).toBe("int_abc123def456gh")
      expect(result.status).toBe("awaiting_signature")
      expect(mockFetch).toHaveBeenCalledWith(
        "https://nimimo.com/api/v1/intents/int_abc123def456gh",
      )
    })

    it("returns completed intent with tx_hash", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          intent_id: "int_abc123def456gh",
          status: "completed",
          tx_hash: "0xdeadbeef",
          from: null,
          to_handle: "@chris",
          to_address: "0xABC",
          chain: "ethereum",
          asset: "ETH",
          amount: "0.05",
          memo: null,
          sign_url: "https://nimimo.com/sign/int_abc123def456gh",
          expires_at: "2026-04-13T12:00:00.000Z",
          created_at: "2026-04-12T12:00:00.000Z",
          updated_at: "2026-04-12T13:00:00.000Z",
        }),
      )

      const result = await client.getIntent("int_abc123def456gh")
      expect(result.status).toBe("completed")
      expect(result.tx_hash).toBe("0xdeadbeef")
    })

    it("throws IntentNotFound for missing intent", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "not_found", message: "Intent not found" }, 404),
      )

      await expect(client.getIntent("int_doesnotexist0")).rejects.toThrow(
        IntentNotFound,
      )
    })

    it("throws IntentExpired for expired intent", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { error: "intent_expired", message: "This intent has expired" },
          410,
        ),
      )

      await expect(client.getIntent("int_expired0000xx")).rejects.toThrow(
        IntentExpired,
      )
    })
  })

  // ── cancelIntent ──────────────────────────────────────────────────

  describe("cancelIntent", () => {
    it("cancels a pending intent", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          intent_id: "int_abc123def456gh",
          status: "cancelled",
          from: null,
          to_handle: "@chris",
          to_address: "0xABC",
          chain: "ethereum",
          asset: "ETH",
          amount: "0.05",
          memo: null,
          tx_hash: null,
          sign_url: "https://nimimo.com/sign/int_abc123def456gh",
          expires_at: "2026-04-13T12:00:00.000Z",
          created_at: "2026-04-12T12:00:00.000Z",
          updated_at: "2026-04-12T12:30:00.000Z",
        }),
      )

      const result = await client.cancelIntent("int_abc123def456gh")
      expect(result.status).toBe("cancelled")
      expect(mockFetch).toHaveBeenCalledWith(
        "https://nimimo.com/api/v1/intents/int_abc123def456gh",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        }),
      )
    })

    it("throws IntentNotFound when cancelling missing intent", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "not_found", message: "Intent not found" }, 404),
      )

      await expect(client.cancelIntent("int_doesnotexist0")).rejects.toThrow(
        IntentNotFound,
      )
    })
  })
})
