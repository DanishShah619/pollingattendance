import Redis from 'ioredis'

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (process.env.REDIS_URL) {
    if (!_redis) {
      _redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        retryStrategy: () => null,
      })
      _redis.on('error', (err) => {
        console.error('[RateLimit] Redis error:', err.message)
      })
    }
    return _redis
  }
  return null
}

const memoryStore = new Map<string, number[]>()

/**
 * Checks if a request from a given IP exceeds the rate limit.
 * Uses a Redis sorted set for a sliding window, falling back to in-memory if Redis fails.
 * 
 * @param ip Client IP address
 * @param limit Max allowed attempts in the window
 * @param windowSeconds Window length in seconds
 * @returns true if rate limited, false otherwise
 */
export async function checkRateLimit(ip: string, limit = 5, windowSeconds = 60): Promise<boolean> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  // 1. Try Redis first
  const redis = getRedis()
  if (redis) {
    try {
      const key = `ratelimit:${ip}`
      const multi = redis.multi()
      
      // Clean up old attempts
      multi.zremrangebyscore(key, 0, windowStart)
      // Add current attempt
      multi.zadd(key, now, `${now}-${Math.random()}`)
      // Count attempts in window
      multi.zcard(key)
      // Expire key after window
      multi.expire(key, windowSeconds + 5)

      const results = await multi.exec()
      if (results && results[2] && typeof results[2][1] === 'number') {
        const count = results[2][1]
        return count > limit
      }
    } catch (err) {
      console.error('[RateLimit] Redis failed, falling back to memory:', err)
    }
  }

  // 2. Memory fallback
  // Prune memory store periodically if it grows too large
  if (memoryStore.size > 1000) {
    const pruneStart = now - 3600 * 1000 // prune entries inactive for 1 hour
    for (const [key, value] of memoryStore.entries()) {
      const hasRecent = value.some((t) => t > pruneStart)
      if (!hasRecent) {
        memoryStore.delete(key)
      }
    }
  }

  let timestamps = memoryStore.get(ip) || []
  timestamps = timestamps.filter((t) => t > windowStart)
  timestamps.push(now)
  memoryStore.set(ip, timestamps)

  return timestamps.length > limit
}
