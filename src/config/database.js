import mongoose from "mongoose";

export const db = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
};