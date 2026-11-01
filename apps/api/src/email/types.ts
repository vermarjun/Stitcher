/**
 * Shared types for the pluggable email subsystem.
 *
 * The design goal is provider-independence: controllers/services build a fully
 * rendered `EmailMessage`, and a swappable `EmailProvider` is responsible only
 * for transport. Swapping SMTP for Resend or SES is a change in
 * providers/index.ts; nothing upstream changes.
 */

/** A fully rendered, transport-ready email. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback (for clients that don't render HTML, and deliverability). */
  text: string;
}

/** Result of a send attempt. `id` is the provider's message id when available. */
export interface EmailSendResult {
  provider: string;
  id?: string;
}

/** Transport contract every provider implements. */
export interface EmailProvider {
  /** Stable identifier, e.g. "smtp" | "console" — used in logs/results. */
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/**
 * Discriminator carried on each queued job, purely for observability/logging
 * (the message itself is already rendered by the time it's enqueued).
 */
export type EmailKind =
  | "welcome"
  | "verify_email"
  | "signup_otp"
  | "password_reset";

/** BullMQ payload for the `email` queue. */
export interface EmailJobData extends EmailMessage {
  kind: EmailKind;
}
