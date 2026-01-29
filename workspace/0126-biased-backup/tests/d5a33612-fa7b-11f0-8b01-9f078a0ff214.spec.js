import { test, expect } from '@playwright/test';

// Test suite for Application ID: d5a33612-fa7b-11f0-8b01-9f078a0ff214
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/d5a33612-fa7b-11f0-8b01-9f078a0ff214.html
//
// This file validates the FSM states/transitions for the interactive demonstration
// - S0_Idle: initial state where the demonstration is hidden
// - S1_DemonstrationVisible: visible demo after clicking the toggle button
//
// The tests:
// - Verify DOM elements and visual feedback
// - Exercise the ShowDemonstration event (button click) to transition between states
// - Validate entry/exit actions exist or are absent as expected (renderPage vs showDemonstration)
// - Observe console messages and page errors and assert there are no runtime errors (ReferenceError/SyntaxError/TypeError)
// - Include edge-case toggling and rapid interactions
//
// NOTE: Tests will load the page exactly as-is and will not modify or patch the page environment.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a33612-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the simple application
class LogisticRegressionApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemonstration()']");
    this.demo = page.locator('#demonstration');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial load settled
    await this.page.waitForLoadState('load');
  }

  async getButtonText() {
    return await this.button.innerText();
  }

  async getButtonOnClickAttr() {
    return await this.button.getAttribute('onclick');
  }

  async isDemoVisible() {
    // Use computed style for robust visibility check
    return await this.page.evaluate(() => {
      const el = document.getElementById('demonstration');
      if (!el) return false;
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getDemoInlineStyle() {
    return await this.demo.getAttribute('style');
  }

  async getDemoText() {
    return await this.demo.innerText();
  }

  async clickToggle() {
    await this.button.click();
  }

  async isShowDemonstrationDefined() {
    return await this.page.evaluate(() => typeof window.showDemonstration === 'function');
  }

  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  // Helper to get computed display value
  async getDemoComputedDisplay() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('demonstration');
      if (!el) return null;
      return window.getComputedStyle(el).display;
    });
  }
}

test.describe('Understanding Logistic Regression - FSM & UI Tests (d5a33612-...)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleErrors = [];
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and errors
    page.on('console', msg => {
      const type = msg.type(); // e.g., 'log', 'error'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push({ text });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', err => {
      // err is Error object
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the app
    await page.goto(APP_URL);
    await page.waitForLoadState('load');
  });

  test.afterEach(async () => {
    // Basic sanity: no runtime page errors were produced during the test session
    // We assert no ReferenceError, SyntaxError, or TypeError occurred.
    // If any such errors were present they will cause the test to fail here and we attach details.
    const runtimeErrorNames = pageErrors.map(e => e.name);
    for (const err of pageErrors) {
      // Provide actionable test failure details if an error exists
      console.error('Page error captured:', err.name, err.message);
    }
    expect(runtimeErrorNames).not.toContain('ReferenceError');
    expect(runtimeErrorNames).not.toContain('SyntaxError');
    expect(runtimeErrorNames).not.toContain('TypeError');

    // Also assert there were no console.error messages emitted
    if (consoleErrors.length > 0) {
      const messages = consoleErrors.map(e => e.text).join('\n---\n');
      // Fail the test if any console.error happened
      throw new Error('console.error messages were emitted during the test:\n' + messages);
    }
  });

  test('S0_Idle state on initial load: button present and demonstration hidden', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle:
    // - renderPage() is expected in FSM entry_actions but is not implemented in the HTML.
    // - The toggle button must exist with expected text and onclick attribute.
    // - The demonstration container must be present and initially hidden (display: none).

    const app = new LogisticRegressionApp(page);

    // Validate button presence and attributes
    await expect(app.button).toBeVisible();
    const buttonText = await app.getButtonText();
    expect(buttonText.trim()).toBe('Click here for a simple demonstration');

    const onclickAttr = await app.getButtonOnClickAttr();
    expect(onclickAttr).toBe('showDemonstration()');

    // Validate demonstration container exists and is hidden via inline style and computed style
    await expect(app.demo).toBeVisible(); // locator's visible checks element presence; but it may be hidden by CSS - Playwright still considers it attached. We'll check computed style separately.
    const inlineStyle = await app.getDemoInlineStyle();
    // The HTML includes style="display: none;" in the component definition; assert that if present
    expect(inlineStyle).toContain('display: none');

    const computedDisplay = await app.getDemoComputedDisplay();
    expect(computedDisplay).toBe('none');

    // The FSM mentions renderPage() on entry to S0_Idle. Verify that it is not defined on window (because HTML does not implement it).
    const renderPageDefined = await app.isRenderPageDefined();
    expect(renderPageDefined).toBe(false);

    // Ensure showDemonstration function is defined because the button wires to it.
    const showDemoDefined = await app.isShowDemonstrationDefined();
    expect(showDemoDefined).toBe(true);

    // Ensure no runtime Reference/Syntax/Type errors were emitted during load (checked in afterEach as well)
  });

  test('Transition S0_Idle -> S1_DemonstrationVisible: clicking the button shows the demonstration', async ({ page }) => {
    // This test validates transition on ShowDemonstration event:
    // - Click the button once and expect the demonstration to be visible (#demonstration display: block).
    const app = new LogisticRegressionApp(page);

    // Precondition: demo hidden
    expect(await app.isDemoVisible()).toBe(false);

    // Trigger the event
    await app.clickToggle();

    // Expect demo to be visible now
    // Use computed style check to avoid false positives
    await expect.poll(async () => await app.getDemoComputedDisplay()).toBe('block');

    expect(await app.isDemoVisible()).toBe(true);

    // Validate demo content contains explanatory text
    const demoText = await app.getDemoText();
    expect(demoText).toContain('This is a simple demonstration of logistic regression concept.');

    // FSM S1 entry action is showDemonstration(); the function exists and was invoked by the click - the visible state is evidence of invocation.
  });

  test('Transition S1_DemonstrationVisible -> S0_Idle: clicking the button again hides the demonstration', async ({ page }) => {
    // Validate toggling back to hidden state
    const app = new LogisticRegressionApp(page);

    // Ensure visible first (click once)
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoComputedDisplay()).toBe('block');
    expect(await app.isDemoVisible()).toBe(true);

    // Click again to hide
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoComputedDisplay()).toBe('none');
    expect(await app.isDemoVisible()).toBe(false);
  });

  test('Edge case: rapid repeated toggles maintain consistent behavior', async ({ page }) => {
    // This test rapidly toggles the showDemonstration button multiple times to ensure stability.
    const app = new LogisticRegressionApp(page);

    const clicks = 7; // odd -> final state = visible
    for (let i = 0; i < clicks; i++) {
      await app.clickToggle();
      // tiny delay to allow DOM updates
      await page.waitForTimeout(50);
    }

    // After 7 toggles (odd), the demo should be visible
    const finalComputed = await app.getDemoComputedDisplay();
    expect(finalComputed).toBe('block');

    // Toggle one more time to return to initial hidden state
    await app.clickToggle();
    await expect.poll(async () => await app.getDemoComputedDisplay()).toBe('none');
    expect(await app.isDemoVisible()).toBe(false);
  });

  test('Validate FSM evidence and component texts/details', async ({ page }) => {
    // This test cross-checks content against FSM component descriptions
    // - The button text matches FSM extraction
    // - The #demonstration contains expected explanatory sentences
    const app = new LogisticRegressionApp(page);

    const buttonText = await app.getButtonText();
    expect(buttonText).toBe('Click here for a simple demonstration');

    const demoText = await app.getDemoText();
    expect(demoText).toContain('This is a simple demonstration of logistic regression concept.');
    expect(demoText).toContain('importance of learning the underlying mechanics');

    // Confirm #demonstration element exists with the expected id
    const idAttr = await app.demo.getAttribute('id');
    expect(idAttr).toBe('demonstration');
  });

  test('No unexpected runtime errors: observe console.log and page errors', async ({ page }) => {
    // This test explicitly examines collected console messages and page errors to assert no unexpected runtime errors.
    // It will fail if ReferenceError, SyntaxError, TypeError or console.error occurred.

    // We reload to possibly generate any deferred runtime errors
    await page.reload();
    await page.waitForLoadState('load');

    // Allow some time for any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Inspect pageErrors captured during this test
    const errorNames = pageErrors.map(e => e.name || '');
    // Assert none of the critical JS error types occurred
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');

    // Verify there were no console.error messages
    const consoleErrorTypes = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorTypes.length).toBe(0);
  });
});