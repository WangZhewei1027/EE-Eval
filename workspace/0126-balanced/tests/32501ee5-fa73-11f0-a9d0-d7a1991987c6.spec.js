import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/32501ee5-fa73-11f0-a9d0-d7a1991987c6.html';

// Helper to compute Caesar cipher same way as the page implementation
function caesarCipherLocal(str, shift) {
  return str.split('').map(char => {
    if (char.match(/[a-z]/i)) {
      const code = char.charCodeAt();
      const base = char <= 'Z' ? 65 : 97;
      return String.fromCharCode(((code - base + shift) % 26 + 26) % 26 + base);
    }
    return char;
  }).join('');
}

// Page Object for the Encryption page
class EncryptionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputText');
    this.output = page.locator('#outputText');
    this.encryptBtn = page.locator('button[onclick="encryptText()"]');
    this.decryptBtn = page.locator('button[onclick="decryptText()"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async enterInput(text) {
    await this.input.fill(text);
  }

  async clickEncrypt() {
    await this.encryptBtn.click();
  }

  async clickDecrypt() {
    await this.decryptBtn.click();
  }

  async getOutputValue() {
    return this.output.inputValue();
  }

  async isOutputReadonly() {
    return await this.output.getAttribute('readonly') !== null;
  }

  async getInputPlaceholder() {
    return this.input.getAttribute('placeholder');
  }

  async getOutputPlaceholder() {
    return this.output.getAttribute('placeholder');
  }
}

test.describe('Encryption Example - FSM States and Transitions', () => {
  // Collect console errors and page errors for each test run
  /** @type {Array<Error>} */
  let pageErrors;
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture unhandled page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Capture console messages of error severity
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
  });

  test.afterEach(async () => {
    // After each test make sure there were no uncaught page errors
    // This asserts that the page did not throw any ReferenceError/SyntaxError/TypeError during the test run.
    // If there are errors, include their messages to help debugging.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.map(m => m.text()).join(' | ')}`).toBe(0);
  });

  test('S0_Idle: initial rendering has input, buttons, and output present with correct placeholders and readonly', async ({ page }) => {
    // Validate Idle state UI (S0_Idle)
    const app = new EncryptionPage(page);
    await app.goto();

    // Check that input textarea exists and has correct placeholder
    const inputPlaceholder = await app.getInputPlaceholder();
    expect(inputPlaceholder).toBe('Type your message here...');

    // Check that both buttons exist and are visible
    await expect(app.encryptBtn).toBeVisible();
    await expect(app.decryptBtn).toBeVisible();
    expect(await app.encryptBtn.textContent()).toContain('Encrypt Text');
    expect(await app.decryptBtn.textContent()).toContain('Decrypt Text');

    // Check output textarea placeholder and readonly attribute
    const outputPlaceholder = await app.getOutputPlaceholder();
    expect(outputPlaceholder).toBe('Encrypted or Decrypted text will appear here...');
    const readonly = await app.isOutputReadonly();
    expect(readonly).toBe(true);

    // Ensure output is initially empty
    expect(await app.getOutputValue()).toBe('');
  });

  test('Transition S0_Idle -> S1_Encrypted: clicking Encrypt Text encrypts input using Caesar cipher shift=3', async ({ page }) => {
    // This test validates the EncryptText event and the resulting Encrypted state (S1_Encrypted)
    const app1 = new EncryptionPage(page);
    await app.goto();

    const original = 'abc XYZ! 123';
    await app.enterInput(original);

    // Click encrypt and assert output equals expected encrypted text
    await app.clickEncrypt();

    const expectedEncrypted = caesarCipherLocal(original, 3);
    const actualOutput = await app.getOutputValue();
    expect(actualOutput).toBe(expectedEncrypted);

    // Also check that non-letter characters are preserved (space, punctuation, digits)
    expect(actualOutput).toContain('!');
    expect(actualOutput).toMatch(/\d{3}$/); // '123' digits still present at end
  });

  test('Transition S1_Encrypted -> S2_Decrypted: clicking Decrypt Text decrypts output back to original', async ({ page }) => {
    // This test validates the DecryptText event and the resulting Decrypted state (S2_Decrypted)
    const app2 = new EncryptionPage(page);
    await app.goto();

    const original1 = 'Hello, World! ZzY';
    await app.enterInput(original);

    // First encrypt to reach S1_Encrypted
    await app.clickEncrypt();
    const encrypted = await app.getOutputValue();
    expect(encrypted).toBe(caesarCipherLocal(original, 3));

    // Now click decrypt to get back original (S2_Decrypted)
    await app.clickDecrypt();
    const decrypted = await app.getOutputValue();
    expect(decrypted).toBe(original);

    // Check that case is preserved and wrapping works (Z -> C)
    const wrapOriginal = 'xyz XYZ';
    await app.enterInput(wrapOriginal);
    await app.clickEncrypt();
    const wrapEncrypted = await app.getOutputValue();
    expect(wrapEncrypted).toBe(caesarCipherLocal(wrapOriginal, 3));
    await app.clickDecrypt();
    const wrapDecrypted = await app.getOutputValue();
    expect(wrapDecrypted).toBe(wrapOriginal);
  });

  test('Edge case: encrypting empty input yields empty output; decrypting empty output remains empty', async ({ page }) => {
    // Validate edge-case behavior: empty strings
    const app3 = new EncryptionPage(page);
    await app.goto();

    // Ensure input is empty and encryption yields empty output
    await app.enterInput('');
    await app.clickEncrypt();
    expect(await app.getOutputValue()).toBe('');

    // Decrypt when output is empty should keep it empty and not throw errors
    await app.clickDecrypt();
    expect(await app.getOutputValue()).toBe('');
  });

  test('Edge case: non-letter characters remain unchanged and uppercase/lowercase preserved across encrypt/decrypt', async ({ page }) => {
    const app4 = new EncryptionPage(page);
    await app.goto();

    const mixed = '1234 !@#$ AbCdEf';
    await app.enterInput(mixed);
    await app.clickEncrypt();
    const encrypted1 = await app.getOutputValue();

    // Verify digits and punctuation unchanged
    expect(encrypted).toContain('1234');
    expect(encrypted).toContain('!@#$');

    // Verify letters shifted and case preserved
    const expected = caesarCipherLocal(mixed, 3);
    expect(encrypted).toBe(expected);

    // Decrypt back
    await app.clickDecrypt();
    const decrypted1 = await app.getOutputValue();
    expect(decrypted).toBe(mixed);
  });

  test('Verify that no unexpected onEnter/onExit side-effects like missing renderPage call cause runtime errors', async ({ page }) => {
    // FSM references an entry action renderPage() for S0_Idle in the specification,
    // but the actual HTML/JS does not define such a function. This test ensures
    // that loading the page does not produce a runtime ReferenceError or other page errors.
    const app5 = new EncryptionPage(page);
    await app.goto();

    // Interact minimally to ensure no latent errors occur upon interacting with the app
    await app.enterInput('test');
    await app.clickEncrypt();
    await app.clickDecrypt();

    // Output should behave normally and there should be no pageerrors (checked in afterEach)
    expect(await app.getOutputValue()).toBe('test');
  });

  test('Observe console messages and page errors while performing multiple operations', async ({ page }) => {
    // This test exercises multiple operations and explicitly examines console output and page errors.
    const errors = [];
    const consoleErrs = [];

    page.on('pageerror', e => errors.push(e));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrs.push(msg);
    });

    const app6 = new EncryptionPage(page);
    await app.goto();

    // Perform a series of operations
    await app.enterInput('Multiple Runs XYZ');
    for (let i = 0; i < 3; i++) {
      await app.clickEncrypt();
      // small pause to allow script to run between interactions
      await page.waitForTimeout(50);
      await app.clickDecrypt();
      await page.waitForTimeout(50);
    }

    // The application should not produce any runtime errors
    expect(errors.length, `Observed page errors during multiple operations: ${errors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrs.length, `Observed console.error messages: ${consoleErrs.map(m => m.text()).join(' | ')}`).toBe(0);

    // Final output should match original input after last decrypt
    expect(await app.getOutputValue()).toBe('Multiple Runs XYZ');
  });
});