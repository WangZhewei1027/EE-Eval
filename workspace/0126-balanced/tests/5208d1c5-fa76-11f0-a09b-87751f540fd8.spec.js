import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208d1c5-fa76-11f0-a09b-87751f540fd8.html';

// Page Object Model for the Radix Sort page
class RadixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      sort12345: "button[onclick='sortArray(12345)']",
      sort67890: "button[onclick='sortArray(67890)']",
      result: '#result',
      heading: 'h1'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSort12345() {
    await this.page.click(this.selectors.sort12345);
  }

  async clickSort67890() {
    await this.page.click(this.selectors.sort67890);
  }

  async getResultText() {
    const text = await this.page.textContent(this.selectors.result);
    return (text ?? '').trim();
  }

  async getHeadingText() {
    return (await this.page.textContent(this.selectors.heading))?.trim();
  }

  async hasSortButton12345() {
    return await this.page.$(this.selectors.sort12345) !== null;
  }

  async hasSortButton67890() {
    return await this.page.$(this.selectors.sort67890) !== null;
  }

  async getSortArraySource() {
    return await this.page.evaluate(() => {
      // Access the function source if available; return string or null
      return typeof sortArray === 'function' ? sortArray.toString() : null;
    });
  }

  async typeofRenderPage() {
    return await this.page.evaluate(() => typeof window.renderPage);
  }

  async typeofSortArray() {
    return await this.page.evaluate(() => typeof window.sortArray);
  }
}

test.describe('Radix Sort FSM - Interactive Application (5208d1c5-fa76-11f0-a09b-87751f540fd8)', () => {
  // Reusable arrays to collect runtime errors and console errors during each test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect uncaught exceptions from the page runtime
    page.on('pageerror', (err) => {
      // store the Error object for later assertions
      pageErrors.push(err);
    });

    // Collect console messages (particularly 'error' type)
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application page for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // small cleanup: remove listeners if necessary (Playwright removes them when page is closed)
    // No explicit teardown required beyond Playwright's fixtures
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Page loads into Idle state: buttons present, heading and result DOM exist', async ({ page }) => {
      const rp = new RadixPage(page);

      // Validate the static content - heading and description are present
      const heading = await rp.getHeadingText();
      expect(heading).toContain('Radix Sort');

      // Both Sort Array buttons should exist as per FSM evidence
      expect(await rp.hasSortButton12345()).toBeTruthy();
      expect(await rp.hasSortButton67890()).toBeTruthy();

      // The result div should exist and be empty initially
      const resultText = await rp.getResultText();
      expect(resultText).toBe('', 'Expected #result to be empty on initial load');

      // Verify that renderPage (FSM's S0 entry action) is not defined on the global window.
      // This checks the implementation does not accidentally call or define the FSM-stated entry action.
      const renderType = await rp.typeofRenderPage();
      expect(renderType).toBe('undefined');

      // Verify that sortArray exists as a function on the page (implementation provides it)
      const sortArrayType = await rp.typeofSortArray();
      expect(sortArrayType).toBe('function');

      // There should be no uncaught page runtime errors just from loading the page
      expect(pageErrors.length).toBe(0);
      // And no console error messages on initial load
      expect(consoleErrors.length).toBe(0);
    });

    test('Function source includes expected evidence (return arr;)', async ({ page }) => {
      const rp = new RadixPage(page);
      const src = await rp.getSortArraySource();
      // The FSM evidence indicates the implementation should contain "return arr;"
      expect(src).toBeTruthy();
      expect(src).toContain('return arr;');
    });
  });

  test.describe('Transitions: S0_Idle -> S1_Sorting -> S2_Sorted via button clicks', () => {
    // This helper attempts a click and waits briefly for runtime errors to surface
    async function clickAndCollectErrors(page, clickAction) {
      // perform the click
      await clickAction();
      // allow brief time for any uncaught exceptions to be emitted
      await page.waitForTimeout(150);
      return {
        pageErrorsSnapshot: [...pageErrors],
        consoleErrorsSnapshot: [...consoleErrors]
      };
    }

    test('Click SortArray(12345) triggers runtime error(s) and leaves DOM result unchanged', async ({ page }) => {
      const rp = new RadixPage(page);

      // Ensure starting conditions
      expect(await rp.getResultText()).toBe('');

      // Click the button that triggers sortArray(12345)
      const { pageErrorsSnapshot, consoleErrorsSnapshot } = await clickAndCollectErrors(page, async () => {
        await rp.clickSort12345();
      });

      // The implementation of sortArray expects an array, but buttons pass a Number.
      // We expect runtime errors (TypeError or similar) due to operations like spread on a non-iterable.
      const hasPageError = pageErrorsSnapshot.length > 0;
      const hasConsoleError = consoleErrorsSnapshot.length > 0;

      expect(hasPageError || hasConsoleError).toBeTruthy();

      // If pageErrors present, ensure at least one looks like a TypeError or references iterable/spread issues
      if (hasPageError) {
        const messages = pageErrorsSnapshot.map(e => String(e && e.message).toLowerCase());
        // Look for common patterns
        const matches = messages.some(m => /typeerror|not iterable|is not iterable|cannot spread|cannot read property|undefined/.test(m));
        expect(matches).toBeTruthy();
      }

      if (hasConsoleError) {
        const matches = consoleErrorsSnapshot.some(m => /typeerror|not iterable|cannot spread|cannot read property|undefined/i.test(m));
        expect(matches).toBeTruthy();
      }

      // The page's result div should remain unchanged (the function does not update DOM)
      const resultTextAfter = await rp.getResultText();
      expect(resultTextAfter).toBe('', 'Expected #result to remain empty after clicking a malformed sort trigger');
    });

    test('Click SortArray(67890) triggers runtime error(s) and multiple clicks accumulate errors', async ({ page }) => {
      const rp = new RadixPage(page);

      // Click first time
      await rp.clickSort67890();
      await page.waitForTimeout(100);

      // Capture first wave of errors
      const firstPageErrors = [...pageErrors];
      const firstConsoleErrors = [...consoleErrors];

      // Click second time to ensure repeated events lead to multiple errors being recorded
      await rp.clickSort67890();
      await page.waitForTimeout(100);

      const secondPageErrors = [...pageErrors];
      const secondConsoleErrors = [...consoleErrors];

      // There should be at least one error after the first click
      expect(firstPageErrors.length + firstConsoleErrors.length).toBeGreaterThan(0);

      // After the second click, the total recorded errors should be equal or greater
      expect(secondPageErrors.length + secondConsoleErrors.length).toBeGreaterThanOrEqual(firstPageErrors.length + firstConsoleErrors.length);

      // Basic check that the errors look like runtime TypeErrors or similar problems
      const combined = [...secondPageErrors.map(e => String(e.message)), ...secondConsoleErrors];
      const found = combined.some(s => /typeerror|not iterable|cannot spread|cannot read property/i.test(String(s).toLowerCase()));
      expect(found).toBeTruthy();

      // Result div still unchanged by the broken implementation
      expect(await rp.getResultText()).toBe('');
    });
  });

  test.describe('Edge cases and explicit invocation scenarios', () => {
    test('Direct invocation: calling sortArray with a proper array should still surface implementation errors (rejects/throws)', async ({ page }) => {
      // The application function is present, but its internal logic has flaws.
      // Calling it with a valid array may still throw due to incorrect indices and assumptions.
      // We assert that invoking it via page.evaluate rejects with an error.
      await expect(page.evaluate(() => {
        // call with a reasonable small array to test behavior
        return sortArray([3, 1, 2]);
      })).rejects.toThrow();
    });

    test('Verify function source code contains expected evidence and problematic constructs', async ({ page }) => {
      // Check that the implementation contains fragments that correspond to FSM evidence and also some problematic constructs
      const src = await page.evaluate(() => (typeof sortArray === 'function' ? sortArray.toString() : null));
      expect(src).toBeTruthy();
      // FSM evidence: contains "let n = arr.length;" and "let max = Math.max(...arr);"
      expect(src).toContain('let n = arr.length;');
      expect(src).toContain('let max = Math.max(...arr);');

      // Also check for suspicious constructs that likely cause runtime errors:
      // e.g., usage of spread on arr and using count[maxElement] as an index
      const hasSpreadOnArr = /Math\.max\(\.\.\.arr\)/.test(src) || /Math\.max\(\s*\.\.\.arr\s*\)/.test(src);
      const usesCountIndexingByValue = /count\[maxElement\]/.test(src);
      expect(hasSpreadOnArr).toBeTruthy();
      expect(usesCountIndexingByValue).toBeTruthy();
    });
  });
});