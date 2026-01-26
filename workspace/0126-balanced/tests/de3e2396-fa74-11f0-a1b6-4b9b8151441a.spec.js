import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e2396-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the Asymmetric Cryptography Demo
class CryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generateKeys');
    this.publicContainer = page.locator('#publicKeyContainer');
    this.privateContainer = page.locator('#privateKeyContainer');
    this.publicKey = page.locator('#publicKey');
    this.privateKey = page.locator('#privateKey');
    this.plaintext = page.locator('#plaintext');
    this.encryptBtn = page.locator('#encryptBtn');
    this.decryptBtn = page.locator('#decryptBtn');
    this.resultText = page.locator('#resultText');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGenerateKeys() {
    await this.generateBtn.click();
  }

  async clickEncrypt() {
    await this.encryptBtn.click();
  }

  async clickDecrypt() {
    await this.decryptBtn.click();
  }

  async setPlaintext(text) {
    await this.plaintext.fill(text);
  }

  async getResultValue() {
    return await this.resultText.inputValue();
  }

  async isGenerateButtonVisible() {
    return await this.generateBtn.isVisible();
  }

  async areKeyContainersVisible() {
    const pubVis = await this.publicContainer.isVisible();
    const privVis = await this.privateContainer.isVisible();
    return { pubVis, privVis };
  }

  async getPublicKeyText() {
    return (await this.publicKey.textContent()) || '';
  }

  async getPrivateKeyText() {
    return (await this.privateKey.textContent()) || '';
  }
}

test.describe('Asymmetric Cryptography Demo - FSM validation', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // Record all console messages for later assertions; include type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test initial Idle state S0_Idle
  test('S0_Idle: Initial page renders "Generate Key Pair" and key containers hidden', async ({ page }) => {
    const p = new CryptoPage(page);
    await p.goto();

    // The Idle state's evidence: Generate Key Pair button must exist and be visible
    expect(await p.isGenerateButtonVisible()).toBeTruthy();

    // On entry the FSM mentions renderPage() but the implementation does not define it.
    // Verify there is no global renderPage function defined (verification of onEnter action presence)
    // We do not invoke it — only check whether it exists.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Key containers should be hidden initially
    const vis = await p.areKeyContainersVisible();
    expect(vis.pubVis).toBeFalsy();
    expect(vis.privVis).toBeFalsy();

    // Ensure there are no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);
    // No console errors of type 'error' should be present on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: GenerateKeys from S0_Idle -> S1_KeysGenerated
  test('GenerateKeys event: generates key pair and reveals public/private keys (S1_KeysGenerated)', async ({ page }) => {
    const p = new CryptoPage(page);
    await p.goto();

    // Handle the alert prompted by successful key generation
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    // Click generate keys and wait for the public container to become visible
    await p.clickGenerateKeys();

    // Wait for public and private containers to be visible (the app sets style.display = 'block')
    await expect(p.publicContainer).toBeVisible();
    await expect(p.privateContainer).toBeVisible();

    // Ensure public/private key text content is non-empty JSON-like strings
    const pubText = await p.getPublicKeyText();
    const privText = await p.getPrivateKeyText();
    expect(pubText.length).toBeGreaterThan(0);
    expect(privText.length).toBeGreaterThan(0);

    // The application alerts 'Key pair generated successfully!' on success; assert that a dialog was shown with that message
    expect(dialogs.length).toBeGreaterThan(0);
    const successDialog = dialogs.find(d => d.message.includes('Key pair generated successfully'));
    expect(successDialog).toBeDefined();

    // Confirm that no uncaught page errors or console errors occurred during key generation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  }, 60_000); // key generation may take time - extend timeout

  // Test transition: EncryptMessage from S1_KeysGenerated -> S2_Encrypting
  test('EncryptMessage event: encrypts plaintext and displays base64 ciphertext (S2_Encrypting)', async ({ page }) => {
    const p = new CryptoPage(page);
    await p.goto();

    // Accept any dialogs
    page.on('dialog', async (dialog) => { await dialog.accept(); });

    // Generate keys first
    await p.clickGenerateKeys();
    await expect(p.publicContainer).toBeVisible();

    // Enter plaintext and encrypt
    const original = 'Hello Playwright!';
    await p.setPlaintext(original);
    await p.clickEncrypt();

    // Result textbox should contain base64 ciphertext (non-empty and different from plaintext)
    const result = await p.getResultValue();
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe(original);

    // Basic base64 validation (characters and padding)
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    // Because ciphertext might be fairly long, ensure it matches base64 pattern
    expect(base64Regex.test(result)).toBeTruthy();

    // Verify no uncaught page errors were emitted
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  }, 60_000);

  // Test transition: DecryptMessage from S1_KeysGenerated -> S3_Decrypting
  test('DecryptMessage event: decrypts ciphertext back to original plaintext (S3_Decrypting)', async ({ page }) => {
    const p = new CryptoPage(page);
    await p.goto();

    // Accept any alerts
    page.on('dialog', async (dialog) => { await dialog.accept(); });

    // Generate keys
    await p.clickGenerateKeys();
    await expect(p.publicContainer).toBeVisible();

    // Encrypt a message
    const original = 'Secret message 123';
    await p.setPlaintext(original);
    await p.clickEncrypt();

    // Ensure ciphertext exists
    const ciphertext = await p.getResultValue();
    expect(ciphertext.length).toBeGreaterThan(0);

    // Now decrypt
    await p.clickDecrypt();

    // After decryption, resultText should contain the original plaintext
    // The app writes decrypted text back into #resultText
    await expect(p.resultText).toHaveValue(original, { timeout: 5000 });

    // Confirm no uncaught runtime errors happened
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  }, 60_000);

  // Edge case tests: behavior when operations are attempted without required prerequisites
  test.describe('Edge cases and error scenarios', () => {
    test('Encrypt before generating keys: shows alert "Please generate a key pair first"', async ({ page }) => {
      const p = new CryptoPage(page);
      await p.goto();

      const dialogMessages = [];
      page.on('dialog', async (dialog) => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      // Click encrypt without keys and without plaintext
      await p.clickEncrypt();

      // Alert should prompt user to generate keys first
      expect(dialogMessages.length).toBeGreaterThan(0);
      expect(dialogMessages.some(m => m.includes('Please generate a key pair first'))).toBe(true);

      // No uncaught runtime errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Encrypt with generated keys but empty plaintext: shows alert "Please enter a message to encrypt"', async ({ page }) => {
      const p = new CryptoPage(page);
      await p.goto();

      const dialogMessages = [];
      page.on('dialog', async (dialog) => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      // Generate keys
      await p.clickGenerateKeys();
      await expect(p.publicContainer).toBeVisible();

      // Ensure plaintext is empty
      await p.setPlaintext('');
      await p.clickEncrypt();

      // Expect alert telling user to enter a message
      expect(dialogMessages.some(m => m.includes('Please enter a message to encrypt'))).toBe(true);

      expect(pageErrors.length).toBe(0);
    }, 60_000);

    test('Decrypt before generating keys: shows alert "Please generate a key pair first"', async ({ page }) => {
      const p = new CryptoPage(page);
      await p.goto();

      const dialogMessages = [];
      page.on('dialog', async (dialog) => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      // Click decrypt without generating keys
      await p.clickDecrypt();

      expect(dialogMessages.some(m => m.includes('Please generate a key pair first'))).toBe(true);
      expect(pageErrors.length).toBe(0);
    });

    test('Decrypt with generated keys but empty ciphertext: shows alert "No ciphertext to decrypt"', async ({ page }) => {
      const p = new CryptoPage(page);
      await p.goto();

      const dialogMessages = [];
      page.on('dialog', async (dialog) => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      // Generate keys
      await p.clickGenerateKeys();
      await expect(p.publicContainer).toBeVisible();

      // Ensure resultText is empty
      await p.resultText.fill('');
      await p.clickDecrypt();

      expect(dialogMessages.some(m => m.includes('No ciphertext to decrypt'))).toBe(true);
      expect(pageErrors.length).toBe(0);
    }, 60_000);
  });

  // Final test: aggregate check for runtime errors across typical user journeys
  test('No uncaught console or page errors across full generate->encrypt->decrypt flow', async ({ page }) => {
    const p = new CryptoPage(page);
    await p.goto();

    // Accept all dialogs automatically
    page.on('dialog', async (dialog) => { await dialog.accept(); });

    await p.clickGenerateKeys();
    await expect(p.publicContainer).toBeVisible();

    await p.setPlaintext('End-to-end check');
    await p.clickEncrypt();
    const ciphertext = await p.getResultValue();
    expect(ciphertext.length).toBeGreaterThan(0);

    await p.clickDecrypt();
    await expect(p.resultText).toHaveValue('End-to-end check', { timeout: 5000 });

    // After entire flow, assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Also assert there were no console messages of type 'error'
    const fatalConsoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(fatalConsoleErrors.length).toBe(0);
  }, 120_000);
});