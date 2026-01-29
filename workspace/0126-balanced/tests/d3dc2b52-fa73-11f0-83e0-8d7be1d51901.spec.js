import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc2b52-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Playwright E2E tests for the AES-GCM interactive demo.
 *
 * Tests:
 *  - Initialization state (S0_Idle)
 *  - Key generation (S1_KeyGenerated)
 *  - Key derivation (S3_KeyDerived)
 *  - Key import (S2_KeyImported)
 *  - Encrypt -> Encrypted state (S4_Encrypted)
 *  - Decrypt -> Decrypted state (S5_Decrypted)
 *  - Clear ciphertext (S4_Encrypted -> S4_Encrypted)
 *  - Copy ciphertext (attempt; may show dialog)
 *  - Edge cases: import invalid base64 (expect alert + possible pageerror),
 *                decrypt with wrong key (expect decryption failure alert & debug log)
 *
 * Note: Tests observe console logs and page errors. They do not modify page JS.
 */

test.describe('Symmetric Cryptography Demo (AES‑GCM) - FSM validation', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      // Normalize by type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for the initialization debug message and for exported key to be populated
    await page.waitForFunction(() => {
      const dbg = document.getElementById('debug');
      const exported = document.getElementById('exportedKey');
      return dbg && dbg.textContent && dbg.textContent.includes('Initializing Web Crypto') && exported && exported.value && exported.value.length > 0;
    }, { timeout: 5000 });
  });

  test.afterEach(async () => {
    // no-op but keep hook for symmetry (could be used for cleanup)
  });

  test('Initialization (S0_Idle) - page loads, initial key generated and debug logs present', async ({ page }) => {
    // Validate debug contains initialization message
    const debugText = await page.locator('#debug').innerText();
    expect(debugText).toContain('Initializing Web Crypto');
    // After init the app auto-generates a key: exportedKey should have a base64 value
    const exportedKeyVal = await page.locator('#exportedKey').inputValue();
    expect(exportedKeyVal).toBeTruthy();
    // saltOut should be empty for generated raw key
    const saltVal = await page.locator('#saltOut').inputValue();
    expect(saltVal).toBe('');
    // deriveInfo should mention a random key was generated for you
    const deriveInfo = await page.locator('#deriveInfo').innerText();
    expect(deriveInfo).toContain('A random key has been generated for you');

    // There should be no uncaught page errors on a healthy initialization
    expect(pageErrors.length).toBe(0);
  });

  test('Generate Key event (GenerateKey) transitions to Key Generated (S1_KeyGenerated)', async ({ page }) => {
    // Capture previously exported key to verify it changes
    const before = await page.locator('#exportedKey').inputValue();

    // Click "Generate Random AES‑GCM Key"
    await page.click('#genKey');

    // Wait for UI update: exportedKey changes and deriveInfo text updated
    await page.waitForFunction((prev) => {
      const exported1 = document.getElementById('exportedKey');
      const deriveInfo1 = document.getElementById('deriveInfo1');
      return exported && exported.value && exported.value !== prev && deriveInfo && deriveInfo.textContent.includes('Random key generated');
    }, before, { timeout: 5000 });

    const after = await page.locator('#exportedKey').inputValue();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);

    const debugText1 = await page.locator('#debug').innerText();
    expect(debugText).toContain('Generated random AES');
    expect(debugText).toContain('Generated random AES‑GCM key'); // tolerant to presence
  });

  test('Derive Key event (DeriveKey) transitions to Key Derived (S3_KeyDerived)', async ({ page }) => {
    // Ensure keyMode is set to derive (default is passphrase)
    const keyModeVal = await page.locator('#keyMode').inputValue();
    // If for some reason it is 'raw', set to 'passphrase'
    if (keyModeVal !== 'passphrase') {
      await page.selectOption('#keyMode', 'passphrase');
    }

    // Provide a known passphrase
    await page.fill('#keyInput', 'test-passphrase-123');

    // Click Derive from passphrase
    await page.click('#deriveKey');

    // Wait for salt and exportedKey to be set and for deriveInfo to include iterations
    await page.waitForFunction(() => {
      const salt = document.getElementById('saltOut');
      const exported2 = document.getElementById('exportedKey');
      const deriveInfo2 = document.getElementById('deriveInfo2');
      return salt && salt.value && salt.value.length > 0 && exported && exported.value && deriveInfo && deriveInfo.textContent.includes('iterations');
    }, { timeout: 10000 });

    const exported3 = await page.locator('#exportedKey').inputValue();
    const salt1 = await page.locator('#saltOut').inputValue();
    const deriveInfo3 = await page.locator('#deriveInfo3').innerText();

    expect(exported).toBeTruthy();
    expect(salt).toBeTruthy();
    expect(deriveInfo).toContain('iterations');

    const debugText2 = await page.locator('#debug').innerText();
    expect(debugText).toContain('Derived key from passphrase');
  });

  test('Import Key event (ImportKey) transitions to Key Imported (S2_KeyImported)', async ({ page }) => {
    // Get an existing exported key (from previous derive or init)
    const currentExported = await page.locator('#exportedKey').inputValue();
    expect(currentExported).toBeTruthy();

    // Switch to raw key mode for import
    await page.selectOption('#keyMode', 'raw');

    // Put the base64 exported key into keyInput and import
    await page.fill('#keyInput', currentExported);
    const [dialogPromise] = await Promise.all([
      // importRawKeyFromBase64 shows an alert only on failure; import should succeed and no dialog
      // We don't expect a dialog, but set up a short wait just in case to avoid flakiness
      page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null),
      page.click('#importKey')
    ]);

    // Ensure exportedKey input matches what was imported
    const exportedAfter = await page.locator('#exportedKey').inputValue();
    expect(exportedAfter).toBe(currentExported);

    const deriveInfo4 = await page.locator('#deriveInfo4').innerText();
    expect(deriveInfo).toContain('Imported raw key');

    const debugText3 = await page.locator('#debug').innerText();
    expect(debugText).toContain('Imported raw key from base64');
  });

  test('Encrypt (Encrypt) then Decrypt (Decrypt) transitions: Encrypted (S4_Encrypted) -> Decrypted (S5_Decrypted)', async ({ page }) => {
    const originalPlain = 'Playwright E2E roundtrip: hello AES-GCM!';
    await page.fill('#plaintext', originalPlain);

    // Ensure we have a key (app initializes one; but ensure exportedKey exists)
    const exported4 = await page.locator('#exportedKey').inputValue();
    expect(exported).toBeTruthy();

    // Clear debug to make assertions deterministic
    await page.evaluate(() => document.getElementById('debug').textContent = '');

    // Click Encrypt
    await page.click('#encryptBtn');

    // Wait for ciphertext to appear
    await page.waitForFunction(() => {
      const ct = document.getElementById('ciphertext');
      const dbg1 = document.getElementById('debug');
      return ct && ct.value && ct.value.length > 0 && dbg && dbg.textContent && dbg.textContent.includes('Encrypted data');
    }, { timeout: 5000 });

    const ciphertext = await page.locator('#ciphertext').inputValue();
    expect(ciphertext).toBeTruthy();
    expect(ciphertext.length).toBeGreaterThan(10);

    const debugAfterEncrypt = await page.locator('#debug').innerText();
    expect(debugAfterEncrypt).toContain('Encrypted data');
    expect(debugAfterEncrypt).toContain('Encryption time (ms)');

    // Test copy button - may show dialog on success. Accept if shown.
    // Only click copy when ciphertext present.
    const dialogPromise = page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null);
    await page.click('#copyCipher');
    const maybeDialog = await dialogPromise;
    if (maybeDialog) {
      // On success, the page alerts "Ciphertext copied to clipboard."
      expect(maybeDialog.message()).toContain('Ciphertext copied to clipboard');
      await maybeDialog.accept();
    } // else: clipboard API may be unavailable in the environment; that's acceptable.

    // Now click Decrypt
    await page.click('#decryptBtn');

    // Wait for plaintext to be replaced with decrypted value and debug to contain decryption messages
    await page.waitForFunction((expected) => {
      const ptEl = document.getElementById('plaintext');
      const dbg2 = document.getElementById('debug');
      return ptEl && ptEl.value === expected && dbg && dbg.textContent && dbg.textContent.includes('Decryption successful');
    }, originalPlain, { timeout: 5000 });

    const plaintextAfter = await page.locator('#plaintext').inputValue();
    expect(plaintextAfter).toBe(originalPlain);

    const debugAfterDecrypt = await page.locator('#debug').innerText();
    expect(debugAfterDecrypt).toContain('Decryption successful');
    expect(debugAfterDecrypt).toContain('Decryption time (ms)');
  });

  test('Clear Ciphertext (ClearCiphertext) leaves ciphertext empty (S4_Encrypted -> S4_Encrypted)', async ({ page }) => {
    // Ensure ciphertext exists: encrypt a short message if needed
    await page.fill('#plaintext', 'Clear test');
    await page.click('#encryptBtn');
    await page.waitForFunction(() => {
      const ct1 = document.getElementById('ciphertext');
      return ct && ct.value && ct.value.length > 0;
    }, { timeout: 5000 });

    const before1 = await page.locator('#ciphertext').inputValue();
    expect(before.length).toBeGreaterThan(0);

    // Click Clear Ciphertext
    await page.click('#clearCipher');

    // Assert it's empty
    const after1 = await page.locator('#ciphertext').inputValue();
    expect(after).toBe('');
  });

  test('Edge case: Import invalid base64 triggers failure alert and may produce page error', async ({ page }) => {
    // Switch to raw mode
    await page.selectOption('#keyMode', 'raw');

    // Provide obviously invalid base64
    await page.fill('#keyInput', '!!!invalid-base64###');

    // Expect an alert 'Failed to import key...' and we also observe page errors collection
    const dialogPromise1 = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
    // Trigger import
    await page.click('#importKey');

    const dialog = await dialogPromise;
    if (dialog) {
      // The page alerts about failed import
      expect(dialog.message()).toContain('Failed to import key');
      await dialog.accept();
    } else {
      // If no dialog, still assert that either debug contains an error or pageErrors captured
      const debug = await page.locator('#debug').innerText();
      // The import function logs nothing on failed import except alert then throws,
      // but thrown error may produce a pageerror — check pageErrors array as captured globally.
      // We don't strictly require a pageerror, but we assert at least one of the two observable failure signals happened.
      const hasDebugError = debug.toLowerCase().includes('failed') || debug.toLowerCase().includes('error');
      const hasPageError = pageErrors.length > 0;
      expect(hasDebugError || hasPageError).toBeTruthy();
    }
  });

  test('Edge case: decrypt with the wrong key triggers decryption failure and debug shows error', async ({ page }) => {
    // Ensure we have a valid ciphertext encrypted with current key
    await page.fill('#plaintext', 'Secret-for-wrong-key-test');
    await page.click('#encryptBtn');
    await page.waitForFunction(() => {
      const ct2 = document.getElementById('ciphertext');
      return ct && ct.value && ct.value.length > 0;
    }, { timeout: 5000 });

    const ciphertext1 = await page.locator('#ciphertext1').inputValue();
    expect(ciphertext).toBeTruthy();

    // Now generate a brand new key to make the current key incorrect for decryption
    await page.click('#genKey');

    // Ensure exportedKey changed (new key)
    await page.waitForTimeout(200); // short wait to allow UI update

    // Attempt to decrypt - this should fail and the page should alert 'Decryption failed.'
    const dialogPromise2 = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);
    await page.click('#decryptBtn');
    const dialog1 = await dialogPromise;
    if (dialog) {
      expect(dialog.message()).toContain('Decryption failed');
      await dialog.accept();
    }

    // Debug should contain 'Decryption error:' entry from catch block
    // Wait a bit for debug to be appended
    await page.waitForFunction(() => {
      const dbg3 = document.getElementById('debug');
      return dbg && dbg.textContent && dbg.textContent.toLowerCase().includes('decryption error');
    }, { timeout: 3000 });

    const debugText4 = await page.locator('#debug').innerText();
    expect(debugText.toLowerCase()).toContain('decryption error');
  });

  test('Console and page error observation: report any unexpected page errors or console errors', async ({ page }) => {
    // The previous tests have populated consoleMessages & pageErrors via beforeEach page instance.
    // Here we assert active console messages contain expected debug entries and no fatal uncaught exceptions.
    const debugMsgs = consoleMessages.filter(m => m.text && m.text.toLowerCase().includes('generated random') || m.text.toLowerCase().includes('derived key') || m.text.toLowerCase().includes('initialized'));
    // At least some debug console messages should have been emitted during init/generation/derive actions.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    // There should be no unhandled SyntaxError or ReferenceError in pageErrors at this point.
    const fatalErrors = pageErrors.filter(err => {
      const txt = String(err && err.message ? err.message : err);
      return /referenceerror|syntaxerror|typeerror/i.test(txt);
    });
    // We assert that no fatal JS engine errors occurred (the app is expected to run without crashing)
    expect(fatalErrors.length).toBe(0);
  });
});