import { hash } from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDB } from '../lib/db'
import User from '../model/User'

// We require dotenv to load environment variables when run directly in terminal
// In development, the database URI is in process.env.MONGODB_URI
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local from backend root if it exists
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
// If not found or empty, load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function seed() {
  console.log('[Seed] Starting database seeding...')
  
  if (!process.env.MONGODB_URI) {
    console.error('[Seed] ERROR: MONGODB_URI environment variable is not defined.')
    process.exit(1)
  }

  try {
    await connectDB()
    console.log('[Seed] Connected to database')

    // Clean existing users
    const deleteResult = await User.deleteMany({})
    console.log(`[Seed] Deleted ${deleteResult.deletedCount} existing users`)

    // Hash password
    const passwordHash = await hash('demo123', 10)

    const usersToSeed = [
      {
        collegeId: 'STU001',
        name: 'Jane Doe (Student)',
        passwordHash,
        role: 'student' as const,
        department: 'CS',
        semester: 6,
      },
      {
        collegeId: 'TCH001',
        name: 'Dr. John Smith (Teacher)',
        passwordHash,
        role: 'teacher' as const,
        department: 'CS',
      },
      {
        collegeId: 'HOD001',
        name: 'Prof. Sarah Evans (HoD)',
        passwordHash,
        role: 'hod' as const,
        department: 'CS',
      },
    ]

    const seededUsers = await User.insertMany(usersToSeed)
    console.log(`[Seed] Seeded ${seededUsers.length} users successfully:`)
    seededUsers.forEach(u => {
      console.log(` - ${u.name} [ID: ${u.collegeId}, Role: ${u.role}]`)
    })

    console.log('[Seed] Seeding completed successfully.')
    process.exit(0)
  } catch (error) {
    console.error('[Seed] Seeding failed with error:', error)
    process.exit(1)
  }
}

seed()
