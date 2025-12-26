/**
 * Manim Agent Service — entry point
 *
 * Boots Fastify, registers all routes, and starts listening.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { logger } from "./logging.js";
import { traceMiddleware } from "./middleware/trace.js";
import { registerHealth } from "./api/health.js";
import { registerCapabilities } from "./api/capabilities.js";
import { registerGenerate } from "./api/generate.js";
import { registerDebug } from "./api/debug.js";
import { registerStream } from "./api/stream.js";
import { registerJobs } from "./api/jobs.js";
import { closeRedis } from "./graph/checkpointer.js";

async function build() {
  const app = Fastify({
    logger: false, // using pino directly
    trustProxy: true,
    bodyLimit: config.maxCodeSizeBytes + 65536, // code + overhead
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.addHook("onRequest", traceMiddleware);

  app.addHook("onRequest", async (req) => {
    logger.info(
      { method: req.method, url: req.url, traceId: req.traceId },
      "request"
    );
  });

  app.addHook("onResponse", async (req, reply) => {
    logger.info(
      { method: req.method, url: req.url, status: reply.statusCode, traceId: req.traceId },
      "response"
    );
  });

  // Routes
  registerHealth(app);
  registerCapabilities(app);
  registerGenerate(app);
  registerDebug(app);
  registerStream(app);
  registerJobs(app);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    await app.close();
    await closeRedis();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  return app;
}

async function main() {
  try {
    const app = await build();
    await app.listen({ host: config.host, port: config.port });
    logger.info(
      { host: config.host, port: config.port, env: config.nodeEnv },
      "Manim Agent Service started"
    );
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

void main();
