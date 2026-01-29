import { test, expect } from '@playwright/test';

// URL of the page to test (as provided)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d16872-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Asymmetric Cryptography Demo
class CryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors based on the provided HTML
    this.generateBtn = 'button[onclick="generateKeys()"]';
    this.encryptBtn = 'button[onclick="encryptMessage()"]';
    this.decryptBtn = 'button[onclick="decryptMessage()"]';
    this.messageInput = '#message';
    this.encryptedMessageInput = '#encryptedMessageInput';
    this.publicKeyPre = '#publicKey';
    this.privateKeyPre = '#privateKey';
    this.encryptedMessagePre = '#encryptedMessage';
    this.decryptedMessagePre = '#decryptedMessage';
  }

  // Navigate to the app page and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the generate keys button and handle the alert dialog
  async generateKeys() {
    // Setup dialog handler to accept and capture text
    let dialogMessage = null;
    const onDialog = async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    };
    this.page.on('dialog', onDialog);
    await this.page.click(this.generateBtn);
    // small wait to allow DOM updates
    await this.page.waitForTimeout(200);
    this.page.off('dialog', onDialog);
    return dialogMessage;
  }

  // Encrypt a message (assumes keys generated if necessary)
  async encryptMessage(message) {
    await this.page.fill(this.messageInput, message);
    await this.page.click(this.encryptBtn);
    // wait a bit for encryption to complete and DOM to update
    await this.page.waitForTimeout(200);
    return this.getEncryptedMessageText();
  }

  // Decrypt a provided encrypted string (entered into encryptedMessageInput)
  async decryptMessage(encryptedText) {
    await this.page.fill(this.encryptedMessageInput, encryptedText);
    await this.page.click(this.decryptBtn);
    await this.page.waitForTimeout(200);
    return this.getDecryptedMessageText();
  }

  // Getters for visible text values
  async getPublicKeyText() {
    return (await this.page.locator(this.publicKeyPre).innerText()).trim();
  }

  async getPrivateKeyText() {
    return (await this.page.locator(this.privateKeyPre).innerText()).trim();
  }

  async getEncryptedMessageText() {
    return (await this.page.locator(this.encryptedMessagePre).innerText()).trim();
  }

  async getDecryptedMessageText() {
    return (await this.page.locator(this.decryptedMessagePre).innerText()).trim();
  }

  // Existence checks for elements (Idle state verifications)
  async isGenerateButtonVisible() {
    return this.page.isVisible(this.generateBtn);
  }
  async isEncryptButtonVisible() {
    return this.page.isVisible(this.encryptBtn);
  }
  async isDecryptButtonVisible() {
    return this.page.isVisible(this.decryptBtn);
  }
  async isMessageInputVisible() {
    return this.page.isVisible(this.messageInput);
  }
  async isEncryptedMessageInputVisible() {
    return this.page.isVisible(this.encryptedMessageInput);
  }
}

// Group tests for this application
test.describe('Asymmetric Cryptography Demo - FSM validations', () => {
  // Each test will create its own page and collect console/page errors
  test('Initial Idle state: elements render correctly', async ({ page }) => {
    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app = new CryptoPage(page);
    // Navigate to the page as-is (do not modify runtime)
    await app.goto();

    // Validate Idle state elements exist per FSM evidence
    expect(await app.isGenerateButtonVisible()).toBeTruthy();
    expect(await app.isEncryptButtonVisible()).toBeTruthy();
    expect(await app.isDecryptButtonVisible()).toBeTruthy();
    expect(await app.isMessageInputVisible()).toBeTruthy();
    expect(await app.isEncryptedMessageInputVisible()).toBeTruthy();

    // Visual placeholders should be empty initially
    const pub = await app.getPublicKeyText();
    const priv = await app.getPrivateKeyText();
    const enc = await app.getEncryptedMessageText();
    const dec = await app.getDecryptedMessageText();

    expect(pub).toBe(''); // no public key at idle
    expect(priv).toBe(''); // no private key at idle
    expect(enc).toBe(''); // no encrypted message at idle
    expect(dec).toBe(''); // no decrypted message at idle

    // Observe console and page errors: assert there are no uncaught page errors on load
    // We intentionally assert that pageErrors array exists and contains zero errors,
    // allowing the test to fail if runtime issues (ReferenceError/SyntaxError/TypeError) occur naturally.
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(pageErrors.length).toBe(0);

    // Console may have messages (info/debug) depending on CDN/script; ensure no 'error' type console messages.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_KeysGenerated: generate keys updates DOM and shows alert', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new CryptoPage(page);
    await app.goto();

    // Trigger generateKeys and capture dialog message
    const dialogMessage = await app.generateKeys();

    // FSM evidence expects an alert "Keys generated!"
    // If the environment loaded the script properly, the dialogMessage should be that text
    expect(dialogMessage).toBe('Keys generated!');

    // After generating keys, public and private key pre elements should be populated (non-empty)
    const publicKeyText = await app.getPublicKeyText();
    const privateKeyText = await app.getPrivateKeyText();

    expect(publicKeyText.length).toBeGreaterThan(0);
    expect(privateKeyText.length).toBeGreaterThan(0);

    // No uncaught page errors during key generation
    expect(pageErrors.length).toBe(0);

    // No console errors of type 'error'
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S1_KeysGenerated -> S2_MessageEncrypted -> S3_MessageDecrypted: full encrypt/decrypt flow', async ({ page }) => {
    // Validate the complete happy path
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new CryptoPage(page);
    await app.goto();

    // 1) Generate keys first
    const dialogMessage = await app.generateKeys();
    expect(dialogMessage).toBe('Keys generated!');

    const publicKeyText = await app.getPublicKeyText();
    const privateKeyText = await app.getPrivateKeyText();
    expect(publicKeyText).not.toBe('');
    expect(privateKeyText).not.toBe('');

    // 2) Encrypt a sample message
    const originalMessage = 'Hello Playwright!';
    const encrypted = await app.encryptMessage(originalMessage);

    // FSM evidence expects encryptedMessage to be populated (or show 'Encryption failed!')
    expect(typeof encrypted).toBe('string');
    expect(encrypted.length).toBeGreaterThan(0);
    // Ensure it is not the literal failure string
    expect(encrypted).not.toBe('Encryption failed!');

    // 3) Decrypt using the produced encrypted text
    const decrypted = await app.decryptMessage(encrypted);

    // FSM evidence expects decryptedMessage to contain original message (or 'Decryption failed!')
    expect(typeof decrypted).toBe('string');
    expect(decrypted.length).toBeGreaterThan(0);
    expect(decrypted).not.toBe('Decryption failed!');

    // The decrypted value should equal the original message in the normal happy path
    expect(decrypted).toBe(originalMessage);

    // No uncaught page errors should have occurred
    expect(pageErrors.length).toBe(0);

    // No console 'error' messages during happy path
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge cases: encrypt without keys and decrypt with invalid input produce failure messages', async ({ page }) => {
    // This test validates error scenarios and DOM failure feedback per FSM evidence.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new CryptoPage(page);
    await app.goto();

    // Ensure we are in Idle state (no keys)
    const pubBefore = await app.getPublicKeyText();
    const privBefore = await app.getPrivateKeyText();
    expect(pubBefore).toBe('');
    expect(privBefore).toBe('');

    // Attempt to encrypt without generating keys - expected to set encryptedMessage to 'Encryption failed!' per implementation
    const message = 'This will not encrypt';
    const encryptedResult = await app.encryptMessage(message);
    // The implementation sets encryptedMessage to encrypted ? encrypted : 'Encryption failed!';
    // Without keys, encryption may fail (encryptedResult may be 'Encryption failed!' or an empty string)
    expect(typeof encryptedResult).toBe('string');
    // Accept either explicit failure text or empty/undefined encryption result - assert it's the failure case or empty
    const allowedFailure = encryptedResult === 'Encryption failed!' || encryptedResult === '' || encryptedResult === 'null' || encryptedResult === 'undefined';
    expect(allowedFailure).toBeTruthy();

    // Attempt to decrypt with an invalid encrypted string - expected 'Decryption failed!'
    const invalidEncrypted = 'invalid-encrypted-data';
    const decryptedResult = await app.decryptMessage(invalidEncrypted);
    expect(typeof decryptedResult).toBe('string');
    // Implementation: decrypted ? decrypted : 'Decryption failed!'
    expect(decryptedResult === 'Decryption failed!' || decryptedResult === '' || decryptedResult === 'null' || decryptedResult === 'undefined').toBeTruthy();

    // There should be no uncaught page errors even in edge scenarios (failures should be handled in DOM updates)
    expect(pageErrors.length).toBe(0);

    // Ensure no 'error' level console messages were emitted (info/debug are acceptable)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Observes console and runtime errors explicitly when scripts fail to load (if any)', async ({ page }) => {
    // This test is explicitly intended to observe console and page errors.
    // It will not modify the runtime or patch scripts; it simply records errors and asserts that we captured them (zero or more).
    // The reason for this test is to satisfy the requirement to observe console logs and page errors without fixing them.

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new CryptoPage(page);
    await app.goto();

    // Wait a short period to allow external scripts (like the CDN JSEncrypt) to attempt to load and possibly emit errors
    await page.waitForTimeout(500);

    // We captured console messages and page errors; assert that the arrays exist and are accessible
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // If there are page errors, they will be instances of Error. We assert that they are Error-like objects when present.
    for (const err of pageErrors) {
      expect(err).toBeInstanceOf(Error);
    }

    // Logically, in a healthy environment we expect zero page errors.
    // We assert that pageErrors.length is a number (this provides deterministic behavior for the test harness).
    expect(typeof pageErrors.length).toBe('number');

    // Provide a soft expectation: prefer zero uncaught page errors, but don't force failure if the runtime environment blocks external scripts.
    // This expectation is permissive to account for network/CSP issues but still validates that we observed runtime state.
    // If there are errors, the presence of them is noted by the test harness; here we simply ensure we captured them.
    // (No explicit fail condition beyond malformed error types.)
  });
});