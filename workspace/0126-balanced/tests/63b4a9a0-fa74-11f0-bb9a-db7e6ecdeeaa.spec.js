import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b4a9a0-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Encryption demo
class EncryptionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.plaintext = page.locator('#plaintext');
    this.key = page.locator('#key');
    this.encryptBtn = page.locator('#encryptBtn');
    this.decryptBtn = page.locator('#decryptBtn');
    this.ciphertext = page.locator('#ciphertext');
    this.decrypted = page.locator('#decrypted');
    this.decryptedLabel = page.locator('label[for="decrypted"]');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main elements to be available
    await expect(this.heading).toBeVisible();
    await expect(this.plaintext).toBeVisible();
    await expect(this.key).toBeVisible();
    await expect(this.encryptBtn).toBeVisible();
  }

  async fillPlaintext(value) {
    await this.plaintext.fill(value);
  }

  async fillKey(value) {
    await this.key.fill(value);
  }

  async clickEncrypt() {
    await this.encryptBtn.click();
  }

  async clickDecrypt() {
    await this.decryptBtn.click();
  }

  async getCiphertextText() {
    return (await this.ciphertext.textContent()) ?? '';
  }

  async getDecryptedText() {
    return (await this.decrypted.textContent()) ?? '';
  }

  async getDecryptBtnDisplay() {
    return this.page.evaluate((el) => el.style.display, await this.decryptBtn.elementHandle());
  }

  async getDecryptedDisplay() {
    return this.page.evaluate((el) => el.style.display, await this.decrypted.elementHandle());
  }

  async getDecryptedLabelDisplay() {
    return this.page.evaluate((el) => el.style.display, await this.decryptedLabel.elementHandle());
  }
}

test.describe('Encryption Demonstration - FSM states and transitions', () => {
  let consoleErrors = [];
  let pageErrors = [];
  let lastDialogMessage = null;

  test.beforeEach(async ({ page }) => {
    // Capture console error messages
    consoleErrors = [];
    pageErrors = [];
    lastDialogMessage = null;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture and accept dialog alerts, record the message for assertions
    page.on('dialog', async (dialog) => {
      lastDialogMessage = dialog.message();
      await dialog.accept();
    });
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors or console error messages
    // Tests that expect alerts use the dialog capture; alerts are not console errors
    expect(pageErrors.length, `No page errors should be thrown`).toBe(0);
    expect(consoleErrors.length, `No console errors should be logged`).toBe(0);
  });

  test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
    // This test verifies the initial state: the page renders, h1 exists, outputs hidden where appropriate.
    const app = new EncryptionPage(page);
    await app.goto();

    // Validate the header text (evidence for S0_Idle)
    await expect(app.heading).toHaveText('Encryption Concept Demonstration');

    // Plaintext and key placeholders
    await expect(app.plaintext).toHaveAttribute('placeholder', 'Type your message here...');
    await expect(app.key).toHaveAttribute('placeholder', 'Enter secret key');

    // Ciphertext is empty initially
    await expect(app.ciphertext).toHaveText('');

    // Decrypt button should be hidden initially (style="display:none;")
    const decryptBtnStyle = await page.evaluate((el) => el.getAttribute('style'), await app.decryptBtn.elementHandle());
    expect(decryptBtnStyle).toContain('display:none');

    // Decrypted output and its label are hidden initially
    const decryptedStyleAttr = await page.evaluate((el) => el.getAttribute('style'), await app.decrypted.elementHandle());
    expect(decryptedStyleAttr).toContain('display:none');

    const decryptedLabelStyle = await page.evaluate((el) => el.getAttribute('style'), await app.decryptedLabel.elementHandle());
    expect(decryptedLabelStyle).toContain('display:none');

    // Ensure no dialogs were shown during initial render
    expect(lastDialogMessage).toBe(null);
  });

  test('EncryptMessage transition updates ciphertext and reveals decrypt button (S0_Idle -> S1_Encrypted)', async ({ page }) => {
    // This test covers the encryption transition and checks the DOM changes as per the FSM.
    const app1 = new EncryptionPage(page);
    await app.goto();

    // Input known plaintext and key
    const plaintext = 'Hello, World!';
    const key = 'KEY';
    await app.fillPlaintext(plaintext);
    await app.fillKey(key);

    // Click encrypt and wait for updates
    await app.clickEncrypt();

    // Expected ciphertext computed for Vigenère with key "KEY" on "Hello, World!" -> "Rijvs, Uyvjn!"
    const expectedCiphertext = 'Rijvs, Uyvjn!';

    await expect(app.ciphertext).toHaveText(expectedCiphertext);

    // Decrypt button should now be visible and have inline-block style
    const decryptDisplay = await app.getDecryptBtnDisplay();
    expect(decryptDisplay).toBe('inline-block');

    // Decrypted output must remain hidden after encryption
    const decryptedDisplay = await app.getDecryptedDisplay();
    expect(decryptedDisplay).toBe('none');

    // No alert should have been shown
    expect(lastDialogMessage).toBe(null);
  });

  test('DecryptMessage transition reveals original plaintext (S1_Encrypted -> S2_Decrypted)', async ({ page }) => {
    // This test covers decrypting the ciphertext to get back the original plaintext.
    const app2 = new EncryptionPage(page);
    await app.goto();

    const plaintext1 = 'Hello, World!';
    const key1 = 'KEY';
    await app.fillPlaintext(plaintext);
    await app.fillKey(key);

    await app.clickEncrypt();

    // Ensure ciphertext populated
    await expect(app.ciphertext).toHaveText('Rijvs, Uyvjn!');

    // Click decrypt
    await app.clickDecrypt();

    // Decrypted output should equal original plaintext and be visible
    await expect(app.decrypted).toHaveText(plaintext);

    const decryptedDisplay1 = await app.getDecryptedDisplay();
    expect(decryptedDisplay).toBe('block');

    const decryptedLabelDisplay = await app.getDecryptedLabelDisplay();
    expect(decryptedLabelDisplay).toBe('block');

    // No alert expected
    expect(lastDialogMessage).toBe(null);
  });

  test('Edge case: Encrypt with empty plaintext shows alert and no state change', async ({ page }) => {
    // Validate behavior when user tries to encrypt an empty plaintext (should alert and remain in Idle)
    const app3 = new EncryptionPage(page);
    await app.goto();

    await app.fillPlaintext(''); // empty
    await app.fillKey('SOMEKEY');

    // Click encrypt and capture dialog message
    await app.clickEncrypt();

    // The dialog handler in beforeEach accepted the dialog and recorded lastDialogMessage
    expect(lastDialogMessage).toBe('Please enter a message to encrypt.');

    // Verify no ciphertext was produced and decrypt remains hidden
    await expect(app.ciphertext).toHaveText('');
    const decryptBtnStyle1 = await page.evaluate((el) => el.getAttribute('style'), await app.decryptBtn.elementHandle());
    expect(decryptBtnStyle).toContain('display:none');
  });

  test('Edge case: Encrypt with empty key shows alert and no ciphertext', async ({ page }) => {
    // Validate behavior when key is empty
    const app4 = new EncryptionPage(page);
    await app.goto();

    await app.fillPlaintext('Test message');
    await app.fillKey(''); // empty

    await app.clickEncrypt();

    expect(lastDialogMessage).toBe('Please enter a secret key.');

    // Ciphertext remains empty
    await expect(app.ciphertext).toHaveText('');
  });

  test('Edge case: Encrypt with key containing no letters shows alert', async ({ page }) => {
    // If the key contains no alphabetical characters, encryption should alert and not produce ciphertext
    const app5 = new EncryptionPage(page);
    await app.goto();

    await app.fillPlaintext('Another test');
    await app.fillKey('1234-!@#'); // no letters

    await app.clickEncrypt();

    expect(lastDialogMessage).toBe('The key must contain at least one alphabetical character.');

    await expect(app.ciphertext).toHaveText('');
  });

  test('Edge case: Decrypt with no ciphertext shows alert', async ({ page }) => {
    // Attempt to decrypt when there is no ciphertext should show alert
    const app6 = new EncryptionPage(page);
    await app.goto();

    // Ensure ciphertext is empty
    await expect(app.ciphertext).toHaveText('');

    // Click decrypt directly
    await app.clickDecrypt();

    expect(lastDialogMessage).toBe('No ciphertext to decrypt.');

    // Decrypted output remains hidden
    const decryptedDisplay2 = await app.getDecryptedDisplay();
    expect(decryptedDisplay).toBe('none');
  });

  test('Edge case: Decrypt with empty key after encryption shows alert and no decrypted output', async ({ page }) => {
    // Encrypt first to produce ciphertext, then clear key and try to decrypt
    const app7 = new EncryptionPage(page);
    await app.goto();

    const plaintext2 = 'EdgeCase';
    await app.fillPlaintext(plaintext);
    await app.fillKey('KEY');

    await app.clickEncrypt();

    // Ensure ciphertext exists
    await expect(app.ciphertext).not.toHaveText('');

    // Clear the key field
    await app.fillKey('');

    // Click decrypt
    await app.clickDecrypt();

    // Should show alert asking for secret key used for encryption
    expect(lastDialogMessage).toBe('Please enter the secret key used for encryption.');

    // Decrypted output should remain hidden
    const decryptedDisplay3 = await app.getDecryptedDisplay();
    expect(decryptedDisplay).toBe('none');
  });

  test('Preserves non-letter characters and case during encryption/decryption', async ({ page }) => {
    // This test ensures punctuation, whitespace and letter casing are preserved across encrypt->decrypt
    const app8 = new EncryptionPage(page);
    await app.goto();

    const plaintext3 = 'Attack at Dawn! 123';
    const key2 = 'LeMon';

    await app.fillPlaintext(plaintext);
    await app.fillKey(key);

    await app.clickEncrypt();

    // Save ciphertext produced
    const ciphertext = await app.getCiphertextText();
    expect(ciphertext.length).toBeGreaterThan(0);
    // ensure digits and spaces and punctuation remain in ciphertext where non-letter positions existed
    expect(ciphertext).toContain('!'); // punctuation preserved
    expect(ciphertext).toContain('123'); // digits preserved

    // Now decrypt
    await app.clickDecrypt();

    // The decrypted output should exactly match original plaintext (case, spaces, digits)
    const decrypted = await app.getDecryptedText();
    expect(decrypted).toBe(plaintext);
  });
});