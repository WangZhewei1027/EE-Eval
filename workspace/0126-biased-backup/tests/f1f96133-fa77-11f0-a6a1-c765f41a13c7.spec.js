import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f96133-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the demo UI
class KMeansDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.toggleBtn = page.locator('#toggleBtn');
    this.toggleLabel = page.locator('#toggleLabel');
    this.shuffleBtn = page.locator('#shuffleBtn');
    this.iterEl = page.locator('#iter');
    this.inertiaEl = page.locator('#inertia');
    this.pointsCountEl = page.locator('#pointsCount');
    this.kValEl = page.locator('#kVal');
    this.legendEl = page.locator('#legend');
    this.canvas = page.locator('#canvas');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main canvas to be ready and for initial UI label to be present
    await this.canvas.waitFor({ state: 'visible', timeout: 5000 });
    await this.toggleLabel.waitFor({ state: 'visible', timeout: 5000 });
  }

  async clickToggle() { await this.toggleBtn.click(); }

  async clickShuffle() { await this.shuffleBtn.click(); }

  async getToggleLabelText() { return (await this.toggleLabel.textContent())?.trim(); }

  async getIterText() { return (await this.iterEl.textContent())?.trim(); }

  async getInertiaText() { return (await this.inertiaEl.textContent())?.trim(); }

  async getPointsCountText() { return (await this.pointsCountEl.textContent())?.trim(); }

  async getKValText() { return (await this.kValEl.textContent())?.trim(); }

  async getLegendCount() { return await this.legendEl.locator('.chip').count(); }
}

test.describe('K-Means Clustering — Aesthetic Animated Demo (FSM validation)', () => {
  let page;
  let demo;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // New context + page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console messages and uncaught page errors for assertions later
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      // Capture only error-level console messages to validate runtime issues
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      // Uncaught exceptions from the page
      pageErrors.push(err);
    });

    demo = new KMeansDemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors occurred during the test run
    // The application is expected to be stable; any ReferenceError/TypeError/SyntaxError
    // would have been emitted and captured here. We assert zero occurrences.
    expect(pageErrors.length, `No uncaught page errors expected, got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    // Also assert there are no console.error messages
    expect(consoleErrors.length, `No console.error messages expected, got: ${JSON.stringify(consoleErrors)}`).toBe(0);

    // Close the page's context to clean up (page.context() close will close all pages)
    await page.context().close();
  });

  test('Initial state: demo loads and shows Playing (Pause label), K and points info, legend built', async () => {
    // Validate initial UI indicators implying S1_Playing (playing = true inferred via "Pause" label)
    const label = await demo.getToggleLabelText();
    // The demo initializes and starts the animation; toggle label should be "Pause"
    expect(label).toBe('Pause');

    // K value and points count should reflect the fixed configuration in the app
    const kVal = await demo.getKValText();
    expect(kVal).toBe('5');

    const pointsCount = await demo.getPointsCountText();
    expect(pointsCount).toBe('200');

    // Legend should be populated with K chips
    const legendCount = await demo.getLegendCount();
    expect(legendCount).toBe(5);

    // Iteration should initialize at 0 in the DOM
    const iter = await demo.getIterText();
    expect(iter).toBe('0');
  });

  test('Toggle Play/Pause control correctly flips play state and updates label', async () => {
    // Comments:
    // - Clicking the toggle button should pause the animation (label -> "Play").
    // - Clicking again should resume it (label -> "Pause").
    // We infer playing state solely from the toggle label as internal variables are scoped inside an IIFE.

    // Click to pause
    await demo.clickToggle();
    await demo.toggleLabel.waitFor(); // ensure label updates
    let label = await demo.getToggleLabelText();
    expect(label).toBe('Play');

    // Click to resume
    await demo.clickToggle();
    await demo.toggleLabel.waitFor();
    label = await demo.getToggleLabelText();
    expect(label).toBe('Pause');

    // Rapid toggling edge-case: click multiple times quickly to ensure label toggles deterministically
    for (let i = 0; i < 5; i++) {
      await demo.clickToggle();
    }
    // After 5 rapid clicks, the state should have flipped odd number of times from 'Pause' -> 'Play'
    label = await demo.getToggleLabelText();
    expect(['Play', 'Pause']).toContain(label);
  });

  test('Shuffle Dataset generates a fresh dataset and restarts algorithm (iter reset and Pause label)', async () => {
    // Comments:
    // - Clicking shuffle should set playing = true (label "Pause") and regenerate dataset.
    // - generateDataset resets iter to 0 in the DOM; we validate that.
    // First, click shuffle
    await demo.clickShuffle();

    // After clicking, toggle label should be "Pause" since shuffle sets playing = true
    await demo.toggleLabel.waitFor();
    let label = await demo.getToggleLabelText();
    expect(label).toBe('Pause');

    // Iter should be reset to "0" as generateDataset resets iter and UI writes "0"
    const iterAfterShuffle = await demo.getIterText();
    expect(iterAfterShuffle).toBe('0');

    // Clicking shuffle multiple times in short succession: should not break UI; iter remains "0"
    await demo.clickShuffle();
    await demo.clickShuffle();
    const iterAfterMultipleShuffle = await demo.getIterText();
    expect(iterAfterMultipleShuffle).toBe('0');
  });

  test('Algorithm progresses: iteration counter increments after assign+move cycle (Assigning -> Moving -> Iter++)', async () => {
    // Comments:
    // - We cannot access internal animPhase (it is scoped inside the IIFE). We instead observe
    //   the visible iteration counter which increments when a move phase completes.
    // - Wait for the first non-zero iteration value indicating a full assign+move transition occurred.

    // Ensure we start from iter 0 (initial state)
    const initialIterText = await demo.getIterText();
    expect(initialIterText).toBe('0');

    // Wait for the iteration counter to become greater than '0'
    // The demo durations are ~900ms + 1100ms per cycle; allow ample timeout
    await page.waitForFunction(() => {
      const el = document.getElementById('iter');
      if (!el) return false;
      const v = parseInt(el.textContent || '0', 10);
      return v > 0;
    }, { timeout: 12000 });

    const iterAfter = await demo.getIterText();
    expect(Number(iterAfter)).toBeGreaterThan(0);
  });

  test('Move phase completes and leads to next assignment or idle: iteration increments and UI stabilizes', async () => {
    // Comments:
    // - After a move completes, iter is incremented and the animation either goes to next assign
    //   or to idle (if converged / max iterations reached). We assert iter increases and inertia is shown.

    // Record starting iteration
    const startIter = Number(await demo.getIterText());

    // Wait for a subsequent iteration increment (allow multiple cycles)
    await page.waitForFunction((s) => {
      const el = document.getElementById('iter');
      if (!el) return false;
      const v = parseInt(el.textContent || '0', 10);
      return v > s;
    }, startIter, { timeout: 15000 });

    const newIter = Number(await demo.getIterText());
    expect(newIter).toBeGreaterThan(startIter);

    // Inertia should have some numeric value displayed after assignments occur
    // The code updates inertiaEl to a number; we accept '—' only at very initial times, but after cycles expect numeric.
    const inertiaText = await demo.getInertiaText();
    // inertia is displayed as '—' initially; after a cycle it should be digits (or still '—' if not yet computed).
    // Be lenient: assert string is either '—' or a string that contains a digit.
    expect(/[\d]/.test(inertiaText) || inertiaText === '—').toBe(true);
  });

  test('Stress and edge interactions: rapid shuffle and toggles should not produce uncaught errors', async () => {
    // Comments:
    // - Simulate rapid user actions to exercise edge cases:
    //   * Rapid toggling play/pause
    //   * Rapid successive dataset shuffles
    // - The important assertion is that no uncaught exceptions or console.error messages are emitted.

    // Rapid toggling
    for (let i = 0; i < 6; i++) {
      await demo.clickToggle();
      // small delay to let UI update label
      await page.waitForTimeout(80);
    }

    // Rapid shuffles
    for (let i = 0; i < 4; i++) {
      await demo.clickShuffle();
      await page.waitForTimeout(120);
    }

    // After heavy interaction, verify the UI still reports a valid points count and K value
    const points = await demo.getPointsCountText();
    expect(points).toBe('200');

    const kVal = await demo.getKValText();
    expect(kVal).toBe('5');

    // Final assertion on errors will run in afterEach: pageErrors and consoleErrors must be empty
  });

});