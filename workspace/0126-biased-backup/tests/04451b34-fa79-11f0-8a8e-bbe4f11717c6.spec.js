import { test, expect } from '@playwright/test';

// Test file for Application ID: 04451b34-fa79-11f0-8a8e-bbe4f11717c6
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/04451b34-fa79-11f0-8a8e-bbe4f11717c6.html
// This suite validates the FSM states/transitions described for the Encryption interactive app.
// It also observes console logs and uncaught page errors (ReferenceError, SyntaxError, TypeError etc.)
// and asserts on their presence/absence after interactions.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04451b34-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object Model for the Encryption page
class EncryptionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.encryptButton = page.locator('#encrypt-button');
    this.decryptButton = page.locator('#decrypt-button');
  }

  // Navigate to the app and wait for key elements to be attached
  async load() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure the key elements exist in the DOM
    await expect(this.encryptButton).toBeAttached();
    await expect(this.decryptButton).toBeAttached();
  }

  // Click the Encrypt button
  async clickEncrypt() {
    await this.encryptButton.click();
  }

  // Click the Decrypt button
  async clickDecrypt() {
    // Using click even if disabled - the test will assert that the disabled state prevents behavior
    await this.decryptButton.click();
  }

  // Return whether the decrypt button has disabled attribute set (true if disabled)
  async isDecryptDisabled() {
    // Use getAttribute because disabled attr may be present or absent
    const attr = await this.decryptButton.getAttribute('disabled');
    // When attribute is present (even as empty string) it is considered disabled
    return attr !== null;
  }

  // Read button text content for both buttons
  async getEncryptText() {
    return await this.encryptButton.textContent();
  }
  async getDecryptText() {
    return await this.decryptButton.textContent();
  }
}

test.describe('Encryption App - FSM validation and error observation', () => {
  // Arrays to collect console errors and page errors per test
  let consoleErrors;
  let consoleMessages;
  let pageErrors;
  let encryptionPage;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Listen for console events
    page.on('console', msg => {
      // Collect console text and severity for debugging and assertions
      const type = msg.type(); // e.g., 'log', 'error', 'warning'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Listen for uncaught exceptions on the page
    page.on('pageerror', error => {
      // Collect the Error object - this will capture ReferenceError/SyntaxError/TypeError etc.
      pageErrors.push(error);
    });

    encryptionPage = new EncryptionPage(page);
    await encryptionPage.load();
  });

  test.afterEach(async ({}) => {
    // After each test, assert there were no unexpected console errors or uncaught page errors.
    // We capture them and assert they are empty. If the application naturally emits such errors,
    // these assertions will fail, which is intended because we are observing errors naturally.
    // The test suite does not patch or fix any runtime issues.
    // Provide diagnostic details in assertion messages for easier debugging.
    expect(
      consoleErrors.length,
      `Expected no console.error messages, got ${consoleErrors.length}. Console errors: ${JSON.stringify(consoleErrors, null, 2)}`
    ).toBe(0);

    expect(
      pageErrors.length,
      `Expected no uncaught page errors, got ${pageErrors.length}. Page errors: ${pageErrors.map(e => e.message).join(' | ')}`
    ).toBe(0);
  });

  test('Initial state (S0_Idle): Encrypt button present and Decrypt button disabled', async () => {
    // Validate initial FSM state S0_Idle according to the FSM evidence:
    // - Encrypt button exists and is enabled
    // - Decrypt button exists and is disabled
    const encryptText = await encryptionPage.getEncryptText();
    const decryptText = await encryptionPage.getDecryptText();
    expect(encryptText.trim()).toBe('Encrypt');
    expect(decryptText.trim()).toBe('Decrypt');

    const decryptDisabled = await encryptionPage.isDecryptDisabled();
    expect(decryptDisabled).toBe(true);

    // Additional sanity: ensure clicking the encrypt button is possible
    await expect(encryptionPage.encryptButton).toBeEnabled();
    await expect(encryptionPage.decryptButton).toBeDisabled();
  });

  test('Transition: Encrypt -> Encrypted (S0_Idle to S1_Encrypted) enables Decrypt button', async () => {
    // This validates the EncryptButtonClick event and the transition action:
    // document.getElementById('decrypt-button').disabled = false;
    // Precondition: Decrypt disabled
    expect(await encryptionPage.isDecryptDisabled()).toBe(true);

    // Action: click Encrypt
    await encryptionPage.clickEncrypt();

    // Postcondition: Decrypt should be enabled (S1_Encrypted)
    await expect(encryptionPage.decryptButton).toBeEnabled();
    expect(await encryptionPage.isDecryptDisabled()).toBe(false);
  });

  test('Transition: Decrypt -> Idle (S1_Encrypted to S0_Idle) disables Decrypt button after decrypting', async () => {
    // To test decrypt action, first go to Encrypted state by clicking Encrypt
    await encryptionPage.clickEncrypt();
    await expect(encryptionPage.decryptButton).toBeEnabled();
    expect(await encryptionPage.isDecryptDisabled()).toBe(false);

    // Now click Decrypt to transition back
    await encryptionPage.clickDecrypt();

    // After clicking Decrypt, the decrypt button should be disabled again per transition action
    await expect(encryptionPage.decryptButton).toBeDisabled();
    expect(await encryptionPage.isDecryptDisabled()).toBe(true);
  });

  test('Edge case: Clicking disabled Decrypt button should do nothing and produce no errors', async () => {
    // Precondition: Decrypt is disabled
    expect(await encryptionPage.isDecryptDisabled()).toBe(true);

    // Attempt to click the disabled decrypt button.
    // Playwright might still perform the click call, but the application should not change state.
    // We don't intercept or change app behavior; we simply perform the user action.
    await encryptionPage.clickDecrypt();

    // Validate state unchanged: decrypt still disabled
    expect(await encryptionPage.isDecryptDisabled()).toBe(true);

    // Also ensure encrypt remains present and enabled
    await expect(encryptionPage.encryptButton).toBeEnabled();
  });

  test('Repeated interactions and idempotence: multiple Encrypt clicks keep Decrypt enabled; Decrypt once disables', async () => {
    // Click Encrypt multiple times
    await encryptionPage.clickEncrypt();
    await encryptionPage.clickEncrypt();
    await encryptionPage.clickEncrypt();

    // Decrypt should be enabled
    await expect(encryptionPage.decryptButton).toBeEnabled();
    expect(await encryptionPage.isDecryptDisabled()).toBe(false);

    // Now click Decrypt once to return to idle
    await encryptionPage.clickDecrypt();

    // Decrypt should be disabled again
    await expect(encryptionPage.decryptButton).toBeDisabled();
    expect(await encryptionPage.isDecryptDisabled()).toBe(true);
  });

  test('DOM evidence checks: ensure expected buttons markup persists', async () => {
    // Check the raw attributes via getAttribute
    const decryptAttr = await encryptionPage.decryptButton.getAttribute('disabled');
    // Initially disabled attribute should be present
    expect(decryptAttr !== null).toBe(true);

    // After encrypt it should be removed
    await encryptionPage.clickEncrypt();
    const decryptAttrAfter = await encryptionPage.decryptButton.getAttribute('disabled');
    expect(decryptAttrAfter).toBeNull();

    // After decrypt it should return
    await encryptionPage.clickDecrypt();
    const decryptAttrFinal = await encryptionPage.decryptButton.getAttribute('disabled');
    expect(decryptAttrFinal !== null).toBe(true);
  });

  test('Console and page error observation: capture and assert no ReferenceError/SyntaxError/TypeError occurred', async ({ page }) => {
    // This test specifically exercises capturing of console and page errors during interactions.
    // Perform normal interactions
    await encryptionPage.clickEncrypt();
    await encryptionPage.clickDecrypt();

    // At this point, our afterEach will assert no console errors / page errors.
    // Additionally, we perform explicit checks here to provide extra diagnostics if needed.

    // Ensure no console.error messages were captured
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);

    // Ensure no page errors of common runtime error types were emitted
    const runtimeErrorNames = pageErrors.map(e => e.name || '');
    const hasRuntimeError = runtimeErrorNames.some(name =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(name)
    );
    expect(hasRuntimeError).toBe(false);
  });
});