import mongoose from "mongoose";
import { MONGODB_URL } from "../config";
import { startNotificationCleanupJob } from "./notificationcleaner.util";
import { seedServiceConfigs } from "../scripts/serviceConfig.seed";
import logger from "./logger.util";

const connectDB = async (): Promise<void> => {
  try {
    // Bound the pool + fail fast: the API and the RAG service both connect to the
    // same Atlas cluster, so an unbounded default pool (100/process) can exhaust the
    // cluster's connection cap under load. serverSelectionTimeoutMS makes requests
    // error fast instead of hanging when Atlas is unreachable.
    await mongoose.connect(MONGODB_URL, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 8000,
    });
    logger.info("MongoDB connected successfully");
    startNotificationCleanupJob();
    logger.info("Notification Cleanup Job started successfully!");
    // Seed per-tier provider configs (idempotent — only inserts missing rows)
    void seedServiceConfigs();
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