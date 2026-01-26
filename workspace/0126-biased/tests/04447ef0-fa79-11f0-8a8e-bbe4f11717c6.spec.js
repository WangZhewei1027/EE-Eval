import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04447ef0-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the Integration Testing app
class IntegrationApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns the test button locator
  testButton() {
    return this.page.locator('#test-button');
  }

  container() {
    return this.page.locator('.container');
  }

  header() {
    return this.page.locator('.header');
  }

  footer() {
    return this.page.locator('.footer');
  }

  // Click the test button and wait for the alert dialog message
  async clickTestButtonAndGetDialogMessage() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.testButton().click(),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Integration Testing FSM - Application 04447ef0-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test to capture runtime diagnostics
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type(); // 'log', 'error', etc.
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', (err) => {
      // err is an Error object for uncaught exceptions on the page
      pageErrors.push(err);
    });
  });

  // Clean up listeners after each test (Playwright auto-cleans per test),
  // but we reset arrays to avoid cross-test leakage.
  test.afterEach(async () => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
  });

  test('S0_Idle: Initial render shows container, header and footer (renderPage entry action)', async ({ page }) => {
    // This validates the FSM Idle state entry action renderPage() by asserting the DOM elements exist.
    const app = new IntegrationApp(page);
    await app.goto();

    // Verify structural elements that indicate the Idle state
    await expect(app.container()).toBeVisible();
    await expect(app.header()).toBeVisible();
    await expect(app.header().locator('h1')).toHaveText('Integration Testing');
    await expect(app.footer()).toBeVisible();
    await expect(app.footer().locator('p')).toContainText('© 2023 Integration Testing');

    // Ensure the test button exists and has expected label text
    await expect(app.testButton()).toBeVisible();
    await expect(app.testButton()).toHaveText('Test');

    // Observe console and page errors during initial render.
    // The test records any console errors and page errors for later assertions.
    // It's valid for these arrays to be empty if the page runs cleanly.
    // We assert that there were no uncaught page errors on load.
    expect(pageErrors.length).toBe(0);

    // Log any console errors for visibility in test output; assert none present.
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_TestPerformed: Clicking the test button triggers expected alert (FSM transition ButtonClick)', async ({ page }) => {
    // This validates the transition from S0_Idle -> S1_TestPerformed via ButtonClick,
    // and checks the onEnter action: alert('Integration testing has been performed successfully!')
    const app = new IntegrationApp(page);
    await app.goto();

    // Click the button and capture the dialog message
    const message = await app.clickTestButtonAndGetDialogMessage();

    // Validate the alert message exactly matches the FSM's expected string
    expect(message).toBe('Integration testing has been performed successfully!');

    // After the alert is accepted, ensure no uncaught exceptions were thrown
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also assert that structural elements remain present after the transition
    await expect(app.container()).toBeVisible();
    await expect(app.header()).toBeVisible();
    await expect(app.footer()).toBeVisible();
  });

  test('Event handling: Multiple clicks produce multiple alerts (idempotency / repeated transition)', async ({ page }) => {
    // Validate multiple rapid interactions still produce alert each time and no errors accumulate.
    const app = new IntegrationApp(page);
    await app.goto();

    // We'll click the button twice and collect both dialog messages.
    const messages = [];
    for (let i = 0; i < 2; i++) {
      // Use the page.waitForEvent('dialog') pattern to reliably capture each alert.
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.testButton().click(),
      ]);
      messages.push(dialog.message());
      await dialog.accept();
    }

    // Expect both alerts to have the expected message
    expect(messages.length).toBe(2);
    messages.forEach((m) => {
      expect(m).toBe('Integration testing has been performed successfully!');
    });

    // Ensure no uncaught exceptions or console errors accumulated after repeated interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking other regions does not trigger the test alert (negative test)', async ({ page }) => {
    // This test ensures that clicks outside the #test-button do not trigger the alert.
    // It asserts the app only transitions on the specific ButtonClick event.
    const app = new IntegrationApp(page);
    await app.goto();

    // Click header and wait briefly to ensure no dialog appears.
    await app.header().click();

    let dialogAppeared = false;
    try {
      // Intentionally short timeout to verify absence of dialog event
      await page.waitForEvent('dialog', { timeout: 1000 });
      dialogAppeared = true;
    } catch (e) {
      // Expected: timeout because no dialog should appear
      dialogAppeared = false;
      // Confirm the error is a Playwright timeout-like error
      expect(e).toBeInstanceOf(Error);
    }

    expect(dialogAppeared).toBe(false);

    // No page errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('DOM robustness: Validate malformed HTML does not crash script (observe runtime errors)', async ({ page }) => {
    // The provided HTML contains a mis-matched closing tag: <div ...>...</button>
    // This test observes whether that malformed markup created runtime JS errors (e.g., TypeError)
    // and asserts on the presence or absence of such errors. We do not modify the page.
    const app = new IntegrationApp(page);
    await app.goto();

    // Capture current console and page errors after load
    // We explicitly allow both possibilities: the browser may correct the markup silently (no errors),
    // or some environments might throw errors. We assert on the nature of any errors if they exist.

    if (pageErrors.length > 0) {
      // If there are uncaught page errors, ensure they are standard JS Errors and log their names/messages
      for (const err of pageErrors) {
        expect(err).toBeInstanceOf(Error);
        // Accept either TypeError, ReferenceError, SyntaxError etc. Do not try to patch the page.
        expect(['TypeError', 'ReferenceError', 'SyntaxError', 'Error']).toContain(err.name || 'Error');
      }
    } else {
      // No uncaught exceptions found on the page; assert that the button is still interactive
      await expect(app.testButton()).toBeVisible();
      const message = await app.clickTestButtonAndGetDialogMessage();
      expect(message).toBe('Integration testing has been performed successfully!');
    }

    // Additionally check console.error entries (if any) for evidence of runtime issues
    if (consoleErrors.length > 0) {
      // Each console error should be a string message; ensure not empty
      for (const errMsg of consoleErrors) {
        expect(typeof errMsg).toBe('string');
        expect(errMsg.length).toBeGreaterThan(0);
      }
    } else {
      // No console errors observed is also acceptable
      expect(consoleErrors.length).toBe(0);
    }
  });
});