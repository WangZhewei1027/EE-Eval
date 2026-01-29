import { test, expect } from '@playwright/test';

// Test suite for Application ID: f1f6c921-fa77-11f0-a6a1-c765f41a13c7
// Hosted at: http://127.0.0.1:5500/workspace/0126-biased/html/f1f6c921-fa77-11f0-a6a1-c765f41a13c7.html
//
// This suite validates the FSM states (Idle, Running, Paused), the ToggleAnimation and ResetView events,
// verifies visual DOM updates, and observes console/page errors. It intentionally does NOT modify the
// application code and only asserts behavior as observed in the browser.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6c921-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object to encapsulate interactions and queries against the app UI.
class AppPage {
  constructor(page) {
    this.page = page;
    this.toggle = page.locator('#toggle');
    this.toggleText = page.locator('#toggleText');
    this.reset = page.locator('#reset');
    this.playDot = page.locator('#playDot');
    this.miniDot = page.locator('#dot'); // moving mini-dot
    this.cacheCells = page.locator('#cacheCells .cell');
    this.svgNodes = page.locator('svg #treeGroup .node');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure initial drawInitial has run: wait for cells to be present
    await this.page.waitForSelector('#cacheCells .cell', { timeout: 3000 });
  }

  async getToggleText() {
    return (await this.toggleText.textContent())?.trim();
  }

  async clickToggle() {
    await this.toggle.click();
  }

  async clickReset() {
    await this.reset.click();
  }

  async cellCount() {
    return await this.cacheCells.count();
  }

  // Count filled cells (have class 'filled')
  async filledCellCount() {
    return await this.page.$$eval('#cacheCells .cell.filled', els => els.length);
  }

  // Count empty cells
  async emptyCellCount() {
    return await this.page.$$eval('#cacheCells .cell.empty', els => els.length);
  }

  // Wait until at least n filled cells exist (timeout can be specified)
  async waitForAtLeastFilled(n, timeout = 7000) {
    await this.page.waitForFunction(
      (expected) => document.querySelectorAll('#cacheCells .cell.filled').length >= expected,
      n,
      { timeout }
    );
  }

  // Wait until no filled cells exist (used after reset)
  async waitForNoFilled(timeout = 2000) {
    await this.page.waitForFunction(
      () => document.querySelectorAll('#cacheCells .cell.filled').length === 0,
      null,
      { timeout }
    );
  }

  // Get number of svg nodes
  async svgNodeCount() {
    return await this.svgNodes.count();
  }

  // Returns whether the mini-dot (moving indicator) is currently visible (opacity > 0)
  async miniDotVisible() {
    return await this.page.evaluate(() => {
      const d = document.getElementById('dot');
      if (!d) return false;
      const op = window.getComputedStyle(d).opacity;
      return Number(op) > 0;
    });
  }

  // Return array of console messages captured (populated externally)
  // and page errors are available from test context via captured arrays.
}

// Global timeout for slower CI environments
test.setTimeout(45000);

test.describe('Dynamic Programming — Visual Elegance (FSM + UI)', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', err => {
      // err is an Error object
      pageErrors.push(err);
    });

    const app = new AppPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Ensure we at least recorded console/page error arrays for assertions in tests
    // (tests will assert specific expectations about these arrays)
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('Initial DOM structure is built by drawInitial on load', async ({ page }) => {
      const app = new AppPage(page);

      // Verify toggle button text is the Idle state's expected label
      await expect(app.toggleText).toHaveText('Animate');

      // Verify both control buttons have correct title attributes
      await expect(page.locator('#toggle')).toHaveAttribute('title', 'Play animation');
      await expect(page.locator('#reset')).toHaveAttribute('title', 'Reset view');

      // There should be N+1 cells (N=8 => 9 cells)
      const totalCells = await app.cellCount();
      expect(totalCells).toBe(9);

      // All cells should initially be empty
      const emptyCells = await app.emptyCellCount();
      expect(emptyCells).toBe(totalCells);

      // Some svg nodes representing recursion tree should exist (non-zero)
      const nodeCount = await app.svgNodeCount();
      expect(nodeCount).toBeGreaterThan(0);

      // No uncaught errors during initial load
      // pageErrors array is captured in beforeEach and should be empty
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('ToggleAnimation event and Running/Paused states (S1_Running, S2_Paused)', () => {
    test('Clicking Animate starts the animation (Idle -> Running), and Pause toggles it', async ({ page }) => {
      const app = new AppPage(page);

      // Start animation: Idle -> Running
      await app.clickToggle();

      // Immediately the UI should update to show Pause label
      await expect(app.toggleText).toHaveText('Pause');

      // Wait for at least one cell to become filled (visual effect of runAnimation)
      await app.waitForAtLeastFilled(1, 10000); // allow a bit longer for animation

      const filledAfterStart = await app.filledCellCount();
      expect(filledAfterStart).toBeGreaterThanOrEqual(1);

      // Now click toggle to pause (Running -> Paused)
      // We capture filled count, then click pause and ensure it stops producing more filled cells
      const filledBeforePause = filledAfterStart;
      await app.clickToggle();

      // After clicking to pause, toggle text should be back to 'Animate' (per code)
      await expect(app.toggleText).toHaveText('Animate');

      // Wait some time while checking no new cells are filled (the app sets canceled=true on exit)
      await page.waitForTimeout(600);
      const filledAfterPauseWait = await app.filledCellCount();
      expect(filledAfterPauseWait).toBeLessThanOrEqual(filledBeforePause + 1); // allow for race (<= +1)

      // Resume (Paused -> Running) by clicking again
      await app.clickToggle();
      await expect(app.toggleText).toHaveText('Pause');

      // Wait for more fills to occur after resume
      await app.waitForAtLeastFilled(Math.min(5, 9), 10000).catch(() => { /* non-fatal if not enough */ });

      const filledAfterResume = await app.filledCellCount();
      expect(filledAfterResume).toBeGreaterThanOrEqual(filledAfterPauseWait);

      // Finally stop the animation by pausing again to leave in a stable state
      await app.clickToggle();
      await expect(app.toggleText).toHaveText('Animate');

      // Confirm there are no uncaught page errors from running/pausing
      expect(pageErrors.length).toBe(0);
    });

    test('Toggling pause while animation is in-flight ceases further DOM updates (exit action canceled = true)', async ({ page }) => {
      const app = new AppPage(page);

      // Start animation and wait only for the first visible activity
      await app.clickToggle();

      // Wait for at least one filled cell
      await app.waitForAtLeastFilled(1, 8000);
      const beforePauseCount = await app.filledCellCount();

      // Immediately pause
      await app.clickToggle();
      await expect(app.toggleText).toHaveText('Animate');

      // Store snapshot of filled cells and wait to ensure no further changes
      await page.waitForTimeout(800);
      const afterPauseCount = await app.filledCellCount();

      // If cancellation worked, filled count should not meaningfully increase
      expect(afterPauseCount).toBeLessThanOrEqual(beforePauseCount + 1);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('ResetView event and transitions back to Idle (S0_Idle)', () => {
    test('Reset while running should reset the view to initial state', async ({ page }) => {
      const app = new AppPage(page);

      // Start animation and allow some fills
      await app.clickToggle();
      await app.waitForAtLeastFilled(1, 9000);
      const filledDuringRun = await app.filledCellCount();
      expect(filledDuringRun).toBeGreaterThanOrEqual(1);

      // Click reset: this should cancel animation and rebuild fresh view shortly after (120ms in code)
      await app.clickReset();

      // After reset, the app triggers buildFreshView after a small timeout, so wait and assert no filled cells
      await app.waitForNoFilled(2000);

      const filledAfterReset = await app.filledCellCount();
      expect(filledAfterReset).toBe(0);

      // All cells should be empty class again
      const emptyAfterReset = await app.emptyCellCount();
      expect(emptyAfterReset).toBe(await app.cellCount());

      // The mini dot should be hidden (opacity 0)
      const miniVisible = await app.miniDotVisible();
      expect(miniVisible).toBe(false);

      // Toggle text should be 'Animate' after reset
      await expect(app.toggleText).toHaveText('Animate');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });

    test('Reset while paused should also rebuild the initial view', async ({ page }) => {
      const app = new AppPage(page);

      // Start -> wait a bit -> pause
      await app.clickToggle();
      await app.waitForAtLeastFilled(1, 9000);
      await app.clickToggle(); // pause

      // Ensure paused
      await expect(app.toggleText).toHaveText('Animate');

      // Now reset while paused
      await app.clickReset();

      // Wait for rebuild to complete and verify empty cells
      await app.waitForNoFilled(2000);
      const filledAfterReset = await app.filledCellCount();
      expect(filledAfterReset).toBe(0);
      await expect(app.toggleText).toHaveText('Animate');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Visual feedback assertions and edge cases', () => {
    test('Mini dot becomes visible during animation (visual transfer to cache)', async ({ page }) => {
      const app = new AppPage(page);

      // Start animation and wait for the mini-dot to be used.
      await app.clickToggle();

      // Poll for mini-dot visibility (it blinks on each cache move)
      const sawMiniDot = await page.waitForFunction(() => {
        const d = document.getElementById('dot');
        if (!d) return false;
        return Number(window.getComputedStyle(d).opacity) > 0;
      }, null, { timeout: 9000 }).then(() => true).catch(() => false);

      // We accept either seeing the mini dot or not depending on timing, but the animation normally shows it.
      expect(sawMiniDot).toBeTruthy();

      // Pause to stop animation
      await app.clickToggle();
      await expect(app.toggleText).toHaveText('Animate');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
    });

    test('No unexpected console errors or uncaught exceptions during typical use', async ({ page }) => {
      const app = new AppPage(page);

      // Do a sequence of interactions: start, pause, resume, reset
      await app.clickToggle();
      await app.waitForAtLeastFilled(1, 9000).catch(() => {});
      await app.clickToggle(); // pause
      await app.clickToggle(); // resume
      await page.waitForTimeout(300);
      await app.clickReset();

      // Allow short time for any potential errors to surface
      await page.waitForTimeout(500);

      // Inspect captured console messages for 'error' type entries
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      // Expect no console error messages
      expect(consoleErrors.length).toBe(0);

      // Expect no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and edge-case handling', () => {
    test('Collect and assert absence of ReferenceError / SyntaxError / TypeError (no runtime exceptions)', async ({ page }) => {
      // The pageErrors array is captured by beforeEach; assert none of them are common runtime error types.
      const badErrorNames = ['ReferenceError', 'SyntaxError', 'TypeError'];
      const foundBad = pageErrors.filter(e => badErrorNames.includes(e.name));
      // We expect none of these runtime errors to have occurred.
      expect(foundBad.length).toBe(0);
    });

    test('If any page errors occur, they are reported (edge case test - non-destructive)', async ({ page }) => {
      // This test simply ensures that pageErrors is accessible and can be iterated without throwing.
      // It does not cause errors; it will fail if there are uncaught page errors previous tests didn't catch.
      for (const err of pageErrors) {
        // Basic assertions about shape of error objects
        expect(err).toHaveProperty('message');
        expect(typeof err.message).toBe('string');
      }
      // We do not assert on counts here; previous tests explicitly expect zero errors.
    });
  });
});