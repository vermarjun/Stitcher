import mongoose from "mongoose";
import { MONGODB_URL } from "../config";
import logger from "./logger.util";

const connectDB = async (): Promise<void> => {
  try {
    // Bound the pool + fail fast: the API and the RAG service may share one
    // MongoDB, so an unbounded default pool (100/process) can exhaust its
    // connection cap. serverSelectionTimeoutMS makes requests error fast
    // instead of hanging when MongoDB is unreachable.
    await mongoose.connect(MONGODB_URL, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 8000,
    });
    logger.info("MongoDB connected successfully");
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