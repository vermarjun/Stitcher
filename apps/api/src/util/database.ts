import mongoose from "mongoose";
import { MONGODB_URL } from "../config";

const connectDB = async (): Promise<void> => {
  try {
    if (!MONGODB_URL) {
      throw new Error("MONGODB_URL is not defined in environment variables");
    }
    await mongoose.connect(MONGODB_URL);
    console.log('MongoDB connected successfully');
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error('An unknown error occurred while connecting to MongoDB');
    }
    process.exit(1);
  }
};

export default connectDB;