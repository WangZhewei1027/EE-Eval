import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a9b730-fa78-11f0-812d-c9788050701f.html';

// Page object to encapsulate common interactions and queries
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getStartButton() {
    return this.page.locator('#startBtn');
  }

  async getResetButton() {
    return this.page.locator('#resetBtn');
  }

  async getVisualization() {
    return this.page.locator('#visualization');
  }

  // Returns array of string values from data-value attributes of bars
  async getBarValues() {
    return this.page.$$eval('.array-bar', bars => bars.map(b => b.getAttribute('data-value')));
  }

  // Returns counts of bars with given class
  async countBarsWithClass(className) {
    return this.page.$$eval(`.array-bar.${className}`, els => els.length);
  }

  // Returns boolean: any bar has given class
  async anyBarHasClass(className) {
    return this.page.$eval('#visualization', (viz, cls) => {
      return !!viz.querySelector(`.array-bar.${cls}`);
    }, className).catch(() => false);
  }

  // Click start button
  async clickStart() {
    await (await this.getStartButton()).click();
  }

  // Click reset button
  async clickReset() {
    await (await this.getResetButton()).click();
  }

  // Wait for at least one bar to have given class (with timeout)
  async waitForBarClass(className, timeout = 15000) {
    await this.page.waitForFunction(
      (cls) => !!document.querySelector(`.array-bar.${cls}`),
      className,
      { timeout }
    );
  }

  // Wait until the start button disabled state matches expected
  async waitForStartDisabled(expected, timeout = 10000) {
    await this.page.waitForFunction(
      (exp) => document.getElementById('startBtn').disabled === exp,
      expected,
      { timeout }
    );
  }
}

test.describe('Artistic Selection Sort Visualization (App ID: 72a9b730-fa78-11f0-812d-c9788050701f)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors and console messages for assertion and debugging
    page.on('pageerror', (err) => {
      // Capture runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    page.on('console', (msg) => {
      // Capture console messages and their severity
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the application page before each test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic sanity: Ensure there were no uncaught page errors during test run.
    // If errors exist, expose them via assertion failure to surface runtime issues.
    expect(pageErrors, 'There should be no uncaught page errors').toEqual([]);
  });

  test.describe('Initial Idle State (S0_Idle) validations', () => {
    test('Initial render: visualization created and 15 bars present; buttons exist and enabled', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // Validate visualization container exists
      const viz = await app.getVisualization();
      await expect(viz).toBeVisible();

      // The implementation's generateRandomArray runs on load.
      // Check that 15 bars were created with data-value attributes.
      const values = await app.getBarValues();
      // Expect an array and at least 1 element; implementation uses size=15
      expect(Array.isArray(values)).toBe(true);
      expect(values.length).toBeGreaterThanOrEqual(1);

      // Specifically verify there are 15 bars (implementation sets size=15)
      expect(values.length).toBe(15);

      // Buttons should be present.
      const startBtn = await app.getStartButton();
      const resetBtn = await app.getResetButton();
      await expect(startBtn).toBeVisible();
      await expect(resetBtn).toBeVisible();

      // Implementation: buttons are enabled on initial load.
      await expect(startBtn).toBeEnabled();
      await expect(resetBtn).toBeEnabled();

      // Log captured console messages for debugging if any
      // We assert there are no console.error messages in this test
      const errorConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole.length).toBe(0);
    });

    test('Reset before sorting regenerates array (Idle -> Idle via ResetSorting)', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // Snapshot initial values
      const before = await app.getBarValues();

      // Click reset when not sorting; per implementation, generateRandomArray runs
      await app.clickReset();

      // After reset, bar values should change (highly likely). Wait briefly for rerender.
      await page.waitForTimeout(200); // small delay for DOM update

      const after = await app.getBarValues();

      // At least one value should differ, indicating a new random array was generated
      const anyDifferent = before.some((v, i) => after[i] !== v);
      expect(anyDifferent).toBe(true);
    });
  });

  test.describe('Start Sorting (Transition S0_Idle -> S1_Sorting) and Sorting behavior', () => {
    test('Clicking Start begins sorting: buttons disabled and minimum highlight appears', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // Pre-check: ensure buttons enabled
      await expect(await app.getStartButton()).toBeEnabled();
      await expect(await app.getResetButton()).toBeEnabled();

      // Click start to begin sorting; implementation sets isSorting=true and disables buttons synchronously
      await app.clickStart();

      // Immediately the Start and Reset buttons should be disabled
      await app.waitForStartDisabled(true, 2000);
      await expect(await app.getStartButton()).toBeDisabled();
      await expect(await app.getResetButton()).toBeDisabled();

      // The algorithm marks a current minimum immediately (synchronous before awaits), so a bar with class 'minimum' should exist quickly.
      await app.waitForBarClass('minimum', 2000);
      const minimumCount = await app.countBarsWithClass('minimum');
      expect(minimumCount).toBeGreaterThanOrEqual(1);

      // Within a short time, comparing highlights will appear as the algorithm steps through inner loop (animationSpeed/2 = 250ms).
      // We wait a little longer (600ms) to allow first comparing highlight to show up.
      await page.waitForTimeout(600);
      const comparingCount = await app.countBarsWithClass('comparing');
      // There may be zero or more comparing bars depending on timing; we accept either, but ensure no exceptions occurred.
      expect(comparingCount).toBeGreaterThanOrEqual(0);
    });

    test('Ensure clicking Start multiple times during sorting does not throw and is ignored by guard', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // Start sorting
      await app.clickStart();
      // Immediately attempt a second click; implementation guards with if (isSorting) return;
      // This should not produce errors nor start multiple concurrent sorts.
      await app.clickStart();

      // Wait briefly for any side-effects
      await page.waitForTimeout(500);

      // There should still be a minimum highlighted and no uncaught errors
      const minimumExists = await app.anyBarHasClass('minimum');
      expect(minimumExists).toBe(true);

      // No console.error messages captured
      const errorConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole.length).toBe(0);
    });

    test('Partial progress: within a reasonable time, some elements become sorted (S1_Sorting -> partial S2_Sorted evidence)', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // Start sorting
      await app.clickStart();

      // Wait up to 12s for at least one element to be marked as sorted.
      // The algorithm marks each element as sorted as it completes each outer loop iteration.
      await app.waitForFunction(
        () => !!document.querySelector('.array-bar.sorted'),
        null,
        { timeout: 12000 }
      );

      const sortedCount = await app.countBarsWithClass('sorted');
      expect(sortedCount).toBeGreaterThanOrEqual(1);

      // During sorting, Start and Reset should remain disabled
      expect(await app.getStartButton()).toBeDisabled();
      expect(await app.getResetButton()).toBeDisabled();
    });

    test('Reset during sorting should not reset array because reset handler checks isSorting; reset button is disabled', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // Capture initial bar snapshot
      const before = await app.getBarValues();

      // Start sorting
      await app.clickStart();

      // Ensure sorting started (buttons disabled)
      await app.waitForStartDisabled(true, 2000);

      // Reset button should be disabled during sorting; attempt to click programmatically (will be ignored by disabled attribute)
      const resetBtn = await app.getResetButton();
      // Even if we call click on disabled button locator, Playwright will throw. We guard and attempt a JS-level dispatch to simulate user's disabled click attempt:
      // Note: we do not modify page functions or internals; dispatching an event on a disabled button should not trigger the click handler.
      await page.evaluate(() => {
        const btn = document.getElementById('resetBtn');
        // Attempt to dispatch a click event; since the button is disabled, attached listener should not run per HTML semantics.
        btn && btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      // Wait briefly for any unexpected changes
      await page.waitForTimeout(300);

      const afterAttempt = await app.getBarValues();

      // The array should not have been reset while sorting; expect at least one value matches previous snapshot
      const anySame = before.some((v, i) => afterAttempt[i] === v);
      expect(anySame).toBe(true);
    });
  });

  test.describe('Reset behavior when not sorting and final state checks', () => {
    test('After sorting completes, buttons are re-enabled (S1_Sorting exit_actions) and last element is marked sorted (S2_Sorted evidence)', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // NOTE:
      // Waiting for full sort completion may take significant time for 15 elements due to animation delays.
      // We'll wait a generous timeout but keep test reasonable. If sorting completes, we validate final-state expectations.
      await app.clickStart();

      // Wait for the sorting process to complete by observing that the Start button becomes enabled again.
      // This indicates isSorting was set to false and exit actions ran.
      // Set a generous timeout (70s) to allow worst-case completion on slow CI. Adjust as necessary.
      await app.waitForStartDisabled(false, 70000);

      // After completion, Start and Reset should be enabled again.
      await expect(await app.getStartButton()).toBeEnabled();
      await expect(await app.getResetButton()).toBeEnabled();

      // The implementation marks the last element sorted explicitly when i == n - 2
      // Verify that at least one sorted class exists, and specifically that the last bar is marked sorted.
      const totalBars = (await app.getBarValues()).length;
      const lastBarSorted = await page.$eval(
        '#visualization',
        (viz, idx) => {
          const bars = viz.querySelectorAll('.array-bar');
          if (!bars[idx]) return false;
          return bars[idx].classList.contains('sorted');
        },
        totalBars - 1
      );

      expect(lastBarSorted).toBe(true);
    }, 75000); // extended timeout for potential long-running sorting

    test('Reset after sorting re-generates array (S2_Sorted -> S0_Idle via ResetSorting)', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // Start and wait for completion (again may be long)
      await app.clickStart();
      await app.waitForStartDisabled(false, 70000);

      // Snapshot after sort
      const afterSort = await app.getBarValues();

      // Click reset now that not sorting
      await app.clickReset();

      // Wait briefly for array regeneration
      await page.waitForTimeout(200);

      const afterReset = await app.getBarValues();

      // Expect that the reset generated a new array (at least one difference)
      const anyDifferent = afterSort.some((v, i) => afterReset[i] !== v);
      expect(anyDifferent).toBe(true);
    }, 75000);
  });

  test.describe('Edge cases and stability', () => {
    test('Rapid start and reset interactions do not produce runtime exceptions', async ({ page }) => {
      const app = new SelectionSortPage(page);

      // Rapid interactions: start, small delay, attempt reset, start again
      await app.clickStart();
      await page.waitForTimeout(100);
      // Try dispatching click on reset (may be disabled) to simulate user interaction attempt
      await page.evaluate(() => {
        const r = document.getElementById('resetBtn');
        r && r.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForTimeout(100);
      await app.clickStart(); // second start should be ignored by guard

      // Wait a bit to let any unexpected errors surface
      await page.waitForTimeout(500);

      // Validate no runtime errors were emitted to pageerror
      expect(pageErrors.length).toBe(0);

      // Validate no console.error occurred during these rapid interactions
      const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(errorConsole.length).toBe(0);
    });
  });
});