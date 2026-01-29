import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b4a9a1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Symmetric Cryptography Demo - FSM validation (63b4a9a1-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    // Auto-collect dialogs (alerts) so they don't block tests and so we can assert on them
    page.on('dialog', async (dialog) => {
      dialogs.push({
        type: dialog.type(),
        message: dialog.message()
      });
      await dialog.dismiss();
    });

    // Navigate to the app exactly as-is
    await page.goto(APP_URL);
    // Ensure DOM loaded and script executed
    await expect(page.locator('h1')).toHaveText('Symmetric Cryptography Demo');
  });

  test.afterEach(async () => {
    // Basic assertions about console and page errors are done in a dedicated test below.
    // Nothing to teardown explicitly here.
  });

  test('Initial state (S0_Idle): elements present and buttons disabled', async ({ page }) => {
    // Validate initial UI - Idle state of the FSM
    // Check presence of all main elements
    const keyInput = page.locator('#keyInput');
    const plaintextInput = page.locator('#plaintextInput');
    const encryptBtn = page.locator('#encryptBtn');
    const ciphertextOutput = page.locator('#ciphertextOutput');
    const decryptBtn = page.locator('#decryptBtn');
    const decryptedOutput = page.locator('#decryptedOutput');

    await expect(keyInput).toBeVisible();
    await expect(plaintextInput).toBeVisible();
    await expect(encryptBtn).toBeVisible();
    await expect(ciphertextOutput).toBeVisible();
    await expect(decryptBtn).toBeVisible();
    await expect(decryptedOutput).toBeVisible();

    // Encrypt and Decrypt should be disabled initially (no key / no plaintext)
    await expect(encryptBtn).toBeDisabled();
    await expect(decryptBtn).toBeDisabled();

    // Outputs should be empty
    await expect(ciphertextOutput).toHaveValue('');
    await expect(decryptedOutput).toHaveValue('');
  });

  test('Entering 16-char key transitions to S1_KeyEntered and enabling conditions', async ({ page }) => {
    // Validate that when a valid 16-char key is entered the internal UI state updates
    const keyInput1 = page.locator('#keyInput1');
    const encryptBtn1 = page.locator('#encryptBtn1');
    const plaintextInput1 = page.locator('#plaintextInput1');

    // Enter only key (16 characters), plaintext empty => encrypt must remain disabled
    await keyInput.fill('1234567890ABCDEF'); // 16 chars
    await expect(keyInput).toHaveValue('1234567890ABCDEF');

    // Since plaintext empty encrypt should still be disabled
    await expect(encryptBtn).toBeDisabled();

    // Now enter plaintext to move to S2_PlaintextEntered (combined with key we should enable encrypt)
    await plaintextInput.fill('Hello Playwright');
    await expect(plaintextInput).toHaveValue('Hello Playwright');

    // Now encrypt should be enabled (valid key length and non-empty plaintext)
    await expect(encryptBtn).toBeEnabled();
  });

  test('Encrypt cycle: S2_PlaintextEntered -> S3_Encrypted (ciphertext output updated)', async ({ page }) => {
    // This test validates encryption produces a non-empty base64 ciphertext and updates UI accordingly
    const keyInput2 = page.locator('#keyInput2');
    const plaintextInput2 = page.locator('#plaintextInput2');
    const encryptBtn2 = page.locator('#encryptBtn2');
    const ciphertextOutput1 = page.locator('#ciphertextOutput1');
    const decryptBtn1 = page.locator('#decryptBtn1');
    const decryptedOutput1 = page.locator('#decryptedOutput1');

    const plaintext = 'This is a secret message.';

    // Enter key and plaintext
    await keyInput.fill('abcdefghijklmnop'); // 16 chars
    await plaintextInput.fill(plaintext);

    // Wait for encrypt button to become enabled
    await expect(encryptBtn).toBeEnabled();

    // Click encrypt and ensure ciphertext is produced
    await encryptBtn.click();

    // ciphertextOutput should get a base64 string
    await expect(ciphertextOutput).toHaveValue(/^[A-Za-z0-9+/=]+$/);

    // After encryption decryptedOutput should be cleared
    await expect(decryptedOutput).toHaveValue('');

    // Decrypt button should be enabled now (ciphertext present & valid key)
    await expect(decryptBtn).toBeEnabled();
  });

  test('Decrypt cycle: S3_Encrypted -> S4_Decrypted (decrypted output equals plaintext)', async ({ page }) => {
    // Full encrypt & decrypt flow with the same key should return the original plaintext
    const keyInput3 = page.locator('#keyInput3');
    const plaintextInput3 = page.locator('#plaintextInput3');
    const encryptBtn3 = page.locator('#encryptBtn3');
    const ciphertextOutput2 = page.locator('#ciphertextOutput2');
    const decryptBtn2 = page.locator('#decryptBtn2');
    const decryptedOutput2 = page.locator('#decryptedOutput2');

    const plaintext1 = 'Restore this message after encryption.';

    // Enter key and plaintext
    await keyInput.fill('ABCDEFGHIJKLMNOP'); // 16 chars
    await plaintextInput.fill(plaintext);

    // Encrypt
    await expect(encryptBtn).toBeEnabled();
    await encryptBtn.click();

    // Ensure ciphertext is present
    const ciphertext = await ciphertextOutput.inputValue();
    expect(ciphertext).toBeTruthy();
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);

    // Decrypt
    await expect(decryptBtn).toBeEnabled();
    await decryptBtn.click();

    // decryptedOutput should equal plaintext
    await expect(decryptedOutput).toHaveValue(plaintext);
  });

  test('Decryption with wrong key triggers error dialog (edge case)', async ({ page }) => {
    // This test verifies an error scenario: encrypt with one key, then change key before decrypting
    // Expect decryption to fail and an alert dialog to be shown with 'Decryption failed'
    const keyInput4 = page.locator('#keyInput4');
    const plaintextInput4 = page.locator('#plaintextInput4');
    const encryptBtn4 = page.locator('#encryptBtn4');
    const decryptBtn3 = page.locator('#decryptBtn3');
    const ciphertextOutput3 = page.locator('#ciphertextOutput3');
    const decryptedOutput3 = page.locator('#decryptedOutput3');

    // Use first key to encrypt
    await keyInput.fill('firstfirstfirstf'); // 16 chars
    await plaintextInput.fill('Message that will fail to decrypt with another key');
    await expect(encryptBtn).toBeEnabled();
    await encryptBtn.click();

    // Ensure we have ciphertext
    await expect(ciphertextOutput).not.toHaveValue('');

    // Change the key to a different valid 16-char key
    await keyInput.fill('secondsecondseco'); // 16 chars

    // decryptBtn should be enabled because ciphertext present and key length valid
    await expect(decryptBtn).toBeEnabled();

    // Click decrypt - expect a dialog showing "Decryption failed" (the page shows alert on catch)
    // We captured dialogs in beforeEach; after clicking decrypt ensure a dialog was recorded
    await decryptBtn.click();

    // Wait briefly to allow dialog handler to fire and be recorded
    await page.waitForTimeout(200);

    // There should be at least one dialog and its message should include 'Decryption failed' OR 'Decryption failed:'
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toMatch(/Decryption failed/i);

    // After failed decryption decryptedOutput should be empty
    await expect(decryptedOutput).toHaveValue('');
  });

  test('Invalid key / plaintext combinations keep buttons disabled and produce alerts when triggered incorrectly', async ({ page }) => {
    // This test checks edge cases: short key and trying to cause invalid states.
    // Note: Buttons are disabled in these states, so we verify they remain disabled.
    const keyInput5 = page.locator('#keyInput5');
    const plaintextInput5 = page.locator('#plaintextInput5');
    const encryptBtn5 = page.locator('#encryptBtn5');
    const decryptBtn4 = page.locator('#decryptBtn4');

    // Enter plaintext without valid key -> encrypt should remain disabled
    await plaintextInput.fill('Some plaintext with no valid key');
    await expect(encryptBtn).toBeDisabled();

    // Enter invalid short key (less than 16)
    await keyInput.fill('shortkey');
    await expect(encryptBtn).toBeDisabled();

    // Try clicking disabled encrypt (Playwright will still perform click, but browser ignores)
    // We assert that clicking doesn't produce ciphertext and no dialog appears.
    await encryptBtn.click();
    await page.waitForTimeout(100);

    // No dialogs should have been produced in this flow (dialogs captured earlier may exist, but ensure no new ones)
    // We can't know prior count, but at least ensure there is not an alert specifically saying "Invalid key" from this action.
    const hasInvalidKeyDialog = dialogs.some(d => /Invalid key/i.test(d.message));
    expect(hasInvalidKeyDialog).toBeFalsy();
  });

  test('Console and page error monitoring - ensure no unexpected runtime Syntax/Reference/Type errors on load', async ({ page }) => {
    // This test inspects collected console messages and page errors.
    // According to the instruction, we only observe them (do not patch), and assert expected conditions.
    // Here we assert that there were no uncaught page errors (pageerror events).
    // Also ensure no console messages of type 'error' indicating runtime exceptions.

    // Allow some time for any asynchronous script errors to surface
    await page.waitForTimeout(200);

    // Assert there are no page errors (uncaught exceptions)
    // If the environment or implementation had thrown ReferenceError/SyntaxError/TypeError, they'd appear here.
    expect(pageErrors.length).toBe(0);

    // Assert there are no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM transition coverage summary (logical assertions tying states together)', async ({ page }) => {
    // This test provides an end-to-end logical validation of FSM transitions in a single scenario:
    // S0_Idle -> S1_KeyEntered -> S2_PlaintextEntered -> S3_Encrypted -> S4_Decrypted

    const keyInput6 = page.locator('#keyInput6');
    const plaintextInput6 = page.locator('#plaintextInput6');
    const encryptBtn6 = page.locator('#encryptBtn6');
    const decryptBtn5 = page.locator('#decryptBtn5');
    const ciphertextOutput4 = page.locator('#ciphertextOutput4');
    const decryptedOutput4 = page.locator('#decryptedOutput4');

    const key = 'ZYXWVUTSRQPONMLK'; // 16 chars
    const message = 'FSM end-to-end message';

    // S0 -> S1: enter key
    await keyInput.fill(key);
    await expect(keyInput).toHaveValue(key);

    // S1 -> S2: enter plaintext
    await plaintextInput.fill(message);
    await expect(plaintextInput).toHaveValue(message);

    // Now we should be eligible to encrypt (S2)
    await expect(encryptBtn).toBeEnabled();

    // S2 -> S3: encrypt
    await encryptBtn.click();
    await expect(ciphertextOutput).not.toHaveValue('');
    const ciphertext1 = await ciphertextOutput.inputValue();
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);

    // Ensure decrypt button enabled
    await expect(decryptBtn).toBeEnabled();

    // S3 -> S4: decrypt
    await decryptBtn.click();
    await expect(decryptedOutput).toHaveValue(message);

    // Final check: decrypted equals original plaintext
    const decrypted = await decryptedOutput.inputValue();
    expect(decrypted).toBe(message);
  });

});