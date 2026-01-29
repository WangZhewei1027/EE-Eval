import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a18864-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Merge Sort demo page
class MergeSortDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showDemoButtonSelector = "button[onclick='showDemo()']";
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getShowDemoButton() {
    return this.page.locator(this.showDemoButtonSelector);
  }

  // Click the show demo button and wait for the alert dialog
  async clickShowDemoAndCaptureDialog() {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click(this.showDemoButtonSelector);
    const dialog = await dialogPromise;
    return dialog;
  }
}

test.describe('Understanding Divide and Conquer - FSM Validation (d5a18864...)', () => {
  // Arrays used to capture console messages and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions in the page
    page.on('pageerror', err => {
      // err is an Error object (or sometimes a string) depending on browser
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the app page before each test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }, testInfo) => {
    // If a test failed, attach captured console and page errors to the test output for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      testInfo.attach('consoleErrors', { body: JSON.stringify(consoleErrors, null, 2), contentType: 'application/json' });
      testInfo.attach('pageErrors', { body: JSON.stringify(pageErrors, null, 2), contentType: 'application/json' });
    }
    // remove listeners by closing page (Playwright does this automatically between tests,
    // but we keep this comment to emphasize cleanup intent)
  });

  test('S0_Idle: Initial render shows content and the "Show Demo" button is present', async ({ page }) => {
    // Validate initial state (Idle) as per FSM:
    // - The page renders correctly
    // - The Show Demo button exists and has expected text
    const pod = new MergeSortDemoPage(page);

    // Check page title contains expected text
    await expect(page).toHaveTitle(/Understanding Divide and Conquer/);

    // Button should be visible and have the expected label
    const button = await pod.getShowDemoButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Show Demo of Merge Sort Steps');

    // No page errors should exist right after load for the Idle state (evidence of clean initial render)
    expect(pageErrors.length).toBe(0);

    // No console errors on load
    expect(consoleErrors.length).toBe(0);
  });

  test('S0_Idle -> S1_DemoShown: Clicking the "Show Demo" button triggers the alert (entry action)', async ({ page }) => {
    // This verifies the transition ShowDemo and the onEnter action for S1_DemoShown (alert)
    const pod = new MergeSortDemoPage(page);

    // Wait for the dialog that should be produced by showDemo()
    const dialogPromise = page.waitForEvent('dialog');

    // Perform the event (click)
    await page.click(pod.showDemoButtonSelector);

    // Assert that the dialog appears and contains the exact expected message
    const dialog = await dialogPromise;
    const expectedAlertText = "This feature is a simple interaction simulating the steps of Merge Sort. Review the text above for a detailed understanding of Merge Sort's divide, conquer, and combine steps!";
    expect(dialog.message()).toBe(expectedAlertText);

    // Accept the alert to allow flow to continue
    await dialog.accept();

    // After handling the alert, ensure no unexpected page errors were produced by this action
    expect(pageErrors.length).toBe(0);

    // Also assert there were no console errors produced by clicking the button
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Double-clicking the button produces two alerts sequentially', async ({ page }) => {
    // Validate behavior if user triggers the event twice (two alerts produced one after another)
    const pod = new MergeSortDemoPage(page);

    // First click -> first dialog
    const firstDialogPromise = page.waitForEvent('dialog');
    await page.click(pod.showDemoButtonSelector);
    const firstDialog = await firstDialogPromise;
    expect(firstDialog.message()).toContain('This feature is a simple interaction simulating the steps of Merge Sort');
    await firstDialog.accept();

    // Second click -> second dialog should appear after the first is accepted
    const secondDialogPromise = page.waitForEvent('dialog');
    await page.click(pod.showDemoButtonSelector);
    const secondDialog = await secondDialogPromise;
    expect(secondDialog.message()).toContain('This feature is a simple interaction simulating the steps of Merge Sort');
    await secondDialog.accept();

    // Ensure no page errors appeared during these interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Error scenario: Invoking missing entry action renderPage() causes a ReferenceError observed in page errors', async ({ page }) => {
    // FSM had an entry action renderPage() for S0_Idle but the HTML does not define it.
    // We intentionally call renderPage() in the page context to observe the natural ReferenceError.
    // This test does not patch or define renderPage(); it simply triggers the error to verify it occurs and is captured.

    // Ensure pageErrors is empty before we intentionally trigger the error
    expect(pageErrors.length).toBe(0);

    // Attempt to call the missing function. page.evaluate will reject; we assert that it throws.
    let failed = false;
    try {
      // This will throw in the browser context because renderPage is not defined
      await page.evaluate(() => {
        // Intentionally call undefined function to trigger ReferenceError naturally
        // Do not define or patch anything in the page; let the runtime produce the error.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      failed = true;
      // The thrown error should indicate that renderPage is not defined or similar ReferenceError
      const errMsg = String(err && (err.message || err));
      expect(errMsg).toMatch(/renderPage|not defined|ReferenceError/i);
    }

    expect(failed).toBe(true);

    // The pageerror listener should have captured a corresponding error event (depending on environment)
    // We allow either 1 or more entries but assert that at least one captured message references renderPage
    const capturedRelevant = pageErrors.some(m => /renderPage|not defined|ReferenceError/i.test(m));
    expect(capturedRelevant).toBe(true);
  });

  test('Robustness check: Ensure clicking nonexistent selector throws a meaningful Playwright error (edge case)', async ({ page }) => {
    // Edge case: attempting to click a selector that does not exist should reject with a helpful error.
    // This validates the app/test harness behavior under invalid interactions.

    // Use an unlikely selector
    const badSelector = 'button[onclick="nonExistentHandler()"]';
    let threw = false;
    try {
      await page.click(badSelector, { timeout: 1000 });
    } catch (err) {
      threw = true;
      const msg = String(err && (err.message || err));
      // The thrown error should indicate the element wasn't found or clickable
      expect(msg).toMatch(/No node found|waiting for selector|Timeout|Cannot click/i);
    }
    expect(threw).toBe(true);
  });

  test('Observability: captured console and page errors summary remains stable after normal interactions', async ({ page }) => {
    // Perform normal interaction and then assert that there's no unexpected accumulation of errors.
    const pod = new MergeSortDemoPage(page);

    // Click the show demo button once and accept the dialog
    const dialogPromise = page.waitForEvent('dialog');
    await page.click(pod.showDemoButtonSelector);
    const dialog = await dialogPromise;
    await dialog.accept();

    // After normal usage, there should be no console errors and no page errors (aside from any intentionally triggered ones in other tests)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});