import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2c0e1-fa7b-11f0-8b-01-9f078a0ff214.html';

// Page Object for the Socket Programming Explained page
class SocketPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick]';
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Return the button element handle
  async getShowDemoButton() {
    return await this.page.$(this.buttonSelector);
  }

  // Click the "Show Demonstration" button and handle the alert via a provided callback
  async clickShowDemonstration() {
    await this.page.click(this.buttonSelector);
  }

  // Read the onclick attribute from the button -- verifies evidence in FSM
  async getButtonOnclickAttribute() {
    const button = await this.getShowDemoButton();
    if (!button) return null;
    return await button.getAttribute('onclick');
  }

  // Call a global function by name in the page context; used to test missing entry action renderPage()
  // This intentionally does a direct evaluate to let ReferenceError occur naturally in the page context.
  async callGlobalFunction(fnName) {
    return await this.page.evaluate((name) => {
      // Intentionally call the function by name to allow natural ReferenceError if it doesn't exist.
      // This will throw in the page context and be propagated back to the test.
      return window[name]();
    }, fnName);
  }
}

test.describe('Socket Programming Explained - FSM end-to-end tests', () => {
  // Collect page errors and console messages for assertions
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally here; Playwright will close pages automatically.
    // Arrays are reset in beforeEach for next test.
  });

  test('Initial Load - Idle State (S0_Idle): DOM structure, heading and button presence', async ({ page }) => {
    // Validate the initial render of the page corresponds to the Idle state (S0_Idle)
    const socketPage = new SocketPage(page);
    await socketPage.goto();

    // Verify basic page metadata and structure: title and main heading
    await expect(page).toHaveTitle(/Socket Programming Explained/i);
    const mainHeading = await page.locator('h1', { hasText: 'Socket Programming Explained' });
    await expect(mainHeading).toHaveCount(1);

    // Verify explanatory text sections exist
    await expect(page.locator('h2', { hasText: 'A Simple Demonstration' })).toHaveCount(1);

    // The "Show Demonstration" button must exist and be visible
    const button = await socketPage.getShowDemoButton();
    expect(button, 'Show Demonstration button should exist in the DOM').toBeTruthy();
    const btnText = await button.innerText();
    expect(btnText.trim()).toBe('Show Demonstration');

    // Verify the onclick attribute exists and contains the expected alert message (evidence)
    const onclickAttr = await socketPage.getButtonOnclickAttribute();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('This would typically show you how a server and client communicate");

    // Ensure that no unexpected page errors were emitted during initial load
    expect(pageErrors.length, 'No page errors should occur on initial load').toBe(0);
  });

  test('Verify entry action renderPage is not present and invoking it produces ReferenceError as expected', async ({ page }) => {
    // This test checks the FSM's declared entry action renderPage():
    // The HTML does not define renderPage(), so calling it should naturally throw a ReferenceError.
    const socketPage = new SocketPage(page);
    await socketPage.goto();

    // Ensure no page errors before we intentionally invoke the missing function
    expect(pageErrors.length, 'No page errors before calling renderPage').toBe(0);

    // Call the missing global function renderPage() and assert that a ReferenceError is thrown.
    let caughtError = null;
    try {
      await socketPage.callGlobalFunction('renderPage');
    } catch (err) {
      caughtError = err;
    }

    // We expect an error to have been thrown. Playwright's evaluate will reject with an error.
    expect(caughtError, 'Calling renderPage() should throw an error because it is not defined').toBeTruthy();

    // The error message should indicate that renderPage is not defined (ReferenceError)
    // Different engines might format messages slightly differently, so check for the substring.
    const message = String(caughtError.message || caughtError);
    expect(message).toMatch(/renderPage is not defined|renderPage is not a function|renderPage is not defined/i);

    // Also check that a pageerror may have been emitted (uncaught in page context). It's acceptable whether it appears or not,
    // but if it did, it should be a ReferenceError referencing renderPage.
    if (pageErrors.length > 0) {
      const hasRenderPageReferenceError = pageErrors.some(e =>
        /renderPage/i.test(e.message) || /ReferenceError/i.test(e.name)
      );
      expect(hasRenderPageReferenceError, 'If a pageerror was emitted it should reference renderPage or be a ReferenceError').toBeTruthy();
    }
  });

  test('Show Demonstration event (ShowDemonstration): clicking button displays alert and transitions to Demonstration Shown (S1)', async ({ page }) => {
    // This test validates the event and transition: clicking the button triggers an alert with the expected message.
    const socketPage = new SocketPage(page);
    await socketPage.goto();

    // Prepare to capture the alert/dialog
    const alerts = [];
    page.on('dialog', async (dialog) => {
      alerts.push({
        type: dialog.type(),
        message: dialog.message(),
      });
      // Accept the alert so it does not block further actions
      await dialog.accept();
    });

    // Ensure no page errors prior to clicking
    expect(pageErrors.length, 'No page errors prior to clicking Show Demonstration').toBe(0);

    // Click the button that should trigger the alert
    await socketPage.clickShowDemonstration();

    // Await microtask to ensure dialog handler processed
    await page.waitForTimeout(50);

    // There should be exactly one alert with the expected message (evidence from FSM)
    expect(alerts.length, 'One alert should have been shown after clicking the button').toBe(1);
    const expectedTextStart = "This would typically show you how a server and client communicate";
    expect(alerts[0].message).toContain(expectedTextStart);
    expect(alerts[0].type).toBe('alert');

    // After the alert, ensure no unexpected page errors were emitted as a result of the click
    expect(pageErrors.length, 'No page errors should occur after clicking Show Demonstration').toBe(0);

    // The FSM transition from S0_Idle to S1_DemonstrationShown is evidenced by the alert - we validated it above.
    // We cannot introspect FSM internals; verifying the alert suffices per FSM definition.
  });

  test('Edge case: Multiple rapid clicks produce repeated alerts (repeatability of ShowDemonstration event)', async ({ page }) => {
    // Validate that multiple clicks will trigger repeated alerts as expected (stateless button behavior)
    const socketPage = new SocketPage(page);
    await socketPage.goto();

    const capturedAlerts = [];
    page.on('dialog', async (dialog) => {
      capturedAlerts.push({
        type: dialog.type(),
        message: dialog.message(),
      });
      await dialog.accept();
    });

    // Click the button twice in quick succession
    await socketPage.clickShowDemonstration();
    // Small delay to allow alert handling
    await page.waitForTimeout(20);
    await socketPage.clickShowDemonstration();
    await page.waitForTimeout(50);

    // Expect two alerts captured
    expect(capturedAlerts.length, 'Two alerts should be raised for two clicks').toBe(2);
    expect(capturedAlerts[0].message).toEqual(capturedAlerts[1].message);
    expect(capturedAlerts[0].message).toContain('This would typically show you how a server and client communicate');

    // Ensure no page errors occurred as a result of repeated clicking
    expect(pageErrors.length, 'No page errors should occur after multiple clicks').toBe(0);
  });

  test('Edge case: Attempt to click a non-existent selector should throw an element handle error', async ({ page }) => {
    // Test robustness when interacting with missing elements - Playwright should throw an error we can assert.
    const socketPage = new SocketPage(page);
    await socketPage.goto();

    let clickError = null;
    try {
      // Intentionally click a selector that doesn't exist
      await page.click('button[data-nonexistent]', { timeout: 2000 });
    } catch (err) {
      clickError = err;
    }

    expect(clickError, 'Clicking a non-existent selector should throw an error').toBeTruthy();
    // The error message should indicate that the element was not found or click failed
    expect(String(clickError.message)).toMatch(/(No node was found|waiting for selector|element|Timeout)/i);

    // No additional page errors from the page context expected
    expect(pageErrors.length, 'No page errors should be emitted when clicking a non-existent selector').toBe(0);
  });

  test('Console and pageerror observation: load and interactions should not produce unexpected console errors', async ({ page }) => {
    // This test aggregates console messages and page errors across common interactions to ensure nothing unexpected appears.
    const socketPage = new SocketPage(page);
    await socketPage.goto();

    // Clear previous captures just for this test's clarity
    pageErrors = [];
    consoleMessages = [];

    // Perform a normal click to produce the alert and some console activity (if any)
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });

    await socketPage.clickShowDemonstration();
    await page.waitForTimeout(50);

    // There should be exactly one dialog message as earlier validated
    expect(dialogs.length).toBe(1);

    // Now assert that no uncaught page errors (TypeError, ReferenceError, SyntaxError) have occurred during standard usage.
    // If any such errors were emitted they will be captured in pageErrors.
    const severeErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError|Error/i.test(e.name) || /ReferenceError|TypeError|SyntaxError/i.test(e.message)
    );

    // We allow the possibility that renderPage was called elsewhere only if previously invoked in another test;
    // however for this test we expect no severe page errors.
    expect(severeErrors.length, 'No severe page errors should be emitted during normal interactions').toBe(0);

    // Optionally assert that console messages (logs or info) are not showing 'Uncaught' or 'error' messages.
    const consoleErrors = consoleMessages.filter(m =>
      /error|exception|uncaught/i.test(m.text)
    );
    expect(consoleErrors.length, 'No console messages indicating errors during interactions').toBe(0);
  });
});