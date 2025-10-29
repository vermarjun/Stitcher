import mongoose from "mongoose";
import { MONGODB_URL } from "../config";
import { startNotificationCleanupJob } from "./notificationcleaner.util";

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('MongoDB connected successfully');
    startNotificationCleanupJob();
    console.log('Notification Cleanup Job started successfully!');
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