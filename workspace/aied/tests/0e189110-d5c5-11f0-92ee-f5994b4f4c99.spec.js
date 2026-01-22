import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e189110-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page object for the Linear Search page
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.searchInput = '#search';
    this.submitButton = 'button[type="submit"]';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillSearch(value) {
    // Use fill to set exact value (triggers input event)
    await this.page.fill(this.searchInput, value);
  }

  async clickSubmit() {
    await this.page.click(this.submitButton);
  }

  async getSearchValue() {
    return this.page.$eval(this.searchInput, el => el.value);
  }

  async isSearchVisible() {
    return this.page.isVisible(this.searchInput);
  }

  async isSubmitVisible() {
    return this.page.isVisible(this.submitButton);
  }
}

test.describe('Linear Search FSM - End-to-End Tests', () => {
  // Capture global console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Nothing required here (each test will attach listeners as needed or rely on page events)
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial render contains input#search and Search button (Idle evidence)', async ({ page }) => {
      // This test validates the entry evidence of S0_Idle: the DOM elements are present.
      const app = new LinearSearchPage(page);
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg));

      await app.goto();

      // Assert the input and button exist and are visible
      expect(await app.isSearchVisible()).toBe(true);
      expect(await app.isSubmitVisible()).toBe(true);

      // No runtime page errors should have surfaced on initial load
      expect(pageErrors.length).toBe(0);

      // No console logs expected just from rendering (script runs only after input)
      // But we use a non-strict check: there should be no error-level console messages.
      const errorConsole = consoleMessages.find(m => m.type() === 'error');
      expect(errorConsole).toBeUndefined();
    });
  });

  test.describe('InputSearch Event and Searching State (S1_Searching) validations', () => {
    test('Empty input triggers alert "Please enter a search term." (Transition S0 -> S1 edge case)', async ({ page }) => {
      // This test validates the behavior when the input becomes empty (the FSM transition expects an alert).
      const app = new LinearSearchPage(page);
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      await app.goto();

      // Fill with a non-empty char first to ensure subsequent empty fill triggers the alert path
      await app.fillSearch('x');

      // Now clear the field to trigger the empty-check path which should alert and return
      const dialogPromise = page.waitForEvent('dialog');
      await app.fillSearch(''); // triggers input event with empty string
      const dialog = await dialogPromise;

      // Validate the alert message text
      expect(dialog.message()).toBe('Please enter a search term.');

      // Accept the alert so the test can continue
      await dialog.accept();

      // Ensure no unexpected page errors were thrown
      expect(pageErrors.length).toBe(0);
    });

    test('Non-empty input logs matches array to console (Searching active behavior)', async ({ page }) => {
      // This test validates that when a non-empty string is typed, the page computes "matches" and logs it.
      const app = new LinearSearchPage(page);
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      await app.goto();

      // Prepare to capture the next console message produced by the page
      const consolePromise = page.waitForEvent('console');

      // Provide a specific input for deterministic expectations
      await app.fillSearch('abc'); // this should trigger console.log(matches)

      // Get the console message emitted as a result of the input
      const msg = await consolePromise;

      // Ensure it's a log (console.log)
      expect(msg.type()).toBe('log');

      // The first argument to console.log is the matches array (a JSHandle)
      const args = msg.args();
      expect(args.length).toBeGreaterThanOrEqual(1);

      // Extract the JSON value of the first argument (the array)
      const firstArgValue = await args[0].jsonValue();

      // The implementation computes an array of booleans with length === input length
      expect(Array.isArray(firstArgValue)).toBe(true);
      expect(firstArgValue.length).toBe(3); // 'abc' -> length 3

      // Compute expected result using the buggy algorithm present in the page:
      // Observed behavior: for 'abc' algorithm yields [true, false, false]
      expect(firstArgValue).toEqual([true, false, false]);

      // No runtime page errors should have occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Matches array length equals input length for a longer input (edge case)', async ({ page }) => {
      // Validates the algorithm produces an array whose length equals the length of the input string
      const app = new LinearSearchPage(page);
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      await app.goto();

      const input = 'abcd123!@';
      const consolePromise = page.waitForEvent('console');
      await app.fillSearch(input);
      const msg = await consolePromise;

      expect(msg.type()).toBe('log');

      const arr = await msg.args()[0].jsonValue();
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(input.length);

      // Ensure no page errors occurred while processing longer input
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('SubmitSearch Event and transition S1 -> S0 validations', () => {
    test('Submitting the form reloads the page and returns to Idle evidence (S1 -> S0 transition)', async ({ page }) => {
      // This test validates that submitting (clicking Search) performs the form submission
      // which (in this implementation) results in a page reload, bringing the app back to Idle.
      const app = new LinearSearchPage(page);
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg));

      await app.goto();

      // Enter a non-empty value to be in "Searching" state logically
      await app.fillSearch('abc');

      // Wait for the console log from the searching behavior to ensure the page processed input
      await page.waitForEvent('console');

      // Now submit the form. The form has no action, so clicking submit reloads the same page.
      // Wait for navigation/load to complete.
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'load' }),
        app.clickSubmit()
      ]);

      // After reload, the page should be back to Idle: input and button visible
      expect(await app.isSearchVisible()).toBe(true);
      expect(await app.isSubmitVisible()).toBe(true);

      // The search input should be empty after a reload (fresh Idle)
      const valueAfter = await app.getSearchValue();
      expect(valueAfter).toBe('');

      // No runtime page errors should have occurred during this transition
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error observation and robustness checks', () => {
    test('No unexpected ReferenceError / SyntaxError / TypeError occurred during typical flows', async ({ page }) => {
      // This test groups multiple interactions and asserts that none of the common runtime error types were emitted.
      const app = new LinearSearchPage(page);
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      await app.goto();

      // Interact: empty alert path
      const dialogPromise = page.waitForEvent('dialog');
      await app.fillSearch('x');
      await app.fillSearch('');
      const dialog = await dialogPromise;
      await dialog.accept();

      // Interact: non-empty to trigger console logging
      const consolePromise = page.waitForEvent('console');
      await app.fillSearch('test');
      await consolePromise;

      // Submit to reload
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load' }),
        app.clickSubmit()
      ]);

      // Now inspect captured pageErrors for critical error types
      const errorMessages = pageErrors.map(e => String(e.message || e));
      // Assert that none of the captured errors are ReferenceError, SyntaxError, or TypeError
      for (const msg of errorMessages) {
        // If any of these substrings appear the test should fail
        expect(msg).not.toContain('ReferenceError');
        expect(msg).not.toContain('SyntaxError');
        expect(msg).not.toContain('TypeError');
      }

      // Also assert that there were no page errors at all in normal usage
      expect(pageErrors.length).toBe(0);
    });
  });
});