import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/325045f3-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object Model for the Digital Signatures Demo page
class DigitalSignaturesPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.message = page.locator('#message');
    this.signButton = page.locator('#signButton');
    this.verifyButton = page.locator('#verifyButton');
    this.result = page.locator('#result');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the heading to ensure page "rendered"
    await expect(this.heading).toHaveText('Digital Signatures Demonstration');
  }

  async fillMessage(text) {
    await this.message.fill(text);
  }

  async clickSign() {
    await this.signButton.click();
  }

  async clickVerify() {
    await this.verifyButton.click();
  }

  async getResultText() {
    return await this.result.innerText();
  }

  async getResultHTML() {
    return await this.result.innerHTML();
  }
}

test.describe('Digital Signatures Demonstration - FSM validation', () => {
  let page;
  let app;
  // collectors for console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // create a new context/page per test to avoid cross-test state
    page = await browser.newPage();
    app = new DigitalSignaturesPage(page);

    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect page errors (uncaught exceptions on the page)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Load the application page as-is
    await app.goto();
  });

  test.afterEach(async () => {
    // Basic teardown
    await page.close();
  });

  test('Initial Idle state (S0_Idle) renders correctly', async () => {
    // This test validates the S0_Idle state entry actions (renderPage())
    // Check visual elements existence and initial content
    await expect(app.heading).toHaveText('Digital Signatures Demonstration');
    await expect(app.message).toHaveAttribute('placeholder', 'Enter your message here...');
    await expect(app.signButton).toHaveText('Sign Message');
    await expect(app.verifyButton).toHaveText('Verify Signature');

    // Initially, #result should be empty
    const resultText = await app.getResultText();
    expect(resultText.trim()).toBe('', 'Expected result div to be empty in Idle state');

    // Validate that we captured console messages array (could be empty) and no page errors occurred during initial render
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
    // Assert there were no page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Signing a message transitions to Message Signed (S1_Signed)', async () => {
    // This test covers the SignMessage event and transition S0_Idle -> S1_Signed
    const sampleMessage = 'Hello Playwright';

    // Fill the message textarea
    await app.fillMessage(sampleMessage);

    // Click the sign button and wait for the result text to update
    await Promise.all([
      // the click triggers async crypto ops; wait for result to contain the signed message text
      app.clickSign(),
      app.result.waitFor({ state: 'visible', timeout: 10000 }),
    ]);

    // Get the result and verify expected observables from the FSM
    const resultHTML = await app.getResultHTML();
    expect(resultHTML).toContain('Message Signed!', 'Result should indicate the message was signed');
    expect(resultHTML).toContain('Signature (Base64):', 'Result should include the signature label');

    // Extract the Base64 signature substring after the colon if present
    // We make a forgiving extraction to support minor spacing/linebreak differences
    const base64Match = resultHTML.match(/Signature \(Base64\):\s*([A-Za-z0-9+/=]+)/);
    expect(base64Match).not.toBeNull();
    const signatureBase64 = base64Match ? base64Match[1] : '';
    expect(signatureBase64.length).toBeGreaterThan(0);

    // Basic sanity check: signature looks like base64 (characters allowed)
    expect(/^[A-Za-z0-9+/=]+$/.test(signatureBase64)).toBe(true);

    // Ensure no page errors occurred during signing
    expect(pageErrors.length).toBe(0);

    // Ensure no console error-level messages were emitted
    const errorLogs = consoleMessages.filter((m) => m.type === 'error');
    expect(errorLogs.length).toBe(0);
  });

  test('Verifying the signature transitions to Message Verified (S2_Verified) and shows Valid Signature', async () => {
    // This test validates the VerifySignature event and transition S1_Signed -> S2_Verified
    const sampleMessage1 = 'Verify me';

    // Sign first
    await app.fillMessage(sampleMessage);

    // Click sign and wait for the result to be present
    await Promise.all([app.clickSign(), app.result.waitFor({ state: 'visible', timeout: 10000 })]);

    // Now click verify
    await app.clickVerify();

    // After verification, the result should include verification result text
    // The app appends the verification result to the existing result HTML
    // Wait for the result to contain the verification string
    await expect(app.result).toContainText('Verification Result:', { timeout: 10000 });

    const resultText1 = await app.getResultText();

    // It should indicate a valid signature (since we signed then verified)
    expect(resultText).toMatch(/Verification Result:\s*(Valid Signature|Invalid Signature)/);

    // Preferably it should be 'Valid Signature'
    expect(resultText).toContain('Valid Signature');

    // Verify that both signed and verification labels are present
    expect(resultText).toContain('Message Signed!');
    expect(resultText).toContain('Signature (Base64):');
    expect(resultText).toContain('Verification Result:');

    // Ensure there were no uncaught page errors during verify
    expect(pageErrors.length).toBe(0);

    // Ensure no console error-level messages were emitted
    const errorLogs1 = consoleMessages.filter((m) => m.type === 'error');
    expect(errorLogs.length).toBe(0);
  });

  test('Edge case: Clicking Sign without a message triggers an alert', async () => {
    // This test ensures the application handles empty message input when signing (should alert)
    // Ensure textarea is empty
    await app.fillMessage('');

    // Listen for the alert dialog
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      // Trigger the sign click which should produce an alert and not proceed
      app.clickSign(),
    ]);

    // Assert the dialog message matches expected alert text from implementation
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Please enter a message.');

    // Accept the alert to allow script to continue
    await dialog.accept();

    // Ensure result is still empty since sign should not have proceeded
    const resultText2 = await app.getResultText();
    expect(resultText.trim()).toBe('', 'Result should remain empty after attempting to sign an empty message');
  });

  test('Edge case: Clicking Verify before signing triggers an alert', async () => {
    // This test ensures verifying before signing is handled with an alert
    // Ensure textarea is empty and signature not present
    await app.fillMessage('');

    // Listen for the alert dialog on verify
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.clickVerify(),
    ]);

    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Please sign a message first to verify.');
    await dialog.accept();

    // Confirm result remains unchanged / empty
    const resultText3 = await app.getResultText();
    expect(resultText.trim()).toBe('', 'Result should remain empty after verify attempt without a signature');
  });

  test('Captures console messages and page errors during full workflow', async () => {
    // This test demonstrates observation of console and page errors while performing sign+verify
    const sampleMessage2 = 'Watch console';

    // Clear collectors first
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Sign
    await app.fillMessage(sampleMessage);
    await Promise.all([app.clickSign(), app.result.waitFor({ state: 'visible', timeout: 10000 })]);

    // Verify
    await app.clickVerify();
    await expect(app.result).toContainText('Verification Result:', { timeout: 10000 });

    // At this point we've observed console messages and page errors arrays
    // Assert that the collectors are arrays (they may be empty depending on runtime)
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // If there are page errors, surface them to make debugging easier (fail the test)
    if (pageErrors.length > 0) {
      // Build a descriptive message
      const errorMessages = pageErrors.map((e) => e.stack || e.message || String(e)).join('\n---\n');
      throw new Error(`Page had ${pageErrors.length} error(s):\n${errorMessages}`);
    }

    // Also fail if any console 'error' level messages appeared
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    if (consoleErrors.length > 0) {
      const msgs = consoleErrors.map((m) => m.text).join('\n---\n');
      throw new Error(`Console had ${consoleErrors.length} error-level message(s):\n${msgs}`);
    }

    // If no errors, assert that we at least captured some console messages or that workflow succeeded
    expect(await app.getResultText()).toContain('Message Signed!');
    expect(await app.getResultText()).toContain('Verification Result:');
  });
});