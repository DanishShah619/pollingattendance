// models/Poll.ts
import mongoose, { Schema, Document } from 'mongoose'

export interface IPoll extends Document {
  sessionId: mongoose.Types.ObjectId
  createdBy: mongoose.Types.ObjectId    // teacher or HoD
  question: string
  isAnonymous: boolean                  // always false for now (Yes/No public)
  isOpen: boolean                       // teacher can close voting
  yesCount: number                      // denormalised counter for speed
  noCount: number
  totalEligible: number                 // snapshot of checked-in count at poll creation
  createdAt: Date
  closedAt?: Date
}

const PollSchema = new Schema<IPoll>({
  sessionId:     { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  createdBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  question:      { type: String, required: true, maxlength: 300 },
  isAnonymous:   { type: Boolean, default: false },
  isOpen:        { type: Boolean, default: true },
  yesCount:      { type: Number, default: 0 },
  noCount:       { type: Number, default: 0 },
  totalEligible: { type: Number, default: 0 },
  closedAt:      { type: Date },
}, { timestamps: true })

export default mongoose.models.Poll || mongoose.model<IPoll>('Poll', PollSchema)