/**
 * Gmail transport for the email subsystem.
 *
 * Two auth modes, chosen automatically:
 *   A. OAuth2 ("send via API") — used when GMAIL_OAUTH_CLIENT_ID,
 *      GMAIL_OAUTH_CLIENT_SECRET and GMAIL_OAUTH_REFRESH_TOKEN are all set.
 *      nodemailer obtains and refreshes short-lived access tokens itself via
 *      Google's OAuth endpoint, so no access token is ever stored. This is the
 *      recommended production path (no app password, revocable from Google).
 *   B. App Password — fallback when OAuth2 vars are absent but EMAIL_APP_PASSWORD
 *      is set. Simpler to set up; fine for low volume / dev.
 *
 * If neither mode is configured, construction succeeds but send() throws a clear
 * error (so the worker logs + retries rather than crashing at boot).
 */

import nodemailer, { Transporter } from "nodemailer";
import { EMAIL_CONFIG } from "../../config";
import logger from "../../util/logger.util";
import type { EmailMessage, EmailProvider, EmailSendResult } from "../types";

type GmailAuthMode = "oauth2" | "app_password" | "unconfigured";

function detectMode(): GmailAuthMode {
  const { oauth, pass } = EMAIL_CONFIG;
  if (oauth.clientId && oauth.clientSecret && oauth.refreshToken) return "oauth2";
  if (pass) return "app_password";
  return "unconfigured";
}

export class GmailProvider implements EmailProvider {
  readonly name = "gmail";

  private readonly mode: GmailAuthMode;
  private transporter: Transporter | null = null;

  constructor() {
    this.mode = detectMode();
    if (this.mode === "unconfigured") {
      logger.warn({
        message:
          "[email] Gmail provider has no credentials — set GMAIL_OAUTH_* (preferred) " +
          "or EMAIL_APP_PASSWORD, or set EMAIL_PROVIDER=console for local dev. " +
          "Email sends will fail until configured.",
      });
    } else {
      logger.info({ message: `[email] Gmail provider initialized (mode=${this.mode})` });
    }
  }

  /** Build the transporter on first use so an unconfigured provider never crashes at import. */
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    if (this.mode === "oauth2") {
      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: EMAIL_CONFIG.user,
          clientId: EMAIL_CONFIG.oauth.clientId,
          clientSecret: EMAIL_CONFIG.oauth.clientSecret,
          refreshToken: EMAIL_CONFIG.oauth.refreshToken,
        },
      });
    } else if (this.mode === "app_password") {
      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: EMAIL_CONFIG.user, pass: EMAIL_CONFIG.pass },
      });
    } else {
      throw new Error(
        "Gmail email provider is not configured (no OAuth2 credentials and no app password)."
      );
    }

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
