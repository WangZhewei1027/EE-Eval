import { test, expect } from '@playwright/test';

// Test file: d5a13a42-fa7b-11f0-8b01-9f078a0ff214.spec.js
// Tests for the "Interpolation Search Explained" interactive page.
// Verifies FSM states/transitions described in the specification and observes console/page errors.

// Page object for the Interpolation Search demo page
class InterpolationSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a13a42-fa7b-11f0-8b01-9f078a0ff214.html';
    this.selectors = {
      title: 'h1',
      demoSection: '#demo-section',
      showButton: 'button[onclick="alert(\'Demonstration feature is under development!\')"]'
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async titleText() {
    return this.page.textContent(this.selectors.title);
  }

  showButtonLocator() {
    return this.page.locator(this.selectors.showButton);
  }

  async clickShowButtonAndHandleDialog() {
    // Setup a single-use dialog handler to capture the alert message and accept it.
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.showButtonLocator().click();
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Interpolation Search FSM and UI - d5a13a42-fa7b-11f0-8b01-9f078a0ff214', () => {
  // Shared variables for each test
  let pageErrors = [];
  let consoleMessages = [];

  // Setup a fresh page for each test and collect console/page errors for observation
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page context
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack
      });
    });

    page.on('console', (msg) => {
      // Collect console messages and their severity/type
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async ({ }, testInfo) => {
    // If a test failed, attach collected console and page error information to the test report.
    if (testInfo.status !== testInfo.expectedStatus) {
      // This will not modify the application; it's for debugging test failures.
      testInfo.attach('console-messages', { body: JSON.stringify(consoleMessages, null, 2), contentType: 'application/json' });
      testInfo.attach('page-errors', { body: JSON.stringify(pageErrors, null, 2), contentType: 'application/json' });
    }
  });

  test('S0_Idle: Page loads and Idle evidence is rendered (button present)', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle) per the FSM:
    // - The page should load.
    // - The "Show Demonstration" button should be present with the exact inline onclick attribute and text.
    const ui = new InterpolationSearchPage(page);
    await ui.goto();

    // Basic sanity checks for page content
    await expect(page).toHaveTitle(/Interpolation Search Explained/);
    await expect(page.locator('h1')).toHaveText('Understanding Interpolation Search');

    // Verify demo section and button exist
    const demoSection = page.locator(ui.selectors.demoSection);
    await expect(demoSection).toBeVisible();

    const showButton = ui.showButtonLocator();
    await expect(showButton).toHaveCount(1);
    await expect(showButton).toBeVisible();
    await expect(showButton).toHaveText('Show Demonstration');

    // Verify the exact onclick attribute is present (evidence in the FSM)
    const onclickValue = await page.locator(ui.selectors.showButton).getAttribute('onclick');
    expect(onclickValue).toBe("alert('Demonstration feature is under development!')");

    // Observe any runtime errors or console messages that occurred during initial render.
    // The FSM mentions an entry action `renderPage()` for S0_Idle. The HTML file does not define renderPage(),
    // but we MUST NOT patch or inject it. Instead we observe if any ReferenceError or other page error occurred naturally.
    // Assert there are no uncaught page errors on load.
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ShowDemonstration: clicking the button triggers an alert dialog (S1_DemonstrationAlert)', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_DemonstrationAlert:
    // - Clicking the button should produce an alert with the expected text (the FSM expected observable).
    const ui = new InterpolationSearchPage(page);
    await ui.goto();

    // Setup: ensure no previous page errors
    expect(pageErrors.length).toBe(0);

    // Click the button and capture the dialog message
    const dialogMessage = await ui.clickShowButtonAndHandleDialog();

    // Verify dialog content matches the FSM evidence
    expect(dialogMessage).toBe('Demonstration feature is under development!');

    // After dismissing the alert, ensure no new uncaught page errors were introduced
    expect(pageErrors.length).toBe(0);

    // The DOM should remain stable after the alert: demo section and button still present.
    await expect(page.locator(ui.selectors.demoSection)).toBeVisible();
    await expect(ui.showButtonLocator()).toBeVisible();
  });

  test('S1_DemonstrationAlert: Repeated interactions (edge case) - multiple alerts handled sequentially without errors', async ({ page }) => {
    // Edge case test: clicking the button multiple times in quick succession should show sequential alerts.
    // We ensure both alerts appear with correct content and that no uncaught errors occur.
    const ui = new InterpolationSearchPage(page);
    await ui.goto();

    // Prepare to capture dialogs; we'll count how many are seen.
    const observedDialogs = [];
    page.on('dialog', async (dialog) => {
      observedDialogs.push(dialog.message());
      await dialog.accept();
    });

    // Click the button twice quickly
    await ui.showButtonLocator().click();
    await ui.showButtonLocator().click();

    // Wait a short time to allow both dialogs to be processed
    await page.waitForTimeout(250);

    // We expect two dialogs with the same message
    expect(observedDialogs.length).toBe(2);
    for (const msg of observedDialogs) {
      expect(msg).toBe('Demonstration feature is under development!');
    }

    // Ensure no uncaught page errors occurred during rapid interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: console and page errors are collected and do not contain unexpected exceptions', async ({ page }) => {
    // This test explicitly demonstrates collection of console messages and page errors.
    // It asserts that no ReferenceError/SyntaxError/TypeError occurred during normal usage.
    const ui = new InterpolationSearchPage(page);
    await ui.goto();

    // Interact with the page to potentially surface any errors
    const dialogMessage = await ui.clickShowButtonAndHandleDialog();
    expect(dialogMessage).toBe('Demonstration feature is under development!');

    // After interactions, inspect collected errors and console messages.
    // We expect the page to be free of uncaught JS exceptions in this application.
    // If there are errors, they will be attached to the test report via afterEach for debugging.
    expect(pageErrors.length).toBe(0);

    // Ensure console messages don't include 'error' type entries.
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Negative scenario: clicking a non-existent selector should throw a handled Playwright error (no page crash)', async ({ page }) => {
    // This test ensures that attempts to interact with non-existent elements are handled at the test layer
    // and do not cause the application to crash or generate unexpected page errors.
    const ui = new InterpolationSearchPage(page);
    await ui.goto();

    // Try to click a selector that does not exist in the DOM.
    const missingLocator = page.locator('button#non-existent-demo-button');

    let threw = false;
    try {
      // Use a short timeout to force a quick failure rather than waiting on default timeout.
      await missingLocator.click({ timeout: 500 });
    } catch (err) {
      threw = true;
      // The thrown error should be a Playwright error indicating the element was not found/clickable.
      expect(err).toBeDefined();
      // Do not assert on exact error message to avoid brittleness across Playwright versions.
    }

    expect(threw).toBe(true);

    // Ensure the page itself has no uncaught runtime errors after this handled failure.
    expect(pageErrors.length).toBe(0);
  });
});