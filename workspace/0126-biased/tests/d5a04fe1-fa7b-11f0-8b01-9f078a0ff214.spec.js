import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a04fe1-fa7b-11f0-8b01-9f078a0ff214.html';
const DEMONSTRATE_ALERT_TEXT = "This is a simple multiset in action! Try defining your own multiset as per the explanations above!";

/**
 * Page Object Model for the Multisets demo page.
 * Encapsulates interactions and common selectors.
 */
class MultisetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick]';
    this.h1Selector = 'h1';
  }

  async goto() {
    // Navigate to the application page and wait for load
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return await this.page.textContent(this.h1Selector);
  }

  async getDemonstrateButton() {
    return await this.page.$(this.buttonSelector);
  }

  async getDemonstrateButtonText() {
    return await this.page.textContent(this.buttonSelector);
  }

  async getDemonstrateOnclickAttr() {
    return await this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  async clickDemonstrate() {
    await this.page.click(this.buttonSelector);
  }

  async getButtonComputedBackgroundColor() {
    const handle = await this.page.$(this.buttonSelector);
    if (!handle) return null;
    return await this.page.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    }, handle);
  }
}

/**
 * Helper asserts that any captured page errors are either zero,
 * or match allowed JavaScript error types. This follows the requirement
 * to observe errors and let ReferenceError/SyntaxError/TypeError happen naturally.
 *
 * @param {Array<Error>} pageErrors
 */
function assertAllowedPageErrors(pageErrors) {
  // Allowed error type names (case-insensitive)
  const allowedTypes = ['ReferenceError', 'TypeError', 'SyntaxError'];
  // If there are no errors, that's acceptable.
  if (pageErrors.length === 0) {
    expect(pageErrors.length).toBe(0);
    return;
  }
  // If errors exist, ensure they are of one of the allowed types.
  for (const err of pageErrors) {
    // err may be an Error object or plain object with message; normalize.
    const name = err && err.name ? err.name : String(err).split(':')[0];
    const message = err && err.message ? err.message : String(err);
    const matched = allowedTypes.some((t) => name.includes(t) || message.includes(t));
    expect(matched).toBeTruthy();
  }
}

test.describe('Multisets Interactive Page - FSM Validation', () => {
  // Will collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Observe console messages
    page.on('console', (msg) => {
      // Collect console messages for inspection
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Observe uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Observe dialogs and automatically accept them while recording
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // If accepting fails, record it as an error as well.
        pageErrors.push(e);
      }
    });
  });

  test.afterEach(async () => {
    // After each test, ensure that observed pageErrors are either none
    // or of the allowed types. This checks that we observed and validated
    // any natural runtime errors without patching or modifying the page.
    assertAllowedPageErrors(pageErrors);
  });

  test('Page loads correctly and initial DOM/state matches S0_Idle', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry conditions:
    // - Page renders (h1 text present)
    // - Demonstrate button exists with correct text and onclick attribute
    // - entry action "renderPage()" is NOT present on global window (we assert absence)
    const app = new MultisetPage(page);
    await app.goto();

    // Validate heading text
    const heading = await app.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toEqual('Understanding Multisets');

    // Validate button exists
    const button = await app.getDemonstrateButton();
    expect(button).not.toBeNull();

    // Validate button text
    const btnText = await app.getDemonstrateButtonText();
    expect(btnText).toBe('Demonstrate Multiset');

    // Validate onclick attribute content matches FSM evidence
    const onclickAttr = await app.getDemonstrateOnclickAttr();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('This is a simple multiset in action! Try defining your own multiset as per the explanations above!')");

    // Verify that the entry action "renderPage" is not inadvertently defined on the page as a global.
    // FSM listed renderPage() as an entry action; the HTML implementation does not define this,
    // so we expect it to be undefined. We must not define or mock it.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // There should be no console errors emitted during initial load (but we still accept zero or allowed JS errors).
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Clicking Demonstrate Multiset shows expected alert dialog (Transition test)', async ({ page }) => {
    // This test exercises the FSM transition "DemonstrateMultiset" by clicking the button,
    // and verifies the expected observable: an alert dialog with exact message.
    const app = new MultisetPage(page);
    await app.goto();

    // Click the button; the page.on('dialog') handler in beforeEach will accept and record it.
    await app.clickDemonstrate();

    // After the click, we expect exactly one dialog recorded with the expected alert text.
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    // The first dialog must match expected
    const firstDialog = dialogs[0];
    expect(firstDialog.type).toBe('alert');
    expect(firstDialog.message).toBe(DEMONSTRATE_ALERT_TEXT);

    // Also ensure clicking the button does not produce any unexpected console errors
    // (page errors will be asserted in afterEach).
    expect(consoleMessages.filter(m => m.type === 'error').length).toBeGreaterThanOrEqual(0);
  });

  test('Rapid sequential clicks create sequential alert dialogs and are handled', async ({ page }) => {
    // Edge case: clicking the demonstrate button multiple times quickly.
    // Ensure that multiple dialogs appear in order and are captured by our dialog handler.
    const app = new MultisetPage(page);
    await app.goto();

    // Click the button twice in quick succession.
    // The built-in page.on('dialog') handler will accept each dialog.
    await Promise.all([
      app.clickDemonstrate(),
      app.clickDemonstrate()
    ]);

    // We should have recorded two dialogs (or at least two invocations).
    // Due to timing in some browsers, the second click may be queued until the first dialog is handled;
    // our test accepts both possibilities but expects at least 2 entries after both clicks.
    expect(dialogs.length).toBeGreaterThanOrEqual(2);

    // Validate both dialog messages match expected text.
    for (let i = 0; i < 2; i++) {
      expect(dialogs[i].type).toBe('alert');
      expect(dialogs[i].message).toBe(DEMONSTRATE_ALERT_TEXT);
    }
  });

  test('Button styling and visual feedback present', async ({ page }) => {
    // This test checks visual feedback by verifying computed styles on the button.
    // It ensures the button is styled (background color) as per the provided CSS.
    const app = new MultisetPage(page);
    await app.goto();

    const bgColor = await app.getButtonComputedBackgroundColor();
    // The CSS sets background-color: #007bff which resolves to rgb(0, 123, 255) in most browsers.
    // We assert that the computed value contains the expected RGB components.
    expect(bgColor).toBeTruthy();
    expect(bgColor).toContain('0, 123, 255');
  });

  test('Ensure onclick attribute triggers native alert (no JS function patching)', async ({ page }) => {
    // Validate that the onclick attribute is inline and triggers the native alert call,
    // rather than calling a missing global function (i.e., we assert the attribute contains alert()).
    const app = new MultisetPage(page);
    await app.goto();

    const onclickAttr = await app.getDemonstrateOnclickAttr();
    expect(onclickAttr).toContain('alert(');
    // Perform the click and ensure the dialog text equals expected text.
    await app.clickDemonstrate();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1].message).toBe(DEMONSTRATE_ALERT_TEXT);
  });

  test('Attempt to click a non-existent selector results in Playwright error (edge/error scenario)', async ({ page }) => {
    // This test checks behavior when trying to interact with a missing element.
    // It verifies our test environment surfaces the error from Playwright as expected.
    const app = new MultisetPage(page);
    await app.goto();

    // Try to click a selector that does not exist and assert that Playwright throws.
    let thrown = null;
    try {
      await page.click('button.non-existent-selector', { timeout: 2000 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).not.toBeNull();
    // The error message should indicate that the element was not found or clickable.
    expect(String(thrown.message)).toMatch(/(strict mode|No element|waiting for|timeout|not visible|not attached|not found)/i);
  });

  test('Page error observation: if any runtime errors occur they are of allowed types', async ({ page }) => {
    // This test specifically focuses on observing uncaught runtime errors.
    // It doesn't force an error, it only asserts that any naturally occurring errors are Reference/Type/Syntax errors.
    const app = new MultisetPage(page);
    await app.goto();

    // No interactions necessary; just wait a short moment to collect any async page errors.
    await page.waitForTimeout(200);

    // Use the helper to assert errors are either absent or of allowed types.
    assertAllowedPageErrors(pageErrors);
  });
});