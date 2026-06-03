import mongoose from 'mongoose'

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

// Use global to persist the cache across hot-reloads in Next.js dev mode
declare global {
  // eslint-disable-next-line no-var
  var __mongoose: MongooseCache | undefined
}

const cached: MongooseCache = global.__mongoose ?? { conn: null, promise: null }
global.__mongoose = cached

let rescheduled = false

export async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI!
  if (!MONGODB_URI) {
    throw new Error(
      'Missing MONGODB_URI environment variable. Check your .env.local file.'
    )
  }

  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((m) => {
        console.log('[DB] MongoDB connected')
        // Trigger poll rescheduling once on app boot/first connection
        if (!rescheduled) {
          rescheduled = true
          // Dynamic import to prevent circular dependencies at start time
          import('./pollScheduler')
            .then(({ rescheduleOpenPolls }) => {
              rescheduleOpenPolls().catch((err) =>
                console.error('[DB Boot] Reschedule open polls failed:', err)
              )
            })
            .catch((err) => console.error('[DB Boot] Failed to import pollScheduler:', err))
        }
        return m
      })
      .catch((err) => {
        cached.promise = null // reset so next call retries
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}