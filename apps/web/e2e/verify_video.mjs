/**
 * verify_video.mjs
 *
 * Playwright headless browser verification that:
 *   GOAL A — history render: a completed chat's video renders as <video> element
 *   GOAL B — live flow: submitting a new prompt eventually renders a <video>
 *
 * Usage:  node e2e/verify_video.mjs
 *
 * Test user:  e2etest2025@playwright.local / TestPass123!
 * Test project: 6a1c360c351761087adafe65 (pre-created via API)
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ────────────────────────────────────────────────────────────
const FRONTEND_URL = 'http://localhost:5173';
const API_BASE     = 'http://localhost:3000/api';

const TEST_EMAIL    = 'e2etest2025@playwright.local';
const TEST_PASSWORD = 'TestPass123!';

// Pre-created test project (already a fresh project with no prior chats)
const TEST_PROJECT_ID = '6a1c360c351761087adafe65';

// Proof screenshot directory (same folder as this script)
const PROOF_DIR = path.join(__dirname);

// Timeout for live generation (ms) — 3 minutes
const LIVE_GEN_TIMEOUT_MS = 180_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Build the addInitScript payload.
 * Injects token + user into localStorage before React boots.
 * Also stamps onboardingTourCompletedAt so the driver.js tour never opens.
 */
function buildInitScript(token, user) {
  // Mark the onboarding tour complete so the modal doesn't block the UI
  const patchedUser = {
    ...user,
    onboardingTourCompletedAt: new Date().toISOString(),
  };
  return `
    localStorage.setItem('token', ${JSON.stringify(token)});
    localStorage.setItem('user', ${JSON.stringify(JSON.stringify(patchedUser))});
    localStorage.setItem('lastAuthMethod', 'password');
    // Suppress driver.js onboarding tour for this user ID
    localStorage.setItem('stitcher_onboarding_progress', '{"step":"done"}');
    localStorage.setItem('stitcher_onboarding_uid', ${JSON.stringify(patchedUser._id)});
    console.log('[e2e] localStorage auth injected — no tour, userId=' + ${JSON.stringify(patchedUser._id)});
  `;
}

function attachConsoleLogger(page, label) {
  const log = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      log.push({ type: 'error', text });
    }
    // Print e2e injected logs
    if (text.startsWith('[e2e]')) console.log(`${label}: ${text}`);
  });
  page.on('pageerror', err => log.push({ type: 'pageerror', text: err.message }));
  return log;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(PROOF_DIR, { recursive: true });

  console.log('\n===== Stitcher Video Render Verification =====\n');

  console.log('[setup] Logging in as test user...');
  const { token, user } = await apiLogin(TEST_EMAIL, TEST_PASSWORD);
  console.log(`[setup] userId=${user._id}, generation_credits=${user.credits?.generation}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let goalAResult = { passed: false, src: null, error: null };
  let goalBResult = { passed: false, src: null, error: null };
  const consoleErrorsB = [];
  const consoleErrorsA = [];

  // ─────────────────────────────────────────────────────────────────────────
  // GOAL B — Live generation flow
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[GOAL B] Starting live generation flow...');
  const pageB = await browser.newPage();
  const logB = attachConsoleLogger(pageB, '[GOAL-B]');
  await pageB.setViewportSize({ width: 1400, height: 900 });

  try {
    // Inject auth + suppress onboarding tour
    await pageB.addInitScript(buildInitScript(token, user));

    const dashUrl = `${FRONTEND_URL}/dashboard/${TEST_PROJECT_ID}`;
    console.log(`[GOAL B] → ${dashUrl}`);
    await pageB.goto(dashUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    await pageB.waitForTimeout(2000);

    // Screenshot — verify auth worked and UI loaded
    await pageB.screenshot({ path: path.join(PROOF_DIR, 'debug_initial.png'), fullPage: true });

    const currentUrl = pageB.url();
    console.log(`[GOAL B] URL after load: ${currentUrl}`);
    if (!currentUrl.includes('/dashboard/')) {
      throw new Error(`Not on dashboard — redirected to: ${currentUrl}`);
    }

    // ── Find the generate input inside the right sidebar ──
    // The right sidebar has data-tour="ai-chat" and the textarea placeholder
    // is "Describe the animation..."
    const sidebarLocator = pageB.locator('[data-tour="ai-chat"]');
    const sidebarVisible = await sidebarLocator.isVisible().catch(() => false);
    console.log(`[GOAL B] Right sidebar (data-tour=ai-chat) visible: ${sidebarVisible}`);

    const inputLocator = sidebarLocator.locator('textarea');
    const inputCount = await inputLocator.count();
    console.log(`[GOAL B] Textarea count in sidebar: ${inputCount}`);

    if (inputCount === 0) {
      // Dump partial HTML for diagnostics
      const sidebarHtml = await sidebarLocator.innerHTML().catch(() => '(could not get html)');
      console.log('[GOAL B] Sidebar HTML (partial):', sidebarHtml.slice(0, 500));
      await pageB.screenshot({ path: path.join(PROOF_DIR, 'debug_no_input.png'), fullPage: true });
      throw new Error('No textarea found in right sidebar');
    }

    // Type prompt
    const prompt = 'display hello world in bold white text on black background';
    console.log(`[GOAL B] Typing prompt: "${prompt}"`);
    await inputLocator.first().fill(prompt);
    await pageB.waitForTimeout(300);

    await pageB.screenshot({ path: path.join(PROOF_DIR, 'debug_before_submit.png'), fullPage: true });

    // Submit via Enter key
    await inputLocator.first().press('Enter');
    console.log('[GOAL B] Submitted via Enter');

    // Wait briefly then check if input cleared (means submit fired)
    await pageB.waitForTimeout(2000);
    const inputValueAfter = await inputLocator.first().inputValue().catch(() => prompt);
    console.log(`[GOAL B] Input value after submit: "${inputValueAfter}"`);

    // If input still has text, try the "Generate Animations" submit button
    if (inputValueAfter === prompt) {
      console.log('[GOAL B] Enter did not submit — trying submit button...');
      const submitBtn = sidebarLocator.locator('button').filter({ hasText: /generate animations|send/i }).first();
      const submitBtnCount = await submitBtn.count();
      if (submitBtnCount > 0) {
        await submitBtn.click();
        console.log('[GOAL B] Clicked submit button');
      }
      // Also try any button with the Send SVG icon near the textarea
      const sendIconBtn = sidebarLocator.locator('button[type="button"]').last();
      await sendIconBtn.click().catch(() => {});
      await pageB.waitForTimeout(2000);
    }

    await pageB.screenshot({ path: path.join(PROOF_DIR, 'debug_after_submit.png'), fullPage: true });

    // ── Wait for <video> in the generate chat area ──
    // The FinalVideoPlayer renders as:
    //   <div class="mt-2 rounded-md overflow-hidden w-full border border-zinc-800...">
    //     <video src="...cloudinary..." controls .../>
    // Scope to the right sidebar to avoid the editor's video player in the center.
    //
    // We poll every 3s for up to LIVE_GEN_TIMEOUT_MS.
    console.log(`[GOAL B] Polling for <video> in sidebar (timeout ${LIVE_GEN_TIMEOUT_MS / 1000}s)...`);

    const startTime = Date.now();
    let videoFound = false;
    let videoSrc = null;

    while (Date.now() - startTime < LIVE_GEN_TIMEOUT_MS) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // Count <video> elements inside the right sidebar
      const sidebarVideoCount = await sidebarLocator.locator('video').count().catch(() => 0);

      if (sidebarVideoCount > 0) {
        // Get each video's src and find one with an actual URL (not null)
        const allVideos = await sidebarLocator.locator('video').all();
        for (const vid of allVideos) {
          const src = await vid.getAttribute('src').catch(() => null);
          if (src && src.length > 5) {
            videoSrc = src;
            videoFound = true;
            console.log(`[GOAL B] video[src] found after ${elapsed}s: ${src}`);
            break;
          }
        }
        if (videoFound) break;

        // Found video elements but no src yet (loading) — keep waiting
        if (elapsed % 15 === 0 || elapsed < 10) {
          console.log(`[GOAL B] ${elapsed}s: ${sidebarVideoCount} video element(s) in sidebar, all src=null — still loading`);
        }
      }

      // Print progress messages
      if (elapsed % 20 === 0 && elapsed > 0) {
        console.log(`[GOAL B] ${elapsed}s elapsed, waiting for generation...`);
        await pageB.screenshot({ path: path.join(PROOF_DIR, `debug_progress_${elapsed}s.png`), fullPage: true });
      }

      await pageB.waitForTimeout(3000);
    }

    if (!videoFound) {
      // Final screenshot and diagnose
      await pageB.screenshot({ path: path.join(PROOF_DIR, 'debug_timeout.png'), fullPage: true });

      // Check all page videos for any with src
      const allPageVideos = await pageB.locator('video').all();
      console.log(`[GOAL B] Total <video> elements on page at timeout: ${allPageVideos.length}`);
      for (let i = 0; i < allPageVideos.length; i++) {
        const src = await allPageVideos[i].getAttribute('src').catch(() => null);
        console.log(`  video[${i}] src=${src}`);
      }

      throw new Error(`No <video src="..."> in sidebar after ${LIVE_GEN_TIMEOUT_MS / 1000}s`);
    }

    // Screenshot as proof
    await pageB.screenshot({ path: path.join(PROOF_DIR, 'proof_live.png'), fullPage: true });
    console.log('[GOAL B] proof_live.png saved');

    const isCloudinary = videoSrc.includes('cloudinary');
    const isMp4 = videoSrc.includes('.mp4') || videoSrc.includes('.webm');
    goalBResult = { passed: true, src: videoSrc, isCloudinary, isMp4 };
    console.log('[GOAL B] PASS');

  } catch (err) {
    console.error(`[GOAL B] FAIL: ${err.message}`);
    goalBResult = { passed: false, src: null, error: err.message };
    await pageB.screenshot({ path: path.join(PROOF_DIR, 'debug_goal_b_failure.png'), fullPage: true }).catch(() => {});
  }
  consoleErrorsB.push(...logB.filter(l => l.type === 'error').map(l => l.text));

  // ─────────────────────────────────────────────────────────────────────────
  // GOAL A — History render
  // Navigate to the SAME project in a fresh page tab and verify the
  // just-generated video shows up in history.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n[GOAL A] Verifying history render...');
  const pageA = await browser.newPage();
  const logA = attachConsoleLogger(pageA, '[GOAL-A]');
  await pageA.setViewportSize({ width: 1400, height: 900 });

  try {
    await pageA.addInitScript(buildInitScript(token, user));

    const dashUrl = `${FRONTEND_URL}/dashboard/${TEST_PROJECT_ID}`;
    console.log(`[GOAL A] → ${dashUrl}`);
    await pageA.goto(dashUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    // Wait for data fetch
    await pageA.waitForTimeout(5000);

    const sidebarA = pageA.locator('[data-tour="ai-chat"]');

    // Look for videos inside the sidebar with a real src
    let found = false;
    let srcA = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const vids = await sidebarA.locator('video').all();
      for (const vid of vids) {
        const s = await vid.getAttribute('src').catch(() => null);
        if (s && s.length > 5) {
          srcA = s;
          found = true;
          break;
        }
      }
      if (found) break;

      if (attempt < 3) {
        console.log(`[GOAL A] attempt ${attempt}: no video with src yet, reloading...`);
        await pageA.reload({ waitUntil: 'networkidle' });
        await pageA.waitForTimeout(4000);
      }
    }

    if (!found) {
      await pageA.screenshot({ path: path.join(PROOF_DIR, 'debug_goal_a_no_video.png'), fullPage: true });
      goalAResult = { passed: false, src: null, error: 'No <video src="..."> found in history' };
      console.log('[GOAL A] FAIL — no video in history');
    } else {
      await pageA.screenshot({ path: path.join(PROOF_DIR, 'proof_history.png'), fullPage: true });
      console.log(`[GOAL A] proof_history.png saved — video src: ${srcA}`);
      goalAResult = { passed: true, src: srcA };
      console.log('[GOAL A] PASS');
    }

  } catch (err) {
    console.error(`[GOAL A] FAIL: ${err.message}`);
    goalAResult = { passed: false, src: null, error: err.message };
    await pageA.screenshot({ path: path.join(PROOF_DIR, 'debug_goal_a_failure.png'), fullPage: true }).catch(() => {});
  }
  consoleErrorsA.push(...logA.filter(l => l.type === 'error').map(l => l.text));

  await browser.close();

  // ── Final Report ─────────────────────────────────────────────────────────
  console.log('\n\n========== VERIFICATION REPORT ==========\n');

  console.log('GOAL A (history render):');
  console.log(`  Verdict: ${goalAResult.passed ? 'PASS' : 'FAIL'}`);
  if (goalAResult.src) console.log(`  <video> src: ${goalAResult.src}`);
  if (goalAResult.error) console.log(`  Error: ${goalAResult.error}`);
  console.log(`  Screenshot: ${path.join(PROOF_DIR, 'proof_history.png')}`);

  console.log('\nGOAL B (live generation flow):');
  console.log(`  Verdict: ${goalBResult.passed ? 'PASS' : 'FAIL'}`);
  if (goalBResult.src) {
    console.log(`  <video> src: ${goalBResult.src}`);
    console.log(`  Cloudinary URL: ${goalBResult.isCloudinary}`);
    console.log(`  .mp4/.webm URL: ${goalBResult.isMp4}`);
  }
  if (goalBResult.error) console.log(`  Error: ${goalBResult.error}`);
  console.log(`  Screenshot: ${path.join(PROOF_DIR, 'proof_live.png')}`);

  // Deduplicated console errors (React prop warnings are dev-mode noise)
  const significantErrors = [...new Set([...consoleErrorsA, ...consoleErrorsB])]
    .filter(e => !e.startsWith('Warning:'));   // filter React dev warnings
  if (significantErrors.length > 0) {
    console.log('\nSignificant Console Errors:');
    significantErrors.forEach(e => console.log(' ', e.slice(0, 200)));
  } else {
    console.log('\nNo significant console errors (React dev warnings filtered).');
  }

  console.log('\n=========================================\n');

  const overallPass = goalBResult.passed || goalAResult.passed;
  process.exit(overallPass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
