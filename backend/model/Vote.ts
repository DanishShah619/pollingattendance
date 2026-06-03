// models/Vote.ts
import mongoose, { Schema, Document } from 'mongoose'

export interface IVote extends Document {
  pollId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  sessionId: mongoose.Types.ObjectId
  answer: 'yes' | 'no'
  votedAt: Date
}

const VoteSchema = new Schema<IVote>({
  pollId:    { type: Schema.Types.ObjectId, ref: 'Poll', required: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  answer:    { type: String, enum: ['yes', 'no'], required: true },
  votedAt:   { type: Date, default: Date.now },
})

// One vote per student per poll
VoteSchema.index({ pollId: 1, userId: 1 }, { unique: true })

export default mongoose.models.Vote || mongoose.model<IVote>('Vote', VoteSchema)