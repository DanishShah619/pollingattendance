import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import Redis from 'ioredis'
import { connectDB } from '@/lib/db'

export async function GET() {
  const startTime = Date.now()
  const status: Record<string, { status: string; latencyMs?: number; error?: string }> = {}

  // 1. Keep-alive for MongoDB
  try {
    const mongoStart = Date.now()
    await connectDB()
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping()
    }
    status.mongodb = {
      status: 'healthy',
      latencyMs: Date.now() - mongoStart,
    }
  } catch (err: any) {
    status.mongodb = {
      status: 'error',
      error: err.message || 'MongoDB ping failed',
    }
  }

  // 2. Keep-alive for Redis
  if (process.env.REDIS_URL) {
    try {
      const redisStart = Date.now()
      const redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
      })
      await redis.connect()
      await redis.ping()
      await redis.quit()

      status.redis = {
        status: 'healthy',
        latencyMs: Date.now() - redisStart,
      }
    } catch (err: any) {
      status.redis = {
        status: 'error',
        error: err.message || 'Redis ping failed',
      }
    }
  } else {
    status.redis = {
      status: 'disabled',
      error: 'REDIS_URL environment variable is not configured',
    }
  }

  const isHealthy = Object.values(status).every(
    (s) => s.status === 'healthy' || s.status === 'disabled'
  )

  return NextResponse.json(
    {
      success: isHealthy,
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - startTime,
      services: status,
    },
    { status: isHealthy ? 200 : 500 }
  )
}
