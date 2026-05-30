/**
 * Provider factory — the single place that maps EMAIL_PROVIDER → a transport.
 *
 * To add a new provider (e.g. Resend, SES, Postmark):
 *   1. Implement EmailProvider in ./<name>.provider.ts
 *   2. Add a `case "<name>":` below
 *   3. Set EMAIL_PROVIDER=<name> in the environment
 * Nothing else in the codebase needs to change.
 */

import { EMAIL_CONFIG } from "../../config";
import logger from "../../util/logger.util";
import type { EmailProvider } from "../types";
import { GmailProvider } from "./gmail.provider";
import { ConsoleProvider } from "./console.provider";

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const name = (EMAIL_CONFIG.provider || "gmail").toLowerCase();
  switch (name) {
    case "console":
      cached = new ConsoleProvider();
      break;
    case "gmail":
      cached = new GmailProvider();
      break;
    default:
      logger.warn({
        message: `[email] Unknown EMAIL_PROVIDER="${name}" — falling back to gmail.`,
      });
      cached = new GmailProvider();
  }

  return cached;
}
