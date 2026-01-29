import { test, expect } from '@playwright/test';

// Test suite for the Overfitting interactive application (Application ID: f5b45411-fa7c-11f0-adc7-178f556b1ee0)
// The application is served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/f5b45411-fa7c-11f0-adc7-178f556b1ee0.html
//
// Notes:
// - The page's script creates a dataset and then attempts to instantiate `new Model(dataset)`
//   but `Model` is not defined in the provided HTML. According to the instructions, the tests
//   must not modify the page or its environment and must observe errors naturally.
// - Tests assert both normal UI state ("Idle") and the transition triggered by clicking the
//   "View Demo" button which leads to a runtime ReferenceError. Tests also validate that
//   DOM remains unchanged after the error and that the error occurs consistently across clicks.

// Page Object for the Overfitting page
class OverfittingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b45411-fa7c-11f0-adc7-178f556b1ee0.html';
    this.selectors = {
      demoButton: '#overfitting-demo',
      demoDiv: '#demo',
      title: 'title',
      heading: 'h1'
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async getTitle() {
    return this.page.title();
  }

  async getHeadingText() {
    return this.page.locator(this.selectors.heading).innerText();
  }

  async demoButtonVisible() {
    return this.page.locator(this.selectors.demoButton).isVisible();
  }

  async demoButtonEnabled() {
    return this.page.locator(this.selectors.demoButton).isEnabled();
  }

  async clickDemo() {
    await this.page.click(this.selectors.demoButton);
  }

  async getDemoDivContent() {
    return this.page.locator(this.selectors.demoDiv).innerHTML();
  }
}

test.describe('Overfitting demo - FSM states and transitions', () => {
  // Shared variables for each test
  let pageEvents = null;
  let consoleMessages = null;

  // Setup listeners in beforeEach and navigate to the page
  test.beforeEach(async ({ page }) => {
    pageEvents = {
      pageErrors: [],
    };
    consoleMessages = [];

    // Capture pageerrors (uncaught exceptions thrown in the page context)
    page.on('pageerror', (err) => {
      // Push the actual Error object for assertions
      pageEvents.pageErrors.push(err);
    });

    // Capture console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test interference
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');

    // Reset arrays
    pageEvents = null;
    consoleMessages = null;
  });

  test('S0_Idle state: page loads and displays the "View Demo" button and content', async ({ page }) => {
    // Validate initial Idle state on page load (renderPage())
    const app = new OverfittingPage(page);
    await app.goto();

    // Check page title and heading to ensure the page rendered
    await expect(app.getTitle()).resolves.toContain('Overfitting');
    await expect(app.getHeadingText()).resolves.toBe('Overfitting');

    // Validate the "View Demo" button exists, is visible, and enabled (evidence of Idle state)
    expect(await app.demoButtonVisible()).toBeTruthy();
    expect(await app.demoButtonEnabled()).toBeTruthy();

    // The demo div should be empty initially
    const demoContent = await app.getDemoDivContent();
    expect(demoContent).toBe('');

    // No uncaught page errors should have occurred during initial render
    expect(pageEvents.pageErrors.length).toBe(0);

    // No console logs expected on initial render for this implementation
    // (there may be harmless informational console messages depending on environment,
    // but we assert there are no errors)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoViewed: clicking "View Demo" triggers dataset creation and runtime error due to missing Model (ReferenceError)', async ({ page }) => {
    // This test verifies the transition triggered by the View Demo click event.
    // According to the provided HTML, the click handler will:
    // - create a dataset
    // - attempt to instantiate "new Model(dataset)" -> Model is not defined -> ReferenceError
    // We must allow the ReferenceError to happen and assert it is observed as a pageerror.
    const app = new OverfittingPage(page);
    await app.goto();

    // Ensure no errors prior to clicking
    expect(pageEvents.pageErrors.length).toBe(0);

    // Prepare to wait for an uncaught exception triggered by the click handler.
    const [err] = await Promise.all([
      // Wait for the pageerror that should be thrown due to undefined Model
      page.waitForEvent('pageerror'),
      // Trigger the click that attempts to construct Model and train/predict
      page.click('#overfitting-demo')
    ]);

    // Assert that a ReferenceError occurred and mentions "Model"
    expect(err).toBeDefined();
    // err is an Error object; check its name and message
    expect(err.name).toBe('ReferenceError');
    expect(err.message).toMatch(/Model/); // message should reference the undefined identifier Model

    // The demo div should remain unchanged (the script does not modify the DOM before failing)
    const demoContentAfter = await app.getDemoDivContent();
    expect(demoContentAfter).toBe('');

    // Inspect captured console messages: there should be an error-level message related to the uncaught exception
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error' || m.type === 'debug' || m.type === 'warning');
    // There should be at least one console error message or the pageerror captured above
    expect(pageEvents.pageErrors.length).toBeGreaterThanOrEqual(1);

    // There should be no successful predictions logged (console.log(predictions) won't be reached due to the error)
    const logMessages = consoleMessages.filter(m => m.type === 'log').map(m => m.text);
    // If any log message contains 'predictions' or '[' (as predictions might be an array), the test should fail.
    const hasPredictionLog = logMessages.some(text => /predictions|^\[|\{/.test(text));
    expect(hasPredictionLog).toBeFalsy();
  });

  test('Edge case: clicking multiple times consistently produces the same ReferenceError and does not modify DOM', async ({ page }) => {
    // This test clicks the button multiple times in quick succession to ensure the same uncaught error occurs
    const app = new OverfittingPage(page);
    await app.goto();

    // Helper to perform a click and capture the pageerror event
    const clickAndCaptureError = async () => {
      return Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#overfitting-demo')
      ]);
    };

    // First click produces error
    const [err1] = await clickAndCaptureError();
    expect(err1).toBeDefined();
    expect(err1.name).toBe('ReferenceError');
    expect(err1.message).toMatch(/Model/);

    // Second click should also produce error (fresh event)
    const [err2] = await clickAndCaptureError();
    expect(err2).toBeDefined();
    expect(err2.name).toBe('ReferenceError');
    expect(err2.message).toMatch(/Model/);

    // The demo div remains unchanged after repeated attempts
    const demoContent = await app.getDemoDivContent();
    expect(demoContent).toBe('');

    // Confirm we captured multiple page errors
    // Note: pageEvents.pageErrors will accumulate errors if the listener is active
    expect(pageEvents.pageErrors.length).toBeGreaterThanOrEqual(2);
  });

  test('Error scenario validation: assert that the runtime error prevents entry actions from completing (no model training/prediction logs)', async ({ page }) => {
    // The FSM's S1_DemoViewed entry actions are: createDataset(), trainModel(), makePredictions()
    // Because Model is undefined, trainModel() and makePredictions() cannot complete.
    // We verify that no evidence of completed training/predictions exists in console logs or DOM.
    const app = new OverfittingPage(page);
    await app.goto();

    // Click and wait for the runtime ReferenceError
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#overfitting-demo')
    ]);

    // Confirm the ReferenceError
    expect(err).toBeDefined();
    expect(err.name).toBe('ReferenceError');

    // Check console messages for any indication that training or predictions completed.
    // The provided script would console.log(predictions) on success; since an error occurs,
    // we assert there is no log message that looks like an array of predictions or mentions 'trained'/'predictions'.
    const logs = consoleMessages.filter(m => m.type === 'log').map(m => m.text.toLowerCase());
    const suspicious = logs.filter(t => t.includes('prediction') || t.includes('trained') || /\[.*\]/.test(t));
    expect(suspicious.length).toBe(0);

    // The demo div should remain empty (no UI update performed before the error)
    const demoHtml = await app.getDemoDivContent();
    expect(demoHtml).toBe('');
  });
});