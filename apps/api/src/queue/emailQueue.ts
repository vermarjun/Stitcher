/**
 * BullMQ queue for outbound transactional email.
 *
 * Email is enqueued (never sent inline) so that:
 *   - HTTP requests (signup, invite, password reset) never block on SMTP,
 *   - transient send failures retry with backoff instead of being lost.
 *
 * defaultJobOptions mirror the generation queue: 3 attempts, exponential
 * backoff, bounded retention for post-mortem in bull-board.
 */

import { Queue } from "bullmq";
import { redisConnection } from "./connection";
import type { EmailJobData } from "../email/types";

export const EMAIL_QUEUE_NAME = "email";

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});

/** Enqueue a rendered email. Returns the BullMQ job id. */
export async function enqueueEmail(data: EmailJobData): Promise<string> {
  const job = await emailQueue.add(data.kind, data);
  return job.id ?? "";
}
