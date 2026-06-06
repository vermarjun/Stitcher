// Microsoft Clarity integration — session recordings, heatmaps and behavioural
// insights for every page of the app.
//
// Clarity auto-captures the *whole* SPA once it is initialised a single time at
// startup, so there is no need to touch individual page components. This module
// just wraps the vendor SDK behind the same defensive contract as
// `analytics.ts`:
//
//  - Never throws into the app, never blocks render. Every call is swallowed.
//  - No-ops cleanly when the project id is missing (e.g. local dev) or when run
//    outside the browser, so nothing breaks if Clarity is not configured.
//  - Idempotent init — safe to call more than once.

import Clarity from '@microsoft/clarity';

// Public project id. Not a secret — Clarity exposes it in the page snippet —
// but kept in env so it can differ per environment and stay out of source.
const PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;

let initialized = false;

// Initialise Clarity once, as early as possible. No-ops without a project id or
// outside the browser.
export function initClarity(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  if (!PROJECT_ID) return; // not configured — silently skip

  try {
    Clarity.init(PROJECT_ID);
    initialized = true;
  } catch {
    /* never let analytics setup break the app */
  }
}

// Tie the current Clarity session to a known user so recordings/heatmaps can be
// segmented by who they belong to. Safe to call repeatedly with the same id.
export function identifyClarity(
  customId: string,
  friendlyName?: string,
): void {
  if (!initialized || !customId) return;
  try {
    // (customId, customSessionId?, customPageId?, friendlyName?)
    Clarity.identify(customId, undefined, undefined, friendlyName);
  } catch {
    /* ignore */
  }
}

// Attach an arbitrary tag to the current session (e.g. the active route or the
// user's plan) for filtering inside the Clarity dashboard.
export function clarityTag(key: string, value: string | string[]): void {
  if (!initialized || !key) return;
  try {
    Clarity.setTag(key, value);
  } catch {
    /* ignore */
  }
}

// Record a named custom event (e.g. "video_generated", "upgrade_clicked").
export function clarityEvent(name: string): void {
  if (!initialized || !name) return;
  try {
    Clarity.event(name);
  } catch {
    /* ignore */
  }
}
