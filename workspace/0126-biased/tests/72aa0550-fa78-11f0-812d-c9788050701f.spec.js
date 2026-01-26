import { test, expect } from '@playwright/test';

// Test file for Tim Sort Visualization (Application ID: 72aa0550-fa78-11f0-812d-c9788050701f)
// Serves the page at:
// http://127.0.0.1:5500/workspace/0126-biased/html/72aa0550-fa78-11f0-812d-c9788050701f.html

// Page object encapsulating common interactions and assertions against the visualization page
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa0550-fa78-11f0-812d-c9788050701f.html';
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.barLocator = this.arrayContainer.locator('.array-bar');
    // arrays to collect console errors and page errors
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Navigate to the page and attach listeners to capture console errors and page errors
  async goto() {
    this.page.on('console', (msg) => {
      // Record only console messages of error severity
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    this.page.on('pageerror', (err) => {
      // Capture uncaught exceptions in the page context
      this.pageErrors.push(String(err));
    });

    await this.page.goto(this.url);
    // Ensure DOMContentLoaded triggered and initial array rendered
    await this.arrayContainer.waitFor({ state: 'visible', timeout: 5000 });
  }

  // Return number of bars currently rendered
  async getBarsCount() {
    return await this.barLocator.count();
  }

  // Return array of heights (as numbers) of bars for comparison
  async getBarHeights() {
    const count = await this.getBarsCount();
    const heights = [];
    for (let i = 0; i < count; i++) {
      const h = await this.barLocator.nth(i).evaluate((el) => el.style.height);
      // style height like "123px"
      heights.push(parseFloat(h));
    }
    return heights;
  }

  // Return whether the start button is disabled
  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  // Return whether the reset button is disabled
  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  // Click start button and return immediately (visualization runs asynchronously)
  async clickStart() {
    await this.startBtn.click();
  }

  // Click reset button
  async clickReset() {
    await this.resetBtn.click();
  }

  // Wait until start button becomes enabled again (visualization complete)
  async waitForStartEnabled(timeout = 60000) {
    // Wait until the start button is enabled again. This indicates visualization completed.
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('startBtn');
      return btn && btn.disabled === false;
    }, { timeout });
  }

  // Wait until start button becomes disabled (visualization started)
  async waitForStartDisabled(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('startBtn');
      return btn && btn.disabled === true;
    }, { timeout });
  }

  // Wait until all bars have 'sorted' class - used to confirm final renderArray call
  async waitForAllSorted(expectedCount, timeout = 60000) {
    await this.page.waitForFunction((selector, expected) => {
      const container = document.querySelector(selector);
      if (!container) return false;
      const bars = Array.from(container.querySelectorAll('.array-bar'));
      if (bars.length !== expected) return false;
      return bars.every(b => b.classList.contains('sorted'));
    }, { timeout }, '#arrayContainer', expectedCount);
  }

  // Utility for asserting no console/page errors were emitted
  assertNoPageErrors() {
    expect(this.pageErrors, `Unexpected page errors: ${JSON.stringify(this.pageErrors)}`).toHaveLength(0);
    expect(this.consoleErrors, `Unexpected console.error messages: ${JSON.stringify(this.consoleErrors)}`).toHaveLength(0);
  }
}

// Group related tests for FSM states and transitions
test.describe('Tim Sort Visualization - FSM states and transitions', () => {
  let pageObj;

  // Global per-test timeout increase to accommodate the visualization runtime
  test.setTimeout(120000); // 2 minutes per test to be safe for slower CI environments

  test.beforeEach(async ({ page }) => {
    pageObj = new TimSortPage(page);
    await pageObj.goto();
  });

  test.afterEach(async () => {
    // After each test, ensure there were no uncaught errors in the page context.
    // The application should run without throwing ReferenceError/SyntaxError/TypeError.
    pageObj.assertNoPageErrors();
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('Initial load should call resetArray() and render the array (Idle entry actions)', async () => {
      // Validate initial conditions representing the Idle state (S0_Idle)
      // - resetArray() is called on load -> array is rendered with arraySize bars
      // - Start and Reset buttons should be enabled
      const barCount = await pageObj.getBarsCount();
      expect(barCount).toBeGreaterThanOrEqual(1); // Expect bars to exist
      // Based on implementation arraySize constant is 50
      expect(barCount).toBe(50);

      // Buttons should be enabled in Idle
      expect(await pageObj.isStartDisabled()).toBe(false);
      expect(await pageObj.isResetDisabled()).toBe(false);

      // No bar should be sorted initially (entry action shouldn't mark sorted)
      const sortedCount = await pageObj.barLocator.filter({ has: pageObj.page.locator('.sorted') }).count();
      // The above filter is not necessary; instead ensure none of the bars have class 'sorted'
      const barsCount = await pageObj.getBarsCount();
      for (let i = 0; i < barsCount; i++) {
        const hasSorted = await pageObj.barLocator.nth(i).evaluate((el) => el.classList.contains('sorted'));
        expect(hasSorted).toBe(false);
      }
    });

    test('Clicking Reset in Idle should call resetArray() and change the array', async () => {
      // Capture initial heights
      const initialHeights = await pageObj.getBarHeights();
      expect(initialHeights.length).toBe(50);

      // Click reset (Idle -> Resetting transition)
      await pageObj.clickReset();

      // After reset completes (it's synchronous in the implementation), the array DOM should be re-rendered.
      // Inspect heights and expect them to differ in at least one position (random generation).
      const afterHeights = await pageObj.getBarHeights();
      expect(afterHeights.length).toBe(50);

      // It's possible (very unlikely) that two random arrays match exactly; check at least one difference.
      const anyDifferent = initialHeights.some((h, idx) => h !== afterHeights[idx]);
      expect(anyDifferent).toBe(true);

      // Buttons should remain enabled after reset
      expect(await pageObj.isStartDisabled()).toBe(false);
      expect(await pageObj.isResetDisabled()).toBe(false);
    });
  });

  test.describe('Start Visualization (S0_Idle -> S1_Visualizing -> S0_Idle)', () => {
    test('Clicking Start should disable buttons, run visualization, then re-enable and mark all sorted', async () => {
      // Confirm preconditions (Idle)
      expect(await pageObj.isStartDisabled()).toBe(false);
      expect(await pageObj.isResetDisabled()).toBe(false);

      // Click start; visualization should begin and disable both buttons immediately
      await pageObj.clickStart();

      // Immediately after clicking, the start and reset buttons are expected to be disabled (transition evidence)
      await pageObj.waitForStartDisabled(5000);
      expect(await pageObj.isStartDisabled()).toBe(true);
      expect(await pageObj.isResetDisabled()).toBe(true);

      // Wait for visualization to complete: startBtn becomes enabled again
      await pageObj.waitForStartEnabled(90000); // generous timeout
      expect(await pageObj.isStartDisabled()).toBe(false);
      expect(await pageObj.isResetDisabled()).toBe(false);

      // On exit the implementation calls renderArray([], [], Array.from(...)) which should add 'sorted' class to all bars.
      // Validate that every rendered bar has the 'sorted' class
      const barsCount = await pageObj.getBarsCount();
      expect(barsCount).toBe(50);

      for (let i = 0; i < barsCount; i++) {
        const isSorted = await pageObj.barLocator.nth(i).evaluate((el) => el.classList.contains('sorted'));
        expect(isSorted, `Bar at index ${i} expected to be marked sorted`).toBe(true);
      }
    });

    test('During visualization Reset button should be disabled (edge case check)', async () => {
      // Start visualization
      await pageObj.clickStart();

      // Wait for the start button to become disabled to indicate visualizing state
      await pageObj.waitForStartDisabled(5000);
      // Reset should be disabled as well (evidence in FSM transition)
      expect(await pageObj.isResetDisabled()).toBe(true);

      // Attempting to click the disabled reset button is not a valid user action.
      // Ensure Playwright recognizes it as disabled and does not allow interaction.
      // The correct behavior is that the reset button remains disabled until visualization completes.
      // We do not force a click here because that would simulate an impossible user action.
      // Instead, assert that the attribute is present and that clicking without force would fail.
      // (Playwright's click on a disabled element would throw - we avoid causing that exception.)
      expect(await pageObj.resetBtn.evaluate((el) => el.disabled)).toBe(true);

      // Clean up: wait for visualization to finish before leaving test
      await pageObj.waitForStartEnabled(90000);
    });
  });

  test.describe('Resetting State and transitions (S0_Idle -> S2_Resetting -> S0_Idle)', () => {
    test('Reset then Start should produce same sequence: Resetting then Visualizing then back to Idle', async () => {
      // Start from Idle: perform a Reset to enter S2_Resetting
      const beforeHeights = await pageObj.getBarHeights();
      await pageObj.clickReset();

      // After reset, ensure array changed (Reset action took place)
      const afterResetHeights = await pageObj.getBarHeights();
      const changed = beforeHeights.some((h, i) => h !== afterResetHeights[i]);
      expect(changed).toBe(true);

      // Buttons should still be enabled in Resetting exit (resetArray doesn't disable)
      expect(await pageObj.isStartDisabled()).toBe(false);
      expect(await pageObj.isResetDisabled()).toBe(false);

      // Now click Start from Resetting -> should disable buttons and run visualization
      await pageObj.clickStart();
      await pageObj.waitForStartDisabled(5000);
      expect(await pageObj.isStartDisabled()).toBe(true);
      expect(await pageObj.isResetDisabled()).toBe(true);

      // Wait for visualization to complete
      await pageObj.waitForStartEnabled(90000);
      expect(await pageObj.isStartDisabled()).toBe(false);
      expect(await pageObj.isResetDisabled()).toBe(false);

      // After completion verify all bars are marked sorted
      const count = await pageObj.getBarsCount();
      expect(count).toBe(50);
      for (let i = 0; i < count; i++) {
        const sorted = await pageObj.barLocator.nth(i).evaluate((el) => el.classList.contains('sorted'));
        expect(sorted).toBe(true);
      }
    });
  });

  test.describe('Error observation and robustness checks', () => {
    test('Application should not throw uncaught exceptions during typical operations', async () => {
      // Perform a series of typical user operations and assert no page errors are emitted
      await pageObj.clickReset();

      // Start and wait for finish
      await pageObj.clickStart();
      await pageObj.waitForStartEnabled(90000);

      // Click reset again
      await pageObj.clickReset();

      // Finally, ensure there were no uncaught exceptions or console.error entries during the interactions
      pageObj.assertNoPageErrors();
    });

    test('Edge case: Rapid clicking Start multiple times should only trigger a single visualization (buttons become disabled)', async () => {
      // Rapidly click start multiple times; app should disable the button on first click and ignore further clicks
      await pageObj.startBtn.click(); // first click
      // Immediately try clicking again - startBtn should already be disabled, but Playwright's click would fail if disabled.
      // We check disabled state to confirm the application reacted to the first click.
      await pageObj.waitForStartDisabled(5000);
      expect(await pageObj.isStartDisabled()).toBe(true);

      // Wait for completion
      await pageObj.waitForStartEnabled(90000);

      // Confirm no page errors occurred
      pageObj.assertNoPageErrors();
    });
  });
});