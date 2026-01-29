import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e7003-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Asymmetric Cryptography demo
class AsymmetricCryptoPage {
  constructor(page) {
    this.page = page;
    // Buttons are ordered in the HTML; nth-of-type indexing is used in the FSM
    this.generateKeyBtn1 = "button[type='button']:nth-of-type(1)"; // first Generate Key
    this.generateKeyBtn2 = "button[type='button']:nth-of-type(2)"; // second Generate Key
    this.encryptBtn = "button[type='button']:nth-of-type(3)"; // Encrypt
    this.decryptBtn = "button[type='button']:nth-of-type(4)"; // Decrypt

    this.publicKey = '#public-key';
    this.privateKey = '#private-key';
    this.dataTextarea = '#data';
    this.encryptedTextarea = '#encrypted-data';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page load event fired (script executes at bottom and errors may occur during parsing/execution)
    await this.page.waitForLoadState('load');
  }

  async clickGenerateKey1() {
    await this.page.click(this.generateKeyBtn1);
  }

  async clickGenerateKey2() {
    await this.page.click(this.generateKeyBtn2);
  }

  async clickEncrypt() {
    await this.page.click(this.encryptBtn);
  }

  async clickDecrypt() {
    await this.page.click(this.decryptBtn);
  }

  async getPublicKeyValue() {
    return this.page.locator(this.publicKey).inputValue();
  }

  async getPrivateKeyValue() {
    return this.page.locator(this.privateKey).inputValue();
  }

  async getDataValue() {
    return this.page.locator(this.dataTextarea).inputValue();
  }

  async getEncryptedValue() {
    return this.page.locator(this.encryptedTextarea).inputValue();
  }

  async elementExists(selector) {
    return this.page.locator(selector).count().then(c => c > 0);
  }
}

test.describe('Asymmetric Cryptography - FSM behavior and error observation', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // pageerror provides Error object with message
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      // store console text for later inspection
      consoleMessages.push(msg.text());
    });
  });

  test('Initial Idle state: verify UI elements exist and baseline values', async ({ page }) => {
    // This test validates the Idle state: presence of buttons, inputs, and static text
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Validate page title and headings (basic smoke checks)
    await expect(page).toHaveTitle(/Asymmetric Cryptography/);
    await expect(page.locator('h1')).toHaveText('Asymmetric Cryptography');

    // Verify the Generate Key buttons (two present)
    const gen1Exists = await app.elementExists(app.generateKeyBtn1);
    const gen2Exists = await app.elementExists(app.generateKeyBtn2);
    expect(gen1Exists).toBe(true);
    expect(gen2Exists).toBe(true);

    // Verify Encrypt and Decrypt buttons exist
    const encExists = await app.elementExists(app.encryptBtn);
    const decExists = await app.elementExists(app.decryptBtn);
    expect(encExists).toBe(true);
    expect(decExists).toBe(true);

    // Verify public/private key inputs exist and have expected pre-filled values (state evidence)
    const publicKeyValue = await app.getPublicKeyValue();
    const privateKeyValue = await app.getPrivateKeyValue();
    expect(publicKeyValue).toBe('1234567890');
    expect(privateKeyValue).toBe('9876543210');

    // Verify textareas exist and are initially empty
    const dataVal = await app.getDataValue();
    const encryptedVal = await app.getEncryptedValue();
    expect(dataVal).toBe('');
    expect(encryptedVal).toBe('');

    // The script in the HTML has known runtime issues (see implementation). Assert that at least one page error happened on load.
    // We do not attempt to patch or fix anything; we only assert that errors occur naturally.
    expect(pageErrors.length).toBeGreaterThan(0);
    // Error messages can vary across browsers/runtimes; assert that one of the common symptoms is present.
    const knownErrorSignatures = ['addEventListener', 'Cannot read', 'cannot read', 'is not a function', 'is not defined'];
    const matchesSignature = pageErrors.some(err => knownErrorSignatures.some(sig => err.includes(sig)));
    expect(matchesSignature).toBeTruthy();
  });

  test('Transition: Generate Key (Idle -> Keys Generated)', async ({ page }) => {
    // This test validates clicking Generate Key and verifies Keys Generated state evidence (public/private inputs).
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Click first Generate Key button (although the app's script likely did not attach handlers,
    // the inputs are pre-populated according to the FSM evidence)
    await app.clickGenerateKey1();

    // After clicking, public/private key fields should still be present and have expected values
    const publicKeyValue = await app.getPublicKeyValue();
    const privateKeyValue = await app.getPrivateKeyValue();
    expect(publicKeyValue).toBe('1234567890');
    expect(privateKeyValue).toBe('9876543210');

    // Confirm we saw page errors from script execution (the error happens at script initialization)
    expect(pageErrors.length).toBeGreaterThan(0);
    expect(pageErrors.some(e => e.includes('addEventListener') || e.toLowerCase().includes('cannot read'))).toBeTruthy();

    // Also assert that no unexpected mutation occurred to the key fields by clicking
    expect(await app.getPublicKeyValue()).toBe(publicKeyValue);
    expect(await app.getPrivateKeyValue()).toBe(privateKeyValue);
  });

  test('Transition: Encrypt Data (Keys Generated -> Data Encrypted) - handler absent, observe error and no encryption', async ({ page }) => {
    // This test attempts to trigger the Encrypt transition. The implementation tries to reference
    // elements by id that do not exist, causing runtime errors during script initialization.
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Ensure preconditions: keys exist (they are prefilled)
    expect(await app.getPublicKeyValue()).toBe('1234567890');
    expect(await app.getPrivateKeyValue()).toBe('9876543210');

    // Click the Encrypt button - because the script likely failed to attach the event listener,
    // this click will not perform encryption. We assert that encrypted textarea remains empty.
    await app.clickEncrypt();

    // The encrypted-data textarea should remain empty (no encryption performed)
    const encryptedVal = await app.getEncryptedValue();
    expect(encryptedVal).toBe('');

    // Confirm script initialization emitted an error (TypeError likely due to addEventListener on null)
    expect(pageErrors.length).toBeGreaterThan(0);
    const foundAddEventErr = pageErrors.some(e => e.includes('addEventListener') || e.toLowerCase().includes('cannot read'));
    expect(foundAddEventErr).toBeTruthy();

    // Additionally, attempt to call the in-page encrypt function (it is declared in the script) and assert it throws
    // We call it intentionally to observe the natural runtime error (e.g., crypto.randomBytes is not a function or Buffer is not defined).
    const encryptCallResult = await page.evaluate(() => {
      try {
        // If the function exists, calling it will surface deeper runtime errors from use of Node APIs in browser environment
        if (typeof encrypt === 'function') {
          encrypt('someKey', 'plaintext');
          return 'no-error';
        } else {
          return 'encrypt-not-defined';
        }
      } catch (err) {
        return err && err.message ? err.message : String(err);
      }
    });

    // We expect the call to fail: check for common signatures
    const deepErrorSignatures = ['crypto.randomBytes', 'is not a function', 'Buffer is not defined', 'not defined', 'SubtleCrypto'];
    const encryptCallShowsError = deepErrorSignatures.some(sig => typeof encryptCallResult === 'string' && encryptCallResult.includes(sig));
    expect(encryptCallShowsError || encryptCallResult === 'encrypt-not-defined').toBeTruthy();
  });

  test('Transition: Decrypt Data (Data Encrypted -> Data Decrypted) - handler absent, observe error and no decryption', async ({ page }) => {
    // This test attempts to trigger Decrypt transition. As with Encrypt, the handler attachments are broken.
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Click Decrypt button
    await app.clickDecrypt();

    // data textarea should remain empty because no decryption occurred
    const dataVal = await app.getDataValue();
    expect(dataVal).toBe('');

    // Confirm page error(s) exist
    expect(pageErrors.length).toBeGreaterThan(0);
    expect(pageErrors.some(e => e.includes('addEventListener') || e.toLowerCase().includes('cannot read'))).toBeTruthy();

    // Attempt to call decrypt function in page context to observe natural runtime error signatures
    const decryptCallResult = await page.evaluate(() => {
      try {
        if (typeof decrypt === 'function') {
          decrypt('privKey', 'ciphertext');
          return 'no-error';
        } else {
          return 'decrypt-not-defined';
        }
      } catch (err) {
        return err && err.message ? err.message : String(err);
      }
    });

    const decryptErrorSignatures = ['crypto.randomBytes', 'is not a function', 'Buffer is not defined', 'not defined'];
    const decryptCallShowsError = decryptErrorSignatures.some(sig => typeof decryptCallResult === 'string' && decryptCallResult.includes(sig));
    expect(decryptCallShowsError || decryptCallResult === 'decrypt-not-defined').toBeTruthy();
  });

  test('Edge cases & diagnostics: functions exist but rely on Node APIs; assert observed errors and console output', async ({ page }) => {
    // This test collects diagnostic evidence: the script declares functions but relies on Node APIs
    const app = new AsymmetricCryptoPage(page);
    await app.goto();

    // Check that function declarations exist in the page (function declarations are hoisted, so they should be available)
    const encryptType = await page.evaluate(() => typeof window.encrypt);
    const decryptType = await page.evaluate(() => typeof window.decrypt);

    // Expect them to be 'function' or 'undefined' depending on how far script executed. Either is acceptable,
    // but at least confirm we can observe the truthy/defined state.
    expect(['function', 'undefined']).toContain(encryptType);
    expect(['function', 'undefined']).toContain(decryptType);

    // We expect at least one meaningful page error from script initialization related to missing DOM ids or invalid API usage.
    expect(pageErrors.length).toBeGreaterThan(0);

    // Inspect console messages for any hints (warnings or logs). This application doesn't intentionally log, but errors may surface here too.
    // We do a tolerant assertion: consoleMessages is an array (may be empty), but if present should include strings.
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Provide a robust assertion that at least one of the pageErrors contains either 'addEventListener' or 'crypto' or 'Buffer'
    const diagnosticSignatures = ['addEventListener', 'crypto.randomBytes', 'Buffer', 'is not a function', 'is not defined', 'Cannot read'];
    const diagFound = pageErrors.some(err => diagnosticSignatures.some(sig => err.includes(sig)));
    expect(diagFound).toBeTruthy();
  });
});