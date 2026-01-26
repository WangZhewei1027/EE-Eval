import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e2395-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object encapsulating interactions with the Symmetric Cryptography Demo page
class SymmetricDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.secretKey = page.locator('#secretKey');
    this.plaintext = page.locator('#plaintext');
    this.encryptButton = page.locator('button[onclick="encryptMessage()"]');
    this.decryptButton = page.locator('button[onclick="decryptMessage()"]');
    this.encryptedResult = page.locator('#encryptedResult');
    this.decryptedResult = page.locator('#decryptedResult');
    this.ciphertextOutput = page.locator('#ciphertextOutput');
    this.decryptedOutput = page.locator('#decryptedOutput');
    this.h1 = page.locator('h1');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setKey(value) {
    await this.secretKey.fill('');
    await this.secretKey.type(value);
  }

  async setPlaintext(value) {
    await this.plaintext.fill('');
    await this.plaintext.type(value);
  }

  async clickEncrypt() {
    await this.encryptButton.click();
  }

  async clickDecrypt() {
    // Decrypt button is nested inside encryptedResult; ensure it's available
    await this.decryptButton.click();
  }

  async getCiphertext() {
    return (await this.ciphertextOutput.textContent()) ?? '';
  }

  async getDecryptedText() {
    return (await this.decryptedOutput.textContent()) ?? '';
  }

  async isEncryptedVisible() {
    return await this.encryptedResult.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async isDecryptedVisible() {
    return await this.decryptedResult.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }
}

test.describe('Symmetric Cryptography Demo - FSM and interactions', () => {
  // Collect console and page errors for each test to assert there are no runtime errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages; we'll specifically track messages of type 'error'
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught exceptions reported by the page
    page.on('pageerror', (err) => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test('Initial state (S0_Idle) renders correctly and has no runtime errors', async ({ page }) => {
    // This test validates the initial Idle state: page renders title and results are hidden.
    const demo = new SymmetricDemoPage(page);
    await demo.navigate();

    // Verify page title heading exists as evidence of Idle state
    await expect(demo.h1).toHaveText('Symmetric Cryptography Demo');

    // At initial load, encrypted and decrypted result sections should be hidden
    expect(await demo.isEncryptedVisible()).toBe(false);
    expect(await demo.isDecryptedVisible()).toBe(false);

    // Verify the default inputs exist and contain expected default values from the HTML
    await expect(demo.secretKey).toHaveValue('mySuperSecretKey123');
    await expect(demo.plaintext).toHaveValue('This is a secret message!');

    // Assert that no console error messages were emitted during load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Console errors: ${JSON.stringify(errorConsoleMessages, null, 2)}`).toHaveLength(0);

    // Assert no uncaught page errors occurred
    expect(pageErrors, `Page errors: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Encrypt transition (S0_Idle -> S1_Encrypted) displays encrypted result and hides decrypted result', async ({ page }) => {
    // This test validates clicking Encrypt transitions the app to the Encrypted state.
    const demo = new SymmetricDemoPage(page);
    await demo.navigate();

    // Ensure inputs are populated (use defaults)
    const originalPlaintext = await demo.plaintext.inputValue();
    const originalKey = await demo.secretKey.inputValue();
    expect(originalPlaintext).not.toBe('');
    expect(originalKey).not.toBe('');

    // Click Encrypt and verify UI changes
    await demo.clickEncrypt();

    // Encrypted container should become visible
    await expect(demo.encryptedResult).toBeVisible();

    // Ciphertext output should be non-empty
    const ciphertext = await demo.getCiphertext();
    expect(ciphertext.length).toBeGreaterThan(0);

    // Decrypted result should remain hidden after encryption
    expect(await demo.isDecryptedVisible()).toBe(false);

    // Confirm style attribute resulted in display block for encryptedResult
    const displayStyle = await demo.encryptedResult.evaluate(el => window.getComputedStyle(el).display);
    expect(displayStyle === 'block' || displayStyle === 'flex' || displayStyle === 'inline-block').toBeTruthy();

    // Assert no runtime errors happened during encryption
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Console errors during encrypt: ${JSON.stringify(errorConsoleMessages, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors during encrypt: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Decrypt transition (S1_Encrypted -> S2_Decrypted) reveals decrypted result matching plaintext', async ({ page }) => {
    // This test validates that after encryption, clicking Decrypt reveals the original plaintext.
    const demo = new SymmetricDemoPage(page);
    await demo.navigate();

    // Ensure a known plaintext and key
    const knownPlaintext = 'This is a secret message!';
    const knownKey = 'mySuperSecretKey123';
    await demo.setPlaintext(knownPlaintext);
    await demo.setKey(knownKey);

    // Encrypt first
    await demo.clickEncrypt();
    await expect(demo.encryptedResult).toBeVisible();

    // Now click Decrypt and verify decrypted output matches original plaintext
    await demo.clickDecrypt();
    await expect(demo.decryptedResult).toBeVisible();

    const decryptedText = await demo.getDecryptedText();
    expect(decryptedText).toBe(knownPlaintext);

    // Verify decryptedResult style is visible (block)
    const displayStyle = await demo.decryptedResult.evaluate(el => window.getComputedStyle(el).display);
    expect(displayStyle === 'block' || displayStyle === 'flex' || displayStyle === 'inline-block').toBeTruthy();

    // Assert no runtime errors happened during decrypt
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Console errors during decrypt: ${JSON.stringify(errorConsoleMessages, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors during decrypt: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Edge case: clicking Encrypt with missing key shows alert and does not reveal encrypted result', async ({ page }) => {
    // Validates the error scenario where user omits the key and clicks Encrypt.
    const demo = new SymmetricDemoPage(page);
    await demo.navigate();

    // Clear the key to simulate missing input
    await demo.setKey('');
    // Keep plaintext populated
    await demo.setPlaintext('Hello');

    // Listen for dialog and assert message
    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await demo.clickEncrypt();

    // We expect an alert to have been shown with the specific message
    expect(dialogMessage).toBe('Please enter both a key and a message');

    // Encrypted result should remain hidden after the validation alert
    expect(await demo.isEncryptedVisible()).toBe(false);

    // Assert no uncaught runtime errors (alerts are expected, not errors)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Console errors when missing key: ${JSON.stringify(errorConsoleMessages, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors when missing key: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Edge case: clicking Encrypt with missing plaintext shows alert and does not reveal encrypted result', async ({ page }) => {
    // Validates the error scenario where user omits the plaintext and clicks Encrypt.
    const demo = new SymmetricDemoPage(page);
    await demo.navigate();

    // Clear the plaintext to simulate missing input
    await demo.setPlaintext('');
    // Ensure key exists
    await demo.setKey('someValidKey123456');

    // Listen for dialog and assert message
    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await demo.clickEncrypt();

    // We expect an alert to have been shown with the specific message
    expect(dialogMessage).toBe('Please enter both a key and a message');

    // Encrypted result should remain hidden after the validation alert
    expect(await demo.isEncryptedVisible()).toBe(false);

    // Assert no uncaught runtime errors (alerts are expected, not errors)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Console errors when missing plaintext: ${JSON.stringify(errorConsoleMessages, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors when missing plaintext: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Different keys produce different ciphertexts and decrypt returns original with correct key', async ({ page }) => {
    // This test asserts that ciphertext depends on the key and decryption with correct key recovers the plaintext.
    const demo = new SymmetricDemoPage(page);
    await demo.navigate();

    const plaintext = 'Unique message content 42';

    // Use first key
    await demo.setPlaintext(plaintext);
    await demo.setKey('KeyOne_1234567890');
    await demo.clickEncrypt();
    const ciphertext1 = await demo.getCiphertext();
    expect(ciphertext1.length).toBeGreaterThan(0);

    // Decrypt with same key and verify match
    await demo.clickDecrypt();
    const decrypted1 = await demo.getDecryptedText();
    expect(decrypted1).toBe(plaintext);

    // Now change key and encrypt again
    await demo.setKey('AnotherKey987654321');
    // Change plaintext slightly to ensure content flows through encryption pipeline
    await demo.setPlaintext(plaintext);
    await demo.clickEncrypt();
    const ciphertext2 = await demo.getCiphertext();

    // Ciphertexts with different keys should differ (very high probability given XOR-based simulation)
    expect(ciphertext2).not.toBe(ciphertext1);

    // Decrypt with the new correct key
    await demo.clickDecrypt();
    const decrypted2 = await demo.getDecryptedText();
    expect(decrypted2).toBe(plaintext);

    // No runtime errors observed during these operations
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Console errors during key-diff test: ${JSON.stringify(errorConsoleMessages, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors during key-diff test: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });
});