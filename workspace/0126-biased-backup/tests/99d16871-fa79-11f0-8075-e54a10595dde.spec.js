import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d16871-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the demo page
class CryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      keyInput: '#keyInput',
      plaintextInput: '#plaintextInput',
      setKeyButton: 'button[onclick="setKey()"]',
      setPlaintextButton: 'button[onclick="setPlaintext()"]',
      encryptButton: 'button[onclick="encrypt()"]',
      decryptButton: 'button[onclick="decrypt()"]',
      resetButton: 'button[onclick="reset()"]',
      keyStatus: '#keyStatus',
      plaintextStatus: '#plaintextStatus',
      ciphertextStatus: '#ciphertextStatus',
      decryptedStatus: '#decryptedStatus',
      title: 'title'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setKey(value) {
    await this.page.fill(this.selectors.keyInput, value);
    await this.page.click(this.selectors.setKeyButton);
  }

  async setPlaintext(value) {
    await this.page.fill(this.selectors.plaintextInput, value);
    await this.page.click(this.selectors.setPlaintextButton);
  }

  async encrypt() {
    await this.page.click(this.selectors.encryptButton);
  }

  async decrypt() {
    await this.page.click(this.selectors.decryptButton);
  }

  async reset() {
    await this.page.click(this.selectors.resetButton);
  }

  locator(selector) {
    return this.page.locator(selector);
  }
}

test.describe('Symmetric Cryptography Demo - FSM states and transitions', () => {
  // Each test will set up fresh listeners to capture console messages, page errors and dialogs.
  test.beforeEach(async ({ page }) => {
    // Ensure a default timeout long enough for page loads if needed.
    page.setDefaultTimeout(5000);
  });

  test('Initial state (S0_Idle) - page renders and initial statuses are empty', async ({ page }) => {
    // Validate initial rendering and Idle state evidence
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    // Title should match FSM evidence
    // Using page.title() to ensure <title>Symmetric Cryptography Demo</title> exists
    const title = await page.title();
    expect(title).toBe('Symmetric Cryptography Demo');

    // Initial statuses should be empty as described in FSM evidence
    await expect(cp.locator(cp.selectors.keyStatus)).toHaveText('Key Set: ');
    await expect(cp.locator(cp.selectors.plaintextStatus)).toHaveText('Plaintext Set: ');
    await expect(cp.locator(cp.selectors.ciphertextStatus)).toHaveText('Ciphertext: ');
    await expect(cp.locator(cp.selectors.decryptedStatus)).toHaveText('Decrypted Text: ');

    // Inputs should be empty placeholders visible
    await expect(cp.locator(cp.selectors.keyInput)).toHaveValue('');
    await expect(cp.locator(cp.selectors.plaintextInput)).toHaveValue('');

    // No dialogs or page errors should have occurred on initial load
    expect(dialogs.length).toBe(0);
    expect(pageErrors).toHaveLength(0);
    // There should be no critical console errors (we allow console logs but not errors)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Set Key (SetKey) transitions Idle -> Key Set (S0 -> S1)', async ({ page }) => {
    // This test validates setting the secret key triggers the Key Set state and updates DOM
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    const secretKey = 'mySecretKey123';
    await cp.setKey(secretKey);

    await expect(cp.locator(cp.selectors.keyStatus)).toHaveText('Key Set: ' + secretKey);

    // Ensure no unexpected dialogs or page errors
    expect(dialogs.length).toBe(0);
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Set Plaintext (SetPlaintext) transitions Key Set -> Plaintext Set (S1 -> S2)', async ({ page }) => {
    // This test validates setting plaintext when a key is already set updates the DOM accordingly
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    // Precondition: set a key
    const secretKey = 'k';
    await cp.setKey(secretKey);
    await expect(cp.locator(cp.selectors.keyStatus)).toHaveText('Key Set: ' + secretKey);

    // Now set plaintext
    const plaintext = 'hello world';
    await cp.setPlaintext(plaintext);
    await expect(cp.locator(cp.selectors.plaintextStatus)).toHaveText('Plaintext Set: ' + plaintext);

    // No dialogs or page errors expected
    expect(dialogs.length).toBe(0);
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Encrypt (Encrypt) transitions Plaintext Set -> Ciphertext Generated (S2 -> S3)', async ({ page }) => {
    // This test validates encryption produces the expected ciphertext DOM update
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      // capture and accept unexpected alerts
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    const secretKey = 'S3Key!';
    const plaintext = 'EncryptMe';
    await cp.setKey(secretKey);
    await cp.setPlaintext(plaintext);

    // Trigger encryption (should not alert because both key and plaintext are set)
    await cp.encrypt();

    // Compute expected ciphertext using Node Buffer (equivalent to btoa in browser for UTF-8 ASCII here)
    const expectedCipher = Buffer.from(plaintext + secretKey).toString('base64');

    // Ensure the ciphertextStatus contains expected base64 string
    await expect(cp.locator(cp.selectors.ciphertextStatus)).toHaveText('Ciphertext: ' + expectedCipher);

    // Ensure no alerts were shown and no page errors occurred
    expect(dialogs.length).toBe(0);
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Decrypt (Decrypt) transitions Ciphertext Generated -> Decrypted (S3 -> S4) and recovers original plaintext', async ({ page }) => {
    // This test validates a normal encrypt+decrypt cycle recovers original plaintext
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    const secretKey = 'TopSecret';
    const plaintext = 'SensitiveData';
    await cp.setKey(secretKey);
    await cp.setPlaintext(plaintext);
    await cp.encrypt();

    // Decrypt should remove the secretKey from the decoded string and return original plaintext
    await cp.decrypt();

    await expect(cp.locator(cp.selectors.decryptedStatus)).toHaveText('Decrypted Text: ' + plaintext);

    // No alerts or errors expected in this happy path
    expect(dialogs.length).toBe(0);
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Decrypt with changed key (edge case) - demonstrates decryption failure mode when key differs', async ({ page }) => {
    // This test intentionally changes the key after encryption to assert the app's behavior described in FSM evidence
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    // Encrypt with originalKey
    const originalKey = 'originalKey';
    const wrongKey = 'wrongKey';
    const plaintext = 'EdgeCase';
    await cp.setKey(originalKey);
    await cp.setPlaintext(plaintext);
    await cp.encrypt();

    // Now change the key to a different value (simulating user mistake)
    await cp.setKey(wrongKey);

    // Decrypt: because the replace uses current secretKey (wrongKey) and the decoded string contains originalKey,
    // the replace will not remove originalKey, so decryptedStatus will include the originalKey suffix.
    await cp.decrypt();

    const decryptedText = await cp.locator(cp.selectors.decryptedStatus).textContent();
    // Expect decryptedStatus to start with 'Decrypted Text: ' and contain the plaintext, possibly followed by the original key
    expect(decryptedText).toContain('Decrypted Text: ');
    // The substring after the prefix
    const prefix = 'Decrypted Text: ';
    const after = decryptedText.slice(prefix.length);
    // Since wrongKey != originalKey, the originalKey should still be present in the "decrypted" string
    expect(after).toContain(plaintext);
    expect(after).toContain(originalKey);

    // No runtime errors expected; dialogs should be none for this flow
    expect(dialogs.length).toBe(0);
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Encrypt without key or plaintext triggers alert (edge cases for error handling)', async ({ page }) => {
    // This test verifies the application alerts when attempting to encrypt without key and/or plaintext set
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    // Case 1: Both missing
    await cp.encrypt();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1]).toBe('Please set both the key and plaintext');

    // Case 2: Only key present
    await cp.setKey('onlyKey');
    // ensure plaintext is empty
    await cp.page.fill(cp.selectors.plaintextInput, '');
    await cp.encrypt();
    expect(dialogs[dialogs.length - 1]).toBe('Please set both the key and plaintext');

    // Case 3: Only plaintext present
    await cp.page.fill(cp.selectors.keyInput, '');
    // update internal secret key by calling setKey with empty value
    await cp.setKey('');
    await cp.setPlaintext('onlyPlain');
    await cp.encrypt();
    expect(dialogs[dialogs.length - 1]).toBe('Please set both the key and plaintext');

    // Ensure no page errors occurred during these invalid operations
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Decrypt without ciphertext triggers alert', async ({ page }) => {
    // This test verifies the application alerts when decrypt is clicked before any ciphertext is generated
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    // Set a key but do not encrypt, then attempt to decrypt
    await cp.setKey('someKey');
    await cp.decrypt();

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1]).toBe('Please encrypt text first');

    // No page errors expected
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset transitions any active state back to Idle (S* -> S0) and clears DOM and internal inputs', async ({ page }) => {
    // This test validates reset clears secretKey, plaintext, ciphertext and related DOM statuses/inputs
    const consoleMessages = [];
    const pageErrors = [];
    const dialogs = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    const cp = new CryptoPage(page);
    await cp.goto();

    // Set values and perform encryption and decryption to populate fields
    const secretKey = 'ResetKey';
    const plaintext = 'ResetPlain';
    await cp.setKey(secretKey);
    await cp.setPlaintext(plaintext);
    await cp.encrypt();
    await cp.decrypt();

    // Now reset
    await cp.reset();

    // Inputs should be cleared
    await expect(cp.locator(cp.selectors.keyInput)).toHaveValue('');
    await expect(cp.locator(cp.selectors.plaintextInput)).toHaveValue('');

    // Status paragraphs should be reverted to initial empty values
    await expect(cp.locator(cp.selectors.keyStatus)).toHaveText('Key Set: ');
    await expect(cp.locator(cp.selectors.plaintextStatus)).toHaveText('Plaintext Set: ');
    await expect(cp.locator(cp.selectors.ciphertextStatus)).toHaveText('Ciphertext: ');
    await expect(cp.locator(cp.selectors.decryptedStatus)).toHaveText('Decrypted Text: ');

    // No dialogs or page errors expected as result of reset
    expect(dialogs.length).toBe(0);
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});