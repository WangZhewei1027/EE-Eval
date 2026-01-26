import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b47b23-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object for the Authentication page
class AuthPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Return the main heading text
  async headingText() {
    const el = await this.page.$('h1');
    return el ? (await el.textContent()).trim() : null;
  }

  // Return the Learn More button element handle
  async learnMoreButton() {
    return this.page.$('.button');
  }

  // Return visible state of the Learn More button
  async isLearnMoreVisible() {
    const btn = await this.learnMoreButton();
    return btn ? await btn.isVisible() : false;
  }

  // Click the Learn More button
  async clickLearnMore() {
    return this.page.click('.button');
  }

  // Count of buttons with .button selector
  async learnMoreCount() {
    return this.page.$$eval('.button', els => els.length);
  }

  // Return a snapshot of the main container innerText for asserting no major DOM change
  async containerSnapshot() {
    return this.page.$eval('.container', el => el.innerText);
  }

  // Check if renderPage is defined in the page context
  async isRenderPageDefined() {
    return this.page.evaluate(() => typeof window.renderPage === 'function');
  }
}

test.describe('Authentication FSM - f5b47b23-fa7c-11f0-adc7-178f556b1ee0', () => {
  let consoleMessages = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  // Setup: navigate to the page and attach listeners to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    consoleHandler = msg => {
      // Capture console messages for later assertions
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };

    pageErrorHandler = error => {
      // Capture page-level uncaught errors
      pageErrors.push(error);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Load the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  // Teardown: remove listeners
  test.afterEach(async ({ page }) => {
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);

    // If any page errors were captured, attach them to the test output to aid debugging
    if (pageErrors.length > 0) {
      // This will appear in the Playwright test output
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors.map(e => (e && e.message) || String(e)));
    }
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
  });

  test('Idle state: initial render shows heading, content and a single Learn More button', async ({ page }) => {
    // Validate initial Idle state UI evidence per FSM
    const auth = new AuthPage(page);

    // Verify the main heading exists and has expected text
    const heading = await auth.headingText();
    expect(heading).toBe('Authentication');

    // Verify the Learn More button exists, visible, and has correct text content
    const btn = await auth.learnMoreButton();
    expect(btn).toBeTruthy();
    expect(await auth.isLearnMoreVisible()).toBe(true);

    const btnText = await (await btn.getProperty('innerText')).jsonValue();
    expect(String(btnText).trim()).toBe('Learn More');

    // There should be exactly one .button element as extracted by the FSM
    expect(await auth.learnMoreCount()).toBe(1);

    // Verify the page contains educational content paragraphs (basic DOM sanity)
    const containerText = await auth.containerSnapshot();
    expect(containerText).toContain('Authentication is the process of verifying the identity');

    // Assert no uncaught page errors were emitted on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: clicking Learn More (LearnMoreClick event) - observe DOM and errors', async ({ page }) => {
    // This test validates the FSM transition triggered by clicking the button.
    // The implementation does not define any transition behavior, so we check observable outcomes:
    const auth = new AuthPage(page);

    // Snapshot before click
    const beforeSnapshot = await auth.containerSnapshot();

    // Perform the event: click the Learn More button
    await auth.clickLearnMore();

    // After click: The FSM expects a transition to S1_LearnMore.
    // Because the page has no JavaScript to change state, we assert the DOM remains present with the button.
    expect(await auth.learnMoreCount()).toBe(1);
    expect(await auth.isLearnMoreVisible()).toBe(true);

    // The content should remain unchanged (no client-side code to modify it)
    const afterSnapshot = await auth.containerSnapshot();
    expect(afterSnapshot).toBe(beforeSnapshot);

    // Clicking should not produce any uncaught page errors in this implementation
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: calling undefined renderPage() in page context throws ReferenceError and emits pageerror', async ({ page }) => {
    // FSM mentions an entry_action "renderPage()" for S0_Idle.
    // The HTML/JS implementation does not define renderPage. We will attempt to call it in the page context
    // to allow the natural ReferenceError to occur, and assert that it happens and that a pageerror event is emitted.

    // Ensure renderPage is not defined
    const auth = new AuthPage(page);
    const isDefined = await auth.isRenderPageDefined();
    expect(isDefined).toBe(false);

    // Attempt to call renderPage() - this should reject with a ReferenceError from the browser context
    let evaluateError = null;
    try {
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        return renderPage(); // intentionally call undefined function
      });
    } catch (err) {
      evaluateError = err;
    }

    // We expect the evaluation to throw an error (ReferenceError)
    expect(evaluateError).toBeTruthy();
    // The message often contains 'renderPage is not defined' or 'ReferenceError'
    expect(String(evaluateError.message)).toMatch(/renderPage is not defined|ReferenceError/);

    // The pageerror handler should have captured at least one uncaught error related to this call
    // It's possible the pageerror is recorded slightly after the evaluate rejects, so allow a brief wait.
    await page.waitForTimeout(100); // short pause so pageerror event (if any) is fired

    // At least one pageError should mention 'renderPage' or 'ReferenceError'
    const found = pageErrors.some(err => {
      const msg = (err && err.message) || String(err);
      return /renderPage/.test(msg) || /ReferenceError/.test(msg) || /is not defined/.test(msg);
    });

    expect(found).toBe(true);
  });

  test('Edge case: rapid multiple clicks on Learn More produce no errors', async ({ page }) => {
    // Simulate rapid user interactions to check for unexpected runtime errors
    const auth = new AuthPage(page);

    for (let i = 0; i < 5; i++) {
      await auth.clickLearnMore();
    }

    // After rapid clicking, no uncaught page errors should be present for this simple static page
    expect(pageErrors.length).toBe(0);
  });

  test('Negative test: attempting to click a missing selector results in Playwright navigation error', async ({ page }) => {
    // Attempt to click an element that does not exist - Playwright should throw.
    // This validates how the test framework surfaces failures when the DOM is not as expected.
    await expect(page.click('.non-existent-button', { timeout: 1000 })).rejects.toThrow();
  });

  test('Sanity check: no SyntaxError occurred in console on load', async ({ page }) => {
    // Ensure there are no console messages that indicate a SyntaxError on load
    const syntaxErrors = consoleMessages.filter(m => /SyntaxError/i.test(m.text) || m.type === 'error' && /SyntaxError/i.test(m.text));
    expect(syntaxErrors.length).toBe(0);
  });
});