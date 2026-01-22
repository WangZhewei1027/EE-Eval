import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3b9970-d360-11f0-b42e-71f0e7238799.html';

// Page object model for the Radix Sort demo
class RadixSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = "button[onclick='startSorting()']";
    this.generateButton = "button[onclick='generateRandomArray()']";
    this.arrayContainer = '#array-container';
    this.barSelector = '#array-container .bar';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns array of numeric values currently displayed
  async getDisplayedValues() {
    return this.page.$$eval(this.barSelector, (bars) =>
      bars.map(b => Number(b.textContent.trim()))
    );
  }

  // Returns number of bars displayed
  async getBarCount() {
    return this.page.$$eval(this.barSelector, bars => bars.length);
  }

  // Click generate random array
  async clickGenerate() {
    await this.page.click(this.generateButton);
  }

  // Click start sort
  async clickStartSort() {
    await this.page.click(this.startButton);
  }

  // Wait until displayed values are sorted ascending
  async waitForSorted(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const bars = Array.from(document.querySelectorAll('#array-container .bar'));
      const vals = bars.map(b => Number(b.textContent.trim()));
      for (let i = 1; i < vals.length; i++) {
        if (vals[i - 1] > vals[i]) return false;
      }
      return true;
    }, null, { timeout });
  }

  // Wait until DOM of array-container changes from the provided snapshot HTML
  async waitForDomChangeFrom(previousHtml, timeout = 2000) {
    await this.page.waitForFunction((prev) => {
      const container = document.getElementById('array-container');
      if (!container) return false;
      return container.innerHTML !== prev;
    }, previousHtml, { timeout });
  }
}

test.describe('Radix Sort Demonstration - FSM Tests', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : undefined
          });
        }
      } catch (e) {
        // swallow instrumentation errors
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial State: S0_Idle', () => {
    test('should execute entry action generateRandomArray() on load and display an array of 10 bars', async ({ page }) => {
      // This test validates the FSM initial state S0_Idle entry action:
      // The page should run generateRandomArray() on load and populate #array-container with 10 bars.
      const app = new RadixSortPage(page);
      await app.goto();

      // Verify DOM contains 10 bars (generateRandomArray creates an array of length 10)
      const count = await app.getBarCount();
      expect(count).toBe(10);

      // Verify each bar contains a numeric value and has a height style set
      const values = await app.getDisplayedValues();
      expect(values.length).toBe(10);
      for (const v of values) {
        expect(typeof v).toBe('number');
        expect(Number.isFinite(v)).toBe(true);
        // values are between 0 and 99 per implementation
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(100);
      }

      // Confirm no console error or page error occurred during initialization
      expect(consoleErrors.length, 'No console.error on load').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors on load').toBe(0);
    });

    test('generateRandomArray button should produce a (likely) different array when clicked', async ({ page }) => {
      // This test validates the GenerateRandomArray event/transition (S0_Idle -> S0_Idle)
      // Clicking Generate Random Array should update the displayed array.
      const app = new RadixSortPage(page);
      await app.goto();

      const initialValues = await app.getDisplayedValues();
      expect(initialValues.length).toBe(10);

      // Save initial DOM snapshot
      const initialHtml = await page.$eval('#array-container', el => el.innerHTML);

      // Click generate and wait for DOM change (should update)
      await app.clickGenerate();

      // Wait for the DOM to change from previous content (allow some time for re-render)
      await app.waitForDomChangeFrom(initialHtml, 2000);

      const newValues = await app.getDisplayedValues();
      expect(newValues.length).toBe(10);

      // Assert that arrays are not identical in all positions.
      // Because randomness could produce the same array (extremely unlikely),
      // allow a retry: click up to 2 more times if identical.
      let attempts = 0;
      while (arraysEqual(initialValues, newValues) && attempts < 2) {
        attempts++;
        await app.clickGenerate();
        await page.waitForTimeout(100); // short wait
        const later = await app.getDisplayedValues();
        if (!arraysEqual(initialValues, later)) {
          break;
        }
      }

      const finalValues = await app.getDisplayedValues();
      // At least one value should differ in typical randomness.
      const allEqual = arraysEqual(initialValues, finalValues);
      expect(allEqual).toBe(false);

      // Confirm no console or page errors during generate
      expect(consoleErrors.length, 'No console.error on generate').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors on generate').toBe(0);
    });
  });

  test.describe('Sorting State: S1_Sorting and transitions', () => {
    test('startSorting() should sort the array (S0_Idle -> S1_Sorting)', async ({ page }) => {
      // This test validates the StartSort event and transition to S1_Sorting.
      // Clicking Start Sort should produce a sorted array in ascending order at the end.
      const app = new RadixSortPage(page);
      await app.goto();

      // Snapshot before sorting
      const beforeValues = await app.getDisplayedValues();
      expect(beforeValues.length).toBe(10);

      // Click Start Sort and wait for sorting to complete
      await app.clickStartSort();

      // Wait until the DOM shows a sorted array
      // Sorting uses pauses (500ms per digit). For numbers 0-99, there will be up to 2 passes.
      // Use a reasonably generous timeout to accommodate test environment.
      await app.waitForSorted(5000);

      const afterValues = await app.getDisplayedValues();
      expect(afterValues.length).toBe(10);

      // Verify ascending order
      for (let i = 1; i < afterValues.length; i++) {
        expect(afterValues[i - 1]).toBeLessThanOrEqual(afterValues[i]);
      }

      // Ensure that the array contents after sorting are a permutation of before
      expect(sortNumberArray(beforeValues)).toEqual(sortNumberArray(afterValues));

      // Confirm no runtime errors occurred during sorting
      expect(consoleErrors.length, 'No console.error during sorting').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors during sorting').toBe(0);
    });

    test('clicking Start Sort while a sort is already running should still result in a sorted array (concurrent clicks)', async ({ page }) => {
      // Edge case: clicking Start Sort multiple times in quick succession.
      // We must not modify page globals; just click as the user would and assert final state.
      const app = new RadixSortPage(page);
      await app.goto();

      // Start sorting
      await app.clickStartSort();

      // Immediately click Start Sort again to attempt concurrent invocation
      await app.clickStartSort();

      // Wait for final sorted state
      await app.waitForSorted(7000);

      const finalValues = await app.getDisplayedValues();
      for (let i = 1; i < finalValues.length; i++) {
        expect(finalValues[i - 1]).toBeLessThanOrEqual(finalValues[i]);
      }

      // Confirm no runtime errors were produced by concurrent clicks
      expect(consoleErrors.length, 'No console.error after concurrent Start Sort clicks').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors after concurrent Start Sort clicks').toBe(0);
    });

    test('visualization should update during sorting (DOM changes during passes)', async ({ page }) => {
      // Validate that the display updates during the radix sort passes,
      // which gives visual feedback to the user as expected by the FSM evidence.
      const app = new RadixSortPage(page);
      await app.goto();

      const beforeHtml = await page.$eval('#array-container', el => el.innerHTML);

      // Start sorting
      await app.clickStartSort();

      // Wait shortly longer than a single pass delay to observe an intermediate change
      // Each pass awaits 500ms; wait 600ms to observe at least one update.
      await page.waitForTimeout(600);

      const midHtml = await page.$eval('#array-container', el => el.innerHTML);

      // The DOM should have changed from the initial snapshot during sorting
      expect(midHtml === beforeHtml).toBe(false);

      // Finally wait for fully sorted state
      await app.waitForSorted(5000);

      // Confirm that updates occurred and no errors were thrown
      expect(consoleErrors.length, 'No console.error during visualization updates').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors during visualization updates').toBe(0);
    });
  });

  test.describe('Error observation and edge-cases', () => {
    test('page should not produce uncaught exceptions or console.error messages under normal interactions', async ({ page }) => {
      // This test aggregates typical user interactions and ensures no errors are emitted.
      const app = new RadixSortPage(page);
      await app.goto();

      // Perform a sequence of interactions: generate, start, generate during idle, start again
      await app.clickGenerate();
      await page.waitForTimeout(100);
      await app.clickStartSort();
      // Wait for sorted
      await app.waitForSorted(5000);
      // Generate new array again
      await app.clickGenerate();
      await page.waitForTimeout(100);
      // Start sorting again
      await app.clickStartSort();
      await app.waitForSorted(5000);

      // Check accumulated console / page errors
      expect(consoleErrors.length, 'No console.error during aggregated interactions').toBe(0);
      expect(pageErrors.length, 'No uncaught page errors during aggregated interactions').toBe(0);

      // As an explicit assertion related to the developer instruction:
      // We observe and assert the absence of ReferenceError/SyntaxError/TypeError in console or page errors.
      const hasSeriousRuntimeError = pageErrors.some(err => (
        err instanceof ReferenceError ||
        err instanceof SyntaxError ||
        err instanceof TypeError
      ));
      expect(hasSeriousRuntimeError).toBe(false);
    });

    test('stress: multiple generate clicks in quick succession should keep the UI stable', async ({ page }) => {
      // Click generate multiple times rapidly and ensure UI remains responsive and consistent length
      const app = new RadixSortPage(page);
      await app.goto();

      // Rapidly click generate 5 times
      for (let i = 0; i < 5; i++) {
        await app.clickGenerate();
      }

      // Wait shortly for last update
      await page.waitForTimeout(200);

      // Ensure we still have 10 bars and numeric values
      const count = await app.getBarCount();
      expect(count).toBe(10);

      const vals = await app.getDisplayedValues();
      expect(vals.length).toBe(10);
      for (const v of vals) {
        expect(Number.isFinite(v)).toBe(true);
      }

      // Ensure no runtime errors were produced
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});

// Helper utilities

// Compare two number arrays for equality element-by-element
function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Return a sorted copy of a number array
function sortNumberArray(arr) {
  return Array.from(arr).slice().sort((x, y) => x - y);
}