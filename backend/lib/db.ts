import mongoose from "mongoose";

export const connectDB = async ()=> {
  const databaseUrl = process.env.DATABASE_URL || "mongodb://mongo:27017/moviebooking";
  await mongoose.connect(databaseUrl)
  .then(() => {console.log("DB connected")})
}