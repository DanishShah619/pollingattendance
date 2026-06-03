// models/Session.ts
import mongoose, { Schema, Document } from 'mongoose'

export interface ISession extends Document {
  title: string             // e.g. "Operating Systems — Lecture 12"
  subject: string
  teacherId: mongoose.Types.ObjectId
  department: string
  semester: number
  allowedCells: string[]    // array of H3 cell IDs at chosen resolution
  centerLat: number         // stored for display on map
  centerLng: number
  radiusRings: number       // gridDisk rings (0 = 1 cell, 1 = 7 cells, 2 = 19 cells)
  resolution: number        // H3 resolution used
  startTime: Date
  endTime: Date
  isActive: boolean
  createdAt: Date
}

const SessionSchema = new Schema<ISession>({
  title:        { type: String, required: true },
  subject:      { type: String, required: true },
  teacherId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  department:   { type: String, required: true },
  semester:     { type: Number, required: true },
  allowedCells: [{ type: String }],
  centerLat:    { type: Number, required: true },
  centerLng:    { type: Number, required: true },
  radiusRings:  { type: Number, default: 1 },
  resolution:   { type: Number, default: 10 },
  startTime:    { type: Date, required: true },
  endTime:      { type: Date, required: true },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true })

// Index for fast "find active sessions for a semester"
SessionSchema.index({ department: 1, semester: 1, isActive: 1 })

export default mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema)