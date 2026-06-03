// models/Poll.ts
import mongoose, { Schema, Document } from 'mongoose'

export interface IPoll extends Document {
  sessionId: mongoose.Types.ObjectId      // ref: Session
  createdBy: mongoose.Types.ObjectId      // ref: User (teacher or HoD)
  question: string                        // max 300 chars
  isOpen: boolean                         // false when closed manually or timer expires
  yesCount: number                        // denormalised counter — always use $inc
  noCount: number                         // denormalised counter — always use $inc
  totalEligible: number                   // snapshot of checked-in student count at creation

  // ── v2.0 time-limit fields ──────────────────────────────────────────────
  hasTimeLimit: boolean                   // whether a countdown timer is active
  durationSeconds: number                 // 0 if no limit; e.g. 30, 60, 120, 300
  expiresAt?: Date                        // createdAt + durationSeconds; null if no limit
  closedAt?: Date                         // set when poll closes (manual or auto)
  closedBy: 'manual' | 'timer' | null    // how the poll was closed

  createdAt: Date
}

const PollSchema = new Schema<IPoll>(
  {
    sessionId:       { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    createdBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    question:        { type: String, required: true, maxlength: 300 },
    isOpen:          { type: Boolean, default: true },
    yesCount:        { type: Number, default: 0 },
    noCount:         { type: Number, default: 0 },
    totalEligible:   { type: Number, default: 0 },

    // v2.0 timer fields
    hasTimeLimit:    { type: Boolean, default: false },
    durationSeconds: { type: Number, default: 0 },
    expiresAt:       { type: Date, default: null },
    closedAt:        { type: Date, default: null },
    closedBy:        {
      type: String,
      enum: ['manual', 'timer', null],
      default: null,
    },
  },
  { timestamps: true }
)

// Fast "all open polls for a session" query
PollSchema.index({ sessionId: 1, isOpen: 1 })

export default mongoose.models.Poll || mongoose.model<IPoll>('Poll', PollSchema)