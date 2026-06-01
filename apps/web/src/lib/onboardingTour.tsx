// ─────────────────────────────────────────────────────────────────────────────
// Onboarding product tour (driver.js)
//
// Problem this solves: a brand-new user lands on a screen with ~14 controls and
// quietly closes the tab. This walks them through the essentials, once, with
// enough jokes that they actually read it.
//
// "Once, ever" guarantee:
//   - The source of truth is the backend flag `onboardingTourCompletedAt`
//     (survives new devices / browsers / incognito — localStorage can't).
//   - localStorage is only an optimistic cache so the tour never *flashes* on a
//     slow page load.
//
// The tour spans TWO routes (/home → /dashboard/:id). driver.js does not survive
// a route change, so it's really two sequences ("acts") stitched by a small
// progress pointer in localStorage:
//   null|"home"  → run Act 1 on /home
//   "editor"     → Act 1 finished; run Act 2 when the editor mounts
//   "done"       → fully complete; never run again
//
// Skipping (the X / Esc / overlay click) at any point ALSO marks the tour
// complete — a skip is a deliberate "I've seen enough", and the user asked that
// nobody ever sees this twice.
// ─────────────────────────────────────────────────────────────────────────────

import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import api from "@/api";
import type { IUser } from "@/State/Types";

const PROGRESS_KEY = "stitcher_onboarding_progress";
// The account that PROGRESS_KEY belongs to. Tour state is per-user, but
// localStorage is per-browser — without this, a "done" cached by one account
// would suppress the first-run tour for the next account that signs in here.
const UID_KEY = "stitcher_onboarding_uid";
// Set by startReplayTour() to arm Act 2 to auto-run the next time the editor
// mounts, so a home-initiated "Take the tour" spans both routes like a real
// first run. Value "act2" = armed.
const REPLAY_KEY = "stitcher_onboarding_replay";
type Progress = "home" | "editor" | "done";

// ─── State helpers ───────────────────────────────────────────────────────────

function getStoredUser(): IUser | null {
  try {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as IUser) : null;
  } catch {
    return null;
  }
}

/** The id of the account currently cached in localStorage (tour state is per-user). */
function currentUid(): string | null {
  const id = getStoredUser()?._id;
  return id ? String(id) : null;
}

function getProgress(): Progress | null {
  // If the cached progress was written by a *different* account on this browser
  // (someone signed out and a new user signed up), it's stale — drop it so the
  // newcomer still gets their first-run tour instead of inheriting "done".
  if (localStorage.getItem(UID_KEY) !== currentUid()) {
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(UID_KEY);
    return null;
  }
  const v = localStorage.getItem(PROGRESS_KEY);
  return v === "home" || v === "editor" || v === "done" ? v : null;
}

function setProgress(p: Progress) {
  localStorage.setItem(PROGRESS_KEY, p);
  const uid = currentUid();
  if (uid) localStorage.setItem(UID_KEY, uid); // stamp the owner of this progress
}

/** True once the user has finished or skipped the tour (backend flag or cache). */
function hasCompletedTour(): boolean {
  if (getProgress() === "done") return true;
  const user = getStoredUser();
  return Boolean(user?.onboardingTourCompletedAt);
}

/**
 * Stamp the tour as complete: flips the cached user + progress immediately (so
 * the UI never re-triggers) and tells the backend (fire-and-forget — a failed
 * network call must not resurrect the tour for someone who already saw it).
 */
function markTourComplete() {
  setProgress("done");
  const user = getStoredUser();
  if (user && !user.onboardingTourCompletedAt) {
    user.onboardingTourCompletedAt = new Date().toISOString();
    try {
      localStorage.setItem("user", JSON.stringify(user));
    } catch {
      /* storage full / disabled — backend flag is still the source of truth */
    }
  }
  api.post("/users/me/onboarding/complete").catch(() => {
    /* best-effort; getUser() will return the flag on next refresh anyway */
  });
}

// ─── Small DOM helpers ───────────────────────────────────────────────────────

const exists = (selector: string) => Boolean(document.querySelector(selector));

/** Resolve once every required selector is in the DOM (or bail after a timeout). */
function waitForElements(selectors: string[], timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (selectors.every(exists)) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** A tiny, dependency-free confetti burst for the grand finale. 🎉 */
function celebrate() {
  const colors = ["#19E5A1", "#02684D", "#ffffff", "#7C3AED", "#F59E0B"];
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden;";
  for (let i = 0; i < 80; i++) {
    const bit = document.createElement("div");
    const size = 6 + Math.random() * 8;
    bit.style.cssText =
      `position:absolute;top:-12px;left:${Math.random() * 100}%;` +
      `width:${size}px;height:${size * 0.4}px;` +
      `background:${colors[i % colors.length]};border-radius:1px;opacity:.9;` +
      `transform:rotate(${Math.random() * 360}deg);` +
      `animation:stitcher-confetti ${1.6 + Math.random() * 1.4}s ${Math.random() * 0.4}s ease-in forwards;`;
    layer.appendChild(bit);
  }
  if (!document.getElementById("stitcher-confetti-kf")) {
    const style = document.createElement("style");
    style.id = "stitcher-confetti-kf";
    style.textContent =
      "@keyframes stitcher-confetti{to{transform:translateY(105vh) rotate(720deg);opacity:0;}}";
    document.head.appendChild(style);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}

// ─── Shared driver config + skip handling ────────────────────────────────────

/**
 * Build a driver instance for one act.
 * @param steps           the act's steps
 * @param onComplete      called when the user reaches the LAST step's "Done"
 * @param onSkipEarly     called when the user bails out before the end (X/Esc)
 */
function buildDriver(
  steps: DriveStep[],
  onComplete: () => void,
  onSkipEarly: () => void,
): Driver {
  const d: Driver = driver({
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next →",
    prevBtnText: "← Back",
    doneBtnText: "Let's go 🚀",
    allowClose: true, // the tour is always skippable
    // Read-only walkthrough: don't let clicks fall through to the highlighted
    // element. Otherwise tapping (say) the "Collaborators" button mid-tour opens
    // a dialog *behind* driver's overlay and traps the user. They advance with
    // the popover buttons; our programmatic openRailTab() clicks still work.
    disableActiveInteraction: true,
    overlayColor: "#000",
    overlayOpacity: 0.7,
    stagePadding: 6,
    stageRadius: 8,
    popoverClass: "stitcher-tour",
    steps,
    // onDestroyStarted fires for BOTH the final "Done" click and any early close
    // (X / Esc / overlay). isLastStep() tells the two apart.
    onDestroyStarted: () => {
      const finished = d.isLastStep();
      d.destroy();
      if (finished) onComplete();
      else onSkipEarly();
    },
  });
  return d;
}

// ─── Copy ────────────────────────────────────────────────────────────────────
// The whole point of this tour is that it does NOT read like docs. Each step is a
// reaction-cat meme + ONE short line (≤7 words). Gen-Z attention span is the spec:
// a paragraph in a popover gets skipped, a funny cat gets remembered.
//
// Every cat lives in /public/cats (served at the site root). Swapping the meme for
// any step is a one-word filename change — the full collection is in that folder.

/** Build a popover body: a reaction cat on top, one punchy line underneath. */
const cat = (file: string, line: string) =>
  `<img class="stitcher-tour-cat" src="/cats/${file}" alt="" draggable="false" />` +
  `<span class="stitcher-tour-line">${line}</span>`;

const ACT1_STEPS: DriveStep[] = [
  {
    // Centered welcome — no element. Animated Happy Cat for the warmest first hit.
    popover: {
      title: "Welcome to Stitcher 🎬",
      description: cat("happy-cat.gif", "30 seconds. Then you’re dangerous."),
      nextBtnText: "Show me →",
    },
  },
  {
    element: '[data-tour="create-project"]',
    popover: {
      title: "Step one: a project 🆕",
      description: cat("nerd-pointing.png", "Hit New Project. That’s it."),
      side: "bottom",
      align: "start",
      doneBtnText: "Let me in!",
    },
  },
];

// Act 2 lives in the editor. Some anchors are desktop-only (the left rail + the
// header "Collaborators" button collapse on mobile); buildEditorSteps() filters
// to whatever's actually on screen so the tour never points at a ghost.
function buildEditorSteps(): DriveStep[] {
  // Reveal a left-rail panel by clicking its icon button (the strip is always
  // visible; the panel content is not). Safe no-op if the button isn't there.
  const openRailTab = (id: string) => () => {
    (document.querySelector(`[data-tour="sidebar-${id}"]`) as HTMLElement | null)?.click();
  };

  const all: (DriveStep & { _need?: string })[] = [
    {
      popover: {
        title: "You’re in! 🎉",
        description: cat("headset-cockpit.png", "Your cockpit. Four buttons matter."),
        nextBtnText: "Tour it →",
      },
    },
    {
      _need: '[data-tour="timeline"]',
      element: '[data-tour="timeline"]',
      popover: {
        title: "The timeline 🎞️",
        description: cat("dancing.png", "Your video lives here."),
        side: "top",
        align: "center",
      },
    },
    {
      _need: '[data-tour="sidebar-assetstash"]',
      element: '[data-tour="sidebar-assetstash"]',
      onHighlightStarted: openRailTab("assetstash"),
      popover: {
        title: "Add stuff 🧩",
        description: cat("tongue-shaka.png", "Drag these onto the timeline."),
        side: "right",
        align: "start",
      },
    },
    {
      _need: '[data-tour="ai-chat"]',
      element: '[data-tour="ai-chat"]',
      popover: {
        title: "Generate with AI 🪄",
        description: cat("amazed-glasses.png", "Lazy? Describe it, AI builds it."),
        side: "left",
        align: "start",
      },
    },
    {
      _need: '[data-tour="sidebar-memory"]',
      element: '[data-tour="sidebar-memory"]',
      onHighlightStarted: openRailTab("memory"),
      popover: {
        title: "Memory 🧠",
        description: cat("thinking-suit-dog.png", "It remembers so you don’t repeat."),
        side: "right",
        align: "start",
      },
    },
    {
      _need: '[data-tour="collaborators"]',
      element: '[data-tour="collaborators"]',
      popover: {
        title: "Bring the squad 👥",
        description: cat("rock-on-hype.png", "Invite friends. See live cursors."),
        side: "bottom",
        align: "end",
      },
    },
    {
      popover: {
        title: "That’s the tour 🎓",
        description: cat("empty-wallet.png", "Now go make something gorgeous."),
        doneBtnText: "Let’s go 🚀",
      },
    },
  ];

  // Drop steps whose anchor element isn't present (mobile / hidden rails).
  return all
    .filter((s) => !s._need || exists(s._need))
    .map(({ _need, ...step }) => step);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call from the /home screen. Runs Act 1 (welcome + "create a project") once.
 * Finishing advances progress to "editor"; skipping ends the whole tour.
 */
export async function maybeRunHomeTour() {
  if (hasCompletedTour()) return;
  // If Act 1 is already behind us (progress === "editor"), don't replay it —
  // the user is between acts, waiting to land in the editor.
  if (getProgress() === "editor") return;

  const ready = await waitForElements(['[data-tour="create-project"]']);
  if (!ready) return; // anchor never showed up (e.g. odd layout) — skip silently

  const d = buildDriver(
    ACT1_STEPS,
    () => setProgress("editor"), // finished Act 1 → wait for the editor
    () => markTourComplete(), // skipped → never show again
  );
  d.drive();
}

/**
 * Call from the editor (/dashboard/:id) once the project has loaded. Runs Act 2.
 * Runs when the user finished Act 1 (progress "editor") OR landed here directly
 * without ever seeing /home (progress null). Finishing or skipping completes it.
 */
export async function maybeRunEditorTour() {
  // A home-initiated "Take the tour" arms Act 2 to run here once, regardless of
  // whether the user already finished onboarding. Checked before the gate below.
  if (localStorage.getItem(REPLAY_KEY) === "act2") {
    localStorage.removeItem(REPLAY_KEY);
    return replayEditorTour();
  }
  if (hasCompletedTour()) return;
  const progress = getProgress();
  if (progress !== "editor" && progress !== "home" && progress !== null) return;

  // The timeline is the one anchor that must exist for Act 2 to be worth running.
  const ready = await waitForElements(['[data-tour="timeline"]']);
  if (!ready) return;

  const steps = buildEditorSteps();
  if (steps.length === 0) return;

  const finish = () => {
    markTourComplete();
    celebrate();
  };
  const d = buildDriver(steps, finish, () => markTourComplete());
  d.drive();
}

/**
 * Force-run the editor walkthrough (Act 2) on demand, e.g. from a "Replay tour"
 * menu item — for users who want a refresher, and for us while testing.
 *
 * Unlike maybeRunEditorTour(), this ignores the "already completed" gate and
 * deliberately does NOT mutate completion state: replaying a finished tour must
 * not un-complete it, and finishing the replay must not re-stamp the backend.
 * Confetti still fires on the last step — a replay should feel just as fun.
 */
export async function replayEditorTour() {
  const ready = await waitForElements(['[data-tour="timeline"]']);
  if (!ready) return;

  const steps = buildEditorSteps();
  if (steps.length === 0) return;

  const d = buildDriver(steps, celebrate, () => {});
  d.drive();
}

/**
 * Replay the FULL tour from /home — wired to the "Take the tour" quick action.
 * Runs Act 1 now; finishing it arms Act 2 (REPLAY_KEY) so the editor walkthrough
 * fires the next time the user opens a project, mirroring the real first run.
 * Ignores the "completed" gate and never mutates completion state.
 */
export async function startReplayTour() {
  const ready = await waitForElements(['[data-tour="create-project"]']);
  if (!ready) return;

  const d = buildDriver(
    ACT1_STEPS,
    () => localStorage.setItem(REPLAY_KEY, "act2"), // arm the editor leg
    () => localStorage.removeItem(REPLAY_KEY),      // bailed early — disarm
  );
  d.drive();
}
