import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { config } from "../config.js";
import { timingSafeEqual } from "crypto";

function constantTimeEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ab.length !== bb.length) {
      // Still do the comparison to prevent timing oracle on length
      timingSafeEqual(ab, Buffer.alloc(ab.length));
      return false;
    }
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const key = request.headers["x-api-key"];
  if (!key || typeof key !== "string" || !constantTimeEqual(key, config.agentApiKey)) {
    reply.status(401).send({ error: "Unauthorised. Supply X-Api-Key header." });
  }
}

export function registerAuth(app: FastifyInstance): void {
  // Applied per-route in api/* files — not globally so /health doesn't require auth
}
