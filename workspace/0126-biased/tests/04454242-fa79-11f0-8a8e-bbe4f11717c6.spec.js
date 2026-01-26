import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04454242-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page object for the Hash Functions demo page.
 * Encapsulates common queries without modifying the page.
 */
class HashPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonLocator = page.locator('.button');
    this.container = page.locator('.container');
    this.headings = page.locator('h2');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async countButtons() {
    return await this.buttonLocator.count();
  }

  async clickButton(index = 0) {
    await this.buttonLocator.nth(index).click();
  }

  async getAllButtonTexts() {
    const count = await this.countButtons();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push(await this.buttonLocator.nth(i).innerText());
    }
    return texts;
  }

  async isContainerVisible() {
    return await this.container.isVisible();
  }
}

test.describe('Hash Functions - FSM validation and runtime error observation', () => {
  // Each test uses a fresh page fixture provided by Playwright.
  // We capture console messages, dialogs, and page errors to assert expected and unexpected runtime behavior.

  test('Initial render (S0_Idle): page loads and shows Calculate Hash buttons', async ({ page }) => {
    // Arrays to capture events that occur during the test
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('dialog', (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Do not accept/ dismiss programmatically to avoid changing page behavior — but close to avoid blocking
      dialog.dismiss().catch(() => {});
    });

    const model = new HashPage(page);
    await model.goto();

    // Validate entry action "renderPage()" from the FSM by asserting key content is present
    expect(await model.isContainerVisible()).toBe(true);

    // There should be two buttons (as HTML contains two .button elements)
    const buttonCount = await model.countButtons();
    expect(buttonCount).toBeGreaterThanOrEqual(2);

    // All buttons should show the expected text per the FSM/component description
    const texts = await model.getAllButtonTexts();
    for (const t of texts) {
      expect(t).toBe('Calculate Hash');
    }

    // No runtime errors should have occurred simply by loading the page
    expect(pageErrors.length).toBe(0);

    // No dialogs should have been shown automatically at load
    expect(dialogs.length).toBe(0);

    // No console errors at load (we still permit other console messages)
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Clicking the first Calculate Hash button triggers the handler and results in a runtime error (expected ReferenceError due to "crypto" usage)', async ({ page }) => {
    // Capture pageerrors and dialogs to validate behavior
    const pageErrors = [];
    const consoleMessages = [];
    const dialogs = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('dialog', (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Dismiss so it doesn't block tests; this still counts as observing the dialog
      dialog.dismiss().catch(() => {});
    });

    const model = new HashPage(page);
    await model.goto();

    // Precondition: ensure at least one button exists
    expect(await model.countButtons()).toBeGreaterThanOrEqual(1);

    // Click the first button. The implementation attaches the same handler twice to the first element,
    // and that handler references `crypto.createHash` which is not available in the browser environment.
    // We therefore expect at least one uncaught exception (ReferenceError) to be emitted as a pageerror.
    await model.clickButton(0);

    // Wait briefly to allow any synchronous exceptions from the click handler to surface
    // Use waitForEvent to deterministically capture a pageerror if emitted
    let capturedError = null;
    try {
      // If an error is thrown, Playwright's page.waitForEvent('pageerror') will resolve with the Error object.
      capturedError = await page.waitForEvent('pageerror', { timeout: 2000 });
    } catch (e) {
      // If timeout occurs, capturedError remains null; we'll assert accordingly below
    }

    // At least one pageerror is expected because the code uses Node's crypto API in the browser
    expect(capturedError || pageErrors.length > 0).toBeTruthy();

    // If we captured an error object, validate its message mentions 'crypto' or ReferenceError-like text
    const errorToInspect = capturedError ?? pageErrors[0];
    expect(errorToInspect).toBeDefined();
    const message = String(errorToInspect && (errorToInspect.message || errorToInspect));
    // The runtime in the browser will typically say 'crypto is not defined' or similar.
    expect(/crypto/i.test(message)).toBeTruthy();

    // Verify that no alert() dialog with a hash value was shown due to the error occurring before alert()
    // There might be no dialogs; ensure that none indicate the expected success alert.
    // Wait briefly to allow any dialogs to appear (if the implementation had succeeded)
    await page.waitForTimeout(200); // small pause to ensure any sync dialog would appear
    // Ensure there is no alert dialog with "Hash Value:" (FSM expects an alert, but code errors first)
    const alertDialog = dialogs.find(d => /Hash Value:/i.test(d.message));
    expect(alertDialog).toBeUndefined();

    // Additionally assert that the console captured at least one error-level message
    const consoleError = consoleMessages.find(m => m.type === 'error' || /error/i.test(m.text));
    // It's acceptable if there's no console.error; the primary signal is pageerror. But prefer to see console error.
    // Assert non-blocking — if present, it should mention crypto.
    if (consoleError) {
      expect(/crypto/i.test(consoleError.text) || /referenceerror/i.test(consoleError.text.toLowerCase())).toBeTruthy();
    }
  });

  test('Clicking the second Calculate Hash button does NOT trigger the handler because both button1 and button2 selectors point to the same element in the script', async ({ page }) => {
    // This test validates the implementation bug: both button1 and button2 use document.querySelector('.button')
    // which returns the first matching element. As a result, the second visible button in the DOM often has no listener.
    const pageErrors = [];
    const dialogs = [];

    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('dialog', (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      dialog.dismiss().catch(() => {});
    });

    const model = new HashPage(page);
    await model.goto();

    // Ensure we have at least two buttons in the DOM as per HTML
    const count = await model.countButtons();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click the SECOND button (index 1). Because the script attached listeners twice to the first element,
    // the second button is likely not wired. We therefore expect NO pageerror and NO alert from clicking it.
    await model.clickButton(1);

    // Wait briefly to see if any error or dialog appears
    let errorOccurred = false;
    try {
      await page.waitForEvent('pageerror', { timeout: 500 });
      errorOccurred = true;
    } catch {
      errorOccurred = false;
    }

    // Assert that clicking the second button did not produce an error (typical for the faulty implementation)
    expect(errorOccurred).toBe(false);

    // Also assert that no alert dialog was presented
    // Wait a short time for any dialog that might appear synchronously
    await page.waitForTimeout(200);
    const anyAlert = dialogs.find(d => d.type === 'alert' || /Hash Value:/i.test(d.message));
    expect(anyAlert).toBeUndefined();
  });

  test('Edge case: multiple clicks on the first button may emit multiple pageerrors because the handler was added twice', async ({ page }) => {
    // This test probes the fact that the same handler is added twice to the same element,
    // which can result in the handler running twice and therefore throwing twice.
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));

    const model = new HashPage(page);
    await model.goto();

    expect(await model.countButtons()).toBeGreaterThanOrEqual(1);

    // Click twice in quick succession
    await model.clickButton(0);
    await model.clickButton(0);

    // Wait for up to 2 pageerror events to surface (if they occur)
    try {
      // Wait for first error
      await page.waitForEvent('pageerror', { timeout: 2000 });
    } catch {
      // ignore if none
    }

    // Small pause to collect any further thrown errors
    await page.waitForTimeout(300);

    // There should be at least one error. If the handler was invoked twice, we may see two errors.
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // If there are multiple errors, their messages should be similar and mention 'crypto'
    for (const err of errors) {
      const msg = String(err && (err.message || err));
      expect(/crypto/i.test(msg)).toBeTruthy();
    }
  });
});