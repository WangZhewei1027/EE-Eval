import { test, expect } from '@playwright/test';

test.setTimeout(45000); // Allow enough time for the visualization to complete (delays in the app)

/**
 * Page object for the Merge Sort visualization page.
 * Encapsulates common interactions and queries to keep tests organized.
 */
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#startSort');
    this.arrayContainer = page.locator('#array');
    this.barLocator = page.locator('#array .bar');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/7b3b4b51-d360-11f0-b42e-71f0e7238799.html', { waitUntil: 'load' });
  }

  async clickStart() {
    await this.startButton.click();
  }

  async getBarValues() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#array .bar')).map(b => parseInt(b.innerText, 10));
    });
  }

  async getBarHeights() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#array .bar')).map(b => b.style.height);
    });
  }

  async getBarCount() {
    return await this.barLocator.count();
  }

  async getArrayLengthVariable() {
    return await this.page.evaluate(() => {
      // Read the global 'array' variable defined by the page
      return Array.isArray(window.array) ? window.array.length : null;
    });
  }

  async isSorted() {
    return await this.page.evaluate(() => {
      const vals = Array.from(document.querySelectorAll('#array .bar')).map(b => parseInt(b.innerText, 10));
      if (vals.length === 0) return false;
      for (let i = 1; i < vals.length; i++) {
        if (vals[i - 1] > vals[i]) return false;
      }
      return true;
    });
  }

  async waitForSorted(timeout = 30000) {
    await this.page.waitForFunction(() => {
      const vals = Array.from(document.querySelectorAll('#array .bar')).map(b => parseInt(b.innerText, 10));
      if (vals.length === 0) return false;
      for (let i = 1; i < vals.length; i++) {
        if (vals[i - 1] > vals[i]) return false;
      }
      return true;
    }, null, { timeout });
  }
}

test.describe('Merge Sort Visualization - FSM states and transitions', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors to assert runtime health
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // pageerror captures unhandled exceptions that bubble up to window
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure that no uncaught page errors occurred during the test.
    // This validates that the application runs without throwing exceptions for the tested interactions.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(errorConsoleCount, `Console errors were emitted: ${consoleMessages.filter(m => m.type === 'error').map(m => m.text).join(' | ')}`).toBe(0);
  });

  test('S0_Idle: Initial array generation on page load (generateArray entry action)', async ({ page }) => {
    // Validate initial state (S0_Idle): generateArray() should run on load and populate #array
    const app = new MergeSortPage(page);
    await app.goto();

    // There should be bars generated equal to the configured array size variable
    const arrayVariableLength = await app.getArrayLengthVariable();
    const barCount = await app.getBarCount();

    // The page defines arraySize = 20; ensure the DOM was populated accordingly
    expect(arrayVariableLength).toBeGreaterThan(0);
    expect(barCount).toBe(arrayVariableLength);

    // Each bar should have a numeric innerText between 0 and 99 and a CSS height style
    const values = await app.getBarValues();
    expect(values.length).toBe(barCount);
    for (const v of values) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(100);
    }

    // Ensure the element with id 'array' exists and contains bar elements
    await expect(page.locator('#array')).toBeVisible();
    await expect(page.locator('#startSort')).toBeVisible();
  });

  test('Transition S0_Idle -> S1_Sorting: Clicking Start Merge Sort starts visualization and produces DOM updates', async ({ page }) => {
    // Validate that clicking the start button triggers sorting (startSort), which uses mergeSortWithVisualization
    const app = new MergeSortPage(page);
    await app.goto();

    // Snapshot first bar's value before clicking
    const beforeValues = await app.getBarValues();
    const beforeFirstBar = beforeValues.length > 0 ? beforeValues[0] : null;

    // Click the button to trigger generateArray() then startSort()
    await app.clickStart();

    // Because generateArray() is called on click, the array will be re-generated immediately.
    // Wait for the DOM to be different from the snapshot to confirm that displayArray was invoked.
    // Use a reasonable timeout that is shorter than full sort completion, as we only need to see change.
    const firstBarChanged = await page.waitForFunction(
      previous => {
        const first = document.querySelector('#array .bar');
        if (!first) return false;
        const val = parseInt(first.innerText, 10);
        return val !== previous;
      },
      beforeFirstBar,
      { timeout: 3000 }
    );

    expect(firstBarChanged).toBeTruthy();

    // Also ensure no immediate runtime errors were produced by starting the sort
    // (pageErrors and consoleErrors are asserted in afterEach)
  });

  test('Transition S1_Sorting -> S2_Sorted: After sorting completes the array in the DOM is sorted (final state)', async ({ page }) => {
    // This test validates that the Sorting state completes and the final state S2_Sorted displays a sorted array.
    const app = new MergeSortPage(page);
    await app.goto();

    // Trigger sorting
    await app.clickStart();

    // Wait for the visualization to finish and the array to become sorted.
    // The implementation uses a 500ms delay per merge step, so allow generous timeout.
    await app.waitForSorted(30000); // up to 30s for sorting completion

    // After completion, verify the array in DOM is sorted non-decreasingly
    const finalValues = await app.getBarValues();
    expect(finalValues.length).toBeGreaterThan(0);

    for (let i = 1; i < finalValues.length; i++) {
      expect(finalValues[i - 1]).toBeLessThanOrEqual(finalValues[i]);
    }

    // Also validate that the global "array" variable has been updated to the sorted array
    const globalArray = await page.evaluate(() => window.array);
    expect(Array.isArray(globalArray)).toBe(true);
    expect(globalArray.length).toBe(finalValues.length);
    // Compare DOM displayed values to the global array values
    expect(globalArray.map(v => Number(v))).toEqual(finalValues.map(v => Number(v)));
  });

  test('Edge case: Multiple rapid clicks on Start Sort do not cause uncaught exceptions and result in a sorted array', async ({ page }) => {
    // Validate robustness when the user clicks Start Merge Sort multiple times quickly
    const app = new MergeSortPage(page);
    await app.goto();

    // Rapidly click the start button several times
    await app.startButton.click();
    await app.startButton.click();
    await app.startButton.click();

    // Sorting may have been kicked off multiple times; ensure the app still reaches a sorted final state
    await app.waitForSorted(30000);

    const finalValues = await app.getBarValues();
    expect(finalValues.length).toBeGreaterThan(0);
    for (let i = 1; i < finalValues.length; i++) {
      expect(finalValues[i - 1]).toBeLessThanOrEqual(finalValues[i]);
    }

    // No uncaught exceptions should have been emitted (checked in afterEach)
  });

  test('Visual feedback: displayArray updates DOM heights during the sorting process', async ({ page }) => {
    // Validate that the visualization updates bar heights/styles during sorting (evidence of visualization steps)
    const app = new MergeSortPage(page);
    await app.goto();

    // Capture a snapshot of heights before starting
    const heightsBefore = await app.getBarHeights();

    // Start sort
    await app.clickStart();

    // Wait shortly and capture heights again; because delayVisualization calls displayArray periodically,
    // heights are expected to update during sorting.
    // Use a few samples to increase chance of catching a change.
    const samples = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(700); // slightly longer than the 500ms delay to allow updates
      samples.push(await app.getBarHeights());
    }

    // At least one sample should differ from the initial heights (indicating DOM updates)
    const anyDifferent = samples.some(sample => {
      if (sample.length !== heightsBefore.length) return true;
      for (let j = 0; j < sample.length; j++) {
        if (sample[j] !== heightsBefore[j]) return true;
      }
      return false;
    });

    expect(anyDifferent, 'Expected at least one display update to occur during sorting').toBe(true);

    // Wait for final sorted state to ensure test stability
    await app.waitForSorted(30000);
  });
});