import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b47b20-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Asymmetric Cryptography demo page
class AsymmetricCryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      // Normalize text for easier checks
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // pageerror gives an Error-like object
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  generateButton() {
    return this.page.locator('#generate-cipher-btn');
  }

  async clickGenerate() {
    await this.page.click('#generate-cipher-btn');
  }

  // Helper: wait for the next pageerror to be captured
  async waitForPageError(options = {}) {
    // If an error already captured, return it immediately
    if (this.pageErrors.length > 0) return this.pageErrors[this.pageErrors.length - 1];
    const err = await this.page.waitForEvent('pageerror', options);
    return err;
  }

  // Helper to check if any console message contains given substring
  consoleContains(substring) {
    return this.consoleMessages.some((m) => m.text.includes(substring));
  }
}

test.describe('Asymmetric Cryptography FSM - f5b47b20-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Test the Idle state (S0_Idle) and evidence that the page was rendered
  test('S0_Idle: page renders and shows Generate Cipher button (renderPage entry evidence)', async ({ page }) => {
    const app = new AsymmetricCryptoPage(page);
    // Navigate to the application page
    await app.goto();

    // Verify the Generate Cipher button exists and is visible
    const btn = app.generateButton();
    await expect(btn).toBeVisible();
    const text = (await btn.textContent()) || '';
    expect(text.trim()).toBe('Generate Cipher');

    // The FSM's Idle state's evidence mentions the button; assert presence
    // Also assert that there are no page errors immediately after load
    expect(app.pageErrors.length).toBe(0);

    // There should be no 'Cipher:' console log on load (cipher generation happens on click)
    expect(app.consoleContains('Cipher:')).toBe(false);
  });

  // Test the transition GenerateCipher from S0_Idle -> S1_CipherGenerated
  test('GenerateCipher event: clicking button attempts to generate cipher and results in runtime error (expected)', async ({ page }) => {
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Validate pre-click state (Idle)
    await expect(app.generateButton()).toBeVisible();

    // The click handler in the page references an undefined `publicKey` variable.
    // We expect a ReferenceError (or similar) to be thrown and captured as a pageerror.
    // Listen for the pageerror and perform the click that triggers it.
    const [pageError] = await Promise.all([
      // Wait for pageerror produced by the button click handler.
      page.waitForEvent('pageerror'),
      // Trigger the event
      app.clickGenerate()
    ]);

    // Assert that a page error occurred
    expect(pageError).toBeTruthy();

    // The runtime error should indicate the missing identifier 'publicKey' (or at least 'not defined').
    const message = String(pageError.message || pageError.toString());
    const lower = message.toLowerCase();
    const indicatesMissingPublicKey = lower.includes('publickey') || lower.includes('public_key') || lower.includes('not defined') || lower.includes('is not defined');
    expect(indicatesMissingPublicKey).toBeTruthy();

    // Because the handler throws before console.log('Cipher:', cipher) can run,
    // assert that there is no console message that contains 'Cipher:'.
    expect(app.consoleContains('Cipher:')).toBe(false);

    // The FSM's S1_CipherGenerated expected behavior logs 'Cipher:' — since runtime errors occur,
    // we assert that instead of a successful cipher log, an error was produced.
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  // Edge case: clicking the Generate button multiple times should produce repeated errors
  test('Edge case: multiple clicks produce multiple page errors (robustness check)', async ({ page }) => {
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Click twice and collect two pageerror events.
    // Since each click's handler will throw a ReferenceError synchronously,
    // we can await two pageerror events.
    const firstErrorPromise = page.waitForEvent('pageerror');
    await app.clickGenerate();
    const firstError = await firstErrorPromise;
    expect(firstError).toBeTruthy();

    const secondErrorPromise = page.waitForEvent('pageerror');
    await app.clickGenerate();
    const secondError = await secondErrorPromise;
    expect(secondError).toBeTruthy();

    // Both errors should reference the same underlying issue (missing publicKey or similar)
    const m1 = String(firstError.message || firstError.toString()).toLowerCase();
    const m2 = String(secondError.message || secondError.toString()).toLowerCase();
    expect(m1).toContain('public') || expect(m1).toContain('not defined');
    expect(m2).toContain('public') || expect(m2).toContain('not defined');

    // Ensure we've recorded at least two errors in the pageErrors collection
    // (the AsymmetricCryptoPage.pageErrors is appended by the 'pageerror' handler)
    // Note: If the page.on('pageerror') handler didn't run in time, fallback to the two captured errors.
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(2);
  });

  // Validate that the page shows the descriptive content described in the HTML
  test('Content sanity: static explanatory content is present (educational context)', async ({ page }) => {
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Several paragraphs describe asymmetric cryptography; ensure key phrases exist
    await expect(page.locator('h1')).toHaveText('Asymmetric Cryptography');
    await expect(page.locator('body')).toContainText('Asymmetric cryptography is a method of secure communication');
    await expect(page.locator('body')).toContainText('Key Pair Generation');
    await expect(page.locator('body')).toContainText('Encryption: The message to be encrypted');
  });

  // Validate that the FSM's expected onEnter/onExit actions (where visible) are observable:
  // - S0_Idle entry action: renderPage() -> inferred by rendered DOM
  // - S1_CipherGenerated entry action: displayCipher() -> expected to log 'Cipher:' but fails;
  //   we assert the attempted transition resulted in an error rather than a successful console message.
  test('FSM entry actions: renderPage visible; displayCipher attempted but failed with runtime error', async ({ page }) => {
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // renderPage(): presence of key UI elements demonstrates rendering occurred
    await expect(app.generateButton()).toBeVisible();
    expect(await (await app.generateButton().textContent())?.trim()).toBe('Generate Cipher');

    // Attempt the transition to S1 by clicking and capture the resulting error
    const errPromise = page.waitForEvent('pageerror');
    await app.clickGenerate();
    const err = await errPromise;
    expect(err).toBeTruthy();

    // Because displayCipher() would console.log 'Cipher:', assert that such a console message was NOT produced
    // and that instead an error exists indicating displayCipher failed during execution due to undefined key.
    expect(app.consoleContains('Cipher:')).toBe(false);
    const errMsg = String(err.message || err.toString()).toLowerCase();
    expect(errMsg).toMatch(/(publickey|not defined|referenceerror)/i);
  });

  // Defensive test: ensure clicking the button does not remove the button from DOM (UI stability)
  test('UI stability: clicking generate does not remove the Generate Cipher button (even on error)', async ({ page }) => {
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Click and swallow the pageerror (we'll wait but not fail the test because we expect an error)
    const p = page.waitForEvent('pageerror').catch(() => null);
    await app.clickGenerate();
    await p;

    // Button should still be present and visible for further interaction
    await expect(app.generateButton()).toBeVisible();
    // Ensure label remains unchanged
    const txt = (await app.generateButton().textContent()) || '';
    expect(txt.trim()).toBe('Generate Cipher');
  });
});