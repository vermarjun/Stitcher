/**
 * BullMQ worker that delivers queued emails via the configured provider.
 *
 * The worker is intentionally dumb: messages arrive fully rendered, so it only
 * resolves the provider (gmail/console/…) and calls send(). All template logic
 * lives in src/email/. A failed send throws → BullMQ retries per the queue's
 * backoff policy.
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "./connection";
import { getEmailProvider } from "../email/providers";
import logger from "../util/logger.util";
import { EMAIL_QUEUE_NAME } from "./emailQueue";
import type { EmailJobData } from "../email/types";
import { EmailLog } from "../model/emailLog.model";

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const provider = getEmailProvider();
  const { to, subject, html, text, kind } = job.data;
  const result = await provider.send({ to, subject, html, text });
  logger.info({
    message: "[email] sent",
    kind,
    to,
    provider: result.provider,
    messageId: result.id,
    jobId: job.id,
  });
  await EmailLog.create({
    kind,
    to,
    subject,
    provider: result.provider,
    messageId: result.id,
    status: "sent",
    attemptsMade: job.attemptsMade + 1,
    jobId: job.id,
    sentAt: new Date(),
  }).catch(() => {});
}

export const emailWorker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: redisConnection,
  concurrency: 5,
});

emailWorker.on("failed", (job, err) => {
  logger.error({
    message: "[email] send failed",
    kind: job?.data.kind,
    to: job?.data.to,
    jobId: job?.id,
    attemptsMade: job?.attemptsMade,
    error: String(err),
  });
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    EmailLog.create({
      kind: job.data.kind,
      to: job.data.to,
      subject: job.data.subject,
      provider: "unknown",
      status: "failed",
      error: String(err),
      attemptsMade: job.attemptsMade,
      jobId: job.id,
      sentAt: new Date(),
    }).catch(() => {});
  }
});

emailWorker.on("error", (err) => {
  logger.error({ message: "[email] worker error event", error: String(err) });
});
