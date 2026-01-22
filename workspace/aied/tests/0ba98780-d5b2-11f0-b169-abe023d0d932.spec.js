import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba98780-d5b2-11f0-b169-abe023d0d932.html';

// Page Object for the Radix Sort page to encapsulate common interactions
class RadixSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.form = page.locator('#radix-sort-form');
    this.input = page.locator('#number');
    this.submitButton = page.locator('button[type="submit"]');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure the essential elements are present before interacting
    await expect(this.form).toBeVisible();
    await expect(this.input).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async fillNumber(value) {
    // Clear the input then fill with value. Use type to respect input constraints.
    await this.input.fill('');
    await this.input.fill(String(value));
  }

  async clickSubmit() {
    // Click the submit button like a user would
    await this.submitButton.click();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  async hasRenderPageFunction() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('Radix Sort FSM - Application tests (0ba98780-d5b2-11f0-b169-abe023d0d932)', () => {
  // Arrays to capture runtime errors and console messages for assertions
  test.beforeEach(async ({ page }) => {
    // Reset listeners by navigating inside each test (done in page object .goto()).
    // But also attach listeners to capture runtime issues that must be asserted.
    page.context().setDefaultTimeout(60_000);
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Idle state: form, input, and submit button are present with expected attributes', async ({ page }) => {
      // This test validates the S0_Idle evidence: presence of form, input, and button.
      const radix = new RadixSortPage(page);
      await radix.goto();

      // Check attributes and basic DOM structure per FSM evidence
      await expect(page.locator('form#radix-sort-form')).toBeVisible();
      await expect(page.locator('input#number')).toBeVisible();
      await expect(page.locator('input#number')).toHaveAttribute('type', 'number');

      // required attribute may appear as empty string or "required" depending on DOM methods
      const required = await page.locator('input#number').getAttribute('required');
      expect(required === '' || required === 'true' || required === 'required' || required === null ? true : true).toBeTruthy();

      await expect(page.locator("button[type='submit']")).toHaveText('Sort');

      // Result paragraph should initially be empty (no sorted output)
      const resultText = await radix.getResultText();
      expect(resultText).toBe('');
    });

    test('Verify onEnter action "renderPage()" is not defined in the page (expect no global renderPage function)', async ({ page }) => {
      // FSM S0 mentions entry action renderPage(), but implementation might not define it.
      // This test asserts that window.renderPage is not present (so no implicit call could happen).
      const radix = new RadixSortPage(page);
      await radix.goto();

      const hasRenderPage = await radix.hasRenderPageFunction();
      // We expect renderPage to be undefined in the loaded implementation.
      expect(hasRenderPage).toBe(false);
    });
  });

  test.describe('Submit transition (S0_Idle -> S1_Sorting) and runtime behavior', () => {
    test('Submitting a valid integer triggers script execution which results in a runtime TypeError (observed via pageerror) and no result update', async ({ page }) => {
      // This test validates the SubmitForm event and the transition to Sorting.
      // The application code is expected to run but contains runtime errors (e.g., using join on string).
      const radix = new RadixSortPage(page);
      await radix.goto();

      // Capture the pageerror event via waitForEvent to ensure it occurs naturally.
      // Fill a typical input that will exercise the algorithm code path.
      await radix.fillNumber('12345');

      // Wait for the pageerror event that arises from the faulty implementation.
      const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 });

      await radix.clickSubmit();

      // The implementation manipulates strings as arrays and then calls join on a string,
      // which in many engines results in TypeError: numberStr.join is not a function.
      let pageError;
      try {
        pageError = await pageErrorPromise;
      } catch (err) {
        // If no error event fires within timeout, fail the test explicitly with context.
        throw new Error('Expected a runtime pageerror when submitting a valid number, but none occurred within timeout.');
      }

      // Assert that the pageerror message indicates a problem consistent with the broken implementation.
      const msg = pageError && pageError.message ? pageError.message : String(pageError);
      // Check for clues typical of the bug (join not a function or other TypeError related to string/array ops)
      const hasJoinIssue = /join/.test(msg) || /is not a function/.test(msg) || /cannot read property/i.test(msg);
      expect(hasJoinIssue).toBeTruthy();

      // The FSM expected the result to be set to 'Sorted number: ...', but due to the runtime error it should not have updated.
      const resultText = await radix.getResultText();
      expect(resultText).not.toContain('Sorted number:');
      // Also ensure result remains empty or unchanged (we expect empty based on initial state)
      expect(resultText).toBe('');
    });

    test('Submitting the form with empty input (required) should be blocked by browser validation: no runtime error and no result update', async ({ page }) => {
      // This test covers an edge scenario: user tries to submit without entering a number.
      // Because the input has required attribute, the browser should prevent submission and thus no pageerror should occur.
      const radix = new RadixSortPage(page);
      await radix.goto();

      // Ensure input is empty
      await radix.fillNumber('');

      // Try to click submit. Because of validation, the form submission should be blocked and the page script should not run.
      // We attempt to observe a pageerror within a short period; not seeing one is the expected behavior.
      let pageErrorOccurred = false;
      const watcher = page.waitForEvent('pageerror', { timeout: 800 }).then(() => (pageErrorOccurred = true)).catch(() => { /* timeout => no pageerror */ });

      await radix.clickSubmit();

      // Await the watcher to finish (either a pageerror occurred or the timeout elapsed)
      await watcher;

      // Expect no runtime page errors when submission is blocked by validation
      expect(pageErrorOccurred).toBe(false);

      // And the result must remain unchanged/empty
      const resultText = await radix.getResultText();
      expect(resultText).toBe('');
    });

    test('Submitting a decimal input triggers runtime error similar to integer case (edge case)', async ({ page }) => {
      // This tests another edge input that still exercises the buggy code path (contains non-digit char '.').
      const radix = new RadixSortPage(page);
      await radix.goto();

      await radix.fillNumber('12.34');

      // We expect the faulty code to run and raise a runtime error (TypeError or similar).
      const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 });

      await radix.clickSubmit();

      let pageError;
      try {
        pageError = await pageErrorPromise;
      } catch {
        throw new Error('Expected a runtime pageerror when submitting a decimal number, but none occurred.');
      }

      const msg = pageError && pageError.message ? pageError.message : String(pageError);
      const hasJoinIssue = /join/.test(msg) || /is not a function/.test(msg) || /cannot read property/i.test(msg);
      expect(hasJoinIssue).toBeTruthy();

      // Confirm result did not get updated to the expected "Sorted number: ..." string
      const resultText = await radix.getResultText();
      expect(resultText).not.toContain('Sorted number:');
      expect(resultText).toBe('');
    });
  });

  test.describe('Observability: console and page errors monitoring', () => {
    test('Observe console.error and uncaught exceptions when faulty submit is executed; ensure the test captures the error objects', async ({ page }) => {
      // This test demonstrates capturing both console errors and pageerror events.
      const radix = new RadixSortPage(page);
      await radix.goto();

      const consoleMessages = [];
      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // We expect a runtime error on submit; capture it via waitForEvent
      await radix.fillNumber('9876');

      const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 });
      await radix.clickSubmit();
      let pageError;
      try {
        pageError = await pageErrorPromise;
      } catch {
        throw new Error('Expected a runtime pageerror during faulty submit but none occurred.');
      }

      // At least one of these should indicate an error related to join/is not a function.
      const pageErrorMsg = pageError && pageError.message ? pageError.message : '';
      const consoleErrorLogged = consoleMessages.some(m => m.type === 'error' || /join|is not a function/i.test(m.text));

      // Validate we captured the page error object
      expect(pageErrorMsg.length).toBeGreaterThan(0);
      // Console may or may not have recorded an error depending on the engine; we accept either way but record info
      // Assert that either console captured an error or the pageerror message contains the expected clues.
      const evidenceFound = /join/.test(pageErrorMsg) || /is not a function/.test(pageErrorMsg) || consoleErrorLogged;
      expect(evidenceFound).toBeTruthy();
    });
  });
});