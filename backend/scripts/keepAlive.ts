/**
 * Keep-Alive Daemon & CLI Script for MongoDB, Redis, and Web Server
 * 
 * Usage:
 *   npx tsx scripts/keepAlive.ts             # Runs continuously every 10 minutes
 *   npx tsx scripts/keepAlive.ts --one-shot   # Runs once and exits (ideal for cron / GitHub Actions)
 *   npx tsx scripts/keepAlive.ts --interval 5 # Runs continuously every 5 minutes
 */

import mongoose from 'mongoose'
import Redis from 'ioredis'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const isOneShot = process.argv.includes('--one-shot') || process.argv.includes('-1')
const intervalArgIdx = process.argv.indexOf('--interval')
const intervalMinutes = intervalArgIdx !== -1 && process.argv[intervalArgIdx + 1]
  ? parseInt(process.argv[intervalArgIdx + 1], 10)
  : 10 // Default: ping every 10 minutes

async function pingMongoDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.warn('⚠️ [MongoDB] MONGODB_URI not found in env. Skipping MongoDB ping.')
    return false
  }

  try {
    const start = Date.now()
    const conn = await mongoose.connect(uri, { bufferCommands: false })
    if (conn.connection.db) {
      await conn.connection.db.admin().ping()
    }
    const latency = Date.now() - start
    console.log(`✅ [MongoDB] Ping successful! Latency: ${latency}ms`)
    await mongoose.disconnect()
    return true
  } catch (err: any) {
    console.error(`❌ [MongoDB] Keep-alive ping failed:`, err.message || err)
    return false
  }
}

async function pingRedis(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.warn('⚠️ [Redis] REDIS_URL not found in env. Skipping Redis ping.')
    return false
  }

  let redis: Redis | null = null
  try {
    const start = Date.now()
    redis = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    })
    await redis.connect()
    const pong = await redis.ping()
    const latency = Date.now() - start
    console.log(`✅ [Redis] Ping successful (${pong})! Latency: ${latency}ms`)
    await redis.quit()
    return true
  } catch (err: any) {
    console.error(`❌ [Redis] Keep-alive ping failed:`, err.message || err)
    if (redis) {
      try {
        redis.disconnect()
      } catch {}
    }
    return false
  }
}

async function pingWebApp(): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (!appUrl) {
    return false
  }

  try {
    const start = Date.now()
    const targetUrl = `${appUrl.replace(/\/$/, '')}/api/keep-alive`
    const res = await fetch(targetUrl)
    const latency = Date.now() - start
    if (res.ok) {
      console.log(`✅ [Web App] Endpoint ${targetUrl} pinged successfully! Latency: ${latency}ms`)
      return true
    } else {
      console.warn(`⚠️ [Web App] Endpoint responded with HTTP ${res.status}`)
      return false
    }
  } catch (err: any) {
    console.error(`❌ [Web App] Keep-alive ping failed:`, err.message || err)
    return false
  }
}

async function runKeepAliveCycle() {
  const timestamp = new Date().toISOString()
  console.log(`\n==================================================`)
  console.log(`🔄 [KeepAlive] Running keep-alive check at ${timestamp}`)
  console.log(`==================================================`)

  await pingMongoDB()
  await pingRedis()
  await pingWebApp()
}

async function main() {
  console.log(`🚀 [KeepAlive] Starting Keep-Alive script...`)
  console.log(`Mode: ${isOneShot ? 'One-Shot (Single Run)' : `Daemon (Interval: every ${intervalMinutes} minutes)`}`)

  if (isOneShot) {
    await runKeepAliveCycle()
    console.log(`\n🎉 [KeepAlive] One-shot execution complete. Exiting.`)
    process.exit(0)
  } else {
    // Run immediately on boot
    await runKeepAliveCycle()

    // Schedule recurring interval
    const intervalMs = intervalMinutes * 60 * 1000
    setInterval(async () => {
      await runKeepAliveCycle()
    }, intervalMs)
  }
}

main().catch((err) => {
  console.error('Fatal error in Keep-Alive script:', err)
  process.exit(1)
})
