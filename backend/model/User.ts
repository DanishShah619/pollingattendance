// models/User.ts
import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  collegeId: string           // e.g. "STU2024001", "TCH001" — unique, uppercase
  name: string
  passwordHash: string
  role: 'student' | 'teacher' | 'hod'
  department: string
  semester?: number           // students only; 1–8
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    collegeId:    { type: String, required: true, unique: true, uppercase: true, trim: true },
    name:         { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['student', 'teacher', 'hod'], required: true },
    department:   { type: String, required: true, trim: true },
    semester:     { type: Number, min: 1, max: 8 },   // optional — only for students
  },
  { timestamps: true }
)

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)