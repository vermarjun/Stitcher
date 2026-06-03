// Lightweight, privacy-respecting first-party product analytics.
//
// Emits user-behaviour events (page views, active-time heartbeats, discrete
// actions, session ends) to the backend so the admin dashboard can show
// sessions, time-on-platform, per-page/section engagement, DAU and recurrent
// users.
//
// Design rules (do not break):
//  - No new npm deps. Uses crypto.randomUUID, navigator.sendBeacon and the
//    project's axios instance.
//  - Never throws into the app, never blocks render, never logs noisily. Every
//    failure is swallowed.
//  - This is first-party product analytics, so we track even under DNT; we just
//    keep it lightweight.

import api from '@/api';

// --- types -----------------------------------------------------------------

type EventType = 'page_view' | 'heartbeat' | 'action' | 'session_end';

interface AnalyticsEvent {
  type: EventType;
  page: string;
  section?: string;
  action?: string;
  durationMs?: number;
  ts?: number;
  meta?: Record<string, unknown>;
}

interface AnalyticsPayload {
  anonId: string;
  sessionId: string;
  events: AnalyticsEvent[];
}

// --- constants -------------------------------------------------------------

const ANON_KEY = 'st_anon_id';
const SESSION_KEY = 'st_session_id';
const SESSION_LAST_ACTIVITY_KEY = 'st_session_last_activity';

const COLLECT_PATH = '/analytics/collect';

const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min gap => new session
const HEARTBEAT_INTERVAL_MS = 15 * 1000; // emit a beat every 15s
const HEARTBEAT_DURATION_MS = 15 * 1000; // each beat counts 15s of active time
const ACTIVITY_WINDOW_MS = 30 * 1000; // user must have acted within last 30s
const FLUSH_INTERVAL_MS = 10 * 1000; // periodic flush cadence
const FLUSH_AT_COUNT = 20; // flush eagerly at this many buffered events
const MAX_BUFFER = 50; // hard cap; never send more than this per batch

// --- safe storage helpers --------------------------------------------------
// localStorage / sessionStorage can throw (private mode, blocked cookies); wrap
// everything so analytics can never crash the host app.

function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store ? store.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(store: Storage | undefined, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  // Extremely defensive fallback; should rarely run in supported browsers.
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// --- identity --------------------------------------------------------------

function getAnonId(): string {
  const ls = typeof window !== 'undefined' ? window.localStorage : undefined;
  let id = safeGet(ls, ANON_KEY);
  if (!id) {
    id = uuid();
    safeSet(ls, ANON_KEY, id);
  }
  return id;
}

function getSessionId(): string {
  const ss = typeof window !== 'undefined' ? window.sessionStorage : undefined;
  const now = Date.now();
  const last = Number(safeGet(ss, SESSION_LAST_ACTIVITY_KEY)) || 0;
  let id = safeGet(ss, SESSION_KEY);

  // Rotate the session if there's no id yet or the idle gap is too large.
  if (!id || now - last > SESSION_IDLE_MS) {
    id = uuid();
    safeSet(ss, SESSION_KEY, id);
  }
  safeSet(ss, SESSION_LAST_ACTIVITY_KEY, String(now));
  return id;
}

function touchSession(): void {
  const ss = typeof window !== 'undefined' ? window.sessionStorage : undefined;
  safeSet(ss, SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
}

// --- section derivation ----------------------------------------------------

function sectionFromPath(path: string): string {
  const seg = (path || '/').split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  switch (seg) {
    case '':
    case 'home':
      return 'home';
    case 'dashboard':
      return 'dashboard';
    case 'community':
      return 'community';
    case 'auth':
    case 'login':
    case 'signup':
      return 'auth';
    case 'settings':
      return 'settings';
    default:
      return seg;
  }
}

// --- module state ----------------------------------------------------------

let initialized = false;
let buffer: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

let lastActivityAt = Date.now(); // last user interaction (mouse/key/scroll/click)
let activeSinceLastBeatMs = 0; // active ms accumulated since the last heartbeat
let currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

// --- queue + flush ---------------------------------------------------------

function enqueue(ev: AnalyticsEvent): void {
  if (!ev.ts) ev.ts = Date.now();
  buffer.push(ev);
  // Keep only the most recent events if we somehow overflow.
  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(buffer.length - MAX_BUFFER);
  }
  if (buffer.length >= FLUSH_AT_COUNT) flush();
}

function buildPayload(events: AnalyticsEvent[]): AnalyticsPayload {
  return {
    anonId: getAnonId(),
    sessionId: getSessionId(),
    events: events.slice(0, MAX_BUFFER),
  };
}

// Normal (non-exit) flush via axios. Best-effort; failures are swallowed.
function flush(): void {
  if (buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  try {
    void api.post(COLLECT_PATH, buildPayload(events)).catch(() => {
      /* drop silently */
    });
  } catch {
    /* drop silently */
  }
}

// Resolve the absolute collect URL from the axios baseURL so sendBeacon can
// reach the same endpoint the axios instance would.
function collectUrl(): string {
  const base = (api.defaults.baseURL || '').replace(/\/$/, '');
  return `${base}${COLLECT_PATH}`;
}

// Exit flush: prefer sendBeacon so the request survives unload. Appends a
// session_end event carrying the active ms accumulated since the last beat.
function flushOnExit(): void {
  const events = buffer.slice();
  buffer = [];

  if (activeSinceLastBeatMs > 0) {
    events.push({
      type: 'session_end',
      page: currentPath,
      section: sectionFromPath(currentPath),
      durationMs: activeSinceLastBeatMs,
      ts: Date.now(),
    });
    activeSinceLastBeatMs = 0;
  }

  if (events.length === 0) return;

  const payload = buildPayload(events);

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const ok = navigator.sendBeacon(collectUrl(), blob);
      if (ok) return;
    }
  } catch {
    /* fall through to axios */
  }

  // Fallback: normal axios flush (may not complete on hard unload, best effort).
  try {
    void api.post(COLLECT_PATH, payload).catch(() => {
      /* drop silently */
    });
  } catch {
    /* drop silently */
  }
}

// --- public API ------------------------------------------------------------

export function trackPageView(path: string): void {
  if (!path) return;
  currentPath = path;
  touchSession();
  enqueue({
    type: 'page_view',
    page: path,
    section: sectionFromPath(path),
  });
}

export function trackAction(action: string, meta?: Record<string, unknown>): void {
  if (!action) return;
  enqueue({
    type: 'action',
    page: currentPath,
    section: sectionFromPath(currentPath),
    action,
    meta,
  });
}

// --- internals: activity + heartbeats --------------------------------------

function markActivity(): void {
  lastActivityAt = Date.now();
  touchSession();
}

function onHeartbeat(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const recentlyActive = Date.now() - lastActivityAt <= ACTIVITY_WINDOW_MS;
  if (!recentlyActive) return;

  activeSinceLastBeatMs += HEARTBEAT_DURATION_MS;
  enqueue({
    type: 'heartbeat',
    page: currentPath,
    section: sectionFromPath(currentPath),
    durationMs: HEARTBEAT_DURATION_MS,
  });
  // The accumulated active-ms is represented by emitted heartbeats; reset so the
  // session_end on exit only carries the tail not yet covered by a beat.
  activeSinceLastBeatMs = 0;
}

function onVisibilityChange(): void {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    // Tab is going away — flush whatever we have so nothing is lost.
    flushOnExit();
  }
}

// --- init ------------------------------------------------------------------

export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  initialized = true;

  try {
    // Establish identity up front (creates ids if missing).
    getAnonId();
    getSessionId();
    currentPath = window.location.pathname;

    // Passive activity listeners — used only to decide whether heartbeats count.
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('mousemove', markActivity, opts);
    window.addEventListener('keydown', markActivity, opts);
    window.addEventListener('scroll', markActivity, opts);
    window.addEventListener('click', markActivity, opts);

    // Periodic flush + heartbeat intervals (single shared timers).
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
    heartbeatTimer = setInterval(onHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Flush on tab hide / unload so exit events survive.
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flushOnExit);
  } catch {
    /* never let init break the app */
  }
}

// Exposed for completeness / potential teardown in tests; not required by the app.
export function _stopAnalytics(): void {
  if (flushTimer) clearInterval(flushTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  flushTimer = null;
  heartbeatTimer = null;
  initialized = false;
}
