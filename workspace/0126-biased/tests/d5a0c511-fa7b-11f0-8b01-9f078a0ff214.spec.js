import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0c511-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Bubble Sort page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showDemoButtonSelector = "button[onclick='showDemo()']";
    this.expectedAlertText =
      'Bubble Sort Visualization is not currently implemented. Please refer to the textual explanation for understanding the algorithm.';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getShowDemoButton() {
    return this.page.locator(this.showDemoButtonSelector);
  }

  // Clicks the button and returns the dialog message via the dialog handler
  async clickShowDemoAndCaptureDialog() {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Dialog did not appear within expected time'));
      }, 3000);

      this.page.once('dialog', async (dialog) => {
        try {
          const message = dialog.message();
          await dialog.accept();
          clearTimeout(timeout);
          resolve(message);
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });

      await this.page.click(this.showDemoButtonSelector);
    });
  }

  // Install page-level listeners to collect console messages and page errors
  installObservers(consoleMessages, pageErrors) {
    this.page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  }
}

test.describe('Understanding Bubble Sort - FSM tests (d5a0c511-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Test that the page initially loads and the Idle state UI is present
  test('S0_Idle: Page loads with "Show Bubble Sort Visualization" button visible', async ({ page }) => {
    // Arrays to capture runtime console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];

    const ps = new BubbleSortPage(page);
    ps.installObservers(consoleMessages, pageErrors);

    // Navigate to the application page (S0 Idle)
    await ps.goto();

    // Basic page assertions: title and content
    await expect(page).toHaveTitle(/Understanding Bubble Sort/);

    // Verify the button exists and has the expected text
    const button = await ps.getShowDemoButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Show Bubble Sort Visualization');

    // There should be no unhandled page errors on initial load for this implementation
    expect(pageErrors.length).toBe(0);

    // There might be no console errors; record the console messages (informational)
    // We assert at least that the consoleMessages array is defined and is an array
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  // Test the FSM's S0 entry action: renderPage() is specified in the FSM but not implemented in the HTML.
  // We intentionally attempt to call renderPage() in the page context and expect a ReferenceError.
  test('S0 entry action "renderPage()" is not implemented - calling it triggers ReferenceError', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    const ps = new BubbleSortPage(page);
    ps.installObservers(consoleMessages, pageErrors);

    await ps.goto();

    // Attempt to call renderPage() in the page context.
    // The HTML does not define renderPage(), so the evaluation should reject with a ReferenceError.
    await expect(page.evaluate('renderPage()')).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // When an in-page ReferenceError occurs via evaluate, Playwright rejects the promise.
    // The pageerror event may or may not be emitted depending on the browser; if emitted it should be a ReferenceError.
    // We make a weak assertion: if a page error was captured, it should include 'renderPage' or be a ReferenceError.
    if (pageErrors.length > 0) {
      const combined = pageErrors.map((e) => String(e)).join(' | ');
      expect(/renderPage|ReferenceError/i.test(combined)).toBeTruthy();
    }
  });

  // Test the ShowDemo event / transition: clicking the button should display the alert with the expected message.
  test('Transition ShowDemo: clicking button shows alert and transitions to Visualization Shown (S1)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    const ps = new BubbleSortPage(page);
    ps.installObservers(consoleMessages, pageErrors);

    await ps.goto();

    // Ensure the button is available before clicking
    const button = await ps.getShowDemoButton();
    await expect(button).toBeVisible();

    // Click the button and capture the alert text
    const alertText = await ps.clickShowDemoAndCaptureDialog();

    // Validate the alert message matches FSM evidence
    expect(alertText).toBe(ps.expectedAlertText);

    // After the dialog, there should be no new page errors introduced by the click in this implementation
    expect(pageErrors.length).toBe(0);

    // Confirm we at least captured that an alert/dialog was shown by validating the alert text
    expect(alertText.length).toBeGreaterThan(0);
  });

  // Validate that the showDemo function is present in the global scope and calling it triggers the same alert.
  test('S1_Visualization_Shown: showDemo() exists and invoking it triggers the expected alert', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    const ps = new BubbleSortPage(page);
    ps.installObservers(consoleMessages, pageErrors);

    await ps.goto();

    // Check typeof showDemo in page context
    const typeOfShowDemo = await page.evaluate(() => typeof window.showDemo);
    expect(typeOfShowDemo).toBe('function');

    // Prepare to capture the dialog, then call showDemo() directly
    const dialogPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Dialog did not appear in time')), 3000);
      page.once('dialog', async (dialog) => {
        try {
          const msg = dialog.message();
          await dialog.accept();
          clearTimeout(timeout);
          resolve(msg);
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });
    });

    // Call showDemo inside the page; since showDemo triggers alert synchronously, ensure dialog handler is set before evaluate
    await page.evaluate(() => { window.showDemo(); });

    const dialogMessage = await dialogPromise;
    expect(dialogMessage).toBe(ps.expectedAlertText);
  });

  // Edge cases: intentionally execute code snippets in the page that cause SyntaxError and TypeError,
  // allowing those errors to occur naturally and asserting they are thrown.
  test('Edge cases: executing invalid code should naturally produce SyntaxError and TypeError', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    const ps = new BubbleSortPage(page);
    ps.installObservers(consoleMessages, pageErrors);

    await ps.goto();

    // 1) SyntaxError via eval of invalid code
    // We expect the evaluate call to reject with a SyntaxError or message containing 'Unexpected token'
    await expect(page.evaluate(() => eval('var a = ;'))).rejects.toThrow(/SyntaxError|Unexpected token|Unexpected end of input/);

    // 2) TypeError: attempt to call a property on null
    // e.g., null.f() should throw a TypeError in the page context
    await expect(page.evaluate(() => { return null.f(); })).rejects.toThrow(/TypeError|Cannot read property|Cannot read properties/);

    // If pageerror events were emitted for these issues, at least one should reference SyntaxError or TypeError text
    if (pageErrors.length > 0) {
      const joined = pageErrors.map(String).join(' | ');
      expect(/TypeError|SyntaxError|Unexpected token|Cannot read/.test(joined)).toBeTruthy();
    }
  });

  // Comprehensive integration: load page, capture all console and page errors emitted during lifecycle,
  // perform the normal user flow (idle -> click -> visualization shown), and then assert overall runtime stability.
  test('Full flow: monitor console and page errors during full interaction flow', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    const ps = new BubbleSortPage(page);
    ps.installObservers(consoleMessages, pageErrors);

    await ps.goto();

    // Pre-interaction snapshot
    expect(pageErrors.length).toBe(0);

    // Perform user action: click to show demo
    const alertText = await ps.clickShowDemoAndCaptureDialog();
    expect(alertText).toBe(ps.expectedAlertText);

    // Post-interaction: ensure no unexpected console.error messages were captured
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error');
    // For this implementation we expect there to be no console.error messages; assert that
    expect(consoleErrorMessages.length).toBe(0);

    // Also assert there were no unhandled page errors
    expect(pageErrors.length).toBe(0);
  });
});