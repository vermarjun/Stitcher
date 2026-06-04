/**
 * Gmail transport for the email subsystem (App Password / SMTP).
 *
 * Authenticates with EMAIL_USER + EMAIL_APP_PASSWORD over Gmail's SMTP service.
 * Generate an app password at https://myaccount.google.com/apppasswords.
 *
 * If EMAIL_APP_PASSWORD is absent, construction still succeeds but send() throws
 * a clear error (so the worker logs + retries rather than crashing at boot). For
 * local dev with no credentials, set EMAIL_PROVIDER=console instead.
 *
 * Swapping to OAuth2 or a third-party provider later is a new EmailProvider in
 * this directory plus a case in providers/index.ts — nothing upstream changes.
 */

import nodemailer, { Transporter } from "nodemailer";
import { EMAIL_CONFIG } from "../../config";
import logger from "../../util/logger.util";
import type { EmailMessage, EmailProvider, EmailSendResult } from "../types";

export class GmailProvider implements EmailProvider {
  readonly name = "gmail";

  private readonly configured: boolean;
  private transporter: Transporter | null = null;

  constructor() {
    this.configured = Boolean(EMAIL_CONFIG.pass);
    if (this.configured) {
      logger.info({ message: "[email] Gmail provider initialized (app password)" });
    } else {
      logger.warn({
        message:
          "[email] Gmail provider has no EMAIL_APP_PASSWORD — set it in API/.env.docker, or set " +
          "EMAIL_PROVIDER=console for local dev. Email sends will fail until configured.",
      });
    }
  }

  /** Build the transporter on first use so an unconfigured provider never crashes at import. */
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    if (!this.configured) {
      throw new Error("Gmail email provider is not configured (missing EMAIL_APP_PASSWORD in API/.env.docker).");
    }

    // Google displays app passwords with spaces for readability — strip them.
    const pass = EMAIL_CONFIG.pass.replace(/\s/g, "");

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: EMAIL_CONFIG.user, pass },
    });

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
