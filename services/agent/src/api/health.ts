import { FastifyInstance } from "fastify";
import { isRedisHealthy } from "../graph/checkpointer.js";
import { config } from "../config.js";
import * as fs from "fs";

export function registerHealth(app: FastifyInstance): void {
  app.get("/health", async (_req, reply) => {
    const redis = await isRedisHealthy();
    const manimIndex = fs.existsSync(config.manimApiIndexPath);

    const allOk = redis && manimIndex;
    reply.status(allOk ? 200 : 503).send({
      status: allOk ? "ok" : "degraded",
      checks: {
        redis: redis ? "ok" : "unreachable",
        manimApiIndex: manimIndex ? "ok" : "missing",
      },
      version: "0.1.0",
    });
  });
}
