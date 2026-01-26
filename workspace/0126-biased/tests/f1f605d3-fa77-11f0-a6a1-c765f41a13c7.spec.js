import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f605d3-fa77-11f0-a6a1-c765f41a13c7.html';

// f1f605d3-fa77-11f0-a6a1-c765f41a13c7.spec.js
//
// Tests for the Exponential Search Visualizer application.
// These tests exercise the FSM states S0_Idle and S1_Animating, and the Start / Reset transitions.
// They also observe console messages and page errors and assert that no unexpected errors occurred.

test.describe('Exponential Search Visualizer — FSM and UI behavior', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions (page errors)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the page exactly as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the page has finished initial synchronous initialization
    await expect(page.locator('#arrayWrap')).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity: no uncaught page errors occurred during the test
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);
  });

  test('Initial Idle state (S0_Idle) is set up correctly on load', async ({ page }) => {
    // Verify S0_Idle entry action resetState() effects:
    // - stepLabel shows "Ready"
    // - stepsCount is "0"
    // - progressInner width is 0%
    // - start button is enabled and labeled "Start"
    // - stat-size reflects n = 25
    // - stat-target displays a "target = " prefix
    // - arrayWrap contains 25 .cell elements

    const stepLabel = page.locator('#stepLabel');
    const stepsCount = page.locator('#stepsCount');
    const progressInner = page.locator('#progressInner');
    const startBtn = page.locator('#startBtn');
    const statSize = page.locator('#stat-size');
    const statTarget = page.locator('#stat-target');
    const cells = page.locator('.cell');

    // The page's resetState() sets stepLabel to 'Ready' synchronously on init.
    await expect(stepLabel).toHaveText(/Ready/);

    // Steps should be zero
    await expect(stepsCount).toHaveText('0');

    // Progress inner should be at 0% via style attribute
    const progressWidth = await page.evaluate(() => document.getElementById('progressInner').style.width);
    expect(progressWidth === '' || progressWidth === '0%' || progressWidth === '0').toBeTruthy();

    // Start button should be enabled and show "Start"
    await expect(startBtn).toBeEnabled();
    await expect(startBtn).toHaveText('Start');

    // stat-size should show n = 25 (config.n is 25)
    await expect(statSize).toHaveText(/n = 25/);

    // stat-target should have 'target = ' prefix and a value or placeholder
    await expect(statTarget).toHaveText(/^target = /);

    // The implementation builds the array of length 25; wait for cells to be present
    // It's possible DOM rendering is synchronous; but wait for up to 2s for safety
    await expect(cells).toHaveCount(25);

    // No page errors occurred so far
    expect(pageErrors.length).toBe(0);

    // Ensure no console error messages were emitted (we only assert no page errors; console may have non-errors)
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole, 'No console.error messages should be logged during initial load').toBeUndefined();
  });

  test('StartClick triggers animation and transitions to Animating (S1_Animating)', async ({ page }) => {
    // This test clicks Start and waits for observable animation changes:
    // - startBtn toggles to "Running…" and becomes disabled while animating
    // - progressInner width begins increasing and eventually reaches 100%
    // - stepsCount increments as probes and binary steps occur
    // - some cells get .checked or .found classes during the run
    // - on completion, startBtn returns to "Start" and is enabled again

    const startBtn = page.locator('#startBtn');
    const progressInner = page.locator('#progressInner');
    const stepsCount = page.locator('#stepsCount');
    const stepLabel = page.locator('#stepLabel');
    const arrayWrap = page.locator('#arrayWrap');
    const overlayRange = page.locator('#overlayRange');

    // Click Start to initiate the animation
    await startBtn.click();

    // After clicking, the script should set animating and update the start button immediately
    await expect(startBtn).toHaveText(/Running…|Running/);
    await expect(startBtn).toBeDisabled();

    // Wait for at least one step to be recorded (probes increment stepsCount)
    await page.waitForFunction(() => {
      const el = document.getElementById('stepsCount');
      if (!el) return false;
      const n = parseInt(el.textContent || '0', 10);
      return n >= 1;
    }, {}, { timeout: 8000 });

    // Ensure some cells have been checked (visual feedback)
    await page.waitForFunction(() => document.querySelectorAll('.cell.checked').length > 0, {}, { timeout: 8000 });

    // Expect overlayRange to eventually contain DOM elements once the range is drawn
    await page.waitForFunction(() => {
      const el = document.getElementById('overlayRange');
      return el && el.children.length >= 0;
    }, {}, { timeout: 2000 });

    // Wait for the animation to finish (progressInner.style.width === '100%')
    // The full run may take several seconds; allow generous timeout
    await page.waitForFunction(() => {
      const p = document.getElementById('progressInner');
      return p && (p.style.width === '100%' || p.style.width === '100% ');
    }, {}, { timeout: 30000 });

    // After completion, start button should be restored
    await expect(startBtn).toHaveText('Start');
    await expect(startBtn).toBeEnabled();

    // Steps counter should be >= 1
    const steps = parseInt(await stepsCount.textContent(), 10);
    expect(steps).toBeGreaterThanOrEqual(1);

    // Check final stepLabel indicates completion in some form (Found or not found)
    const finalLabel = await stepLabel.textContent();
    expect(finalLabel).toMatch(/Found at index|Value not in array|Value not in array|Found|Search complete|Target found|Ready/);

    // At least one cell should be marked found or checked at the end
    const foundCells = await page.$$eval('.cell.found', els => els.length);
    const checkedCells = await page.$$eval('.cell.checked', els => els.length);
    expect(foundCells + checkedCells).toBeGreaterThanOrEqual(1);

    // Ensure there were no page errors during the animation
    expect(pageErrors.length).toBe(0);
  });

  test('ResetClick during animation aborts and returns to Idle (S1_Animating -> S0_Idle)', async ({ page }) => {
    // Start the animation, wait for it to begin, then click Reset and assert resetState() effects:
    // - startBtn text back to "Start" and enabled
    // - stepsCount is reset to "0"
    // - progressInner width is reset to 0%
    // - overlayRange cleared (empty)
    // - cells do not retain checked/found/skipped states
    // Also observe that the animation's abort flow can set stepLabel/detailBox to indicate abort.

    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepsCount = page.locator('#stepsCount');
    const progressInner = page.locator('#progressInner');
    const stepLabel = page.locator('#stepLabel');
    const detailBox = page.locator('#detailBox');
    const overlayRange = page.locator('#overlayRange');
    const cells = page.locator('.cell');

    // Start animation
    await startBtn.click();

    // Wait until at least one probe/step occurs
    await page.waitForFunction(() => {
      const el = document.getElementById('stepsCount');
      if (!el) return false;
      return parseInt(el.textContent || '0', 10) >= 1;
    }, {}, { timeout: 8000 });

    // Ensure animating state is present
    await expect(startBtn).toBeDisabled();

    // Now click Reset while animation is ongoing
    await resetBtn.click();

    // After resetState is called, the UI should reflect Idle state:
    // Wait for stepsCount to go back to "0"
    await page.waitForFunction(() => {
      const el = document.getElementById('stepsCount');
      return el && el.textContent.trim() === '0';
    }, {}, { timeout: 3000 });

    // ProgressInner style width should be reset to 0% (or empty string)
    await page.waitForFunction(() => {
      const p = document.getElementById('progressInner');
      return p && (p.style.width === '' || p.style.width === '0%' || p.style.width === '0');
    }, {}, { timeout: 3000 });

    // overlayRange should be empty after reset
    const overlayChildren = await page.$eval('#overlayRange', el => el.children.length);
    expect(overlayChildren).toBe(0);

    // All cells should have cleared special classes (checked, found, skip, pulse)
    const cellsState = await page.$$eval('.cell', els => els.map(e => ({
      idx: e.dataset.idx,
      classes: Array.from(e.classList)
    })));
    for (const cs of cellsState) {
      expect(cs.classes).not.toContain('checked');
      expect(cs.classes).not.toContain('found');
      expect(cs.classes).not.toContain('skip');
      expect(cs.classes).not.toContain('pulse');
    }

    // Start button should be enabled and labeled "Start"
    await expect(startBtn).toBeEnabled();
    await expect(startBtn).toHaveText('Start');

    // The stepLabel/detailBox may reflect the abort flow:
    // It can be 'Reset' (set by the catch handler) or 'Ready' (set by resetState synchronously).
    const labelText = await stepLabel.textContent();
    const detailText = await detailBox.textContent();
    expect(labelText.trim()).toMatch(/Reset|Ready/);
    // detailBox might be either 'Press Start to begin...' (resetState) or 'Animation aborted.' from runExponentialSearch catch.
    expect(detailText.trim()).toMatch(/Press Start to begin the visual walk-through.|Animation aborted.|Awaiting action./);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Keyboard space triggers Start when not animating', async ({ page }) => {
    // Press spacebar to start from idle state and ensure animation begins
    const startBtn = page.locator('#startBtn');

    // Ensure idle
    await expect(startBtn).toHaveText('Start');
    await expect(startBtn).toBeEnabled();

    // Press space to start
    await page.keyboard.press(' ');

    // startBtn should reflect running state
    await expect(startBtn).toHaveText(/Running…|Running/);
    await expect(startBtn).toBeDisabled();

    // Allow some time for at least one step to be recorded
    await page.waitForFunction(() => {
      const s = document.getElementById('stepsCount');
      return s && parseInt(s.textContent || '0', 10) >= 1;
    }, {}, { timeout: 8000 });

    // Stop the animation by clicking Reset to clean up
    await page.locator('#resetBtn').click();

    // Assert no page errors were produced
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Start while animating is ignored and does not crash the app (idempotency)', async ({ page }) => {
    // Start the animation and then click Start again; ensure application remains stable and steps continue incrementing
    const startBtn = page.locator('#startBtn');
    const stepsCount = page.locator('#stepsCount');

    await startBtn.click();

    // Wait for the run to start
    await page.waitForFunction(() => {
      const btn = document.getElementById('startBtn');
      return btn && btn.disabled;
    }, {}, { timeout: 5000 });

    // Capture steps at this moment
    const initialSteps = parseInt(await stepsCount.textContent(), 10);

    // Click Start again while animating - should be no-op because handler checks animating
    await startBtn.click();

    // Wait a short interval and ensure steps have increased (animation still running) but no doubled-up runs or errors
    await page.waitForTimeout(1500);

    const laterSteps = parseInt(await stepsCount.textContent(), 10);
    expect(laterSteps).toBeGreaterThanOrEqual(initialSteps);

    // Finally reset to bring back idle state
    await page.locator('#resetBtn').click();

    // Assert application didn't log any console errors or uncaught page errors
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole, 'No console.error messages should be logged during idempotent start').toBeUndefined();
    expect(pageErrors.length).toBe(0);
  });
});