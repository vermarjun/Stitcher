import mongoose from "mongoose";
import { MONGODB_URL } from "../config";
import { startNotificationCleanupJob } from "./notificationcleaner.util";
import logger from "./logger.util";

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URL);
    logger.info("MongoDB connected successfully");
    startNotificationCleanupJob();
    logger.info("Notification Cleanup Job started successfully!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error({ message: "MongoDB connection failed", error: error.message });
    } else {
      logger.error("An unknown error occurred while connecting to MongoDB");
    }
    process.exit(1);
  }
};

export default connectDB;