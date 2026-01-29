import { test, expect } from '@playwright/test';

// Test file for application: 044430d3-fa79-11f0-8a8e-bbe4f11717c6
// URL served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/044430d3-fa79-11f0-8a8e-bbe4f11717c6.html
//
// These tests validate the FSM states and transitions described in the specification.
// IMPORTANT: Per instructions, we load the page exactly as-is and observe console logs
// and page errors. We do NOT attempt to patch or redefine any globals. We assert that
// runtime errors (ReferenceError/TypeError/etc.) occur naturally if they do.

// Page object encapsulating interactions and observability
class LoadBalancingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners to capture console and page errors
    this._consoleListener = msg => {
      try {
        // Collect console messages as string
        this.consoleMessages.push(String(msg.text()));
      } catch (e) {
        this.consoleMessages.push('<unserializable console message>');
      }
    };
    this._pageErrorListener = err => {
      // err is an Error object; capture its message and stack
      this.pageErrors.push(String(err.message || err));
    };

    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/044430d3-fa79-11f0-8a8e-bbe4f11717c6.html', { waitUntil: 'load' });
    // Give any synchronous startup scripts a brief moment to run
    await this.page.waitForTimeout(100);
  }

  async clickLoadBalancing() {
    await this.page.click('#load-balancing-button');
    // allow event handlers and potential errors to surface
    await this.page.waitForTimeout(100);
  }

  async clickExceptional() {
    await this.page.click('#exceptional-button');
    await this.page.waitForTimeout(100);
  }

  async clickLoadBalancingRapid(times = 5, intervalMs = 20) {
    for (let i = 0; i < times; i++) {
      await this.page.click('#load-balancing-button');
      await this.page.waitForTimeout(intervalMs);
    }
    await this.page.waitForTimeout(100);
  }

  async getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  async getPageErrors() {
    return this.pageErrors.slice();
  }

  dispose() {
    // Remove listeners to avoid leaks across tests
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }
}

test.describe('Load Balancing App - FSM validation (044430d3...)', () => {
  let app;

  // Create a fresh page and app instance for each test
  test.beforeEach(async ({ page }) => {
    app = new LoadBalancingPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    if (app) {
      app.dispose();
    }
  });

  test('Initial Idle state: page renders main elements and we observe startup errors if any', async ({ page }) => {
    // This test validates the S0_Idle state rendering and that the page executed its entry actions.
    // It asserts that the expected UI elements are present and that any startup script errors are observable.

    // Validate DOM elements for Idle state
    const title = await page.textContent('h1');
    expect(title).toBeTruthy();
    expect(title).toContain('Load Balancing');

    const paragraph = await page.textContent('p');
    expect(paragraph).toBeTruthy();
    expect(paragraph.toLowerCase()).toContain('load balancing');

    const loadButton = await page.$('#load-balancing-button');
    expect(loadButton).not.toBeNull();

    const exceptionalButton = await page.$('#exceptional-button');
    expect(exceptionalButton).not.toBeNull();

    const animationContainer = await page.$('.animation-container');
    expect(animationContainer).not.toBeNull();

    // Per instructions, we must observe console logs and page errors and assert that errors occur.
    // The implementation may call functions like renderPage() on load which might not be defined.
    const pageErrors = await app.getPageErrors();
    const consoleMessages = await app.getConsoleMessages();

    // Explain in comments: we expect that either the application logged something (renderPage)
    // or raised a runtime error on load. The test requires us to assert that runtime errors occur.
    // Assert that at least one page error was captured during load (ReferenceError / TypeError / SyntaxError).
    expect(pageErrors.length).toBeGreaterThan(0);

    // Also capture at least some console output (may be empty in broken apps) - not a hard requirement
    // but useful for debugging if available.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Transition: Clicking Load Balancing triggers Load Balancing Activated (S1) or an error (startLoadBalancing)', async () => {
    // This test validates the transition from S0_Idle -> S1_LoadBalancing.
    // It clicks the Load Balancing button and asserts expected observables.
    // Expected observable per FSM: "Load balancing process started"
    // But per instructions we let errors happen naturally; we assert that an error referencing
    // startLoadBalancing occurs if the function is missing.

    // Ensure the button is present before clicking
    const btn = await app.page.$('#load-balancing-button');
    expect(btn).not.toBeNull();

    // Click the button
    await app.clickLoadBalancing();

    // Gather messages and errors after interaction
    const pageErrors = await app.getPageErrors();
    const consoleMessages = await app.getConsoleMessages();

    // Two allowed outcomes:
    // 1) The page logs "Load balancing process started" (successful activation)
    // 2) The page throws a ReferenceError/TypeError mentioning startLoadBalancing (missing/broken handler)
    const successLogFound = consoleMessages.some(m => /Load balancing process started/i.test(m));
    const errorMentionFound = pageErrors.some(m => /startLoadBalancing|startLoadBalancing\(\)|is not defined|ReferenceError|TypeError/i.test(m));

    // Assert that at least one of the expected observables happened.
    expect(successLogFound || errorMentionFound).toBeTruthy();

    // Additionally, per the testing instruction, we must assert that runtime errors occur naturally.
    // So require that an error referencing the handler or a ReferenceError-like message exists.
    // If the implementation is correct and no errors occurred, this expectation may fail; but the
    // instructions require asserting these errors occur, so we enforce it.
    expect(errorMentionFound).toBeTruthy();
  });

  test('Transition: Clicking Exceptional Load Balancing triggers Exceptional state (S2) or an error (startExceptionalLoadBalancing)', async () => {
    // This test validates the transition from S0_Idle -> S2_ExceptionalLoadBalancing.
    // Expected observable: "Exceptional load balancing process started" OR an error if handler missing.

    const btn = await app.page.$('#exceptional-button');
    expect(btn).not.toBeNull();

    await app.clickExceptional();

    const pageErrors = await app.getPageErrors();
    const consoleMessages = await app.getConsoleMessages();

    const successLogFound = consoleMessages.some(m => /Exceptional load balancing process started/i.test(m));
    const errorMentionFound = pageErrors.some(m => /startExceptionalLoadBalancing|startExceptionalLoadBalancing\(\)|is not defined|ReferenceError|TypeError/i.test(m));

    expect(successLogFound || errorMentionFound).toBeTruthy();

    // Per instructions, assert that the runtime error referencing the handler occurred.
    expect(errorMentionFound).toBeTruthy();
  });

  test('Edge case: Rapid repeated clicks on Load Balancing - observe errors or stable behavior', async () => {
    // This test simulates multiple quick interactions to surface race conditions or repeated handler errors.

    // Sanity: button exists
    const btn = await app.page.$('#load-balancing-button');
    expect(btn).not.toBeNull();

    // Rapidly click the button multiple times
    await app.clickLoadBalancingRapid(6, 10);

    // Collect errors and console messages after rapid clicks
    const pageErrors = await app.getPageErrors();
    const consoleMessages = await app.getConsoleMessages();

    // We expect that repeated rapid clicks either produce multiple errors or at least one.
    expect(pageErrors.length).toBeGreaterThan(0);

    // If the implementation logs a start message, we accept it but still assert errors must have occurred per instructions.
    const successLogs = consoleMessages.filter(m => /Load balancing process started/i.test(m));
    // Accept zero or more success logs but ensure errors occurred
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('Edge case: Clicking Exceptional then Load Balancing - ensure handlers invoked or errors observed', async () => {
    // Validate sequence of events triggers respective handlers or errors for each event.

    const loadBtn = await app.page.$('#load-balancing-button');
    const exceptionalBtn = await app.page.$('#exceptional-button');
    expect(loadBtn).not.toBeNull();
    expect(exceptionalBtn).not.toBeNull();

    // Click exceptional first, then load balancing
    await app.clickExceptional();
    await app.clickLoadBalancing();

    const pageErrors = await app.getPageErrors();
    const consoleMessages = await app.getConsoleMessages();

    // We expect errors referencing either handler to appear
    const exceptionalError = pageErrors.some(m => /startExceptionalLoadBalancing|startExceptionalLoadBalancing\(\)|is not defined|ReferenceError|TypeError/i.test(m));
    const loadError = pageErrors.some(m => /startLoadBalancing|startLoadBalancing\(\)|is not defined|ReferenceError|TypeError/i.test(m));

    // Per instructions assert that runtime errors occur naturally for missing handlers
    expect(exceptionalError || loadError).toBeTruthy();

    // For stronger checks, ensure at least one page error exists
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('State evidence checks: verify presence or attributes that indicate handlers may be attached', async () => {
    // This test checks for evidence strings in the DOM that the FSM expects (onclick attributes, etc.)
    // The HTML provided does NOT include onclick attributes for the buttons, but the FSM evidence mentions them.
    // We assert the actual DOM state and capture any mismatch as part of validation.

    const loadButton = await app.page.$('#load-balancing-button');
    const exceptionalButton = await app.page.$('#exceptional-button');

    // Check attributes - we do not modify anything; we just assert current state.
    const loadOnClick = await loadButton.getAttribute('onclick');
    const exceptionalOnClick = await exceptionalButton.getAttribute('onclick');

    // The FSM expected onclick="startLoadBalancing()" and onclick="startExceptionalLoadBalancing()".
    // Verify whether these attributes exist. If they do not, that mismatch is notable.
    // We assert that at least one of the following is true:
    // - either the DOM includes the onclick evidence (match FSM)
    // - or runtime errors were observed referring to those functions (indicating handlers referenced elsewhere)
    const pageErrors = await app.getPageErrors();

    const domEvidence = (typeof loadOnClick === 'string' && /startLoadBalancing/i.test(loadOnClick)) ||
                        (typeof exceptionalOnClick === 'string' && /startExceptionalLoadBalancing/i.test(exceptionalOnClick));

    const errorEvidence = pageErrors.some(m => /startLoadBalancing|startExceptionalLoadBalancing|is not defined|ReferenceError|TypeError/i.test(m));

    // Assert that either DOM evidence or runtime error evidence is present
    expect(domEvidence || errorEvidence).toBeTruthy();
  });
});