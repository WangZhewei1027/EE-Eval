import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d38b2-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object encapsulating selectors and common actions
class SelectionSortPage {
  constructor(page) {
    this.page = page;
    this.arraySelector = '#array';
    this.barSelector = '.bar';
    this.generateButtonSelector = "button[onclick='generateArray()']";
    this.sortButtonSelector = "button[onclick='selectionSort()']";
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getBars() {
    return this.page.$$(this.barSelector);
  }

  async getBarCount() {
    const bars = await this.getBars();
    return bars.length;
  }

  async getArrayValues() {
    // Access the global `array` defined by the page
    return this.page.evaluate(() => Array.isArray(window.array) ? window.array.slice() : null);
  }

  async clickGenerate() {
    await this.page.click(this.generateButtonSelector);
  }

  async clickSort() {
    await this.page.click(this.sortButtonSelector);
  }

  async setArray(values) {
    // Set the global array variable and re-render using displayArray()
    await this.page.evaluate((vals) => {
      window.array = vals.slice();
      if (typeof displayArray === 'function') {
        displayArray();
      }
    }, values);
  }

  async waitForLastBarGreen(timeout = 10000) {
    // Wait until the last bar's inline style backgroundColor is 'green'
    await this.page.waitForFunction(() => {
      const bars1 = document.querySelectorAll('.bar');
      if (!bars.length) return false;
      return bars[bars.length - 1].style.backgroundColor === 'green';
    }, null, { timeout });
  }

  async anyBarHighlighted() {
    return await this.page.evaluate(() => {
      return !!document.querySelector('.bar.highlight');
    });
  }
}

test.describe('Selection Sort Visualization - FSM validation', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test
    pageErrors = [];
    consoleMessages = [];

    page.on('console', msg => {
      // capture console output to inspect for unexpected logs
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture uncaught errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  test.describe('Initial state S0_Idle -> S1_ArrayGenerated', () => {
    test('window.onload should trigger generateArray and display 10 bars (S0 -> S1)', async ({ page }) => {
      // This test validates: onEnter of S0_Idle calls generateArray() and displayArray() produces 10 bars
      const app = new SelectionSortPage(page);
      await app.goto();

      // Wait for at least one bar to appear, then ensure there are 10 bars as generateArray creates 10 items
      await page.waitForSelector('.bar');

      const barCount = await app.getBarCount();
      expect(barCount).toBe(10);

      // Verify the global `array` variable exists and has length 10
      const arrayValues = await app.getArrayValues();
      expect(Array.isArray(arrayValues)).toBeTruthy();
      expect(arrayValues.length).toBe(10);

      // Verify each bar's textContent corresponds to the array values and heights are set
      const domBarValues = await page.$$eval('.bar', bars => bars.map(b => ({ text: b.textContent.trim(), height: b.style.height })));
      for (let i = 0; i < arrayValues.length; i++) {
        // text content should be the numeric value
        expect(domBarValues[i].text).toBe(String(arrayValues[i]));
        // height should be value * 2 + 'px'
        expect(domBarValues[i].height).toBe(String(arrayValues[i] * 2) + 'px');
      }

      // Ensure no uncaught page errors occurred during load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('User-triggered events and sorting transitions', () => {
    test('Clicking "Generate New Array" updates the array and DOM', async ({ page }) => {
      // Validate the GenerateArray event and transition S0_Idle -> S1_ArrayGenerated
      const app1 = new SelectionSortPage(page);
      await app.goto();

      // Capture the first generated array
      const firstArray = await app.getArrayValues();
      expect(Array.isArray(firstArray)).toBeTruthy();
      expect(firstArray.length).toBe(10);

      // Click the Generate button and verify array and DOM are valid after regeneration
      await app.clickGenerate();

      // small wait to allow DOM update
      await page.waitForTimeout(100);

      const secondArray = await app.getArrayValues();
      expect(Array.isArray(secondArray)).toBeTruthy();
      expect(secondArray.length).toBe(10);

      // It's possible (rare) the new random array equals the previous one. Ensure DOM updated (bars present)
      const barCount1 = await app.getBarCount();
      expect(barCount).toBe(10);

      // Ensure no uncaught page errors occurred during generation
      expect(pageErrors.length).toBe(0);
    });

    test('Sorting a small array shows highlights and produces sorted result (S1 -> S2 -> S3)', async ({ page }) => {
      // This test sets a small array to make selectionSort complete quickly and validates the sorting transition
      test.setTimeout(20000); // Allow time for sorting to complete

      const app2 = new SelectionSortPage(page);
      await app.goto();

      // Use a small deterministic array to reduce test time and make assertions reliable
      const smallArray = [64, 25, 12, 22];
      await app.setArray(smallArray);

      // Ensure DOM reflects our small array
      let current = await app.getArrayValues();
      expect(current).toEqual(smallArray);

      // Start sorting
      await app.clickSort();

      // Shortly after starting, at least one bar should be highlighted as selectionSort highlights indices
      await page.waitForTimeout(300); // Give the algorithm a moment to start and add highlight classes
      const anyHighlight = await app.anyBarHighlighted();
      expect(anyHighlight).toBeTruthy();

      // Wait for the algorithm to complete: check that the last bar gets highlighted green per implementation
      await app.waitForLastBarGreen(12000);

      // After sort completes, the global array should be sorted ascending
      const sortedArray = await app.getArrayValues();
      const expectedSorted = [...smallArray].sort((a, b) => a - b);
      expect(sortedArray).toEqual(expectedSorted);

      // The implementation only sets the last bar's background color to green (highlightSortedIndices(length - 1))
      const lastBarBg = await page.$eval('.bar:last-child', el => el.style.backgroundColor);
      expect(lastBarBg).toBe('green');

      // Ensure no uncaught page errors during this normal sorting flow
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Sorting an empty array triggers a runtime error (expected TypeError)', async ({ page }) => {
      // This test intentionally sets an empty array to exercise highlightSortedIndices with index -1,
      // which in the implementation will attempt to access bars[-1] and throw a TypeError.
      const app3 = new SelectionSortPage(page);
      await app.goto();

      // Set the array to empty and re-render
      await app.setArray([]);

      // Confirm there are zero bars
      const barCount2 = await app.getBarCount();
      expect(barCount).toBe(0);

      // Clear previously captured errors
      // Note: pageErrors is captured in beforeEach; ensure it's empty now
      expect(pageErrors.length).toBe(0);

      // Click Sort and allow the error to occur naturally
      await app.clickSort();

      // Wait briefly to allow the synchronous exception (if any) to surface
      await page.waitForTimeout(200);

      // We expect at least one page error to have been captured
      expect(pageErrors.length).toBeGreaterThan(0);

      // Verify that one of the captured errors is a TypeError related to reading properties of undefined
      const hasTypeError = pageErrors.some(err => {
        // err is typically an Error object; check its message string
        const msg = String(err && err.message ? err.message : err);
        return /TypeError/i.test(msg) || /Cannot read properties of undefined/i.test(msg) || /reading 'style'/.test(msg);
      });
      expect(hasTypeError).toBeTruthy();
    });

    test('Console output remains free of severe error logs during normal interactions', async ({ page }) => {
      // This test validates that there are no "error" level console messages during typical usage
      const app4 = new SelectionSortPage(page);
      await app.goto();

      // Perform a normal generate and quick small sort to exercise interactions
      await app.clickGenerate();
      await app.setArray([3, 2, 1]);
      await app.clickSort();

      // Allow some time for logs to be emitted
      await page.waitForTimeout(500);

      // Inspect console messages captured
      const severeConsole = consoleMessages.filter(msg => msg.type === 'error' || msg.type === 'warning');
      // For regular operation we expect no error-level console messages
      expect(severeConsole.length).toBe(0);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, include captured console messages and page errors in the output for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // Print artifacts to help debugging (Playwright will capture stdout)
      // Avoid throwing here — this is only for additional context in CI logs
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => (e && e.message) ? e.message : String(e)));
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
  });
});