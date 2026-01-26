import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/325045f1-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object encapsulating interactions with the demo
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generateKeys');
    this.encryptBtn = page.locator('#encryptMessage');
    this.decryptBtn = page.locator('#decryptMessage');
    this.publicKey = page.locator('#publicKey');
    this.privateKey = page.locator('#privateKey');
    this.message = page.locator('#message');
    this.encrypted = page.locator('#encryptedMessage');
    this.decrypted = page.locator('#decryptedMessage');
    this.box = page.locator('#box');
  }

  async goto() {
    await this.page.goto(APP_URL);
    await expect(this.box).toBeVisible();
  }

  // Click generate keys and capture the dialog that the page shows (alert)
  async generateKeysAndAcceptAlert() {
    // The page triggers an alert; wait for it and accept
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.generateBtn.click()
    ]);
    // Accepting the dialog - preserves app flow
    await dialog.accept();
    return dialog;
  }

  async clickEncrypt() {
    await this.encryptBtn.click();
  }

  async clickDecrypt() {
    await this.decryptBtn.click();
  }

  async typeMessage(text) {
    await this.message.fill(text);
  }

  async getPublicKeyText() {
    return (await this.publicKey.textContent()) || '';
  }

  async getPrivateKeyText() {
    return (await this.privateKey.textContent()) || '';
  }

  async getEncryptedText() {
    return (await this.encrypted.textContent()) || '';
  }

  async getDecryptedText() {
    return (await this.decrypted.textContent()) || '';
  }
}

test.describe('Asymmetric Cryptography Demo (FSM verification)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Also auto-accept any dialogs so tests don't hang unexpectedly.
    page.on('dialog', async (dialog) => {
      try {
        await dialog.accept();
      } catch (e) {
        // ignore acceptance errors - page might have already handled it
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected page errors remained unasserted in tests
    // Tests that expect errors will assert them explicitly; for other tests we assert none occurred.
    // (If page already closed, nothing to do)
    // This is intentionally left lightweight; specific tests verify expected errors.
  });

  test('Initial state S0_Idle: UI renders and buttons are in expected initial state', async ({ page }) => {
    // Validate initial UI elements and that encrypt/decrypt are disabled
    const app = new AppPage(page);
    await app.goto();

    // Evidence for S0_Idle: Generate Keys button exists
    await expect(app.generateBtn).toBeVisible();
    await expect(app.generateBtn).toBeEnabled();

    // Encrypt and Decrypt should be disabled in Idle
    await expect(app.encryptBtn).toBeVisible();
    await expect(app.encryptBtn).toBeDisabled();
    await expect(app.decryptBtn).toBeVisible();
    await expect(app.decryptBtn).toBeDisabled();

    // Pre elements for keys and messages should exist but be empty
    expect(await app.getPublicKeyText()).toBe('');
    expect(await app.getPrivateKeyText()).toBe('');
    expect(await app.getEncryptedText()).toBe('');
    expect(await app.getDecryptedText()).toBe('');

    // No page errors or console errors at initial load
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: Generate Keys enables encrypt/decrypt and populates keys (and shows alert)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Click "Generate Keys" and accept alert (captured by generateKeysAndAcceptAlert)
    const dialog = await app.generateKeysAndAcceptAlert();
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toMatch(/Keys generated successfully/i);

    // After keys generated, public/private key areas should be populated with base64 text
    const pub = await app.getPublicKeyText();
    const priv = await app.getPrivateKeyText();

    expect(pub.length).toBeGreaterThan(0);
    expect(priv.length).toBeGreaterThan(0);

    // Encrypt and decrypt buttons should now be enabled
    await expect(app.encryptBtn).toBeEnabled();
    await expect(app.decryptBtn).toBeEnabled();

    // No unexpected page errors produced by key generation
    expect(pageErrors.length).toBe(0);
  }).timeout(60000); // key generation may take some time

  test('Transition S1 -> S2: Encrypt Message produces an encrypted output', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Generate keys first
    await app.generateKeysAndAcceptAlert();

    // Provide a message and click encrypt
    const original = 'Hello Playwright!';
    await app.typeMessage(original);

    // Click encrypt and wait for the encrypted output to appear
    await app.clickEncrypt();

    // The encrypted message should be populated and look like base64 text
    const encrypted = await app.getEncryptedText();
    expect(encrypted.length).toBeGreaterThan(0);
    // Basic base64 character sanity check
    expect(/^[A-Za-z0-9+/=]+$/.test(encrypted)).toBeTruthy();

    // Ensure that encrypt did not produce runtime page errors
    expect(pageErrors.length).toBe(0);
  }).timeout(60000);

  test('Transition S2 -> S3: Decrypt Message recovers original plaintext', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Generate keys
    await app.generateKeysAndAcceptAlert();

    // Write message
    const original = 'This is a secret message.';
    await app.typeMessage(original);

    // Encrypt
    await app.clickEncrypt();

    // Ensure encrypted present
    const encrypted = await app.getEncryptedText();
    expect(encrypted.length).toBeGreaterThan(0);

    // Decrypt
    await app.clickDecrypt();

    // Decrypted message should match original
    // Wait for potential async decryption to complete and update DOM
    await expect.poll(async () => (await app.getDecryptedText()), {
      timeout: 10000,
      message: 'Waiting for decrypted message to appear and match original'
    }).toEqual(original);

    // No unhandled runtime errors expected here
    expect(pageErrors.length).toBe(0);
  }).timeout(60000);

  test('Edge case: Encrypt and Decrypt buttons are disabled before keys generated and direct click fails or is inert', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Buttons should be disabled
    await expect(app.encryptBtn).toBeDisabled();
    await expect(app.decryptBtn).toBeDisabled();

    // Attempting to click a disabled button should be prevented - Playwright will throw an error when clicking !enabled
    // We assert that clicking a disabled button rejects with an error.
    const clickEncrypt = app.encryptBtn.click();
    await expect(clickEncrypt).rejects.toThrow();

    const clickDecrypt = app.decryptBtn.click();
    await expect(clickDecrypt).rejects.toThrow();

    // No runtime page errors should have been added as a result
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Corrupted encrypted message yields a runtime error during decryption (observe pageerror)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Generate keys so decrypt button is enabled
    await app.generateKeysAndAcceptAlert();

    // Ensure decrypt is enabled
    await expect(app.decryptBtn).toBeEnabled();

    // Intentionally corrupt the encryptedMessage content to a non-base64 string
    await page.evaluate(() => {
      // Direct DOM modification simulating an invalid encrypted payload
      const el = document.getElementById('encryptedMessage');
      if (el) el.textContent = '!!--not-base64--!!';
    });

    // Prepare to capture the pageerror event that should result from atob failing
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Click decrypt and expect a runtime error event to be emitted on the page
    await app.clickDecrypt();

    const error = await pageErrorPromise;
    expect(error).toBeTruthy();
    // The error message should reference base64/atob/InvalidCharacter; tolerate variations
    const msg = String(error.message || error.toString()).toLowerCase();
    expect(msg.includes('invalid') || msg.includes('atob') || msg.includes('invalidcharacter') || msg.includes('domexception')).toBeTruthy();
  });

  test('Generate keys multiple times produces different key material (public key changes)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // First generation
    const dialog1 = await app.generateKeysAndAcceptAlert();
    expect(dialog1).toBeTruthy();

    const pub1 = await app.getPublicKeyText();
    expect(pub1.length).toBeGreaterThan(0);

    // Generate again
    const dialog2 = await app.generateKeysAndAcceptAlert();
    expect(dialog2).toBeTruthy();

    const pub2 = await app.getPublicKeyText();
    expect(pub2.length).toBeGreaterThan(0);

    // The two exported public keys should not be identical (very low probability they are identical)
    expect(pub1).not.toBe(pub2);

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  }).timeout(120000); // allow more time for repeated key generation
});