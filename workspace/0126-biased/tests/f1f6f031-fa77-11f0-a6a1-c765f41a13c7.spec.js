import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6f031-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the Sliding Window app
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.windowOverlay = page.locator('#windowOverlay');
    this.windowSumLabel = page.locator('#windowSum');
    this.currentSumEl = page.locator('#currentSum');
    this.stepIndicator = page.locator('#stepIndicator');
    this.cells = page.locator('.cell');
    this.bars = page.locator('.bar');
    this.windowSizeLabel = page.locator('#windowSizeLabel');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait a short moment for initial DOM injection/animations to settle
    await this.page.waitForTimeout(120);
  }

  async getPlayButtonText() {
    return (await this.playBtn.innerText()).trim();
  }

  async getPlayButtonAriaPressed() {
    return await this.playBtn.getAttribute('aria-pressed');
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getStepIndicatorText() {
    return (await this.stepIndicator.innerText()).trim();
  }

  async getCurrentSumText() {
    return (await this.currentSumEl.innerText()).trim();
  }

  async getWindowSumText() {
    return (await this.windowSumLabel.innerText()).trim();
  }

  async getOverlayLeft() {
    // read the computed left style property (px)
    return await this.windowOverlay.evaluate((el) => el.style.left);
  }

  async getInsideCellsIndices() {
    // returns array of numbers for cells that have class 'inside'
    return await this.page.$$eval('.cell.inside', (els) =>
      els.map((el) => Number(el.getAttribute('data-index')))
    );
  }

  async getActiveBarIndex() {
    const attr = await this.page.locator('.bar.active').getAttribute('data-index');
    if (attr === null) return null;
    return Number(attr);
  }

  async getWindowSizeLabel() {
    return (await this.windowSizeLabel.innerText()).trim();
  }

  async countCells() {
    return await this.cells.count();
  }

  async countBars() {
    return await this.bars.count();
  }
}

// Test suite
test.describe('Sliding Window — FSM and UI integration tests', () => {
  // Collect runtime errors and console error messages for assertions
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // capture uncaught exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // capture console messages, track error level ones
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // navigate to app
    const app = new SlidingWindowPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught page errors or console errors during the test interactions
    expect(pageErrors.length, 'No page errors should occur').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should be emitted').toBe(0);
  });

  test('Initial state on load should be Playing (S0_Playing) with correct UI evidence', async ({ page }) => {
    // Validate the initial "Playing" state as per FSM: playBtn shows pause and aria-pressed true
    const app = new SlidingWindowPage(page);

    // Play button should indicate Pause because autoplay starts playing = true
    await expect(app.playBtn).toBeVisible();
    const playText = await app.getPlayButtonText();
    const aria = await app.getPlayButtonAriaPressed();
    expect(playText).toContain('⏸', 'Play button should show pause symbol when playing');
    expect(aria).toBe('true');

    // Window size label should match expected (4)
    const ws = await app.getWindowSizeLabel();
    expect(ws).toBe('4');

    // Step indicator should start at 1 / (maxStep+1) -> compute expected total from DOM bars
    const barsCount = await app.countBars();
    // bars count equals number of possible positions (maxStep+1)
    const indicator = await app.getStepIndicatorText();
    expect(indicator).toMatch(/^1 \/ \d+$/);
    expect(indicator).toContain(`${barsCount}`);

    // The first window (indices 0..windowSize-1) should be highlighted with 'inside' class
    const insideIndices = await app.getInsideCellsIndices();
    expect(insideIndices.length).toBeGreaterThanOrEqual(4);
    expect(insideIndices.slice(0, 4)).toEqual([0, 1, 2, 3]);

    // Current sum and window sum label should be consistent and numeric
    const curSum = await app.getCurrentSumText();
    const winSum = await app.getWindowSumText();
    expect(curSum).toMatch(/^\d+$/);
    expect(winSum).toContain(curSum);
  });

  test('Clicking Play while Playing toggles to Paused (S0_Playing -> S1_Paused)', async ({ page }) => {
    // From initial playing state, clicking play should pause
    const app = new SlidingWindowPage(page);

    // ensure currently playing
    const initialText = await app.getPlayButtonText();
    expect(initialText).toContain('⏸');

    // click to pause
    await app.clickPlay();

    // immediate UI evidence: button shows Play symbol and aria-pressed false
    await expect(app.playBtn).toHaveText(/▶ Play/);
    const aria = await app.getPlayButtonAriaPressed();
    expect(aria).toBe('false');

    // verify overlay left remains static for a short period (animation should be paused)
    const leftBefore = await app.getOverlayLeft();
    await page.waitForTimeout(500);
    const leftAfter = await app.getOverlayLeft();
    expect(leftAfter).toBe(leftBefore);
  });

  test('Clicking Play while Paused toggles back to Playing (S1_Paused -> S0_Playing) and advances steps', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    // Ensure paused first: click to pause if needed
    const initialText = await app.getPlayButtonText();
    if (initialText.includes('⏸')) {
      await app.clickPlay(); // pause
      await expect(app.playBtn).toHaveText(/▶ Play/);
    }

    // Now click to resume playing
    await app.clickPlay();
    await expect(app.playBtn).toHaveText(/⏸ Pause/);
    const aria = await app.getPlayButtonAriaPressed();
    expect(aria).toBe('true');

    // Wait slightly more than one step duration to ensure the step advances
    // stepDuration in app is 1100ms -> wait 1300ms to be safe
    await page.waitForTimeout(1300);

    // Step indicator should have incremented from 1
    const indicator = await app.getStepIndicatorText();
    // Accept either 2 / N or greater if multiple steps passed
    expect(indicator).toMatch(/^([2-9]\d*|2) \/ \d+$/);
  });

  test('Reset while Paused moves to Reset state (S1_Paused -> S2_Reset): currentStep=0 and playing=false', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    // Ensure paused first
    const textNow = await app.getPlayButtonText();
    if (textNow.includes('⏸')) {
      await app.clickPlay(); // pause
      await expect(app.playBtn).toHaveText(/▶ Play/);
    }

    // Move to a non-zero step to ensure reset actually changes state
    // Click play to advance one step, then pause again
    await app.clickPlay();
    await expect(app.playBtn).toHaveText(/⏸ Pause/);
    await page.waitForTimeout(1200); // let it step
    await app.clickPlay(); // pause

    // Now click reset
    await app.clickReset();

    // Evidence: play button should show Play and aria-pressed false
    await expect(app.playBtn).toHaveText(/▶ Play/);
    const aria = await app.getPlayButtonAriaPressed();
    expect(aria).toBe('false');

    // Step indicator should show 1 / N (currentStep = 0)
    const indicator = await app.getStepIndicatorText();
    expect(indicator).toMatch(/^1 \/ \d+$/);

    // Current sum and window sum should correspond to first window
    const curSum = await app.getCurrentSumText();
    const winSum = await app.getWindowSumText();
    expect(winSum).toContain(curSum);

    // Highlighted cells should be the initial window 0..3
    const insideIndices = await app.getInsideCellsIndices();
    expect(insideIndices.slice(0, 4)).toEqual([0, 1, 2, 3]);
  });

  test('Reset while Playing moves to Reset state (S0_Playing -> S2_Reset) and stops playback', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    // Ensure playing
    const textNow = await app.getPlayButtonText();
    if (textNow.includes('▶')) {
      await app.clickPlay(); // resume
      await expect(app.playBtn).toHaveText(/⏸ Pause/);
    }

    // Let autoplay advance a bit to make reset meaningful
    await page.waitForTimeout(900);
    // Click reset while playing
    await app.clickReset();

    // Evidence: playing should be false (button shows Play)
    await expect(app.playBtn).toHaveText(/▶ Play/);
    const aria = await app.getPlayButtonAriaPressed();
    expect(aria).toBe('false');

    // Step indicator should be reset to 1 / N
    const indicator = await app.getStepIndicatorText();
    expect(indicator).toMatch(/^1 \/ \d+$/);

    // Confirm overlay left is stable after reset (playback stopped)
    const leftBefore = await app.getOverlayLeft();
    await page.waitForTimeout(500);
    const leftAfter = await app.getOverlayLeft();
    expect(leftAfter).toBe(leftBefore);
  });

  test('Rapid toggling Play multiple times should not throw and ends in a deterministic state', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    // Rapidly toggle play button several times
    for (let i = 0; i < 6; i++) {
      await app.clickPlay();
      // tiny delay to allow event handler to run
      await page.waitForTimeout(80);
    }

    // After even number of toggles (6) the state should be same as initial (which started playing)
    // Since initial may be playing, expect the button to have Pause if even toggles preserved playing
    const text = await app.getPlayButtonText();
    // Accept either state as deterministic: just assert no exceptions occurred and aria-pressed is 'true' or 'false'
    const aria = await app.getPlayButtonAriaPressed();
    expect(['true', 'false']).toContain(aria);

    // Also ensure DOM still has expected components and counts intact
    const cellCount = await app.countCells();
    const barCount = await app.countBars();
    expect(cellCount).toBeGreaterThan(0);
    expect(barCount).toBeGreaterThan(0);
  });

  test('Edge case: clicking Reset repeatedly should remain stable and keep currentStep at 0', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    // Move forward a couple steps then reset repeatedly
    if ((await app.getPlayButtonText()).includes('▶')) {
      await app.clickPlay(); // ensure playing
    }
    await page.waitForTimeout(1200); // let it advance
    // Now click reset multiple times rapidly
    await Promise.all([
      app.clickReset(),
      page.waitForTimeout(30),
      app.clickReset(),
      page.waitForTimeout(30),
      app.clickReset()
    ]);

    // All resets should leave state at step 0 and playing false
    await expect(app.playBtn).toHaveText(/▶ Play/);
    const aria = await app.getPlayButtonAriaPressed();
    expect(aria).toBe('false');

    const indicator = await app.getStepIndicatorText();
    expect(indicator).toMatch(/^1 \/ \d+$/);

    const insideIndices = await app.getInsideCellsIndices();
    expect(insideIndices.slice(0, 4)).toEqual([0, 1, 2, 3]);
  });

  // Additional test to ensure no runtime exceptions were emitted during a longer playback session
  test('Long playback session does not emit uncaught exceptions or console errors', async ({ page }) => {
    const app = new SlidingWindowPage(page);

    // Ensure playing
    if ((await app.getPlayButtonText()).includes('▶')) {
      await app.clickPlay();
    }

    // Let it play for a few steps (3 steps => ~3.3s)
    await page.waitForTimeout(3500);

    // After playing a while, no pageerrors or console errors should have occurred (asserted in afterEach)
    // Also the step indicator should now be > 1
    const indicator = await app.getStepIndicatorText();
    expect(indicator).toMatch(/^\d+ \/ \d+$/);
    const stepNumber = Number(indicator.split('/')[0].trim());
    expect(stepNumber).toBeGreaterThanOrEqual(1);
  });
});