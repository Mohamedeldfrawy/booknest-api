import mongoose from "mongoose";

export const db = async (url = process.env.MONGODB_URI) => {
  try {
    if (!url) {
      throw new Error("MongoDB connection URL is not defined in environment variables.");
    }
    await mongoose.connect(url);
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
};
