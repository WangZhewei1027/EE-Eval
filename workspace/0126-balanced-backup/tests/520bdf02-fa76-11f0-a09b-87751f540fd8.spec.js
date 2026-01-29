import { test, expect } from '@playwright/test';

test.describe('Encryption app FSM (Application ID: 520bdf02-fa76-11f0-a09b-87751f540fd8)', () => {
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bdf02-fa76-11f0-a09b-87751f540fd8.html';

  // Page Object for the encryption page to encapsulate selectors and common actions
  class EncryptionPage {
    constructor(page) {
      this.page = page;
      this.encryptBtn = page.locator('#encrypt-btn');
      this.decryptBtn = page.locator('#decrypt-btn');
      this.output = page.locator('#output');
    }

    // Navigate to the app
    async goto() {
      await this.page.goto(APP_URL);
    }

    // Helper: click encrypt and provide a prompt response (or dismiss if nullProvided = true)
    // Returns any pageerror that occurs after accepting the prompt (if any).
    async clickEncryptAndHandlePrompt({ provideValue = null, expectPrompt = true } = {}) {
      // Click will open a prompt dialog first. Use Promise.all to race click and dialog event reliably.
      const [prompt] = await Promise.all([
        this.page.waitForEvent('dialog'),
        this.encryptBtn.click()
      ]);
      // The dialog for this handler is a prompt
      if (!expectPrompt) {
        // If caller didn't expect a prompt, dismiss it to avoid blocking
        await prompt.dismiss();
        return null;
      }
      if (provideValue === null) {
        // simulate Cancel
        await prompt.dismiss();
        // After dismiss, an alert should appear in the application code path
        const alertDialog = await this.page.waitForEvent('dialog');
        // Return the alert dialog so the caller can assert message and accept it
        return { prompt, alertDialog };
      } else {
        // Provide a key and accept the prompt
        await prompt.accept(provideValue);
        // After accepting, the encrypt function runs and, due to the page implementation bug,
        // a runtime exception (TypeError: Assignment to constant variable) is expected.
        // The consumer of this helper can await page.waitForEvent('pageerror') separately.
        return { prompt };
      }
    }

    // Similar helper for decrypt button
    async clickDecryptAndHandlePrompt({ provideValue = null, expectPrompt = true } = {}) {
      const [prompt] = await Promise.all([
        this.page.waitForEvent('dialog'),
        this.decryptBtn.click()
      ]);
      if (!expectPrompt) {
        await prompt.dismiss();
        return null;
      }
      if (provideValue === null) {
        await prompt.dismiss();
        const alertDialog = await this.page.waitForEvent('dialog');
        return { prompt, alertDialog };
      } else {
        await prompt.accept(provideValue);
        return { prompt };
      }
    }
  }

  test.beforeEach(async ({ page }) => {
    // Navigate to the page before each test
    const ep = new EncryptionPage(page);
    await ep.goto();
  });

  // Test the Idle state: verifies initial render and presence of components
  test('S0_Idle state: initial render shows Encrypt/Decrypt buttons and empty output', async ({ page }) => {
    // This test validates the Idle state's evidence: the two buttons and the output div exist and output is empty.
    const ep = new EncryptionPage(page);

    // Buttons should be visible and have expected text
    await expect(ep.encryptBtn).toBeVisible();
    await expect(ep.encryptBtn).toHaveText('Encrypt');

    await expect(ep.decryptBtn).toBeVisible();
    await expect(ep.decryptBtn).toHaveText('Decrypt');

    // Output should initially be empty
    await expect(ep.output).toHaveText('');
  });

  // Test Encrypt transition where user enters a key (success path)
  test('Transition: S0_Idle -> S1_Encrypting when clicking Encrypt and providing key (expect runtime error in implementation)', async ({ page }) => {
    // This test exercises the EncryptClick event and the expected observable behavior from the FSM.
    // The implementation contains a bug that causes a runtime TypeError when trying to append to a const string.
    // We must let that error happen and assert it occurred, and also assert that output was not updated.
    const ep = new EncryptionPage(page);

    // Click encrypt and handle the prompt by providing a key 'A'
    // Use Promise.all to ensure we capture the dialog and then click.
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      ep.encryptBtn.click()
    ]);
    expect(dialog.type()).toBe('prompt');
    // Accept the prompt with a single-character key
    await dialog.accept('A');

    // After providing the key, the page's encrypt() function runs and is expected to throw a runtime error.
    const pageError = await page.waitForEvent('pageerror');
    // The implementation's bug is "Assignment to constant variable" when doing encryptedText += ...
    // Assert that the error message indicates assignment to constant (case-insensitive)
    expect(pageError.message.toLowerCase()).toMatch(/assignment to constant|assignment/i);

    // The output should remain unchanged (empty) because the exception prevents the assignment to outputDiv.innerText
    await expect(ep.output).toHaveText('');
  });

  // Edge case: user cancels the prompt when clicking Encrypt -> should trigger an alert asking for valid key, no runtime error
  test('Encrypt cancel path: clicking Encrypt and cancelling prompt shows alert and leaves output unchanged', async ({ page }) => {
    // This test validates the branch where user cancels the prompt: the code should show an alert 'Please enter a valid key'
    const ep = new EncryptionPage(page);

    // Click encrypt and dismiss the prompt (simulate Cancel)
    const [prompt] = await Promise.all([
      page.waitForEvent('dialog'),
      ep.encryptBtn.click()
    ]);
    expect(prompt.type()).toBe('prompt');
    await prompt.dismiss();

    // The application code then calls alert('Please enter a valid key'); capture that alert
    const alertDialog = await page.waitForEvent('dialog');
    expect(alertDialog.type()).toBe('alert');
    expect(alertDialog.message()).toContain('Please enter a valid key');
    await alertDialog.accept();

    // Ensure the output remains empty
    await expect(ep.output).toHaveText('');

    // There should be no pageerror thrown in this control flow (no runtime TypeError)
    // We'll give a brief wait to ensure no pageerror appeared asynchronously
    let pageErrorOccurred = false;
    try {
      await page.waitForEvent('pageerror', { timeout: 200 });
      pageErrorOccurred = true;
    } catch (e) {
      // Expected timeout because no pageerror should occur
      pageErrorOccurred = false;
    }
    expect(pageErrorOccurred).toBe(false);
  });

  // Test Decrypt transition where user enters a key (success path) -> similar to encrypt; expect runtime error and no output change
  test('Transition: S0_Idle -> S2_Decrypting when clicking Decrypt and providing key (expect runtime error in implementation)', async ({ page }) => {
    // This test exercises the DecryptClick event; the implementation bug in decrypt() will similarly throw.
    const ep = new EncryptionPage(page);

    // Click decrypt and accept the prompt with a key
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      ep.decryptBtn.click()
    ]);
    expect(dialog.type()).toBe('prompt');
    await dialog.accept('B');

    // Expect the runtime error to be emitted from the page due to the const reassignment bug
    const pageError = await page.waitForEvent('pageerror');
    expect(pageError.message.toLowerCase()).toMatch(/assignment to constant|assignment/i);

    // Output should remain empty because the decrypt routine threw before updating outputDiv
    await expect(ep.output).toHaveText('');
  });

  // Edge case: user cancels the prompt when clicking Decrypt -> should trigger alert and no runtime error
  test('Decrypt cancel path: clicking Decrypt and cancelling prompt shows alert and leaves output unchanged', async ({ page }) => {
    // Validate cancel behavior for decrypt: an alert appears asking for valid key and no runtime error occurs.
    const ep = new EncryptionPage(page);

    const [prompt] = await Promise.all([
      page.waitForEvent('dialog'),
      ep.decryptBtn.click()
    ]);
    expect(prompt.type()).toBe('prompt');
    await prompt.dismiss();

    const alertDialog = await page.waitForEvent('dialog');
    expect(alertDialog.type()).toBe('alert');
    expect(alertDialog.message()).toContain('Please enter a valid key');
    await alertDialog.accept();

    // Output should still be empty
    await expect(ep.output).toHaveText('');

    // Ensure no pageerror occurs in this flow
    let pageErrorOccurred = false;
    try {
      await page.waitForEvent('pageerror', { timeout: 200 });
      pageErrorOccurred = true;
    } catch (e) {
      pageErrorOccurred = false;
    }
    expect(pageErrorOccurred).toBe(false);
  });

  // Additional test: repeated clicks produce repeated runtime errors (verifies the processing states are reached repeatedly)
  test('Repeated Encrypt clicks with key produce runtime errors each time (verifies repeated transition behavior)', async ({ page }) => {
    const ep = new EncryptionPage(page);

    // Helper to invoke encrypt with a provided key and capture the pageerror
    async function invokeEncryptWithKey(key) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        ep.encryptBtn.click()
      ]);
      await dialog.accept(key);
      const err = await page.waitForEvent('pageerror');
      return err;
    }

    const err1 = await invokeEncryptWithKey('X');
    expect(err1.message.toLowerCase()).toMatch(/assignment to constant|assignment/i);

    const err2 = await invokeEncryptWithKey('Y');
    expect(err2.message.toLowerCase()).toMatch(/assignment to constant|assignment/i);

    // Output remains empty after both failures
    await expect(ep.output).toHaveText('');
  });
});