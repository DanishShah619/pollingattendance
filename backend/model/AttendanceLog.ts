// models/AttendanceLog.ts
import mongoose, { Schema, Document } from 'mongoose'

export interface IAttendanceLog extends Document {
  userId: mongoose.Types.ObjectId      // ref: User
  sessionId: mongoose.Types.ObjectId   // ref: Session
  h3Cell: string                       // exact H3 cell the student was in at check-in
  lat: number                          // raw GPS latitude — never shown to students
  lng: number                          // raw GPS longitude — never shown to students
  gpsAccuracy: number                  // coords.accuracy in metres — used for audit + guard
  checkedInAt: Date                    // PRIMARY TIMESTAMP — always set server-side
  checkOutAt?: Date                    // optional; set on explicit checkout
  durationMinutes?: number             // computed at checkout: (checkOutAt - checkedInAt) / 60000
}

const AttendanceLogSchema = new Schema<IAttendanceLog>(
  {
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId:       { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    h3Cell:          { type: String, required: true },
    lat:             { type: Number, required: true },
    lng:             { type: Number, required: true },
    gpsAccuracy:     { type: Number, required: true },   // enforced — enables server-side accuracy guard
    checkedInAt:     { type: Date, default: Date.now },  // set by server, never from client
    checkOutAt:      { type: Date, default: null },
    durationMinutes: { type: Number, default: null },
  },
  { timestamps: false }
)

// One check-in per student per session — prevents duplicate check-ins at DB level
AttendanceLogSchema.index({ userId: 1, sessionId: 1 }, { unique: true })

// Fast attendance history page: "show me all sessions for student X, newest first"
AttendanceLogSchema.index({ userId: 1, checkedInAt: -1 })

// Fast session roster: "who is checked in to session Y"
AttendanceLogSchema.index({ sessionId: 1 })

export default mongoose.models.AttendanceLog ||
  mongoose.model<IAttendanceLog>('AttendanceLog', AttendanceLogSchema)