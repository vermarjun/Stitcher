import { MongoClient, type Db } from "mongodb";
import { config } from "./config.js";
import { log } from "./logger.js";
import { withRetry, isTransient } from "./util/retry.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connect(): Promise<Db> {
  if (db) return db;

  log.info("Connecting to MongoDB…");
  client = new MongoClient(config.MONGODB_URL, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  await withRetry(() => client!.connect(), {
    retries: config.RETRY_MAX,
    baseMs: config.RETRY_BASE_MS,
    label: "mongo.connect",
    shouldRetry: isTransient,
    onRetry: (err, attempt, delay) =>
      log.warn({ attempt, delay, err: String(err) }, "Retrying MongoDB connect"),
  });

  db = client.db(config.MONGODB_DB_NAME);
  log.info({ db: config.MONGODB_DB_NAME }, "MongoDB connected");
  return db;
}

export async function disconnect(): Promise<void> {
  if (!client) return;
  await client.close();
  client = null;
  db = null;
  log.info("MongoDB disconnected");
}

export function getDb(): Db {
  if (!db) {
    throw new Error("ManimRAG: MongoDB not connected. Call connect() first.");
  }
  return db;
}
