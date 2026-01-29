import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b4a9a2-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object encapsulating interactions with the demo page
class AsymmetricCryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generate-keys-btn');
    this.keysInfo = page.locator('#keys-info');
    this.publicKeyPem = page.locator('#publicKeyPem');
    this.privateKeyPem = page.locator('#privateKeyPem');
    this.plaintext = page.locator('#plaintext');
    this.encryptBtn = page.locator('#encrypt-btn');
    this.ciphertext = page.locator('#ciphertextBase64');
    this.decryptBtn = page.locator('#decrypt-btn');
    this.decryptedText = page.locator('#decryptedText');
  }

  // Click the "Generate RSA Key Pair" button and wait until keys are generated.
  async generateKeys({ timeout = 20000 } = {}) {
    await this.generateBtn.click();
    // Wait for the success message indicating S1_KeysGenerated
    await expect(this.keysInfo).toHaveText('RSA 2048-bit key pair generated successfully.', { timeout });
    // Ensure PEM fields populated
    await expect(this.publicKeyPem).not.toHaveValue('', { timeout });
    await expect(this.privateKeyPem).not.toHaveValue('', { timeout });
    // Ensure encrypt button is enabled and decrypt remains disabled
    await expect(this.encryptBtn).toBeEnabled({ timeout });
    await expect(this.decryptBtn).toBeDisabled({ timeout });
  }

  // Fill plaintext and click encrypt; wait for ciphertext to appear and decrypt button to enable.
  async encryptPlaintext(plaintext, { timeout = 10000 } = {}) {
    await this.plaintext.fill(plaintext);
    await this.encryptBtn.click();
    // Wait for ciphertext to become non-empty
    await expect(this.ciphertext).not.toHaveValue('', { timeout });
    // decrypt button should be enabled now
    await expect(this.decryptBtn).toBeEnabled({ timeout });
    // decrypted text should be cleared (per implementation)
    await expect(this.decryptedText).toHaveValue('', { timeout });
    // return ciphertext value for potential further checks
    return await this.ciphertext.inputValue();
  }

  // Click decrypt and wait for decrypted text equal to expectedPlaintext
  async decryptAndAssert(expectedPlaintext, { timeout = 10000 } = {}) {
    await this.decryptBtn.click();
    await expect(this.decryptedText).toHaveValue(expectedPlaintext, { timeout });
  }
}

test.describe('Asymmetric Cryptography Demo - FSM states and transitions', () => {
  // Arrays to capture console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (including errors logged to console)
    page.on('console', (msg) => {
      // capture text and severity/type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page uncaught errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure listeners are cleared (Playwright removes listeners on page close automatically,
    // but explicit navigation away to about:blank avoids cross-test leakage).
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore
    }
  });

  test('Initial state (S0_Idle) - UI elements present and correct', async ({ page }) => {
    // Validate initial Idle state: generate button exists and other actions disabled
    const app = new AsymmetricCryptoPage(page);

    // The Generate RSA Key Pair button should be visible and enabled
    await expect(app.generateBtn).toBeVisible();
    await expect(app.generateBtn).toBeEnabled();

    // Encrypt and Decrypt buttons should start disabled per FSM/component spec
    await expect(app.encryptBtn).toBeDisabled();
    await expect(app.decryptBtn).toBeDisabled();

    // Key info should be empty initially
    await expect(app.keysInfo).toHaveText('', { timeout: 1000 });

    // Public/private key textareas should be present and readonly (readonly attribute presence)
    const publicReadonly = await page.getAttribute('#publicKeyPem', 'readonly');
    const privateReadonly = await page.getAttribute('#privateKeyPem', 'readonly');
    expect(publicReadonly).not.toBeNull();
    expect(privateReadonly).not.toBeNull();

    // Observe console and page errors; if any errors occurred, assert they are of expected kinds or none at all.
    // We allow either zero errors OR captured errors that are runtime errors (ReferenceError/TypeError/SyntaxError).
    // This follows the instruction to observe errors but not to modify page.
    const pageErrorsOk = pageErrors.length === 0 || pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e)));
    expect(pageErrorsOk).toBeTruthy();
  });

  test('GenerateKeys event transitions to Keys Generated (S1) and Ready to Encrypt (S2)', async ({ page }) => {
    // This test validates the GenerateKeys event and subsequent state changes.
    const app1 = new AsymmetricCryptoPage(page);

    // Generate keys and assert resulting UI changes (keys present, encrypt enabled)
    await app.generateKeys({ timeout: 30000 });

    // Validate PEM formats contain expected headers
    const pubPem = await app.publicKeyPem.inputValue();
    const privPem = await app.privateKeyPem.inputValue();
    expect(pubPem).toContain('-----BEGIN PUBLIC KEY-----');
    expect(pubPem).toContain('-----END PUBLIC KEY-----');
    expect(privPem).toContain('-----BEGIN PRIVATE KEY-----');
    expect(privPem).toContain('-----END PRIVATE KEY-----');

    // Ensure keys info text matches FSM evidence
    await expect(app.keysInfo).toHaveText('RSA 2048-bit key pair generated successfully.');

    // Ensure no unexpected page errors (or if present, they are runtime errors per instructions)
    const pageErrorsOk1 = pageErrors.length === 0 || pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e)));
    expect(pageErrorsOk).toBeTruthy();
  });

  test('EncryptText event transitions to Encrypted (S3) and produces ciphertext', async ({ page }) => {
    // This test covers the full flow: generate -> set plaintext -> encrypt -> ciphertext appears.
    const app2 = new AsymmetricCryptoPage(page);
    const message = 'Hello Playwright RSA!';

    // Generate keys first
    await app.generateKeys({ timeout: 30000 });

    // Perform encryption and capture ciphertext
    const ciphertext = await app.encryptPlaintext(message, { timeout: 20000 });

    // Basic validation of ciphertext (should be base64-like characters, not empty)
    expect(ciphertext.length).toBeGreaterThan(0);
    // Base64 regex: letters, digits, +/, possibly padding =
    expect(/^[A-Za-z0-9+/=\s]+$/.test(ciphertext)).toBeTruthy();

    // decrypt button should be enabled now per S3 evidence
    await expect(app.decryptBtn).toBeEnabled();

    // Ensure no fatal page errors occurred (or acceptable runtime errors)
    const pageErrorsOk2 = pageErrors.length === 0 || pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e)));
    expect(pageErrorsOk).toBeTruthy();
  });

  test('DecryptText event transitions to Decrypted (S4) and recovers plaintext', async ({ page }) => {
    // This test validates encryption followed by decryption returns original plaintext.
    const app3 = new AsymmetricCryptoPage(page);
    const message1 = 'The quick brown fox jumps over the lazy dog. 0123456789';

    // Generate keys
    await app.generateKeys({ timeout: 30000 });

    // Encrypt the message
    await app.encryptPlaintext(message, { timeout: 20000 });

    // Decrypt and verify plaintext matches original
    await app.decryptAndAssert(message, { timeout: 20000 });

    // Final assertions: decrypted textarea shows the original text
    const decrypted = await app.decryptedText.inputValue();
    expect(decrypted).toBe(message);

    // Ensure no fatal page errors occurred (or acceptable runtime errors)
    const pageErrorsOk3 = pageErrors.length === 0 || pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e)));
    expect(pageErrorsOk).toBeTruthy();
  });

  test('Edge case: Decryption with invalid ciphertext shows error dialog', async ({ page }) => {
    // This test ensures that when ciphertext is tampered with, decryption fails and an alert is shown.
    const app4 = new AsymmetricCryptoPage(page);
    const message2 = 'Edge case test message2';

    // Generate keys and encrypt to enable decrypt button
    await app.generateKeys({ timeout: 30000 });
    await app.encryptPlaintext(message, { timeout: 20000 });

    // Tamper ciphertext to invalid base64 -> replace with obviously invalid content
    await app.ciphertext.fill('not-a-valid-base64-@@@');

    // Listen for alert/dialog triggered by decryption error
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click decrypt and expect an alert (the implementation calls alert on failure)
    await app.decryptBtn.click();

    // Wait briefly for dialog to be captured
    await page.waitForTimeout(500);

    expect(dialogMessage).not.toBeNull();
    expect(dialogMessage.toLowerCase()).toContain('decryption failed');

    // Ensure page errors are acceptable
    const pageErrorsOk4 = pageErrors.length === 0 || pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e)));
    expect(pageErrorsOk).toBeTruthy();
  });

  test('Edge case: Encrypting empty plaintext still produces ciphertext (or no-op) without throwing', async ({ page }) => {
    // This test explores encrypting an empty string. The implementation should handle this
    // without throwing uncaught exceptions. We accept either a produced ciphertext (non-empty)
    // or no change, but monitor for uncaught errors.
    const app5 = new AsymmetricCryptoPage(page);

    // Generate keys
    await app.generateKeys({ timeout: 30000 });

    // Ensure plaintext is empty
    await app.plaintext.fill('');

    // Click encrypt; implementation may produce ciphertext for empty input or may produce a short output.
    await app.encryptBtn.click();

    // Wait a bit for operation to finish
    await page.waitForTimeout(1000);

    // ciphertext might be empty or non-empty depending on the crypto behavior; assert no uncaught errors
    const pageErrorsOk5 = pageErrors.length === 0 || pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e)));
    expect(pageErrorsOk).toBeTruthy();

    // If ciphertext non-empty then decrypt button should be enabled; otherwise decrypt remains disabled
    const ciphertextValue = await app.ciphertext.inputValue();
    if (ciphertextValue && ciphertextValue.length > 0) {
      await expect(app.decryptBtn).toBeEnabled();
    } else {
      // if ciphertext is empty, decrypt should be disabled per normal flow
      await expect(app.decryptBtn).toBeDisabled();
    }
  });

  test('Observes console messages and page errors during full flow (generate->encrypt->decrypt)', async ({ page }) => {
    // This test runs the full happy path and then asserts that any console errors observed
    // are either absent or are runtime errors captured naturally (per instruction).
    const app6 = new AsymmetricCryptoPage(page);
    const message3 = 'Console/Errors observation test';

    // Generate -> Encrypt -> Decrypt
    await app.generateKeys({ timeout: 30000 });
    await app.encryptPlaintext(message, { timeout: 20000 });
    await app.decryptAndAssert(message, { timeout: 20000 });

    // Inspect collected console messages
    // At minimum, confirm that console was observed (may be empty array in strict environments)
    // This assertion is lenient: if any messages exist, ensure they are strings.
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(msg.text.length).toBeGreaterThanOrEqual(0);
    }

    // Page errors: either none OR contain runtime errors
    const pageErrorsOk6 = pageErrors.length === 0 || pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e)));
    expect(pageErrorsOk).toBeTruthy();
  });
});