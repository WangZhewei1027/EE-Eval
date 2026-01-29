import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8397150-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object representing the small interactive demo area and related utilities.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Containers to collect console messages and page errors observed during the test.
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners to capture console messages and page errors for assertions.
    this._attachListeners();
  }

  _attachListeners() {
    this.page.on('console', (msg) => {
      // Capture console messages with type and text for later inspection.
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // Capture unhandled errors (ReferenceError, TypeError, SyntaxError, etc).
      this.pageErrors.push(err);
    });
  }

  // Navigate to the page and wait for the main container to be visible.
  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForSelector('.container', { state: 'visible' });
  }

  // Get the demo button element handle.
  async demoButton() {
    return this.page.locator('#demoBtn');
  }

  // Click the demo button (uses Playwright click which throws if not available).
  async clickDemo() {
    await this.page.click('#demoBtn');
  }

  // Returns the text content of the response <code> element inside #sim-response.
  async getResponseCodeText() {
    const locator = this.page.locator('#sim-response code');
    return locator.textContent();
  }

  // Returns the text content of the demo button.
  async getDemoButtonText() {
    return this.page.locator('#demoBtn').textContent();
  }

  // Returns whether the demo button is disabled.
  async isDemoButtonDisabled() {
    return this.page.locator('#demoBtn').isDisabled();
  }

  // Returns captured console messages.
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Returns captured page errors.
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('REST API demo interactive (FSM validation) - d8397150...', () => {
  // Each test will create a fresh page and demo page object.
  test.describe.configure({ mode: 'parallel' });

  // Validate the Idle state (S0_Idle) initial rendering and attributes.
  test('S0_Idle: initial render shows demo button and waiting response', async ({ page }) => {
    // Setup page object which collects console/page errors.
    const demo = new DemoPage(page);
    // Navigate to the app.
    await demo.goto();

    // Verify the demo button exists with expected text and attributes.
    const btn = page.locator('#demoBtn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Demo: Simulate GET /books?limit=3');
    await expect(btn).toHaveAttribute('class', 'btn');
    await expect(btn).toHaveAttribute('aria-controls', 'sim-response');
    await expect(btn).toHaveAttribute('aria-label', 'Simulate a GET request');

    // Verify the response area initially displays waiting text.
    const responseCode = page.locator('#sim-response code');
    await expect(responseCode).toBeVisible();
    await expect(responseCode).toHaveText(/Waiting for demo\.\.\./);

    // Verify the surrounding sim-area has aria-live polite (accessibility).
    await expect(page.locator('.sim-area')).toHaveAttribute('aria-live', 'polite');

    // Verify no runtime page errors were produced just from rendering the page.
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages on initial render.
    const consoleErrors = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate the transition: DemoButtonClick moves from S0_Idle -> S1_ResponseDisplayed
  test('DemoButtonClick: clicking demo shows response, updates button text and disables it (S1_ResponseDisplayed)', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the demo button to trigger the simulated response.
    await demo.clickDemo();

    // After click, the button should change its text to 'Demo shown' and be disabled.
    await expect(page.locator('#demoBtn')).toHaveText('Demo shown');
    await expect(page.locator('#demoBtn')).toBeDisabled();

    // The response area should contain the simulated HTTP response header and pretty JSON.
    const respText = await demo.getResponseCodeText();
    expect(respText).toContain('HTTP/1.1 200 OK');
    expect(respText).toContain('Content-Type: application/json');
    // Expect the JSON payload to include the meta limit and three items.
    expect(respText).toContain('"meta":');
    expect(respText).toContain('"limit": 3');
    expect(respText).toContain('"data": [');
    expect(respText).toContain('"links": { "self": "/books?limit=3" }'.replace(/\s+/g, ' ')); // tolerant expectation

    // Verify that the DOM update was performed by setting textContent on the <code> element.
    // The first line should start with HTTP/1.1 200 OK (definitive sign of the example response).
    expect(respText.split('\n')[0].trim()).toBe('HTTP/1.1 200 OK');

    // Confirm no page errors were raised as a result of clicking.
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Confirm there are no console.error messages produced by the click handler.
    const consoleErrors = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: clicking the button multiple times should have no additional effect and must not throw.
  test('Edge case: subsequent clicks after the first do nothing and produce no errors', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform the first click to trigger the one-time demo behavior.
    await demo.clickDemo();

    // Capture response text after first click.
    const respAfterFirst = await demo.getResponseCodeText();
    const btnTextAfterFirst = await demo.getDemoButtonText();
    const btnDisabledAfterFirst = await demo.isDemoButtonDisabled();

    expect(btnTextAfterFirst).toBe('Demo shown');
    expect(btnDisabledAfterFirst).toBe(true);
    expect(respAfterFirst).toContain('HTTP/1.1 200 OK');

    // Attempt a second click. Since the event listener is attached with { once: true } and the button is disabled,
    // this should not change the response nor produce runtime errors.
    // Use try/catch to ensure that a thrown error from the click would be surfaced as a test failure.
    await page.click('#demoBtn').catch(() => {
      // If click fails due to element being disabled or otherwise, that's acceptable; do not modify behavior.
    });

    // Give a small pause to allow any possible asynchronous errors to be emitted to pageerror/console.
    await page.waitForTimeout(100);

    // Re-check values after the attempted second click.
    const respAfterSecond = await demo.getResponseCodeText();
    const btnTextAfterSecond = await demo.getDemoButtonText();
    const btnDisabledAfterSecond = await demo.isDemoButtonDisabled();

    // The response content should remain identical to what was set the first time (no duplication or change).
    expect(respAfterSecond).toBe(respAfterFirst);
    expect(btnTextAfterSecond).toBe(btnTextAfterFirst);
    expect(btnDisabledAfterSecond).toBe(btnDisabledAfterFirst);

    // Confirm no page errors occurred during these interactions.
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Confirm that no console.error messages were emitted.
    const consoleErrors = demo.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate visual/DOM evidence that the FSM transition performed the expected mutations.
  test('Transition evidence: code text updated and button mutated exactly as documented in FSM evidence', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Before clicking, ensure the button text is the initial label (evidence for S0_Idle).
    await expect(page.locator('#demoBtn')).toHaveText('Demo: Simulate GET /books?limit=3');

    // Click to transition.
    await demo.clickDemo();

    // Evidence checks per FSM:
    // - resp.querySelector('code').textContent = example; -> check that the <code> inside #sim-response has the example content
    const responseText = await demo.getResponseCodeText();
    expect(responseText.length).toBeGreaterThan(20); // ensure it's non-trivial and updated
    expect(responseText).toMatch(/HTTP\/1\.1 200 OK/);

    // - btn.textContent = 'Demo shown'; -> button text updated
    const btnText = await demo.getDemoButtonText();
    expect(btnText).toBe('Demo shown');

    // - btn.disabled = true; -> button disabled
    const disabled = await demo.isDemoButtonDisabled();
    expect(disabled).toBe(true);
  });

  // Observability test: collect and report console messages and errors for debugging.
  test('Observability: capture console messages and page errors (reporting)', async ({ page }, testInfo) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform the demo click which drives the small interactive script.
    await demo.clickDemo();

    // Wait briefly for any asynchronous logs/errors to be emitted.
    await page.waitForTimeout(100);

    // Gather captured messages.
    const consoleMessages = demo.getConsoleMessages();
    const pageErrors = demo.getPageErrors();

    // This test asserts that no unhandled page errors occurred for this page as deployed.
    // If the implementation had a ReferenceError / SyntaxError / TypeError it would be captured in pageErrors.
    // We assert zero pageErrors to indicate the page script executed cleanly.
    expect(pageErrors.length).toBe(0);

    // Assert there were no console.error messages. Console.info/debug messages can exist but errors should not.
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);

    // For debugging convenience, add the counts to the test output.
    testInfo.attach('observability-summary', {
      body: `consoleCount=${consoleMessages.length}, consoleErrors=${consoleErrorMessages.length}, pageErrors=${pageErrors.length}`,
      contentType: 'text/plain'
    });
  });
});