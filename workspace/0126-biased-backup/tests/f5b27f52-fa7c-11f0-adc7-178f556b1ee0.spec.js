import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b27f52-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Simple page object for the Relational Database demo page.
 * Encapsulates interactions so tests are easier to read and maintain.
 */
class RelationalDatabasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.submitSelector = '#submit-btn';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async submit() {
    // Wait for the dialog that the page script triggers when clicking submit.
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click(this.submitSelector);
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  async isSubmitVisible() {
    const el = await this.page.$(this.submitSelector);
    if (!el) return false;
    return await el.isVisible();
  }

  async getSubmitText() {
    const el = await this.page.$(this.submitSelector);
    if (!el) return null;
    return el.textContent();
  }

  async elementExists(selector) {
    return (await this.page.$(selector)) !== null;
  }
}

test.describe('Relational Database Interactive - FSM Validation (f5b27f52-...)', () => {
  // Collect console messages and page errors for assertions and debugging.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // store text for analysis
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // best-effort capture; some console messages may not serialize
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error with name and message
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Give a brief moment after actions to capture any late console/page errors
    await page.waitForTimeout(50);
  });

  test.describe('State: S0_Idle (Initial render)', () => {
    test('renders the page and shows a Submit button (Idle state evidence)', async ({ page }) => {
      // This test validates the Idle state evidence from the FSM:
      // - The page loads
      // - The Submit button (#submit-btn) is present and visible
      // - The button has expected label text
      const app = new RelationalDatabasePage(page);

      // Ensure page title and main heading exist as basic sanity checks
      const title = await page.title();
      expect(title).toContain('Relational Database');

      // Verify the submit button exists and is visible
      const exists = await app.elementExists('#submit-btn');
      expect(exists).toBe(true);

      const visible = await app.isSubmitVisible();
      expect(visible).toBe(true);

      const text = await app.getSubmitText();
      // The button text in the HTML is "Submit"
      expect(text).toMatch(/Submit/i);

      // FSM S0 entry action listed "renderPage()": verify that no global renderPage() function is present
      // We do not modify the runtime; we only read it.
      const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
      // The implementation does not define renderPage(); we assert it is undefined (documented check).
      expect(hasRenderPage).toBe(false);

      // Assert that during initial render there were no uncaught page errors.
      // If the page had parsing/runtime issues they'd appear here as pageErrors.
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Event: SubmitClick -> Transition to S1_Feedback', () => {
    test('clicking Submit shows an alert with the thank-you message (Feedback state entry)', async ({ page }) => {
      // This test validates the transition from Idle to Feedback:
      // - Clicking #submit-btn should trigger an alert with the expected message.
      // - We capture and assert the dialog message.
      const app = new RelationalDatabasePage(page);

      // Ensure button present before interacting
      expect(await app.elementExists('#submit-btn')).toBe(true);

      // Click and capture the alert dialog message
      const message = await app.submit();
      expect(message).toBe('Thank you for learning about relational databases!');

      // After the alert, ensure the button remains available (the DOM should not be removed)
      expect(await app.elementExists('#submit-btn')).toBe(true);

      // Verify no uncaught errors were thrown during click handling
      expect(pageErrors.length).toBe(0);
    });

    test('multiple clicks produce repeated alerts (edge case)', async ({ page }) => {
      // Edge case: ensure the button can be clicked repeatedly and each click triggers an alert.
      const app = new RelationalDatabasePage(page);

      // Click the button 3 times, handling each dialog sequentially.
      for (let i = 0; i < 3; i++) {
        const message = await app.submit();
        expect(message).toBe('Thank you for learning about relational databases!');
      }

      // Ensure still no uncaught errors after repeated interactions
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Verifications for onEnter/onExit actions and DOM anomalies', () => {
    test('S1 entry action is an alert (observable) and no hidden onExit functions exist', async ({ page }) => {
      // The FSM indicates S1_Feedback has an entry action that is an alert.
      // We've tested the alert above; here we additionally assert that there is no global onExit function defined.
      const app = new RelationalDatabasePage(page);

      // Trigger once to observe alert (ensures the action is executed at least once)
      const message = await app.submit();
      expect(message).toContain('Thank you for learning about relational databases!');

      // Verify that onExit functions mentioned in FSM are not present (the FSM had none,
      // but this checks there are no unexpected global functions like exitFeedback)
      const hasExitFeedback = await page.evaluate(() => typeof window.exitFeedback !== 'undefined');
      expect(hasExitFeedback).toBe(false);

      // Ensure no page errors were reported
      expect(pageErrors.length).toBe(0);
    });

    test('document contains no unexpected <select> elements introduced by malformed markup', async ({ page }) => {
      // The HTML contains a suspicious stray closing tag ("</select>") inside a list item.
      // Browsers typically tolerate malformed HTML. Assert that there is no unexpected <select> element created.
      const selectCount = await page.evaluate(() => document.querySelectorAll('select').length);
      // Expect zero select elements because the markup had only a stray closing tag, not an actual <select>.
      expect(selectCount).toBe(0);

      // Still ensure page had no uncaught JS errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and page error observation (diagnostics)', () => {
    test('collect console messages and ensure no unexpected ReferenceError/SyntaxError/TypeError occurred', async ({ page }) => {
      // This test explicitly inspects captured console messages and page errors.
      // We do not modify page behavior; we only observe and assert expectations.

      // Trigger a click to potentially generate console messages or errors from handlers
      const app = new RelationalDatabasePage(page);
      await app.submit();

      // Small pause to capture asynchronous logs (if any)
      await page.waitForTimeout(50);

      // Assert that we captured console messages array (may be empty but should be an array)
      expect(Array.isArray(consoleMessages)).toBe(true);

      // Inspect pageErrors and assert none of the common fatal JS error types appeared.
      const fatalErrors = pageErrors.filter(err =>
        typeof err.name === 'string' && (
          err.name.includes('ReferenceError') ||
          err.name.includes('SyntaxError') ||
          err.name.includes('TypeError')
        )
      );

      // For this application we expect no fatal runtime JS errors.
      // If any fatal errors are present, dump them as part of the assertion message to aid debugging.
      expect(fatalErrors.length, `Unexpected fatal JS errors: ${fatalErrors.map(e => `${e.name}: ${e.message}`).join('; ')}`).toBe(0);
    });

    test('log captured console messages and page errors for debugging (no assertions on content)', async ({ page }) => {
      // This test intentionally demonstrates capturing the diagnostics; it's informational.
      // It asserts only that our collectors captured arrays (not their contents).
      // We avoid failing the test based solely on console logs, but still assert pageErrors is an array.
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);
    });
  });
});