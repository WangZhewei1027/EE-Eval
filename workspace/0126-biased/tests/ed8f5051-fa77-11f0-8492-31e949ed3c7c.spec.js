import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f5051-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object Model for the Secure Connection page
class SecureConnectionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.title = page.locator('.title');
    this.subtitle = page.locator('.subtitle');
    this.button = page.locator('.button');
    this.lockIcon = page.locator('.lock-icon');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickLearnMore() {
    // Click the Learn More button
    await this.button.click();
  }

  async getOnclickAttribute() {
    return await this.page.locator('.button').getAttribute('onclick');
  }

  async getComputedOpacity(selector) {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).opacity;
    }, selector);
  }

  async hasShowAlertFunction() {
    return await this.page.evaluate(() => typeof showAlert === 'function');
  }
}

test.describe('Secure Connection - HTTPS (FSM Validation)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info/debug/warn/error) from the page
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture unhandled runtime errors from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the target page
    const model = new SecureConnectionPage(page);
    await model.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure we close any dialogs left open to avoid cross-test interference
    // If a dialog is open, Playwright's dialog handlers in tests will accept them.
    // No global teardown needed here; this is a placeholder for cleanup comments.
  });

  test.describe('State S0_Idle - Initial rendering and DOM checks', () => {
    test('renders all key UI components and entry actions run (title, subtitle, button, lock icon)', async ({ page }) => {
      // This test validates the Idle state (S0_Idle) entry action renderPage()
      const model = new SecureConnectionPage(page);

      // Verify core elements are present and visible
      await expect(model.title).toBeVisible();
      await expect(model.subtitle).toBeVisible();
      await expect(model.button).toBeVisible();
      await expect(model.lockIcon).toBeVisible();

      // Verify inner text content to ensure the correct page/version loaded
      await expect(model.title).toHaveText(/Secure Connection/i);
      await expect(model.subtitle).toHaveText(/You're browsing over HTTPS/i);

      // Verify the button has the expected onclick attribute as documented in FSM
      const onclick = await model.getOnclickAttribute();
      expect(onclick).toBe('showAlert()');

      // Verify computed style changes that should occur on window.onload (opacity transitions)
      const titleOpacity = await model.getComputedOpacity('.title');
      const subtitleOpacity = await model.getComputedOpacity('.subtitle');
      const buttonOpacity = await model.getComputedOpacity('.button');
      const lockOpacity = await model.getComputedOpacity('.lock-icon');

      // The inline script sets opacity to '1' on load; assert that transition applied
      expect(titleOpacity).toBe('1');
      expect(subtitleOpacity).toBe('1');
      expect(buttonOpacity).toBe('1');
      // lock-icon uses animation; it should reach full opacity after animation; expect '1'
      expect(lockOpacity).toBe('1');

      // Verify no page runtime errors were emitted during initial load
      expect(pageErrors.length).toBe(0);

      // Verify no console errors were emitted during initial load
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition LearnMoreClick -> S1_AlertShown', () => {
    test('clicking Learn More triggers alert with correct message and enters Alert Shown state', async ({ page }) => {
      // This test validates the event and transition in the FSM:
      // Event: LearnMoreClick on .button -> Action: showAlert() -> Observable: alert is displayed
      const model = new SecureConnectionPage(page);

      // Ensure showAlert exists on the window (function defined in script)
      const hasFn = await model.hasShowAlertFunction();
      expect(hasFn).toBe(true);

      // Prepare to capture the dialog that should appear upon clicking
      const expectedMessage =
        'HTTPS (Hypertext Transfer Protocol Secure) is an extension of HTTP. It uses TLS/SSL to encrypt data for security.';

      // Wait for the 'dialog' event that represents the alert
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        model.clickLearnMore(), // trigger the alert
      ]);

      // Assert dialog message matches expected alert text
      expect(dialog.message()).toBe(expectedMessage);

      // Accept the alert to close it (simulate user pressing 'OK')
      await dialog.accept();

      // After alert accepted, ensure page still has the key elements visible
      await expect(model.title).toBeVisible();
      await expect(model.button).toBeVisible();

      // No new runtime errors should have been produced by showing the alert
      expect(pageErrors.length).toBe(0);
    });

    test('multiple rapid clicks produce multiple alert dialogs sequentially', async ({ page }) => {
      // Edge case: user rapidly clicks Learn More multiple times
      const model = new SecureConnectionPage(page);

      // We'll perform 3 clicks and ensure 3 dialogs are shown in sequence
      const dialogsHandled = [];
      for (let i = 0; i < 3; i++) {
        const wait = page.waitForEvent('dialog');
        await model.clickLearnMore();
        const dialog = await wait;
        dialogsHandled.push(dialog.message());
        // Accept each dialog to allow the next to appear
        await dialog.accept();
      }

      // All dialog messages should be identical to the expected message
      const expected = 'HTTPS (Hypertext Transfer Protocol Secure) is an extension of HTTP. It uses TLS/SSL to encrypt data for security.';
      expect(dialogsHandled.length).toBe(3);
      for (const msg of dialogsHandled) {
        expect(msg).toBe(expected);
      }

      // No runtime errors should result from repeated alerts
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('attempting to interact with a non-existent selector throws Playwright error', async ({ page }) => {
      // This validates an edge case where user tries to click an element that doesn't exist.
      // We expect Playwright to throw an error when trying to click a missing element.
      // We don't modify the page; we simply attempt an invalid operation and assert the thrown error.

      const missingSelector = '.non-existent-button';

      // Use expect(...).rejects to assert the action fails
      await expect(page.click(missingSelector, { timeout: 2000 })).rejects.toThrow();
    });

    test('no unexpected ReferenceError, SyntaxError, or TypeError occurred on the page', async ({ page }) => {
      // This test explicitly checks that the page did not produce common runtime error types.
      // We gathered page errors in beforeEach. If any exist, inspect their names.

      // If there are no errors, the test passes.
      if (pageErrors.length === 0) {
        expect(pageErrors.length).toBe(0);
        return;
      }

      // If there are errors, assert they are not ReferenceError/SyntaxError/TypeError.
      // This is just to demonstrate observation; we do not alter page to create errors.
      for (const err of pageErrors) {
        const name = err.name || '';
        // Fail the test if we observe a common runtime error type (indicates a problem)
        expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(name);
      }
    });

    test('observe and surface any console.error messages if they occur', async ({ page }) => {
      // This test collects console messages captured and makes them available as assertions.
      // If console.error messages exist, fail the test and print them for diagnosis.

      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      if (consoleErrors.length > 0) {
        // Build a readable string of errors for debugging assertions
        const messages = consoleErrors.map((e) => e.text).join(' | ');
        // Fail with a clear message showing captured console.error output
        throw new Error(`Console errors detected on page load/interactions: ${messages}`);
      } else {
        // No console errors observed
        expect(consoleErrors.length).toBe(0);
      }
    });
  });
});