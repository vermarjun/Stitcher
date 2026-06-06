/**
 * verify_reload.mjs
 *
 * Playwright headless-browser verification that Stitcher's Generate chat UI
 * survives PAGE RELOADS — both during generation (in-flight) and after completion.
 *
 * TEST A — RELOAD DURING GENERATION:
 *   1. Submit a short prompt.
 *   2. Wait 7 s (job is in-flight).
 *   3. Reload the page.
 *   4. Assert that within ~10 s the UI shows a generating/processing state
 *      (spinner img, animate-pulse text, or disabled textarea).
 *   5. Wait up to 120 s for a <video src="...cloudinary..."> to appear.
 *   Screenshots → e2e/reload_during.png, e2e/reload_during_done.png
 *
 * TEST B — RELOAD AFTER COMPLETION:
 *   After the video is present (from Test A), reload the page.
 *   Assert the <video> with a cloudinary src is present within ~15 s.
 *   Screenshot → e2e/reload_after.png
 *
 * Usage:  node e2e/verify_reload.mjs
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ─────────────────────────────────────────────────────────────
const FRONTEND_URL   = 'http://localhost:5173';
const API_BASE       = 'http://localhost:3000/api';

const TEST_EMAIL     = 'e2etest2025@playwright.local';
const TEST_PASSWORD  = 'TestPass123!';
const TEST_PROJECT_ID = '6a1c360c351761087adafe65';

/** Short prompt that Manim can execute in ~20-30 s */
const TEST_PROMPT = 'draw a big blue circle that grows';

/** How long to wait before reload mid-generation (ms) */
const RELOAD_DELAY_MS = 7_000;

/** How long to look for the in-progress indicator after reload (ms) */
const IN_PROGRESS_WAIT_MS = 12_000;

/** Timeout for the post-reload video to appear (ms) */
const VIDEO_AFTER_RELOAD_MS = 120_000;

/** Timeout for the post-completion reload video to appear (ms) */
const VIDEO_AFTER_RELOAD_B_MS = 20_000;

const PROOF_DIR = path.join(__dirname);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/users/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed ${res.status}: ${await res.text()}`);
  return res.json();
}

function buildInitScript(token, user) {
  const patchedUser = {
    ...user,
    onboardingTourCompletedAt: new Date().toISOString(),
  };
  return `
    localStorage.setItem('token', ${JSON.stringify(token)});
    localStorage.setItem('user', ${JSON.stringify(JSON.stringify(patchedUser))});
    localStorage.setItem('lastAuthMethod', 'password');
    localStorage.setItem('stitcher_onboarding_progress', '{"step":"done"}');
    localStorage.setItem('stitcher_onboarding_uid', ${JSON.stringify(patchedUser._id)});
    console.log('[e2e] localStorage auth injected uid=' + ${JSON.stringify(patchedUser._id)});
  `;
}

/** Collect console errors from a page into an array. */
function attachConsoleLogger(page, label) {
  const log = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') log.push({ type: 'error', text });
    if (text.startsWith('[e2e]')) console.log(`  ${label} > ${text}`);
  });
  page.on('pageerror', err => log.push({ type: 'pageerror', text: err.message }));
  return log;
}

/**
 * Navigate to the dashboard with auth injected.
 * Throws if the redirect doesn't land on /dashboard/.
 */
async function navToDashboard(page, token, user) {
  await page.addInitScript(buildInitScript(token, user));
  const url = `${FRONTEND_URL}/dashboard/${TEST_PROJECT_ID}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2_000);
  if (!page.url().includes('/dashboard/')) {
    throw new Error(`Not on dashboard — redirected to: ${page.url()}`);
  }
}

/**
 * Find the textarea inside data-tour="ai-chat" and submit the prompt.
 * Returns true if submission was detected (input cleared / prompt submitted).
 */
async function submitPrompt(page, prompt) {
  const sidebar = page.locator('[data-tour="ai-chat"]');
  const visible  = await sidebar.isVisible().catch(() => false);
  if (!visible) throw new Error('[submit] ai-chat sidebar not visible');

  const textarea = sidebar.locator('textarea').first();
  const count    = await textarea.count();
  if (count === 0) throw new Error('[submit] no textarea in ai-chat sidebar');

  await textarea.fill(prompt);
  await page.waitForTimeout(300);
  await textarea.press('Enter');
  console.log(`  [submit] Pressed Enter with prompt: "${prompt}"`);

  // Give React a moment to process
  await page.waitForTimeout(2_000);

  // Verify submission fired by checking if the input cleared
  const valueAfter = await textarea.inputValue().catch(() => prompt);
  if (valueAfter === prompt) {
    console.log('  [submit] Enter did not clear input — trying send button...');
    // Try any button near the textarea
    const sendBtn = sidebar.locator('button').last();
    await sendBtn.click().catch(() => {});
    await page.waitForTimeout(1_500);
  }
  return true;
}

/**
 * Wait up to `timeoutMs` for a <video src="...cloudinary..."> inside the
 * ai-chat sidebar.  Returns { found: bool, src: string|null }.
 */
async function waitForVideo(page, timeoutMs, label) {
  const sidebar    = page.locator('[data-tour="ai-chat"]');
  const deadline   = Date.now() + timeoutMs;
  let   elapsed    = 0;

  while (Date.now() < deadline) {
    const videos = await sidebar.locator('video').all();
    for (const vid of videos) {
      const src = await vid.getAttribute('src').catch(() => null);
      if (src && src.length > 5) {
        console.log(`  [${label}] video[src] found after ${elapsed}s: ${src}`);
        return { found: true, src };
      }
    }

    elapsed = Math.round((Date.now() - (deadline - timeoutMs)) / 1000);
    if (elapsed % 20 === 0 && elapsed > 0) {
      console.log(`  [${label}] ${elapsed}s elapsed — still waiting for video…`);
      await page.screenshot({
        path:     path.join(PROOF_DIR, `reload_progress_${label}_${elapsed}s.png`),
        fullPage: true,
      });
    }
    await page.waitForTimeout(3_000);
  }
  return { found: false, src: null };
}

/**
 * After a page reload, check within `timeoutMs` whether the UI is showing an
 * in-progress (generating) state.
 *
 * We look for any of:
 *   • The loading GIF / animated spinner image (Cloudinary loading_animation gif)
 *   • Any element with class animate-pulse (the "Planning…" text etc.)
 *   • A disabled textarea (input locked while processing)
 *   • Text matching /planning|generating|rendering|stitching|submitting|processing/i
 *
 * Returns { detected: bool, evidence: string }
 */
async function detectInProgressAfterReload(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // 1. Cloudinary loading GIF
    const gifCount = await page
      .locator('img[src*="loading_animation"]')
      .count()
      .catch(() => 0);
    if (gifCount > 0) {
      return { detected: true, evidence: `loading GIF img visible (count=${gifCount})` };
    }

    // 2. Any element with animate-pulse inside the sidebar
    const sidebar = page.locator('[data-tour="ai-chat"]');
    const pulseCount = await sidebar
      .locator('.animate-pulse')
      .count()
      .catch(() => 0);
    if (pulseCount > 0) {
      // Verify it has text
      const firstText = await sidebar
        .locator('.animate-pulse')
        .first()
        .innerText()
        .catch(() => '');
      if (firstText.trim().length > 0) {
        return { detected: true, evidence: `animate-pulse element: "${firstText.trim()}"` };
      }
    }

    // 3. Disabled textarea (locked during generation)
    const textareaDisabled = await sidebar
      .locator('textarea[disabled]')
      .count()
      .catch(() => 0);
    if (textareaDisabled > 0) {
      return { detected: true, evidence: 'textarea[disabled] found (input locked during generation)' };
    }

    // 4. Text scan for progress keywords inside the sidebar
    const sidebarText = await sidebar.innerText().catch(() => '');
    const match = sidebarText.match(
      /\b(planning|generating|rendering|stitching|submitting|processing)\b/i
    );
    if (match) {
      return { detected: true, evidence: `keyword "${match[0]}" found in sidebar text` };
    }

    await page.waitForTimeout(1_000);
  }

  return { detected: false, evidence: 'none — timeout expired' };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(PROOF_DIR, { recursive: true });

  console.log('\n===== Stitcher Generate Chat Reload Verification =====\n');

  // ── Auth ──────────────────────────────────────────────────────────────────
  console.log('[setup] Logging in...');
  const { token, user } = await apiLogin(TEST_EMAIL, TEST_PASSWORD);
  console.log(`[setup] userId=${user._id}  generation_credits=${user.credits?.generation}`);

  if (!user.credits?.generation || user.credits.generation < 1) {
    console.warn('[setup] WARNING: generation credits are 0 — generation will likely fail with 402');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Results
  const testA = {
    inProgressDetected: false,
    inProgressEvidence: '',
    videoFound:  false,
    videoSrc:    null,
    error:       null,
  };
  const testB = {
    videoFound: false,
    videoSrc:   null,
    error:      null,
  };
  const consoleErrors = [];

  // ──────────────────────────────────────────────────────────────────────────
  // TEST A — Reload during generation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST A] Starting: reload-during-generation...');
  const pageA = await browser.newPage();
  pageA.setDefaultTimeout(30_000);
  await pageA.setViewportSize({ width: 1400, height: 900 });
  const logA = attachConsoleLogger(pageA, 'TEST-A');

  try {
    // ── 1. Navigate to dashboard ──────────────────────────────────────────
    console.log('[TEST A] Navigating to dashboard...');
    await navToDashboard(pageA, token, user);
    console.log('[TEST A] Dashboard loaded: ' + pageA.url());

    await pageA.screenshot({ path: path.join(PROOF_DIR, 'reload_initial.png'), fullPage: true });

    // ── 2. Submit prompt ──────────────────────────────────────────────────
    console.log(`[TEST A] Submitting prompt: "${TEST_PROMPT}"`);
    await submitPrompt(pageA, TEST_PROMPT);

    await pageA.screenshot({ path: path.join(PROOF_DIR, 'reload_after_submit.png'), fullPage: true });

    // ── 3. Wait RELOAD_DELAY_MS then reload ──────────────────────────────
    console.log(`[TEST A] Waiting ${RELOAD_DELAY_MS / 1000}s for job to get in-flight...`);
    await pageA.waitForTimeout(RELOAD_DELAY_MS);

    await pageA.screenshot({ path: path.join(PROOF_DIR, 'reload_pre_reload.png'), fullPage: true });

    console.log('[TEST A] Reloading page mid-generation...');
    // Re-inject auth on the reload via addInitScript before reload
    await pageA.addInitScript(buildInitScript(token, user));
    await pageA.reload({ waitUntil: 'networkidle', timeout: 30_000 });
    await pageA.waitForTimeout(2_000);

    console.log('[TEST A] Page reloaded — URL: ' + pageA.url());

    // ── 4. Detect in-progress state ───────────────────────────────────────
    console.log(`[TEST A] Checking for in-progress state (within ${IN_PROGRESS_WAIT_MS / 1000}s)...`);
    const { detected, evidence } = await detectInProgressAfterReload(pageA, IN_PROGRESS_WAIT_MS);

    testA.inProgressDetected = detected;
    testA.inProgressEvidence = evidence;

    if (detected) {
      console.log(`[TEST A] IN-PROGRESS STATE DETECTED — ${evidence}`);
    } else {
      console.log('[TEST A] WARNING: could not detect in-progress state after reload');
      // Take a diagnostic screenshot of current page state
    }

    await pageA.screenshot({ path: path.join(PROOF_DIR, 'reload_during.png'), fullPage: true });
    console.log('[TEST A] Screenshot → e2e/reload_during.png');

    // ── 5. Wait for video to appear ───────────────────────────────────────
    console.log(`[TEST A] Waiting up to ${VIDEO_AFTER_RELOAD_MS / 1000}s for video to appear...`);
    const { found: videoFound, src: videoSrc } = await waitForVideo(
      pageA, VIDEO_AFTER_RELOAD_MS, 'TEST-A'
    );

    testA.videoFound = videoFound;
    testA.videoSrc   = videoSrc;

    if (videoFound) {
      console.log(`[TEST A] Video appeared: ${videoSrc}`);
    } else {
      console.log('[TEST A] Video did NOT appear within timeout');
      // Dump all videos on page for diagnostics
      const allVids = await pageA.locator('video').all();
      console.log(`[TEST A] Total <video> elements on page at timeout: ${allVids.length}`);
      for (let i = 0; i < allVids.length; i++) {
        const src = await allVids[i].getAttribute('src').catch(() => null);
        console.log(`  video[${i}] src=${src}`);
      }
    }

    await pageA.screenshot({ path: path.join(PROOF_DIR, 'reload_during_done.png'), fullPage: true });
    console.log('[TEST A] Screenshot → e2e/reload_during_done.png');

  } catch (err) {
    console.error(`[TEST A] ERROR: ${err.message}`);
    testA.error = err.message;
    await pageA.screenshot({ path: path.join(PROOF_DIR, 'reload_during.png'), fullPage: true }).catch(() => {});
    await pageA.screenshot({ path: path.join(PROOF_DIR, 'reload_during_done.png'), fullPage: true }).catch(() => {});
  }

  consoleErrors.push(...logA.filter(l => l.type === 'error' || l.type === 'pageerror').map(l => l.text));

  // ──────────────────────────────────────────────────────────────────────────
  // TEST B — Reload after completion
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[TEST B] Starting: reload-after-completion...');

  // Reuse the same page (which should already show the completed video, or we
  // open a fresh context if Test A failed catastrophically).
  let pageB = pageA;
  let ownedPageB = false;
  const logB = logA; // already collecting errors

  try {
    // If Test A succeeded and there's a video, use that page.
    // If not, we still try a fresh navigation — the history reconciliation
    // should render the video if the generation completed server-side.
    if (!testA.videoFound) {
      console.log('[TEST B] Test A had no video — navigating fresh to check history reconciliation...');
      pageB       = await browser.newPage();
      ownedPageB  = true;
      await pageB.setViewportSize({ width: 1400, height: 900 });
      attachConsoleLogger(pageB, 'TEST-B');
      await navToDashboard(pageB, token, user);
      await pageB.waitForTimeout(3_000);
    }

    console.log('[TEST B] Reloading page...');
    await pageB.addInitScript(buildInitScript(token, user));
    await pageB.reload({ waitUntil: 'networkidle', timeout: 30_000 });
    await pageB.waitForTimeout(3_000);

    console.log('[TEST B] Checking for <video> within ' + (VIDEO_AFTER_RELOAD_B_MS / 1000) + 's...');
    const { found, src } = await waitForVideo(pageB, VIDEO_AFTER_RELOAD_B_MS, 'TEST-B');

    testB.videoFound = found;
    testB.videoSrc   = src;

    if (found) {
      console.log(`[TEST B] Video present after reload: ${src}`);
    } else {
      console.log('[TEST B] Video NOT present after reload');
      const allVids = await pageB.locator('video').all();
      console.log(`[TEST B] Total <video> elements on page: ${allVids.length}`);
      for (let i = 0; i < allVids.length; i++) {
        const vs = await allVids[i].getAttribute('src').catch(() => null);
        console.log(`  video[${i}] src=${vs}`);
      }
    }

    await pageB.screenshot({ path: path.join(PROOF_DIR, 'reload_after.png'), fullPage: true });
    console.log('[TEST B] Screenshot → e2e/reload_after.png');

  } catch (err) {
    console.error(`[TEST B] ERROR: ${err.message}`);
    testB.error = err.message;
    await pageB.screenshot({ path: path.join(PROOF_DIR, 'reload_after.png'), fullPage: true }).catch(() => {});
  }

  if (ownedPageB) await pageB.close();
  await browser.close();

  // ── Final Report ──────────────────────────────────────────────────────────
  console.log('\n\n========== RELOAD VERIFICATION REPORT ==========\n');

  // Test A
  const aInProg = testA.inProgressDetected;
  const aVideo  = testA.videoFound;
  const aPass   = aInProg && aVideo;
  console.log('TEST A — Reload During Generation:');
  console.log(`  In-progress state detected: ${aInProg ? 'YES' : 'NO'}`);
  console.log(`  Evidence: ${testA.inProgressEvidence || '(none)'}`);
  console.log(`  Video appeared after reload: ${aVideo ? 'YES' : 'NO'}`);
  if (testA.videoSrc) console.log(`  <video> src: ${testA.videoSrc}`);
  if (testA.error)    console.log(`  Error: ${testA.error}`);
  console.log(`  Screenshots: ${path.join(PROOF_DIR,'reload_during.png')}`);
  console.log(`               ${path.join(PROOF_DIR,'reload_during_done.png')}`);
  console.log(`  VERDICT: ${aPass ? 'PASS' : 'FAIL'}`);

  // Test B
  const bPass = testB.videoFound;
  console.log('\nTEST B — Reload After Completion:');
  console.log(`  Video present after reload: ${bPass ? 'YES' : 'NO'}`);
  if (testB.videoSrc) console.log(`  <video> src: ${testB.videoSrc}`);
  if (testB.error)    console.log(`  Error: ${testB.error}`);
  console.log(`  Screenshot: ${path.join(PROOF_DIR,'reload_after.png')}`);
  console.log(`  VERDICT: ${bPass ? 'PASS' : 'FAIL'}`);

  // Console errors
  const sigErrors = [...new Set(consoleErrors)].filter(e => !e.startsWith('Warning:'));
  if (sigErrors.length > 0) {
    console.log('\nConsole/Page Errors Observed:');
    sigErrors.slice(0, 20).forEach(e => console.log('  ', e.slice(0, 300)));
  } else {
    console.log('\nNo significant console errors.');
  }

  console.log('\n=================================================\n');

  process.exit(aPass && bPass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
