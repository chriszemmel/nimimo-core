import { Redis } from "@upstash/redis"
import { logger } from "@/lib/logger"

const log = logger("cache")

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  // `automaticDeserialization: false` - this layer owns its own encoding.
  //
  // The Upstash REST client writes a string value verbatim and then
  // JSON-parses whatever it reads back (`parseResponse`), so a value stored
  // as the string "0.05" returns as the *number* 0.05. `cached<string>()`
  // still types it as a string, so the type quietly changed between the
  // cache-miss path (string, straight from the fetcher) and the cache-hit
  // path (number) - and only for values whose text happens to be canonical
  // JSON, which is exactly what a trimmed balance like "0.05" is. Downstream
  // that meant `balance.replace(...)` on a number: the wallet's send flow
  // threw `e.replace is not a function` during render and the whole page
  // fell through to the route error boundary, for 60s at a time, whenever
  // the balance came from cache. Encoding on write and decoding on read
  // keeps a `T` in and a `T` out.
  redis = new Redis({ url: url.trim(), token: token.trim(), automaticDeserialization: false })
  return redis
}

// Namespace for the encoding above. Entries written by the previous format
// (bare strings) are unreadable as JSON-encoded values - a legacy "0.05"
// would still decode to a number - so they are stepped over rather than
// migrated: every key gets one cold fetch after deploy and then heals.
const NAMESPACE = "c2:"

function namespaced(key: string): string {
  return `${NAMESPACE}${key}`
}

/**
 * Cache-aside helper for blockchain data.
 * Falls through to the fetcher on cache miss or Redis unavailability.
 */
export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const r = getRedis()
  const k = namespaced(key)

  if (r) {
    try {
      const hit = await r.get<string>(k)
      if (typeof hit === "string") {
        try {
          const decoded = JSON.parse(hit) as T
          // An empty result stays a miss, as it always has here: a fetcher
          // that returns nothing is reporting a gap, not a value worth
          // holding for the rest of the TTL.
          if (decoded !== null) return decoded
        } catch {
          // Corrupt or foreign entry - treat it as a miss and overwrite it.
          log.warn("Undecodable cache entry, refetching", { key })
        }
      }
    } catch (error) {
      log.error("Redis get failed, falling through", error)
    }
  }

  const value = await fetcher()

  // Nothing to store for an empty result: `JSON.stringify(undefined)` is
  // `undefined`, which is not a storable value, and a cached `null` reads
  // back as a miss anyway.
  if (r && value !== undefined && value !== null) {
    try {
      await r.set(k, JSON.stringify(value), { ex: ttlSeconds })
    } catch (error) {
      log.error("Redis set failed", error)
    }
  }

  return value
}

/**
 * Invalidate a cached key after a mutation.
 */
export async function invalidateCache(key: string): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.del(namespaced(key))
  } catch (error) {
    log.error("Redis invalidate failed", error)
  }
}
