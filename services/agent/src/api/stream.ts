import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { streamJob } from "../events/sseTransport.js";

export function registerStream(app: FastifyInstance): void {
  app.get<{ Params: { jobId: string }; Headers: { "last-event-id"?: string } }>(
    "/stream/:jobId",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const lastEventId = req.headers["last-event-id"];
      streamJob(req.params.jobId, reply, lastEventId);
    }
  );
}
