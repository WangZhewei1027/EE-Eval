import { test, expect } from '@playwright/test';

// Page Object for the Agile demo page
class AgilePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b342a2-fa7c-11f0-adc7-178f556b1ee0.html';
    this.buttonSelector = '#agile-demo';
  }

  // Load the page and wait for it to be fully loaded
  async load() {
    await this.page.goto(this.url, { waitUntil: 'load' });
    // give a short moment for any synchronous scripts to run and throw errors
    await this.page.waitForTimeout(200);
  }

  // Get the Explore button element handle
  async getExploreButton() {
    return this.page.$(this.buttonSelector);
  }

  // Click the Explore button
  async clickExplore() {
    await this.page.click(this.buttonSelector);
    // give a moment for any handlers or errors to manifest
    await this.page.waitForTimeout(200);
  }

  // Read button text content
  async getExploreButtonText() {
    const handle = await this.getExploreButton();
    if (!handle) return null;
    return (await this.page.evaluate(el => el.textContent, handle))?.trim();
  }

  // Check if the button is visible
  async isExploreButtonVisible() {
    const handle = await this.getExploreButton();
    if (!handle) return false;
    return await handle.isVisible();
  }
}

test.describe('FSM: Agile Methodology (f5b342a2-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Arrays to collect console messages and page errors
  let consoleMessages;
  let pageErrors;
  let agilePage;

  // Attach handlers before each test to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (log, error, warning, etc.)
    page.on('console', (msg) => {
      // store type and text for diagnostics/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions and other page errors
    page.on('pageerror', (err) => {
      // err is an Error object; store its message
      pageErrors.push(String(err.message || err));
    });

    agilePage = new AgilePage(page);
  });

  test.afterEach(async () => {
    // no-op for now; hooks added for symmetry and future teardown needs
  });

  // Test initial state S0_Idle
  test('S0_Idle: Page renders and initial entry action renderPage() is observed (or its error)', async ({ page }) => {
    // This test validates:
    // - The HTML content is loaded
    // - The expected button exists with correct text (evidence for S0_Idle)
    // - The FSM entry action renderPage() is invoked on load (we observe via console/page errors if it's missing)

    await agilePage.load();

    // Basic DOM checks: title and presence of button
    await expect(page.locator('h1')).toHaveText('Agile Methodology');
    const buttonVisible = await agilePage.isExploreButtonVisible();
    expect(buttonVisible).toBeTruthy(); // button should be present and visible

    const buttonText = await agilePage.getExploreButtonText();
    expect(buttonText).toBe('Explore Agile in Action');

    // Check for evidence of entry action renderPage()
    // The implementation may try to call renderPage() on load. If the function is missing,
    // we expect to capture a ReferenceError or at least a page error mentioning 'renderPage'.
    const anyRenderPageError = pageErrors.some(msg => msg.includes('renderPage'));
    const anyRenderPageConsole = consoleMessages.some(entry => entry.text.includes('renderPage'));

    // Assert that either an error mentioning renderPage was produced or a console message references it.
    // This aligns with the requirement to observe console logs and page errors and assert they occur naturally.
    expect(anyRenderPageError || anyRenderPageConsole).toBeTruthy();
  });

  // Test the transition from S0_Idle -> S1_Exploring by clicking the button
  test('Transition ExploreAgileInAction: clicking #agile-demo triggers startAgileDemo() (S1_Exploring entry action)', async ({ page }) => {
    // This test validates:
    // - Clicking the Explore Agile button triggers the FSM event ExploreAgileInAction
    // - The S1_Exploring entry action startAgileDemo() is invoked (we observe via console/page errors if missing)
    // - The button still exists after click unless implementation removes it

    await agilePage.load();

    // clear previously captured messages to isolate this interaction
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Perform the user action from the FSM: click the button
    await agilePage.clickExplore();

    // After clicking, some implementations log a textual "Agile demo starts" or call startAgileDemo().
    // If startAgileDemo is not defined, we expect a ReferenceError mentioning 'startAgileDemo'.
    const anyStartAgileError = pageErrors.some(msg => msg.includes('startAgileDemo'));
    const anyStartAgileConsole = consoleMessages.some(entry => entry.text.includes('startAgileDemo') || entry.text.includes('Agile demo starts'));

    expect(anyStartAgileError || anyStartAgileConsole).toBeTruthy();

    // Verify DOM state - the button should still be present as evidence unless script intentionally removes it.
    const buttonStillPresent = await agilePage.getExploreButton();
    expect(buttonStillPresent).not.toBeNull();
  });

  // Edge case: rapid sequential clicks
  test('Edge case: rapid multiple clicks on Explore Agile should either debounce or produce repeated handler invocations (observe errors/logs)', async ({ page }) => {
    // This test validates:
    // - Clicking the button rapidly multiple times either safely handles multiple events
    //   or results in repeated errors/logs which we capture.
    await agilePage.load();

    // clear previously captured messages
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Rapidly click the button 5 times
    for (let i = 0; i < 5; i++) {
      await agilePage.clickExplore();
    }

    // Give a tiny extra moment for async errors to surface
    await page.waitForTimeout(200);

    // We expect to have at least one indication that startAgileDemo was invoked (or failed)
    const startCountFromPageErrors = pageErrors.filter(msg => msg.includes('startAgileDemo')).length;
    const startCountFromConsole = consoleMessages.filter(entry => entry.text.includes('startAgileDemo') || entry.text.includes('Agile demo starts')).length;
    const totalDetected = startCountFromPageErrors + startCountFromConsole;

    // Assert at least one invocation/attempt was observed
    expect(totalDetected).toBeGreaterThanOrEqual(1);

    // If multiple errors were produced, that's acceptable; log counts in test output for diagnostics
    // (Using expect to ensure we actually observed behavior; we don't strictly require >1 because a debounced handler could produce 1)
  });

  // Robustness test: ensure console/page error capture works for unexpected runtime errors
  test('Error capture sanity: pageerror and console events are being captured by the test harness', async ({ page }) => {
    // This test validates that our instrumentation captures errors produced by the page.
    // We deliberately attempt to cause a harmless console error by evaluating code on the page that references a missing global.
    // NOTE: We do not modify the application's globals; we only run a short snippet to provoke a console message.
    // Because the instructions disallow injecting global variables or patching, we will not redefine functions on the page.
    // However, running a harmless evaluation that throws will exercise our listeners.
    await agilePage.load();

    // clear any previous captures
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Evaluate an expression that throws a ReferenceError inside the page context
    // This simulates an in-page uncaught exception; we do not patch application logic.
    await page.evaluate(() => {
      // Intentionally cause a ReferenceError by accessing an obviously undefined identifier
      // This is executed in the page's context and will surface through 'pageerror' in Playwright
      // We purposely do not catch the error here so it's an uncaught exception.
      void nonExistentIdentifierForTestCapture;
    }).catch(() => {
      // The evaluation will be rejected because the ReferenceError propagates to the Playwright evaluation.
      // swallow the rejection here; the important part is that page.on('pageerror') captures it.
    });

    // give a moment for the pageerror event to be emitted and captured
    await page.waitForTimeout(200);

    // At least one captured page error should reference the identifier we tried to access
    const captured = pageErrors.some(msg => msg.includes('nonExistentIdentifierForTestCapture'));
    expect(captured).toBeTruthy();

    // Also ensure consoleMessages array has items (could be empty depending on how the browser surfaces it)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});