// lib/sse.ts — Redis-backed SSE broadcaster
import Redis from 'ioredis'

type Listener = (data: string) => void
const localClients = new Map<string, Set<Listener>>()

// Lazy singletons — only instantiated when first needed
// This prevents crashes if REDIS_URL is not set during Next.js cold starts
let _publisher: Redis | null = null
let _subscriber: Redis | null = null

function getPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    })
    _publisher.on('error', (err) =>
      console.error('[SSE] Publisher connection error:', err.message)
    )
  }
  return _publisher
}

function getSubscriber(): Redis {
  if (!_subscriber) {
    _subscriber = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    })
    _subscriber.on('error', (err) =>
      console.error('[SSE] Subscriber connection error:', err.message)
    )
    // Fan-out: deliver any Redis message to all local SSE listeners on this instance
    _subscriber.on('message', (channel: string, message: string) => {
      localClients.get(channel)?.forEach((cb) => cb(`data: ${message}\n\n`))
    })
  }
  return _subscriber
}

/**
 * Subscribe a local SSE client to a session channel.
 * Returns an unsubscribe function — call it when the SSE connection closes.
 */
export function subscribeLocal(sessionId: string, cb: Listener): () => void {
  const sub = getSubscriber()

  if (!localClients.has(sessionId)) {
    localClients.set(sessionId, new Set())
    // Subscribe to Redis channel only when the first local client joins
    sub.subscribe(sessionId).catch((err) =>
      console.error(`[SSE] Failed to subscribe to channel ${sessionId}:`, err.message)
    )
  }
  localClients.get(sessionId)!.add(cb)

  return () => {
    const clients = localClients.get(sessionId)
    clients?.delete(cb)
    // Unsubscribe from Redis when the last local client disconnects
    if (clients?.size === 0) {
      sub.unsubscribe(sessionId).catch(() => {})
      localClients.delete(sessionId)
    }
  }
}

/**
 * Publish an event to all instances via Redis Pub/Sub.
 * Fails silently if Redis is down — votes and check-ins still persist to DB.
 */
export async function broadcast(sessionId: string, payload: object): Promise<void> {
  try {
    await getPublisher().publish(sessionId, JSON.stringify(payload))
  } catch (err) {
    console.error('[SSE] Redis publish failed — real-time update skipped:', err)
    // Graceful degradation: DB write already succeeded before this was called
  }
}