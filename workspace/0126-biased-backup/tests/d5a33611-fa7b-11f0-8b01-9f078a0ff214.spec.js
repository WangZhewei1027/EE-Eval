import { test, expect } from '@playwright/test';

// Page Object Model for the Linear Regression demo page
class LinearRegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a33611-fa7b-11f0-8b01-9f078a0ff214.html';
    this.buttonSelector = '.button';
    this.specificButtonSelector = ".button[onclick='showDemo()']";
    this.expectedAlertMessage = "This is a simple demonstration of how a linear regression model can predict sales based on advertising expenditure. Adjust the values accordingly to see how predictions change!";
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(this.url);
  }

  // Return the button element handle
  async getButton() {
    return await this.page.$(this.buttonSelector);
  }

  // Return the button that matches the FSM trigger selector
  async getSpecificButton() {
    return await this.page.$(this.specificButtonSelector);
  }

  // Click the show demo button using the specific FSM selector
  async clickShowDemoSpecific() {
    await this.page.click(this.specificButtonSelector);
  }

  // Click the show demo button using the generic selector
  async clickShowDemo() {
    await this.page.click(this.buttonSelector);
  }

  // Check if global function exists on window
  async isFunctionDefinedOnWindow(functionName) {
    return await this.page.evaluate((fn) => typeof window[fn] === 'function', functionName);
  }

  // Get attribute of the button element
  async getButtonAttribute(attr) {
    const button = await this.getSpecificButton();
    if (!button) return null;
    return await button.getAttribute(attr);
  }

  // Get page title text
  async getTitleText() {
    const el = await this.page.$('h1');
    if (!el) return '';
    return (await el.innerText()).trim();
  }
}

// Helper to collect console messages and page errors during a test run
function setupLoggingListeners(page) {
  const logs = [];
  const errors = [];

  const consoleListener = (msg) => {
    logs.push({ type: msg.type(), text: msg.text() });
  };

  const pageErrorListener = (err) => {
    // err is an Error object from the page execution context
    errors.push(err);
  };

  page.on('console', consoleListener);
  page.on('pageerror', pageErrorListener);

  return {
    logs,
    errors,
    dispose: () => {
      page.removeListener('console', consoleListener);
      page.removeListener('pageerror', pageErrorListener);
    },
  };
}

/**
 * Tests for the "Understanding Linear Regression" interactive page.
 *
 * The FSM describes two states:
 *  - S0_Idle (entry action: renderPage())
 *  - S1_DemoShown (entry action: alert(...))
 *
 * The tests validate:
 *  - Initial Idle state (DOM rendered, button present)
 *  - Transition on clicking the button: alert dialog appears with expected text
 *  - That the implementation exposes showDemo() and that renderPage() is NOT present
 *    (demonstrating the mismatch between FSM entry_actions and actual HTML/JS)
 *  - Edge cases: multiple clicks trigger multiple alerts; no unexpected runtime errors
 */

test.describe('Linear Regression FSM - Idle State and Page Rendering', () => {
  test('Idle state: page renders and contains the Show Linear Regression Example button', async ({ page }) => {
    // Setup logging collectors to observe console and page errors
    const logger = setupLoggingListeners(page);

    const lrPage = new LinearRegressionPage(page);
    await lrPage.goto();

    // Basic DOM checks to validate the Idle state (S0_Idle)
    const titleText = await lrPage.getTitleText();
    expect(titleText).toBe('Understanding Linear Regression');

    // Button should exist (evidence of S0_Idle)
    const button = await lrPage.getButton();
    expect(button).not.toBeNull();

    // The FSM expects a button with onclick="showDemo()"
    const specificButton = await lrPage.getSpecificButton();
    expect(specificButton).not.toBeNull();

    // Verify the button text content
    const text = (await specificButton.innerText()).trim();
    expect(text).toBe('Show Linear Regression Example');

    // Verify that the onclick attribute matches the FSM evidence
    const onclickAttr = await lrPage.getButtonAttribute('onclick');
    expect(onclickAttr).toBe('showDemo()');

    // Verify that the global function showDemo exists on window (implementation detail)
    const hasShowDemo = await lrPage.isFunctionDefinedOnWindow('showDemo');
    expect(hasShowDemo).toBe(true);

    // FSM indicates an entry action renderPage() for S0_Idle, but the actual HTML/JS does not define it.
    // Assert that renderPage is not defined to capture mismatch (edge case test)
    const hasRenderPage = await lrPage.isFunctionDefinedOnWindow('renderPage');
    expect(hasRenderPage).toBe(false);

    // Ensure no page errors (ReferenceError, TypeError, etc.) occurred during load
    // If such errors occur naturally, they will be captured in logger.errors and the assertion will fail.
    expect(logger.errors.length).toBe(0);

    // Ensure there are no console messages of type 'error'
    const consoleErrors = logger.logs.filter((l) => l.type === 'error');
    expect(consoleErrors.length).toBe(0);

    logger.dispose();
  });
});

test.describe('Linear Regression FSM - ShowDemo Transition and DemoShown State', () => {
  test('Transition ShowDemo: clicking the button triggers an alert with the expected message', async ({ page }) => {
    // Collect logs and page errors to observe runtime behavior
    const logger = setupLoggingListeners(page);

    const lrPage = new LinearRegressionPage(page);
    await lrPage.goto();

    // Listen for the dialog that should be shown as part of S1_DemoShown entry action
    const expectedMessage = lrPage.expectedAlertMessage;

    // Prepare a promise that resolves when the dialog appears
    const dialogPromise = page.waitForEvent('dialog');

    // Trigger the FSM event using the trigger selector (as specified in FSM)
    await lrPage.clickShowDemoSpecific();

    // Wait for the dialog and validate its text and type
    const dialog = await dialogPromise;
    expect(dialog).not.toBeNull();
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe(expectedMessage);

    // Dismiss the alert (OK)
    await dialog.accept();

    // Ensure no page errors occurred as a result of clicking and showing the alert
    expect(logger.errors.length).toBe(0);

    // Ensure no console error messages were emitted
    const consoleErrors = logger.logs.filter((l) => l.type === 'error');
    expect(consoleErrors.length).toBe(0);

    logger.dispose();
  });

  test('Edge case: multiple clicks produce multiple alerts and do not introduce runtime errors', async ({ page }) => {
    const logger = setupLoggingListeners(page);

    const lrPage = new LinearRegressionPage(page);
    await lrPage.goto();

    // We'll click the button three times, each should produce an alert.
    const clicks = 3;
    const dialogs = [];

    // Start waiting for dialogs in sequence; use a short helper to wait for and accept each dialog
    for (let i = 0; i < clicks; i++) {
      const dialogPromise = page.waitForEvent('dialog');
      await lrPage.clickShowDemo();
      const dialog = await dialogPromise;
      dialogs.push(dialog);
      // Validate content for each dialog
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe(lrPage.expectedAlertMessage);
      await dialog.accept();
    }

    // Ensure we received the expected number of dialogs
    expect(dialogs.length).toBe(clicks);

    // Ensure no page errors were emitted during repeated interactions
    expect(logger.errors.length).toBe(0);

    // Ensure no console 'error' messages
    const consoleErrors = logger.logs.filter((l) => l.type === 'error');
    expect(consoleErrors.length).toBe(0);

    logger.dispose();
  });

  test('Implementation check: showDemo() exists and is the function referenced by the button onclick', async ({ page }) => {
    const logger = setupLoggingListeners(page);

    const lrPage = new LinearRegressionPage(page);
    await lrPage.goto();

    // Validate showDemo exists on window
    const hasShowDemo = await lrPage.isFunctionDefinedOnWindow('showDemo');
    expect(hasShowDemo).toBe(true);

    // Validate that the function is invoked by the onclick attribute; we already checked attribute,
    // but also ensure invoking it (via clicking) results in the expected alert which confirms runtime linkage.
    const dialogPromise = page.waitForEvent('dialog');
    await lrPage.clickShowDemoSpecific();
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe(lrPage.expectedAlertMessage);
    await dialog.accept();

    // No runtime errors should have been thrown
    expect(logger.errors.length).toBe(0);

    logger.dispose();
  });
});

test.describe('FSM Consistency and Error Observability', () => {
  test('FSM-specified entry action renderPage() is not present - observe and assert mismatch', async ({ page }) => {
    // This test explicitly verifies an FSM vs implementation mismatch: renderPage() is listed as an
    // entry action for the Idle state (S0_Idle) but the page does not define it. We assert that it is absent.
    const logger = setupLoggingListeners(page);

    const lrPage = new LinearRegressionPage(page);
    await lrPage.goto();

    // Confirm renderPage is not defined; this is an edge case that the test must detect
    const hasRenderPage = await lrPage.isFunctionDefinedOnWindow('renderPage');
    // We expect false because the HTML provided does not declare renderPage()
    expect(hasRenderPage).toBe(false);

    // Also assert that the page did not throw a ReferenceError on load (i.e., it didn't try to call renderPage)
    // If the page attempted to call renderPage() and it wasn't defined, we would see a pageerror.
    // Here we assert that no pageerror occurred.
    expect(logger.errors.length).toBe(0);

    logger.dispose();
  });

  test('Observe console and page errors on load and interactions (if any) and report them', async ({ page }) => {
    // This test collects any console or runtime errors; if any occur naturally in the environment,
    // the test will fail based on explicit expectations below. We do not inject or patch anything.
    const logger = setupLoggingListeners(page);

    const lrPage = new LinearRegressionPage(page);
    await lrPage.goto();

    // No interactions; just ensure clean load
    expect(logger.logs.length).toBeGreaterThanOrEqual(0); // ensure logs array exists

    // Assert that there are no uncaught page errors on load
    // If the environment naturally throws errors, this assertion will fail and reveal those issues.
    expect(logger.errors.length).toBe(0);

    // If there are console messages, dump them into the test output via expectation messages
    // (We don't fail on console.info or console.debug). Only assert there are no console 'error' types.
    const consoleErrorMessages = logger.logs.filter((l) => l.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);

    logger.dispose();
  });
});