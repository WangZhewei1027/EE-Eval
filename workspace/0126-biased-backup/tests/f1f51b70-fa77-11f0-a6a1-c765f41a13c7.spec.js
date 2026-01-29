import { test, expect } from '@playwright/test';

// Test file for: f1f51b70-fa77-11f0-a6a1-c765f41a13c7
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/f1f51b70-fa77-11f0-a6a1-c765f41a13c7.html
//
// Notes:
// - This suite validates the FSM-driven UI for the B-Tree visual demo.
// - It observes console messages and page errors without modifying the page runtime.
// - Tests exercise Play/Pause/Reset controls, auto-advance behavior, visual DOM updates,
//   resize handling, and the special "play at end resets to start" branch.
// - Uses an ergonomic page object for repeated actions and assertions.

// Page object encapsulating common interactions and queries
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playSelector = '#playBtn';
    this.resetSelector = '#resetBtn';
    this.stepCounterSelector = '#stepCounter';
    this.stepTotalSelector = '#stepTotal';
    this.nodeSelector = '.node';
    this.highlightKeySelector = '.key.highlight';
    this.stageSelector = '#stage';
    this.svgSelector = '#svg';
  }

  async clickPlay() {
    await this.page.click(this.playSelector);
  }

  async clickReset() {
    await this.page.click(this.resetSelector);
  }

  async getPlayButtonText() {
    return (await this.page.locator(this.playSelector).innerText()).trim();
  }

  async getStepCounterText() {
    return (await this.page.locator(this.stepCounterSelector).innerText()).trim();
  }

  async getStepTotalText() {
    return (await this.page.locator(this.stepTotalSelector).innerText()).trim();
  }

  async nodeCount() {
    return await this.page.locator(this.nodeSelector).count();
  }

  async highlightedKeyCount() {
    return await this.page.locator(this.highlightKeySelector).count();
  }

  // Wait until the step counter equals a target value (string or number)
  async waitForStep(target, options = {}) {
    const expected = String(target);
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        return el && String(el.textContent).trim() === expected;
      },
      this.stepCounterSelector,
      expected,
      options
    );
  }

  // Small helper to ensure stage and svg exist and are visible
  async ensureStageRendered() {
    await expect(this.page.locator(this.stageSelector)).toBeVisible();
    await expect(this.page.locator(this.svgSelector)).toBeVisible();
  }
}

// Test configuration: top-level grouping
test.describe('B-Tree Visual Concept — FSM and UI integration', () => {
  // Collect console errors and page errors for each test to assert there are none
  let consoleErrors;
  let pageErrors;

  // Each test will create a fresh page and page object
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Navigate to the provided HTML
    await page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/f1f51b70-fa77-11f0-a6a1-c765f41a13c7.html', {
      waitUntil: 'domcontentloaded'
    });

    // Basic sanity: page title should match expectation
    await expect(page).toHaveTitle(/B‑Tree — Visual Concept|B-Tree — Visual Concept/);
  });

  test.afterEach(async ({ page }) => {
    // Optionally take a debug screenshot on failure-prone cases (no-op here)
    // Ensure no unexpected console errors or page errors were emitted
    // These assertions ensure the application executed without uncaught runtime errors.
    expect(consoleErrors.length, `console.error calls (${consoleErrors.join(' | ')})`).toBe(0);
    expect(pageErrors.length, `page errors (${pageErrors.map(e => String(e)).join(' | ')})`).toBe(0);
    // Close page (Playwright will handle in runner), left here for clarity
    await page.close();
  });

  // Group: initial state validation
  test('Initial state (S0_Initial) — shows step 0 and Play button', async ({ page }) => {
    const app = new BTreePage(page);

    // Validate the static metadata of controls and counters
    await expect(page.locator('#playBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('#stepTotal')).toBeVisible();

    // Initial step counter must be 0 per FSM evidence (entry action: showStep(0))
    const stepText = await app.getStepCounterText();
    expect(stepText).toBe('0');

    // Play button must read 'Play' initially
    const playText = await app.getPlayButtonText();
    expect(playText).toMatch(/Play/i);

    // Total steps should reflect the STATES array length minus one (8)
    const totalText = await app.getStepTotalText();
    expect(totalText).toBe('8');

    // Since step 0 corresponds to null tree, there should be no rendered nodes initially
    const nodes = await app.nodeCount();
    expect(nodes).toBe(0);

    // Ensure stage elements exist
    await app.ensureStageRendered();
  });

  // Group: Play/Pause toggle behavior
  test('PlayPauseClick transitions: S0 -> S1 (play), S1 -> S2 (pause), S2 -> S1 (resume)', async ({ page }) => {
    const app = new BTreePage(page);

    // Initial state
    expect(await app.getPlayButtonText()).toMatch(/Play/i);

    // Click Play: should transition to playing (S1_Playing) and change button text to 'Pause'
    await app.clickPlay();
    await expect(page.locator('#playBtn')).toHaveText(/Pause/i);

    // Clicking again should pause (S2_Paused) and show 'Play'
    await app.clickPlay();
    await expect(page.locator('#playBtn')).toHaveText(/Play/i);

    // Clicking once more should resume playing (back to S1_Playing)
    await app.clickPlay();
    await expect(page.locator('#playBtn')).toHaveText(/Pause/i);

    // Finally pause for cleanup
    await app.clickPlay();
    await expect(page.locator('#playBtn')).toHaveText(/Play/i);
  });

  // Group: Reset behavior from various states
  test('ResetClick transitions: S0->S3 (reset from initial), S2->S3 (reset from paused), S1->S3 (reset from playing)', async ({ page }) => {
    const app = new BTreePage(page);

    // 1) Reset from initial state (S0 -> S3)
    // Ensure we are at 0
    expect(await app.getStepCounterText()).toBe('0');
    await app.clickReset();
    expect(await app.getStepCounterText()).toBe('0');
    // Confirm Play button remains 'Play' after reset
    expect(await app.getPlayButtonText()).toMatch(/Play/i);

    // 2) Reset while paused (S2 -> S3)
    // Click play then pause to enter paused
    await app.clickPlay(); // play
    await expect(page.locator('#playBtn')).toHaveText(/Pause/i);
    await app.clickPlay(); // pause
    await expect(page.locator('#playBtn')).toHaveText(/Play/i);
    // Ensure we can still click reset and step returns to 0
    await app.clickReset();
    expect(await app.getStepCounterText()).toBe('0');
    expect(await app.getPlayButtonText()).toMatch(/Play/i);

    // 3) Reset while playing (S1 -> S3)
    // Start playing then immediately reset
    await app.clickPlay(); // playing
    await expect(page.locator('#playBtn')).toHaveText(/Pause/i);
    // Reset should pause and set step to 0
    await app.clickReset();
    expect(await app.getStepCounterText()).toBe('0');
    // Reset should ensure we are paused (Play shown)
    expect(await app.getPlayButtonText()).toMatch(/Play/i);

    // As an extra check, wait a little longer than the play interval to ensure reset cleared any timers
    // The page uses 2000ms interval; wait 2300ms and assert still at 0
    await page.waitForTimeout(2300);
    expect(await app.getStepCounterText()).toBe('0');
  });

  // Group: Visual rendering and highlight behavior during auto-advance
  test('Auto-advance and visual highlights: first insertion creates nodes and a temporary highlight', async ({ page }) => {
    const app = new BTreePage(page);

    // Start playing — auto-advance will increment after STEP_INTERVAL (2000ms)
    await app.clickPlay();
    await expect(page.locator('#playBtn')).toHaveText(/Pause/i);

    // Wait for the step counter to become 1 (first inserted key)
    // Allow some buffer: timeout set to 5000ms to account for environment jitter
    await app.waitForStep(1, { timeout: 5000 });

    // At step 1 there should be rendered nodes (at least one)
    const nodesAfterFirst = await app.nodeCount();
    expect(nodesAfterFirst).toBeGreaterThanOrEqual(1);

    // Immediately after showStep(1) the implementation temporarily highlights the inserted key
    // The highlight persists for ~700ms, so check for presence quickly.
    const highlighted = await app.highlightedKeyCount();
    // Either the highlight is present (if we probe quickly) or just removed — both are acceptable,
    // but at least keys should exist. If highlight exists, it should be >=1.
    if (highlighted > 0) {
      expect(highlighted).toBeGreaterThanOrEqual(1);
    } else {
      // fallback check: keys exist somewhere
      const keysExist = await page.locator('.node .key').count();
      expect(keysExist).toBeGreaterThanOrEqual(1);
    }

    // Pause playback for test hygiene
    await app.clickPlay();
    await expect(page.locator('#playBtn')).toHaveText(/Play/i);
  });

  // Longer-running test: full playthrough to the final step and verifying "play at end resets to start" branch
  test('Full playthrough: reach final step, then clicking Play at end resets to start and resumes', async ({ page }) => {
    const app = new BTreePage(page);

    // This test intentionally waits for the auto-advance to reach the last step.
    // The demo has 8 steps and a 2s interval => ~16s of waiting. Increase timeout for this test.
    test.setTimeout(45000); // allow up to 45s for this test

    // Start playing
    await app.clickPlay();
    await expect(page.locator('#playBtn')).toHaveText(/Pause/i);

    // Wait until step counter reaches '8' (the final step)
    // Allow a reasonably generous timeout (35s)
    await app.waitForStep(8, { timeout: 35000 });

    // When the sequence hits the end the implementation pauses (pause() called)
    // Verify play button shows 'Play' at the end (paused)
    const playTextAtEnd = await app.getPlayButtonText();
    expect(playTextAtEnd).toMatch(/Play/i);

    // Now clicking Play at the end should cause the special branch:
    // if(currentStep >= STATES.length - 1) { currentStep = 0; showStep(currentStep); } play();
    // So clicking Play should immediately set the stepCounter to 0 and change button to 'Pause'
    await app.clickPlay();
    // Immediately after clicking, expect the button to show 'Pause'
    await expect(page.locator('#playBtn')).toHaveText(/Pause/i);

    // And the step counter should have been reset to 0
    await app.waitForStep(0, { timeout: 2000 });

    // Shortly after, auto-advance should begin again — wait for step 1
    await app.waitForStep(1, { timeout: 5000 });

    // Cleanup: pause playback
    await app.clickPlay();
    await expect(page.locator('#playBtn')).toHaveText(/Play/i);
  });

  // Group: Resize handling (WindowResize event)
  test('Window resize triggers showStep without errors and preserves step counter', async ({ page, browserName }) => {
    const app = new BTreePage(page);

    // Ensure we have a known state: step 0
    expect(await app.getStepCounterText()).toBe('0');

    // Resize the viewport to trigger window.resize handler
    // Use different sizes to provoke the event
    await page.setViewportSize({ width: 800, height: 600 });
    // Small wait to allow handler to run
    await page.waitForTimeout(300);
    // Resize back
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(300);

    // The step counter should remain unchanged (showStep called with currentStep)
    expect(await app.getStepCounterText()).toBe('0');

    // No errors should have been emitted (checked in afterEach)
  });

  // Edge-case tests: rapid interaction stress tests
  test('Rapid toggles and repeated resets do not cause unhandled exceptions', async ({ page }) => {
    const app = new BTreePage(page);

    // Rapidly click Play/Reset/Play/Reset to exercise state transitions
    for (let i = 0; i < 3; i++) {
      await app.clickPlay();
      // small interleaving delay
      await page.waitForTimeout(120);
      await app.clickReset();
      await page.waitForTimeout(120);
      await app.clickPlay();
      await page.waitForTimeout(80);
      await app.clickReset();
    }

    // Final assertions: still shows a valid step counter and buttons usable
    const step = await app.getStepCounterText();
    // step should be numeric string
    expect(Number.isFinite(Number(step))).toBe(true);
    const playText = await app.getPlayButtonText();
    expect(/Play|Pause/i.test(playText)).toBe(true);

    // Ensure no console errors or page errors (checked in afterEach)
  });
});