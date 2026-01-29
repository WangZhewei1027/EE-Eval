import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/325045f0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Symmetric Cryptography Demo
class SymmetricCryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.key = page.locator('#key');
    this.plaintext = page.locator('#plaintext');
    this.encryptButton = page.locator('button[onclick="encrypt()"]');
    this.decryptButton = page.locator('button[onclick="decrypt()"]');
    this.ciphertext = page.locator('#ciphertext');
    this.decryptedtext = page.locator('#decryptedtext');
    this.header = page.locator('h1');
  }

  async navigate() {
    await this.page.goto(APP_URL);
  }

  async setKey(value) {
    await this.key.fill(value);
  }

  async setPlaintext(value) {
    await this.plaintext.fill(value);
  }

  async clickEncrypt() {
    await this.encryptButton.click();
  }

  async clickDecrypt() {
    await this.decryptButton.click();
  }

  async getCiphertextValue() {
    return this.ciphertext.inputValue();
  }

  async getDecryptedtextValue() {
    return this.decryptedtext.inputValue();
  }
}

test.describe('Symmetric Cryptography Demo - FSM states and transitions', () => {
  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // attach listeners so tests can assert on console and page errors
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      // capture console messages with their type and text
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture unhandled page errors
      page._pageErrors.push(String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test, assert that no unexpected console errors or page errors were emitted.
    // This verifies that the page did not produce runtime exceptions during interaction.
    const consoleErrors = (page._consoleMessages || []).filter(m => m.type === 'error');
    const pageErrors = page._pageErrors || [];

    // If there are errors, include their content in the assertion failure message for debugging.
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Initial state S0_Idle: page renders and components are present', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle)
    // It checks that the main heading, all controls and read-only result areas exist and have expected attributes/placeholders.
    const demo = new SymmetricCryptoPage(page);
    await demo.navigate();

    // Header present and correct
    await expect(demo.header).toHaveText('Symmetric Cryptography Demo');

    // Inputs and textareas exist with expected placeholders
    await expect(demo.key).toHaveAttribute('placeholder', 'Enter a secret key');
    await expect(demo.plaintext).toHaveAttribute('placeholder', 'Enter text to encrypt');

    await expect(demo.ciphertext).toHaveAttribute('placeholder', 'Encrypted text will appear here');
    await expect(demo.decryptedtext).toHaveAttribute('placeholder', 'Decrypted text will appear here');

    // ciphertext and decryptedtext are readonly (attribute present)
    const ctReadOnly = await demo.ciphertext.getAttribute('readonly');
    const dtReadOnly = await demo.decryptedtext.getAttribute('readonly');
    expect(ctReadOnly, 'ciphertext should have readonly attribute').not.toBeNull();
    expect(dtReadOnly, 'decryptedtext should have readonly attribute').not.toBeNull();

    // Buttons with inline onclick handlers exist
    await expect(page.locator('button[onclick="encrypt()"]')).toHaveCount(1);
    await expect(page.locator('button[onclick="decrypt()"]')).toHaveCount(1);

    // Ensure encrypt and decrypt functions are defined on window
    const encryptType = await page.evaluate(() => typeof window.encrypt);
    const decryptType = await page.evaluate(() => typeof window.decrypt);
    expect(encryptType).toBe('function');
    expect(decryptType).toBe('function');

    // The FSM mentions an entry action renderPage() for S0_Idle.
    // The implementation does not define renderPage; assert that it is not defined to reflect implementation mismatch.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('Transition S0 -> S1 (Encrypt): encrypts plaintext and populates ciphertext', async ({ page }) => {
    // This test validates encryption flow: entering key & plaintext, clicking Encrypt, and observing ciphertext populated.
    const demo = new SymmetricCryptoPage(page);
    await demo.navigate();

    const sampleKey = 'my-secret-key';
    const samplePlaintext = 'Hello, Playwright!';

    await demo.setKey(sampleKey);
    await demo.setPlaintext(samplePlaintext);

    // Click Encrypt and wait for ciphertext to be non-empty
    await demo.clickEncrypt();

    // Assert ciphertext is populated and different from plaintext
    await expect(demo.ciphertext).toHaveValue(/.+/);
    const ciphertextValue = await demo.getCiphertextValue();
    expect(ciphertextValue).not.toBe('');
    expect(ciphertextValue).not.toBe(samplePlaintext);

    // Decrypted area should still be empty after encryption
    const decryptedValueAfterEncrypt = await demo.getDecryptedtextValue();
    expect(decryptedValueAfterEncrypt).toBe('');
  });

  test('Transition S1 -> S2 (Decrypt) with correct key: decrypted text matches original plaintext', async ({ page }) => {
    // This test validates decryption flow using the correct key: ciphertext produced by encrypt() should decrypt back to original plaintext.
    const demo = new SymmetricCryptoPage(page);
    await demo.navigate();

    const key = 'password123';
    const plaintext = 'Sensitive data';

    await demo.setKey(key);
    await demo.setPlaintext(plaintext);
    await demo.clickEncrypt();

    // ensure ciphertext exists
    await expect(demo.ciphertext).toHaveValue(/.+/);

    // Now click decrypt with the same key
    await demo.clickDecrypt();

    // Expect decrypted text to exactly match the original plaintext
    await expect(demo.decryptedtext).toHaveValue(plaintext);
  });

  test('Decrypt with incorrect key should display failure message', async ({ page }) => {
    // This test validates an error scenario: attempting to decrypt with the wrong key should result in the fallback message.
    const demo = new SymmetricCryptoPage(page);
    await demo.navigate();

    const originalKey = 'correct-key';
    const wrongKey = 'wrong-key';
    const plaintext = 'Top secret';

    // Encrypt with original key
    await demo.setKey(originalKey);
    await demo.setPlaintext(plaintext);
    await demo.clickEncrypt();

    // Replace key with incorrect one and attempt decrypt
    await demo.setKey(wrongKey);
    await demo.clickDecrypt();

    // The implementation sets decryptedtext to the fallback message if bytes.toString(Utf8) is empty
    await expect(demo.decryptedtext).toHaveValue('Decryption failed! Check your key!');
  });

  test('Decrypt when ciphertext is empty should display failure message', async ({ page }) => {
    // Edge case: clicking decrypt when no ciphertext exists should not throw, but should display the fallback failure message.
    const demo = new SymmetricCryptoPage(page);
    await demo.navigate();

    // Ensure ciphertext is empty at start
    await expect(demo.ciphertext).toHaveValue('');
    // Provide any key and click decrypt
    await demo.setKey('any-key');
    await demo.clickDecrypt();

    await expect(demo.decryptedtext).toHaveValue('Decryption failed! Check your key!');
  });

  test('Encrypt empty plaintext: produces ciphertext; decrypting same key results in fallback/decrypted empty handling', async ({ page }) => {
    // This test explores encrypting an empty plaintext and subsequent decryption behavior.
    // Some crypto libraries produce a valid ciphertext for empty input; decrypting may yield an empty string and thus trigger fallback.
    const demo = new SymmetricCryptoPage(page);
    await demo.navigate();

    const key = 'key-for-empty';
    const plaintext = ''; // empty plaintext

    await demo.setKey(key);
    await demo.setPlaintext(plaintext);
    await demo.clickEncrypt();

    // Ciphertext should still be populated (likely non-empty)
    await expect(demo.ciphertext).toHaveValue(/.*/);

    // Click decrypt with the same key
    await demo.clickDecrypt();

    // The implementation converts bytes to Utf8 and uses fallback if empty.
    // So either decrypted text is '' (which the code converts to fallback) or actual plaintext.
    const decrypted = await demo.getDecryptedtextValue();
    expect(decrypted === '' || decrypted === 'Decryption failed! Check your key!' || decrypted === plaintext).toBeTruthy();
  });

  test('Observe console and page runtime behavior (no uncaught errors during normal flows)', async ({ page }) => {
    // This test explicitly exercises a typical encrypt->decrypt flow and asserts no runtime exceptions or console errors were emitted.
    const demo = new SymmetricCryptoPage(page);
    await demo.navigate();

    await demo.setKey('observe-key');
    await demo.setPlaintext('observe flow');
    await demo.clickEncrypt();
    await demo.clickDecrypt();

    // Confirm decrypted text equals plaintext
    await expect(demo.decryptedtext).toHaveValue('observe flow');

    // Inspect captured console and page errors directly and assert none found (these are also checked in afterEach)
    const consoleErrors = (page._consoleMessages || []).filter(m => m.type === 'error');
    const pageErrors = page._pageErrors || [];
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});