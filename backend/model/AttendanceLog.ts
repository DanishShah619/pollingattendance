// models/AttendanceLog.ts
import mongoose, { Schema, Document } from 'mongoose'

export interface IAttendanceLog extends Document {
  userId: mongoose.Types.ObjectId
  sessionId: mongoose.Types.ObjectId
  h3Cell: string            // the exact cell the student was in
  lat: number
  lng: number
  checkedInAt: Date
  checkOutAt?: Date
}

const AttendanceLogSchema = new Schema<IAttendanceLog>({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId:   { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  h3Cell:      { type: String, required: true },
  lat:         { type: Number, required: true },
  lng:         { type: Number, required: true },
  checkedInAt: { type: Date, default: Date.now },
  checkOutAt:  { type: Date },
}, { timestamps: false })

// Compound unique — one check-in per student per session
AttendanceLogSchema.index({ userId: 1, sessionId: 1 }, { unique: true })

export default mongoose.models.AttendanceLog ||
  mongoose.model<IAttendanceLog>('AttendanceLog', AttendanceLogSchema)