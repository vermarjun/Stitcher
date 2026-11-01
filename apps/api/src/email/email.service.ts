/**
 * High-level email API used by controllers.
 *
 * Each function renders the appropriate template and enqueues it onto the email
 * queue. They deliberately NEVER throw: a transient Redis/enqueue failure must
 * not break signup or password reset. Failures are logged; the worker
 * + BullMQ retries handle transient transport errors after enqueue.
 */

import { enqueueEmail } from "../queue/emailQueue";
import logger from "../util/logger.util";
import {
  welcomeTemplate,
  verifyEmailTemplate,
  signupOtpTemplate,
  passwordResetTemplate,
} from "./templates";
import type { EmailKind } from "./types";

async function enqueueSafe(
  kind: EmailKind,
  to: string,
  rendered: { subject: string; html: string; text: string }
): Promise<void> {
  try {
    await enqueueEmail({ kind, to, ...rendered });
    logger.debug({ message: "[email] enqueued", kind, to });
  } catch (err) {
    // Swallow — the caller's primary operation must succeed regardless.
    logger.error({ message: "[email] enqueue failed (non-fatal)", kind, to, error: String(err) });
  }
}

export function sendWelcomeEmail(params: { to: string; username: string; appUrl: string }): Promise<void> {
  const { to, username, appUrl } = params;
  return enqueueSafe("welcome", to, welcomeTemplate({ username, appUrl }));
}

export function sendVerificationEmail(params: {
  to: string;
  username: string;
  verifyUrl: string;
}): Promise<void> {
  const { to, username, verifyUrl } = params;
  return enqueueSafe("verify_email", to, verifyEmailTemplate({ username, verifyUrl }));
}

export function sendSignupOtpEmail(params: { to: string; username: string; code: string }): Promise<void> {
  const { to, username, code } = params;
  return enqueueSafe("signup_otp", to, signupOtpTemplate({ username, code }));
}

export function sendPasswordResetEmail(params: { to: string; resetUrl: string }): Promise<void> {
  const { to, resetUrl } = params;
  return enqueueSafe("password_reset", to, passwordResetTemplate({ resetUrl }));
}
