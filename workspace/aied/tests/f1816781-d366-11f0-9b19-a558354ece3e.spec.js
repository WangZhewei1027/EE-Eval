import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1816781-d366-11f0-9b19-a558354ece3e.html';

// Page Object for the Radix Sort visualization page
class RadixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async generate() {
    await this.page.click('#generateBtn');
  }

  async start() {
    await this.page.click('#startBtn');
  }

  async step() {
    await this.page.click('#stepBtn');
  }

  async reset() {
    await this.page.click('#resetBtn');
  }

  async getStatusText() {
    return (await this.page.locator('#status').textContent()) || '';
  }

  async isStartDisabled() {
    return await this.page.$eval('#startBtn', (btn) => btn.disabled);
  }

  async isStepDisabled() {
    return await this.page.$eval('#stepBtn', (btn) => btn.disabled);
  }

  async isResetDisabled() {
    return await this.page.$eval('#resetBtn', (btn) => btn.disabled);
  }

  // Returns array of numeric values currently displayed in the visualization
  async getArrayValues() {
    return this.page.$$eval('.array-element .array-value', nodes =>
      nodes.map(n => parseInt(n.textContent || '', 10))
    );
  }

  // Returns count of bucket elements (should be 10)
  async getBucketCount() {
    return this.page.$$eval('.bucket', nodes => nodes.length);
  }

  // Returns total number of bucket elements across all buckets (sum of .bucket-element)
  async getTotalBucketElements() {
    return this.page.$$eval('.bucket-element', nodes => nodes.length);
  }

  // Wait until the status contains a specific substring
  async waitForStatusContains(substring, timeout = 10000) {
    await this.page.waitForFunction(
      (s) => document.getElementById('status')?.textContent?.includes(s),
      substring,
      { timeout }
    );
  }
}

test.describe('Radix Sort Visualization - FSM tests', () => {
  // Collect console errors and page errors per test to assert no unexpected runtime errors occurred.
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset error collections for each test
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages (especially errors) for assertions
    page.on('console', (msg) => {
      // capture console.error and any console messages that have type 'error'
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err?.message || String(err));
    });

    // Navigate to the application
    const radix = new RadixPage(page);
    await radix.goto();

    // The page calls generateArray() on initialize; wait for the controls to be enabled.
    // Wait for the Start button to be enabled to consider initialization complete.
    await page.waitForFunction(() => {
      const btn = document.getElementById('startBtn');
      return btn && !btn.disabled;
    }, { timeout: 5000 });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught page errors or console errors.
    // These assertions ensure we "observe console logs and page errors" and fail if any occurred.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `Unexpected console.error logs: ${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('Initial state on load should generate array and enable controls (S0_Idle -> S1_ArrayGenerated)', async ({ page }) => {
    // This test validates the initial transition from Idle => Array Generated performed on load.
    const radix = new RadixPage(page);

    // Status should indicate a new array has been generated
    const status = await radix.getStatusText();
    expect(status).toContain("New array generated", 'Status should indicate that a new array was generated on load');

    // Controls should be enabled
    expect(await radix.isStartDisabled()).toBe(false);
    expect(await radix.isStepDisabled()).toBe(false);
    expect(await radix.isResetDisabled()).toBe(false);

    // Array container should contain 10 elements (size defined in generateArray)
    const values = await radix.getArrayValues();
    expect(values.length).toBe(10);

    // Buckets container should have 10 buckets created
    const bucketCount = await radix.getBucketCount();
    expect(bucketCount).toBe(10);
  });

  test('Clicking Generate New Array regenerates a different array (transition S0_Idle -> S1_ArrayGenerated)', async ({ page }) => {
    // Validate generating a new array via the Generate button
    const radix = new RadixPage(page);

    // Capture the current generated array
    const original = await radix.getArrayValues();
    expect(original.length).toBeGreaterThan(0);

    // Click the generate button and wait for the status update
    await radix.generate();
    await radix.waitForStatusContains("New array generated", 3000);

    // New array values should exist and (likely) differ from the previous values
    const after = await radix.getArrayValues();
    expect(after.length).toBe(10);
    // It's possible (rare) the random generation produces the same array; but we still assert at least it's present.
    // To be strict, assert that either arrays are different or the status changed; we already verified status.
    const arraysEqual = JSON.stringify(original) === JSON.stringify(after);
    // We allow occasional equality but log a soft expectation: prefer arrays to differ.
    expect(arraysEqual).toBeFalsy();
  });

  test('Start Sorting should begin automatic sorting and reach Sorting Complete (S1_ArrayGenerated -> S2_Sorting -> S3_SortingComplete)', async ({ page }) => {
    // Validate automatic sorting using Start button and that it completes.
    const radix = new RadixPage(page);

    // Ensure we're in generated array state
    const initialValues = await radix.getArrayValues();
    expect(initialValues.length).toBeGreaterThan(0);

    // Click start to begin sorting
    await radix.start();

    // After starting, the Start button should be disabled (evidence of isSorting = true)
    await page.waitForFunction(() => document.getElementById('startBtn').disabled === true, { timeout: 2000 });

    // Wait for the algorithm to reach the final status message
    await radix.waitForStatusContains("Sorting complete", 15000);

    // After completion, Start and Step should be disabled per implementation
    expect(await radix.isStartDisabled()).toBe(true);
    expect(await radix.isStepDisabled()).toBe(true);

    // Verify the array is sorted in ascending order numerically
    const sortedValues = await radix.getArrayValues();
    // Ensure non-empty
    expect(sortedValues.length).toBeGreaterThan(0);
    for (let i = 1; i < sortedValues.length; i++) {
      expect(sortedValues[i]).toBeGreaterThanOrEqual(sortedValues[i - 1]);
    }
  });

  test('Using Next Step repeatedly should transition through sorting steps to completion (S2_Sorting -> S3_SortingComplete)', async ({ page }) => {
    // Validate manual stepping via the Next Step button until sorting completes.
    const radix = new RadixPage(page);

    // Generate a fresh array to ensure deterministic step-by-step interaction
    await radix.generate();
    await radix.waitForStatusContains("New array generated", 3000);
    const before = await radix.getArrayValues();
    expect(before.length).toBe(10);

    // Ensure step button is enabled for manual stepping
    expect(await radix.isStepDisabled()).toBe(false);

    // Click step button enough times to complete sorting.
    // Each digit requires two steps (distribute and collect).
    // Maximum digits in numbers are 3 (100-999 => 3), so 3 * 2 = 6 steps expected.
    // We'll click up to 20 times defensively, breaking early if sorting completes.
    let completed = false;
    for (let i = 0; i < 20; i++) {
      await radix.step();

      // After each step, check status for completion
      const status = await radix.getStatusText();
      if (status.includes('Sorting complete')) {
        completed = true;
        break;
      }

      // Small pause between steps to allow DOM to update
      await page.waitForTimeout(100);
    }

    expect(completed).toBe(true);

    // Ensure controls are disabled per completion behavior
    expect(await radix.isStartDisabled()).toBe(true);
    expect(await radix.isStepDisabled()).toBe(true);

    // Verify final array is sorted
    const after = await radix.getArrayValues();
    expect(after.length).toBeGreaterThan(0);
    for (let i = 1; i < after.length; i++) {
      expect(after[i]).toBeGreaterThanOrEqual(after[i - 1]);
    }
  });

  test('Reset during sorting should stop sorting and reset the visualization (S3_SortingComplete -> S4_Reset behavior during S2_Sorting)', async ({ page }) => {
    // Validate that Reset stops an ongoing sorting process and restores controls/status.
    const radix = new RadixPage(page);

    // Generate a new array to be safe
    await radix.generate();
    await radix.waitForStatusContains("New array generated", 3000);

    // Start automatic sorting
    await radix.start();

    // Wait a short time to let sorting get underway (but not finish)
    await page.waitForTimeout(600);

    // Click reset while sorting; this should stop sorting and set status to reset message.
    await radix.reset();

    // Wait for reset status to appear
    await radix.waitForStatusContains("Visualization reset", 3000);

    // After reset, isSorting must be false and controls should be enabled for start and step
    expect(await radix.isStartDisabled()).toBe(false);
    expect(await radix.isStepDisabled()).toBe(false);

    // Buckets should be present and array elements rendered
    const bucketCount = await radix.getBucketCount();
    expect(bucketCount).toBe(10);
    const values = await radix.getArrayValues();
    expect(values.length).toBeGreaterThan(0);
  });

  test('Edge case: Clicking Start while already sorting should have no adverse effect', async ({ page }) => {
    // Validate startSorting guard (if isSorting true it returns early)
    const radix = new RadixPage(page);

    // Ensure we have a generated array
    await radix.generate();
    await radix.waitForStatusContains("New array generated", 3000);

    // Click start to begin sorting
    await radix.start();

    // Immediately attempt to click start again
    await radix.start();

    // The Start button should remain disabled while sorting
    await page.waitForFunction(() => document.getElementById('startBtn').disabled === true, { timeout: 2000 });

    // Wait for completion (sorting will finish automatically)
    await radix.waitForStatusContains("Sorting complete", 15000);

    // Confirm final state after completion
    expect(await radix.isStartDisabled()).toBe(true);
    expect(await radix.isStepDisabled()).toBe(true);
    const final = await radix.getArrayValues();
    for (let i = 1; i < final.length; i++) {
      expect(final[i]).toBeGreaterThanOrEqual(final[i - 1]);
    }
  });
});