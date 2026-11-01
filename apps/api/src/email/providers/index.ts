/**
 * Provider factory: the single place that maps EMAIL_PROVIDER to a transport.
 *
 * To add a new provider (for example Resend or SES):
 *   1. Implement EmailProvider in ./<name>.provider.ts
 *   2. Add a `case "<name>":` below and allow the name in config.ts
 */

import { EMAIL_CONFIG } from "../../config";
import type { EmailProvider } from "../types";
import { SmtpProvider } from "./smtp.provider";
import { ConsoleProvider } from "./console.provider";

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  switch (EMAIL_CONFIG.provider) {
    case "smtp":
      cached = new SmtpProvider("smtp");
      break;
    case "gmail":
      cached = new SmtpProvider("gmail");
      break;
    case "console":
    default:
      cached = new ConsoleProvider();
  }

  return cached;
}
