import { test, expect } from '@playwright/test';

test.setTimeout(60000);

// URL of the page under test
const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c971840-fa78-11f0-857d-d58e82d5de73.html';

// Page Object for the Radix Sort Visualizer
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(PAGE_URL);
  }

  startButton() {
    return this.page.locator('#start-button');
  }

  resetButton() {
    return this.page.locator('#reset-button');
  }

  bars() {
    return this.page.locator('#bars-container .bar');
  }

  buckets() {
    return this.page.locator('#buckets-area .bucket');
  }

  // Read the aria-label applied to the start button (used as message channel)
  async startButtonAriaLabel() {
    return this.page.getAttribute('#start-button', 'aria-label');
  }

  // Wait until the animation/system reports sorting complete via aria-label
  async waitForSortingComplete(timeout = 45000) {
    const expected = 'Sorting complete! Array sorted in ascending order.';
    await this.page.waitForFunction(
      (sel, expectedText) => {
        const el = document.querySelector(sel);
        return el && el.getAttribute('aria-label') === expectedText;
      },
      '#start-button',
      expected,
      { timeout }
    );
  }
}

test.describe('Radix Sort Visualizer - FSM and UI Validation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages for additional diagnostics
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure there were no uncaught page errors during the test run.
    // If there are page errors, include them in the assertion message to aid debugging.
    if (pageErrors.length > 0) {
      // Print errors and console messages to test output to aid debugging
      console.error('Captured page errors:', pageErrors);
      console.error('Captured console messages:', consoleMessages);
    }
    expect(pageErrors.length, 'No uncaught page errors should be present').toBe(0);

    // Ensure no critical console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    if (consoleErrors.length > 0) {
      console.warn('Console errors/warnings detected:', consoleErrors);
    }
    expect(consoleErrors.length, 'No console error/warning messages expected').toBe(0);
  });

  test.describe('S0_Ready (Initial Ready State)', () => {
    test('Initial load sets Ready state: Start enabled, Reset disabled, and ARIA message updated', async ({ page }) => {
      // Arrange
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Assert: Start button is present and enabled
      const startBtn = vp.startButton();
      await expect(startBtn).toBeVisible();
      await expect(startBtn).toBeEnabled();

      // Assert: Reset button is present and disabled
      const resetBtn = vp.resetButton();
      await expect(resetBtn).toBeVisible();
      await expect(resetBtn).toBeDisabled();

      // The resetVisualization called on load should set a ready ARIA message
      const aria = await vp.startButtonAriaLabel();
      expect(aria).toBe('Ready to start Radix Sort animation.');

      // Assert: Bars generated equal expected array length (ARRAY_LENGTH = 14)
      const barsCount = await vp.bars().count();
      expect(barsCount, 'Expected 14 bars to be present on initial state').toBe(14);

      // Assert: Ten buckets are created
      const bucketsCount = await vp.buckets().count();
      expect(bucketsCount, 'Expected 10 buckets for digits 0-9').toBe(10);

      // Sanity check: each bar should have a value-label subelement and data-index
      for (let i = 0; i < barsCount; i++) {
        const bar = vp.bars().nth(i);
        await expect(bar.getAttribute('data-index')).resolves.toBe(String(i));
        await expect(bar.locator('.value-label')).toBeVisible();
      }
    });
  });

  test.describe('S0 -> S1: StartAnimation Transition (Ready -> Sorting)', () => {
    test('Clicking Start transitions to Sorting: Start disabled and Reset stays disabled during animation', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Capture a snapshot of the ARIA message before starting
      const beforeMessage = await vp.startButtonAriaLabel();
      expect(beforeMessage).toBe('Ready to start Radix Sort animation.');

      // Act: Click Start
      await vp.startButton().click();

      // Immediately after click, verify start becomes disabled and reset is disabled (entry evidence)
      await expect(vp.startButton()).toBeDisabled();
      await expect(vp.resetButton()).toBeDisabled();

      // During sorting there should be at least one moment where bars are highlighted for digit processing.
      // This checks that the animation code is running and manipulating the DOM.
      // Wait for any bar to gain the data-highlight attribute for "digit" (short timeout).
      const anyDigitHighlight = await page.waitForSelector('.bar[data-highlight="digit"]', { timeout: 8000 }).catch(() => null);
      expect(anyDigitHighlight, 'Expected at least one bar to be highlighted during sorting').not.toBeNull();

      // Ensure reset still disabled (we cannot reset during sorting per implementation)
      await expect(vp.resetButton()).toBeDisabled();
    });

    test('Attempting to use Reset during Sorting does not prematurely reset the visualization', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Start sorting
      await vp.startButton().click();

      // Sanity: reset must be disabled during sorting
      await expect(vp.resetButton()).toBeDisabled();

      // Attempt to click the disabled reset button. Playwright will click the element DOM node,
      // but browser ignores clicks on disabled controls. We assert that nothing changed.
      // We do not force the click because we must not patch or override runtime behavior.
      try {
        await vp.resetButton().click({ timeout: 2000 });
      } catch (e) {
        // If Playwright throws because the element is not actionable, that's acceptable;
        // we still need to assert that sorting state remains active.
      }

      // After the attempted click, ensure we are still in sorting: start disabled, reset disabled
      await expect(vp.startButton()).toBeDisabled();
      await expect(vp.resetButton()).toBeDisabled();
    });
  });

  test.describe('S1 -> S2: Sorting Complete (Sorting -> Sorted) and Reset back to Ready', () => {
    test('Full sorting run should eventually mark bars as sorted and enable Reset', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Record the initial set of values shown before sorting completes
      const initialValues = await page.$$eval('#bars-container .bar .value-label', els => els.map(e => e.textContent));

      // Act: start the sort
      await vp.startButton().click();

      // Wait for sorting to complete as indicated by aria-label change
      await vp.waitForSortingComplete(45000);

      // Assert: aria-label on start button updated to sorting complete message
      const finalMessage = await vp.startButtonAriaLabel();
      expect(finalMessage).toBe('Sorting complete! Array sorted in ascending order.');

      // Assert: all bars have class 'sorted'
      const barsCount = await vp.bars().count();
      expect(barsCount).toBe(14);
      for (let i = 0; i < barsCount; i++) {
        await expect(vp.bars().nth(i)).toHaveClass(/sorted/);
      }

      // Assert: startBtn remains disabled and resetBtn is now enabled (entry evidence on Sorted)
      await expect(vp.startButton()).toBeDisabled();
      await expect(vp.resetButton()).toBeEnabled();

      // Capture final values
      const sortedValues = await page.$$eval('#bars-container .bar .value-label', els => els.map(e => e.textContent));

      // The final array (sortedValues) should be a sorted ascending numeric list of the same length
      const numeric = sortedValues.map(s => parseInt(s, 10));
      const sortedNumeric = [...numeric].sort((a, b) => a - b);
      expect(numeric, 'Final values should be sorted ascending').toEqual(sortedNumeric);
      expect(numeric.length).toBe(initialValues.length);

      // Now test Reset action moves application back to Ready (S2 -> S0 via Reset)
      await vp.resetButton().click();

      // After resetVisualization, start should be enabled and reset disabled again
      await expect(vp.startButton()).toBeEnabled();
      await expect(vp.resetButton()).toBeDisabled();

      // ARIA message should be restored to the ready message
      const readyMessage = await vp.startButtonAriaLabel();
      expect(readyMessage).toBe('Ready to start Radix Sort animation.');

      // After reset, bars should be re-generated (still 14) and no 'sorted' class present
      const postResetBarsCount = await vp.bars().count();
      expect(postResetBarsCount).toBe(14);

      // Ensure none of the bars are marked sorted after reset
      const anySortedAfterReset = await page.$('#bars-container .bar.sorted');
      expect(anySortedAfterReset, 'No bars should be marked sorted after a reset').toBeNull();

      // And the new values are present; they may or may not differ from previous run (random),
      // but the DOM should be valid and contain value-labels
      const postResetValues = await page.$$eval('#bars-container .bar .value-label', els => els.map(e => e.textContent));
      expect(postResetValues.length).toBe(14);
    });
  });

  test.describe('Edge cases and DOM invariants', () => {
    test('Buckets are always 10 and bucket DOM structure remains consistent through runs', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Initial bucket count
      const bucketsInitial = await vp.buckets().count();
      expect(bucketsInitial).toBe(10);

      // Start and wait for one stage of animation (not necessarily completion) to exercise bucket creation/updates
      await vp.startButton().click();

      // Wait for any bucket to become active (data-active attribute) as the animation runs
      const activeBucket = await page.waitForSelector('#buckets-area .bucket[data-active="true"]', { timeout: 10000 }).catch(() => null);
      expect(activeBucket, 'At least one bucket should become active during the animation').not.toBeNull();

      // After a short delay, attempt to stop waiting for completion; do not force-cancel animation.
      // Instead, we will wait for full completion in previously defined tests. Here, we assert invariants.
      // Ensure the buckets count remains 10 while animation is running.
      const bucketsDuring = await vp.buckets().count();
      expect(bucketsDuring).toBe(10);
    });

    test('No unexpected ReferenceError/SyntaxError/TypeError thrown during initialization and runs', async ({ page }) => {
      // This test explicitly monitors page errors (registered in beforeEach).
      // We load the page and perform a short run to exercise code paths; any uncaught exceptions will have been captured.
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Quick validation: trigger a short run by starting and then waiting until highlight occurs.
      await vp.startButton().click();
      await page.waitForSelector('.bar[data-highlight="digit"]', { timeout: 10000 }).catch(() => null);

      // This test's final assertions are handled in afterEach where we assert zero pageErrors and no console errors.
      // No extra assertions here to avoid duplicate failure messages.
    });
  });
});