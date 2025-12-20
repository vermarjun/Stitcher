import { FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";

declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
  }
}

export async function traceMiddleware(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  request.traceId =
    (request.headers["x-trace-id"] as string | undefined) ??
    (request.headers["x-request-id"] as string | undefined) ??
    uuidv4();
}
