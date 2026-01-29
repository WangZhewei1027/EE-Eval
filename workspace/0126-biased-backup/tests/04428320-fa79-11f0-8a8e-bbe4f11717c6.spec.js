import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04428320-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object to interact with the binary search page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.consoleMessages = [];
    // Capture page errors and console messages for assertions
    this.page.on('pageerror', (err) => {
      this.errors.push(err);
    });
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  }

  async goto() {
    // Load the page exactly as-is per instructions
    await this.page.goto(APP_URL);
  }

  startButton() {
    return this.page.locator('#binary-search');
  }

  resetButton() {
    return this.page.locator('#reset');
  }

  result() {
    return this.page.locator('#result');
  }

  targetInput() {
    return this.page.locator('#target');
  }

  // Click the Start Search button and wait briefly for any synchronous errors to surface
  async clickStart() {
    await this.startButton().click();
    // Allow synchronous on-click JS to run and possibly throw - small timeout
    await this.page.waitForTimeout(50);
  }

  // Click the Reset button and wait briefly for any synchronous errors to surface
  async clickReset() {
    await this.resetButton().click();
    await this.page.waitForTimeout(50);
  }

  // Return captured page errors
  getPageErrors() {
    return this.errors;
  }

  // Return captured console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }
}

test.describe('Binary Search Application - FSM validation and error observation', () => {
  // Use a fresh page object per test
  test.beforeEach(async ({ page }) => {
    // nothing global to set up besides navigation performed in tests / page object
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial render shows Start Search and Reset buttons and an empty result', async ({ page }) => {
      // Validate the initial UI elements exist as described in the FSM Idle state
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // Both buttons should be visible
      await expect(bsPage.startButton()).toBeVisible();
      await expect(bsPage.resetButton()).toBeVisible();

      // The result area should be present and initially empty
      await expect(bsPage.result()).toBeVisible();
      await expect(bsPage.result()).toHaveText('');

      // The target input is expected by the FSM but is not present in the provided HTML.
      // We assert that it does not exist to capture the deviation between FSM and implementation.
      const targetCount = await bsPage.targetInput().count();
      expect(targetCount).toBe(0);
    });
  });

  test.describe('Searching State (S1_Searching) and error observation', () => {
    test('Clicking Start Search triggers the search() handler and produces a TypeError due to missing #target', async ({ page }) => {
      // This test validates that clicking the Start Search button invokes the search function in the page's script,
      // and because the input with id="target" is missing in the provided HTML, the attempt to access .value should
      // throw a TypeError. Per instructions we must allow the error to happen and assert it was observed.
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // Pre-assert: result empty
      await expect(bsPage.result()).toHaveText('');

      // Click start - this is expected to cause a runtime error in the page JS (TypeError)
      await bsPage.clickStart();

      const errors = bsPage.getPageErrors();
      // There should be at least one page error captured
      expect(errors.length).toBeGreaterThan(0);

      // The first error should be a TypeError complaining about reading 'value' of null (message may vary by browser)
      const msg = errors[0].message || String(errors[0]);
      // Accept common variants of the error message across browser implementations
      expect(msg).toMatch(/(Cannot read properties of null)|(reading 'value')|cannot read property 'value'/i);

      // After the failed search, result should remain empty (search didn't successfully set it)
      await expect(bsPage.result()).toHaveText('');
    });

    test('Multiple Start Search clicks generate multiple errors (robustness of error capturing)', async ({ page }) => {
      // Verify repeated interactions continue to surface the same runtime error
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // Click start twice
      await bsPage.clickStart();
      await bsPage.clickStart();

      const errors = bsPage.getPageErrors();
      expect(errors.length).toBeGreaterThanOrEqual(2);

      // Validate messages for each captured error
      for (const err of errors) {
        const msg = err.message || String(err);
        expect(msg).toMatch(/(Cannot read properties of null)|(reading 'value')|cannot read property 'value'/i);
      }
    });

    test('Global array is still defined despite search runtime error', async ({ page }) => {
      // Although search() throws due to the missing input, the top-level 'array' variable should still be present
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // Confirm array exists and has 10 items as per implementation
      const arr = await page.evaluate(() => {
        // Accessing array directly; if it doesn't exist this will return undefined
        try {
          return Array.isArray(array) ? array : null;
        } catch (e) {
          return null;
        }
      });

      expect(arr).not.toBeNull();
      expect(arr.length).toBe(10);
    });
  });

  test.describe('Reset State (S4_Reset) and transitions', () => {
    test('Clicking Reset triggers reset() and produces a TypeError due to missing #target input', async ({ page }) => {
      // The reset() function references document.getElementById('target').value = ''
      // Since #target is missing, clicking Reset should produce a runtime TypeError. We assert this behavior.
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // Pre-assert: result empty
      await expect(bsPage.result()).toHaveText('');

      // Click reset - expected to throw due to missing target input
      await bsPage.clickReset();

      const errors = bsPage.getPageErrors();
      expect(errors.length).toBeGreaterThan(0);

      const msg = errors[0].message || String(errors[0]);
      expect(msg).toMatch(/(Cannot read properties of null)|(reading 'value')|cannot read property 'value'/i);

      // Because reset couldn't complete, the result should still be empty (it attempted to set it but failed)
      await expect(bsPage.result()).toHaveText('');
    });

    test('Reset does not remove the array variable even if reset() throws', async ({ page }) => {
      // Even when reset() fails because #target is missing, the top-level 'array' should still be present on the page.
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      await bsPage.clickReset();

      const arr = await page.evaluate(() => {
        try {
          return Array.isArray(array) ? array : null;
        } catch (e) {
          return null;
        }
      });

      expect(arr).not.toBeNull();
      expect(arr.length).toBe(10);
    });
  });

  test.describe('Result Found (S2_ResultFound) and Result Not Found (S3_ResultNotFound) - exploration and edge cases', () => {
    test('Cannot reach Result Found or Result Not Found states because #target input is missing; assert absence', async ({ page }) => {
      // According to FSM, search() would set result.innerHTML to "Found ..." or "Not found ..." depending on target.
      // Since the implementation is missing the input element, we cannot trigger those transitions. This test asserts that.
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // Click start to attempt to trigger search; this will generate a TypeError as captured elsewhere
      await bsPage.clickStart();

      // Ensure that the result text is NOT set to either of the expected final state messages
      const resultText = await bsPage.result().innerText();
      expect(resultText).not.toMatch(/^Found\s+\d+\s+at\s+index\s+\d+/i);
      expect(resultText).not.toMatch(/Not found in the array/i);

      // Ensure we observed the runtime error (sanity check)
      const errors = bsPage.getPageErrors();
      expect(errors.length).toBeGreaterThan(0);
    });

    test('Edge case: interacting with DOM elements that do exist does not throw', async ({ page }) => {
      // Ensure that clicking the visible buttons themselves does not crash Playwright and are clickable.
      // The runtime errors are thrown inside the page context handlers, which we capture separately.
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // Buttons should be clickable - clicking them yields pageerrors but the click itself completes
      await expect(bsPage.startButton()).toBeEnabled();
      await expect(bsPage.resetButton()).toBeEnabled();

      // Clicking Start and Reset should not cause the Playwright action to hang
      await bsPage.startButton().click();
      await bsPage.resetButton().click();

      // We recorded errors in page context; ensure at least one pageerror happened
      const errors = bsPage.getPageErrors();
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Diagnostics: console messages and page error content', () => {
    test('Capture console messages (if any) and validate they are collected', async ({ page }) => {
      // Validate our console recording captures any console messages the page might emit (none expected in this implementation)
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // No explicit console outputs in provided HTML, but we still verify the capture mechanism works
      const consoleMsgs = bsPage.getConsoleMessages();
      // Console may be empty; assert that we have a valid array and that elements (if any) are objects with type/text
      expect(Array.isArray(consoleMsgs)).toBe(true);
      for (const entry of consoleMsgs) {
        expect(entry).toHaveProperty('type');
        expect(entry).toHaveProperty('text');
      }
    });

    test('Captured page errors include stack traces and contextual messages', async ({ page }) => {
      // Ensure that captured page errors include useful diagnostic information
      const bsPage = new BinarySearchPage(page);
      await bsPage.goto();

      // Trigger the known error
      await bsPage.clickStart();

      const errors = bsPage.getPageErrors();
      expect(errors.length).toBeGreaterThan(0);

      const firstError = errors[0];
      // Error objects on the page event typically have message and stack; assert both exist
      expect(firstError).toHaveProperty('message');
      // stack may be present in some environments; ensure no crash if absent
      if (firstError.stack) {
        expect(typeof firstError.stack).toBe('string');
        expect(firstError.stack.length).toBeGreaterThan(0);
      }
    });
  });
});