import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// A stand-in for the Upstash REST client that reproduces the two behaviours
// that matter here, straight from @upstash/redis:
//   • the default serializer writes strings verbatim (only non-primitives
//     are JSON.stringify'd), and
//   • `parseResponse` JSON-parses whatever comes back, keeping the parse
//     only when the number round-trips to the identical text.
// So a value stored as "0.05" is read back as the number 0.05 unless the
// caller does its own encoding - which is exactly what this suite pins.
const store = new Map<string, string>()
const setCalls: Array<{ key: string; value: unknown }> = []
let automaticDeserialization = true

function serialize(v: unknown): string {
  switch (typeof v) {
    case "string":
    case "number":
    case "boolean":
      return String(v)
    default:
      return JSON.stringify(v)
  }
}

function parseResponse(raw: string): unknown {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "number" && parsed.toString() !== raw) return raw
    return parsed
  } catch {
    return raw
  }
}

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(opts: { automaticDeserialization?: boolean }) {
      automaticDeserialization = opts.automaticDeserialization !== false
    }
    async get(key: string) {
      const raw = store.get(key)
      if (raw === undefined) return null
      return automaticDeserialization ? parseResponse(raw) : raw
    }
    async set(key: string, value: unknown) {
      setCalls.push({ key, value })
      store.set(key, serialize(value))
    }
    async del(key: string) {
      store.delete(key)
    }
  },
}))

async function loadCache() {
  vi.resetModules()
  return await import("@/lib/adapters/cache")
}

beforeEach(() => {
  store.clear()
  setCalls.length = 0
  automaticDeserialization = true
  vi.stubEnv("KV_REST_API_URL", "https://cache.test")
  vi.stubEnv("KV_REST_API_TOKEN", "token")
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("cached", () => {
  it("returns a numeric-looking string as a string on a cache hit", async () => {
    // The wallet crash: "0.05" is canonical JSON, so the driver's
    // deserializer used to hand back 0.05 and every downstream
    // `.replace(",", ".")` threw during render.
    const { cached } = await loadCache()
    const fetcher = vi.fn().mockResolvedValue("0.05")

    expect(await cached("bal:solana:addr", 60, fetcher)).toBe("0.05")
    const hit = await cached("bal:solana:addr", 60, fetcher)

    expect(hit).toBe("0.05")
    expect(typeof hit).toBe("string")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("round-trips every shape the balance routes cache", async () => {
    const { cached } = await loadCache()
    const cases: unknown[] = [
      "0",
      "0.05",
      "1e-7",
      "12.500000",
      "not a number",
      [{ hash: "abc", value: "0.05", timestamp: 1 }],
      [],
      { rows: 2 },
    ]

    for (const [i, value] of cases.entries()) {
      const key = `shape:${i}`
      await cached(key, 60, async () => value)
      expect(await cached(key, 60, async () => "MISS")).toEqual(value)
    }
  })

  it("refetches instead of returning an entry written in the legacy format", async () => {
    const { cached } = await loadCache()
    // Whatever a previous deploy left behind lives under its own key
    // namespace, so it can never be decoded as a current entry.
    store.set("bal:solana:addr", "0.05")

    expect(await cached("bal:solana:addr", 60, async () => "0.07")).toBe("0.07")
  })

  it("does not store an empty result", async () => {
    const { cached } = await loadCache()

    expect(await cached("undef", 60, async () => undefined)).toBeUndefined()
    expect(await cached("null", 60, async () => null)).toBeNull()
    expect(setCalls).toHaveLength(0)
  })

  it("invalidates the key it wrote", async () => {
    const { cached, invalidateCache } = await loadCache()
    const fetcher = vi.fn().mockResolvedValueOnce("0.05").mockResolvedValueOnce("0.07")

    await cached("bal:solana:addr", 60, fetcher)
    await invalidateCache("bal:solana:addr")

    expect(await cached("bal:solana:addr", 60, fetcher)).toBe("0.07")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("falls through to the fetcher when Redis is not configured", async () => {
    vi.stubEnv("KV_REST_API_URL", "")
    vi.stubEnv("KV_REST_API_TOKEN", "")
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "")
    const { cached } = await loadCache()

    expect(await cached("bal:solana:addr", 60, async () => "0.05")).toBe("0.05")
    expect(setCalls).toHaveLength(0)
  })
})
