import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e7001-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Encryption app
class EncryptionPage {
  constructor(page) {
    this.page = page;
    this.messageInput = page.locator('#message');
    this.encryptButton = page.locator('#encrypt-button');
    this.decryptButton = page.locator('#decrypt-button');
    this.decryptButton2 = page.locator('#decrypt-button-2');
    this.decryptMessageInput = page.locator('#decrypt-message');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillMessage(text) {
    await this.messageInput.fill(text);
  }

  async clickEncrypt() {
    await this.encryptButton.click();
  }

  async clickDecrypt() {
    await this.decryptButton.click();
  }

  async clickDecrypt2() {
    await this.decryptButton2.click();
  }

  async getEncryptButtonDisabled() {
    return await this.encryptButton.isDisabled();
  }

  async getDecryptButtonDisabled() {
    return await this.decryptButton.isDisabled();
  }

  async getDecryptButton2Disabled() {
    return await this.decryptButton2.isDisabled();
  }

  async getEncryptButtonText() {
    return await this.encryptButton.textContent();
  }

  async getDecryptButtonText() {
    return await this.decryptButton.textContent();
  }

  async getDecryptMessageValue() {
    return await this.decryptMessageInput.inputValue();
  }

  async getMessageValue() {
    return await this.messageInput.inputValue();
  }

  async isDecryptMessageDisabled() {
    return await this.decryptMessageInput.isDisabled();
  }
}

test.describe('Encryption App - FSM states and transitions', () => {
  // Capture page errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // store error name and message for assertions / debugging
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Collect console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws, still capture basic info
        consoleMessages.push({ type: msg.type(), text: String(msg) });
      }
    });
  });

  // Helper to assert that no runtime ReferenceError/SyntaxError/TypeError occurred
  async function assertNoCriticalRuntimeErrors() {
    // Ensure there were no uncaught page errors
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);

    // Also scan console messages for the error keywords
    const badConsole = consoleMessages.filter(m =>
      /ReferenceError|TypeError|SyntaxError/.test(m.text)
    );
    expect(badConsole, `Found console error messages: ${JSON.stringify(badConsole, null, 2)}`).toHaveLength(0);
  }

  test('Initial Idle state (S0_Idle) - buttons present and enabled', async ({ page }) => {
    // Validate Idle initial state: both Encrypt and Decrypt buttons should exist and be enabled
    const app = new EncryptionPage(page);
    await app.goto();

    // Elements should be present
    await expect(app.messageInput).toBeVisible();
    await expect(app.encryptButton).toBeVisible();
    await expect(app.decryptButton).toBeVisible();
    await expect(app.decryptButton2).toBeVisible();
    await expect(app.decryptMessageInput).toBeVisible();

    // Initially both main buttons should be enabled (Idle)
    expect(await app.getEncryptButtonDisabled()).toBe(false);
    expect(await app.getDecryptButtonDisabled()).toBe(false);
    // decrypt-button-2 should also be enabled initially
    expect(await app.getDecryptButton2Disabled()).toBe(false);

    // Inputs should start empty
    expect(await app.getMessageValue()).toBe('');
    expect(await app.getDecryptMessageValue()).toBe('');

    // Ensure no runtime ReferenceError/SyntaxError/TypeError happened during load
    await assertNoCriticalRuntimeErrors();
  });

  test('Encrypt transition S0 -> S1: clicking Encrypt updates DOM and toggles buttons', async ({ page }) => {
    // This validates the EncryptClick event and the transition into "Encrypted" state
    const app = new EncryptionPage(page);
    await app.goto();

    // Enter a message and click encrypt
    const originalMessage = 'HelloWorld';
    await app.fillMessage(originalMessage);

    // Click encrypt and wait a short time for DOM update
    await app.clickEncrypt();
    // Small wait to let handlers run and DOM update (the implementation uses synchronous code but uses loops generating content)
    await page.waitForTimeout(50);

    // After encryption the encrypt button should be disabled (per FSM evidence)
    expect(await app.getEncryptButtonDisabled()).toBe(true);

    // Decrypt button should be enabled (encrypt sets decryptButton.disabled = false)
    expect(await app.getDecryptButtonDisabled()).toBe(false);

    // decrypt-message input should be populated with the encrypted value
    const encryptedVal = await app.getDecryptMessageValue();
    expect(typeof encryptedVal).toBe('string');
    expect(encryptedVal.length).toBeGreaterThan(0);
    // Encrypted value should not equal the plain original message
    expect(encryptedVal).not.toBe(originalMessage);

    // The encrypt and decrypt buttons swap their visible text content in the implementation
    expect((await app.getEncryptButtonText()).trim()).toBe('Decrypt');
    expect((await app.getDecryptButtonText()).trim()).toBe('Encrypt');

    // decrypt-message input is disabled by the encrypt() implementation
    expect(await app.isDecryptMessageDisabled()).toBe(true);

    // Validate no critical runtime errors occurred during this transition
    await assertNoCriticalRuntimeErrors();
  });

  test('Decrypt transition S1 -> S2: clicking Decrypt updates DOM and disables decrypt button', async ({ page }) => {
    // This validates decrypt behavior when the main decrypt button (decrypt-button) is clicked after encryption
    const app = new EncryptionPage(page);
    await app.goto();

    // Prepare encrypted state by filling message and clicking encrypt
    await app.fillMessage('TestMsg');
    await app.clickEncrypt();
    await page.waitForTimeout(50);

    // Ensure preconditions: decrypt button should be enabled after encrypt
    expect(await app.getDecryptButtonDisabled()).toBe(false);

    // Click decrypt (main decrypt button)
    await app.clickDecrypt();
    await page.waitForTimeout(50);

    // After decrypt, per implementation, decryptButton.disabled should become true
    expect(await app.getDecryptButtonDisabled()).toBe(true);

    // The decrypt-message input should contain a (new) value (the decrypt function mutates the value)
    const afterDecryptVal = await app.getDecryptMessageValue();
    expect(typeof afterDecryptVal).toBe('string');
    expect(afterDecryptVal.length).toBeGreaterThan(0);

    // decrypt sets encrypt button text back to 'Encrypt'
    expect((await app.getEncryptButtonText()).trim()).toBe('Encrypt');

    // decrypt also disables the decrypt-message input
    expect(await app.isDecryptMessageDisabled()).toBe(true);

    // Validate no critical runtime errors occurred during this transition
    await assertNoCriticalRuntimeErrors();
  });

  test('Attempt Decrypt from S2 using decrypt-button-2 (S2 -> S0 expected by FSM but validate actual behavior)', async ({ page }) => {
    // This test exercises the second decrypt button when in a post-decrypt state.
    // The FSM includes a S2 -> S0 transition on a DecryptClick event; we will perform decrypt via decrypt-button-2
    // and assert actual DOM effects (the implementation may not fully match FSM expectations).
    const app = new EncryptionPage(page);
    await app.goto();

    // Move to encrypted state first
    await app.fillMessage('EdgeCase');
    await app.clickEncrypt();
    await page.waitForTimeout(50);

    // Then decrypt using the main decrypt button
    await app.clickDecrypt();
    await page.waitForTimeout(50);

    // At this point decryptButton is expected to be disabled
    expect(await app.getDecryptButtonDisabled()).toBe(true);

    // decrypt-button-2 was not changed by decrypt() in the implementation; click it to trigger decrypt again
    // This simulates the FSM transition S2 -> S0 which expects another decrypt click may restore Idle
    expect(await app.getDecryptButton2Disabled()).toBe(false);
    await app.clickDecrypt2();
    await page.waitForTimeout(50);

    // After clicking decrypt-button-2, the decrypt-message input should be updated again (value mutated)
    const valAfterSecondDecrypt = await app.getDecryptMessageValue();
    expect(typeof valAfterSecondDecrypt).toBe('string');
    expect(valAfterSecondDecrypt.length).toBeGreaterThan(0);

    // decrypt() sets decryptButton.disabled = true (again) - ensure the main decrypt button remains disabled
    expect(await app.getDecryptButtonDisabled()).toBe(true);

    // The implementation does not re-enable encrypt button, but it does set encryptButton text to 'Encrypt'
    // Check the visible text regardless of whether the FSM expected a full Idle reset
    expect((await app.getEncryptButtonText()).trim()).toBe('Encrypt');

    // Validate no critical runtime errors occurred during this sequence
    await assertNoCriticalRuntimeErrors();
  });

  test('Edge case: clicking Decrypt from Idle (before any encryption) and observing behavior', async ({ page }) => {
    // This test validates behavior when the user clicks decrypt before encrypting any message.
    // According to implementation, decrypt will act on the decrypt-message input (likely empty) and then disable decryptButton.
    const app = new EncryptionPage(page);
    await app.goto();

    // Confirm starting in Idle
    expect(await app.getEncryptButtonDisabled()).toBe(false);
    expect(await app.getDecryptButtonDisabled()).toBe(false);

    // Click decrypt immediately
    await app.clickDecrypt();
    await page.waitForTimeout(50);

    // decrypt() should disable decryptButton
    expect(await app.getDecryptButtonDisabled()).toBe(true);

    // decrypt-message value should be some string (even if empty input, implementation writes a mutated value)
    const decryptVal = await app.getDecryptMessageValue();
    expect(typeof decryptVal).toBe('string');

    // Ensure encrypt button text remains or is set to 'Encrypt' per implementation
    expect((await app.getEncryptButtonText()).trim()).toBe('Encrypt');

    // Validate no critical runtime errors occurred during this edge case
    await assertNoCriticalRuntimeErrors();
  });

  test('Robustness: multiple sequential clicks across buttons do not produce runtime exceptions', async ({ page }) => {
    // This test rapidly exercises multiple buttons in sequence to trigger potential runtime issues.
    const app = new EncryptionPage(page);
    await app.goto();

    // Rapid interactions
    await app.fillMessage('Rapid');
    await app.clickEncrypt();
    await page.waitForTimeout(20);
    await app.clickDecrypt2();
    await page.waitForTimeout(20);

    // Try clicking decrypt main (might be disabled) using try/catch to avoid test crash if Playwright disallows click on disabled
    const decryptDisabled = await app.getDecryptButtonDisabled();
    if (!decryptDisabled) {
      await app.clickDecrypt();
    } else {
      // Try click decrypt-button-2 again
      await app.clickDecrypt2();
    }
    await page.waitForTimeout(50);

    // Ensure page remained alive and inputs/buttons exist
    await expect(app.encryptButton).toBeVisible();
    await expect(app.decryptButton).toBeVisible();
    await expect(app.decryptButton2).toBeVisible();

    // Final sanity checks
    expect(await app.getDecryptMessageValue().then(v => typeof v === 'string')).toBe(true);

    // Ensure no uncaught runtime errors occurred during rapid interactions
    await assertNoCriticalRuntimeErrors();
  });
});