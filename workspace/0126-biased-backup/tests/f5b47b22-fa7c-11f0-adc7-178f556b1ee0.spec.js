import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b47b22-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object for the demo page
class DigitalSignaturesPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.signButton = page.locator('#sign-demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSign() {
    await this.signButton.click();
  }

  async getSignButtonText() {
    return (await this.signButton.textContent())?.trim();
  }

  async isSignButtonVisible() {
    return this.signButton.isVisible();
  }
}

test.describe('Digital Signatures - FSM validation (f5b47b22-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Record console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws, still record stringified event
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Record page errors (uncaught exceptions)
    page.on('pageerror', err => {
      // err is an Error object; store its message and stack
      pageErrors.push({ message: err?.message ?? String(err), stack: err?.stack });
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure listeners are cleaned up to avoid cross-test interference
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle: Initial render shows "Sign the Document" button (renderPage entry action)', async ({ page }) => {
    // Validate Idle state: button is present and visible
    const demo = new DigitalSignaturesPage(page);
    await demo.goto();

    // The FSM's entry action for Idle is renderPage(), so the DOM should include the button
    await expect(demo.signButton).toBeVisible();
    const text = await demo.getSignButtonText();
    expect(text).toBe('Sign the Document');

    // Ensure no page errors have occurred just from loading the page
    expect(pageErrors.length).toBe(0);

    // No "Signature:" or "Hash:" logs should exist prior to interaction
    const signatureLogs = consoleMessages.filter(m => m.text.includes('Signature:') || m.text.includes('Hash:'));
    expect(signatureLogs.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Signed: clicking the button triggers the sign handler and results in a runtime error due to Node crypto usage', async ({ page }) => {
    // This test validates the SignDocument event and the expected (erroneous) behavior in the browser environment.
    const demo = new DigitalSignaturesPage(page);
    await demo.goto();

    // Click should trigger the click handler. The page's script uses Node's crypto APIs (crypto.createHash / crypto.createSign),
    // which do not exist on window.crypto in browsers. We expect a runtime TypeError (or similar) to be thrown and captured as a pageerror.
    const [pageError] = await Promise.all([
      // Wait for the uncaught exception triggered by the flawed crypto usage
      page.waitForEvent('pageerror'),
      // Trigger the event
      demo.clickSign(),
    ]);

    // Assert an error was thrown and has an informative message
    expect(pageError).toBeTruthy();
    // The message usually mentions createHash is not a function or similar - check for those tokens
    const msg = pageError.message || String(pageError);
    expect(msg).toMatch(/createHash|createSign|is not a function|crypto/i);

    // Confirm that the runtime error prevented the console logs "Signature:" and "Hash:" from being printed
    // (since createHash throws before the subsequent console.log calls)
    // Give a short moment for any console messages to be emitted
    await page.waitForTimeout(100);
    const signatureLogs = consoleMessages.filter(m => m.text.includes('Signature:') || m.text.includes('Hash:'));
    expect(signatureLogs.length).toBe(0);
  });

  test('Edge case: multiple clicks produce repeated runtime errors (ensures handler consistently fails in browser)', async ({ page }) => {
    // Validate repeated transitions / repeated event invocations produce repeated errors
    const demo = new DigitalSignaturesPage(page);
    await demo.goto();

    // First click -> expect pageerror
    const firstErrorPromise = page.waitForEvent('pageerror');
    await demo.clickSign();
    const firstError = await firstErrorPromise;
    expect(firstError).toBeTruthy();
    expect(firstError.message).toMatch(/createHash|createSign|is not a function|crypto/i);

    // Second click -> expect another pageerror
    const secondErrorPromise = page.waitForEvent('pageerror');
    await demo.clickSign();
    const secondError = await secondErrorPromise;
    expect(secondError).toBeTruthy();
    expect(secondError.message).toMatch(/createHash|createSign|is not a function|crypto/i);

    // Both errors should be captured in our pageErrors collection as well (since we registered a listener)
    // Allow a short time for the pageerror listener to push into pageErrors
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);

    // Ensure no successful signature/hash console logs are present even after multiple attempts
    const signatureLogs = consoleMessages.filter(m => m.text.includes('Signature:') || m.text.includes('Hash:'));
    expect(signatureLogs.length).toBe(0);
  });

  test('Behavioral assertion: FSM expected observables ("Signature:", "Hash:") are NOT produced due to runtime environment mismatch', async ({ page }) => {
    // This test focuses on verifying that the FSM's expected_observables do not occur in the browser runtime.
    const demo = new DigitalSignaturesPage(page);
    await demo.goto();

    // Attempt to trigger the transition; we intentionally capture the resulting pageerror but continue
    await Promise.all([
      page.waitForEvent('pageerror').catch(() => undefined), // swallow to continue assertions
      demo.clickSign().catch(() => undefined),
    ]);

    // Collect console messages after the click
    await page.waitForTimeout(100);

    // The FSM expected "Signature: ..." and "Hash: ..." to be printed; assert they are not present
    const signatureLog = consoleMessages.find(m => /Signature:\s*/i.test(m.text));
    const hashLog = consoleMessages.find(m => /Hash:\s*/i.test(m.text));
    expect(signatureLog).toBeUndefined();
    expect(hashLog).toBeUndefined();
  });

  test('Sanity: clicking without JS error listener still does not produce "Signature" logs (defensive check)', async ({ page }) => {
    // This final test double-checks that even if someone forgot to hook pageerror events, the console logs for Signature/Hash don't appear.
    // We navigate in a fresh page (listeners were removed in afterEach), then just click and inspect console output.
    const demo = new DigitalSignaturesPage(page);
    await demo.goto();

    // Temporarily capture console messages locally to ensure independence from beforeEach listeners
    const localConsole = [];
    page.on('console', m => localConsole.push({ type: m.type(), text: m.text() }));

    // Click and wait briefly
    await demo.clickSign();
    await page.waitForTimeout(100);

    const found = localConsole.find(m => m.text.includes('Signature:') || m.text.includes('Hash:'));
    expect(found).toBeUndefined();

    // Clean up local listener
    page.removeAllListeners('console');
  });
});