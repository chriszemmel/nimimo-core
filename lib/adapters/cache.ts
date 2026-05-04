import { Redis } from "@upstash/redis"
import { logger } from "@/lib/logger"

const log = logger("cache")

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url: url.trim(), token: token.trim() })
  return redis
}

/**
 * Cache-aside helper for blockchain data.
 * Falls through to the fetcher on cache miss or Redis unavailability.
 */
export async function cached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const r = getRedis()

  if (r) {
    try {
      const hit = await r.get<T>(key)
      if (hit !== null && hit !== undefined) {
        return hit
      }
    } catch (error) {
      log.error("Redis get failed, falling through", error)
    }
  }

  const value = await fetcher()

  if (r) {
    try {
      await r.set(key, value, { ex: ttlSeconds })
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
    await r.del(key)
  } catch (error) {
    log.error("Redis invalidate failed", error)
  }
}
