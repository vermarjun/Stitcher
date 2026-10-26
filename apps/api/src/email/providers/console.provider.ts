/**
 * No-op provider that logs the email instead of sending it.
 *
 * Selected with EMAIL_PROVIDER=console. Useful for local development and
 * self-hosting where no SMTP/OAuth credentials are available — verification
 * links, signup codes, etc. are printed to the logs so flows remain testable.
 */

import logger from "../../util/logger.util";
import type { EmailMessage, EmailProvider, EmailSendResult } from "../types";

export class ConsoleProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    logger.info({
      message: "[email:console] (not actually sent)",
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { provider: this.name };
  }
}
