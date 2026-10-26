/**
 * SMTP transport for the email subsystem (nodemailer).
 *
 * EMAIL_PROVIDER=smtp   uses SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
 * EMAIL_PROVIDER=gmail  is a preset for smtp.gmail.com (465, TLS). Use a Google
 *                       app password as SMTP_PASS.
 *
 * If the settings are incomplete, construction still succeeds but send() throws
 * a clear error (so the worker logs and retries rather than crashing at boot).
 * For local development with no mail server, use EMAIL_PROVIDER=console.
 */

import nodemailer, { Transporter } from "nodemailer";
import { EMAIL_CONFIG } from "../../config";
import logger from "../../util/logger.util";
import type { EmailMessage, EmailProvider, EmailSendResult } from "../types";

export interface SmtpSettings {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from: string;
}

/** Resolve SMTP connection settings, applying the gmail preset. Pure, for tests. */
export function resolveSmtpTransport(
  provider: "smtp" | "gmail",
  s: SmtpSettings
): { host: string; port: number; secure: boolean; auth?: { user: string; pass: string } } | null {
  const host = s.host || (provider === "gmail" ? "smtp.gmail.com" : undefined);
  if (!host) return null;
  const port = s.port ?? (provider === "gmail" ? 465 : 587);
  const auth = s.user && s.pass ? { user: s.user, pass: s.pass.replace(/\s/g, "") } : undefined;
  return { host, port, secure: port === 465, ...(auth ? { auth } : {}) };
}

export class SmtpProvider implements EmailProvider {
  readonly name: string;

  private transporter: Transporter | null = null;
  private readonly settings: ReturnType<typeof resolveSmtpTransport>;

  constructor(kind: "smtp" | "gmail" = "smtp") {
    this.name = kind;
    this.settings = resolveSmtpTransport(kind, EMAIL_CONFIG);
    if (this.settings) {
      logger.info({ message: `[email] ${kind} provider ready`, host: this.settings.host, port: this.settings.port });
    } else {
      logger.warn({
        message:
          "[email] EMAIL_PROVIDER=smtp needs SMTP_HOST (and usually SMTP_USER and SMTP_PASS). " +
          "Set them, or use EMAIL_PROVIDER=console. Email sends will fail until configured.",
      });
    }
  }

  /** Build the transporter on first use so an unconfigured provider never crashes at import. */
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    if (!this.settings) {
      throw new Error("SMTP email provider is not configured (missing SMTP_HOST).");
    }
    this.transporter = nodemailer.createTransport(this.settings);
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const info = await this.getTransporter().sendMail({
      from: EMAIL_CONFIG.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { provider: this.name, id: info.messageId };
  }
}
