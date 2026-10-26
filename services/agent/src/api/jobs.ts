import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.js";
import { loadJob } from "../graph/checkpointer.js";
import { publishEvent, getEmitter, removeEmitter } from "../events/emitter.js";
import { getLogger } from "../logging.js";

const log = getLogger("jobs");

// In-memory cancel registry — jobs check this flag during execution
const cancelledJobs = new Set<string>();

export function isJobCancelled(jobId: string): boolean {
  return cancelledJobs.has(jobId);
}

export function registerJobs(app: FastifyInstance): void {
  // GET /jobs/:jobId — polling fallback for non-SSE clients
  app.get<{ Params: { jobId: string } }>(
    "/jobs/:jobId",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const { jobId } = req.params;
      const state = await loadJob(jobId);
      if (!state) {
        return reply.status(404).send({ error: "Job not found or expired" });
      }
      reply.send(state);
    }
  );

  // POST /jobs/:jobId/cancel — abort in-flight job
  app.post<{ Params: { jobId: string } }>(
    "/jobs/:jobId/cancel",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const { jobId } = req.params;
      cancelledJobs.add(jobId);
      publishEvent(jobId, "job_cancelled", { jobId });
      const emitter = getEmitter(jobId);
      if (emitter) {
        setTimeout(() => removeEmitter(jobId), 5000);
      }
      log.info({ jobId }, "Job cancelled");
      reply.send({ cancelled: true, jobId });
    }
  );
}
