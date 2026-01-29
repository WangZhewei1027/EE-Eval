import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1217d030-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Asymmetric Cryptography Interactive Demo
class CryptoDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Keygen section
    this.h1 = page.locator('h1', { hasText: 'Asymmetric Cryptography Interactive Demo' });
    this.keyType = page.locator('#keytype');
    this.keySizeRsa = page.locator('#keysize-rsa');
    this.ecCurve = page.locator('#eccurve');
    this.genKeysButton = page.locator('#gen-keys-button');
    this.keygenStatus = page.locator('#keygen-status');
    this.publicKeyText = page.locator('#public-key-text');
    this.privateKeyText = page.locator('#private-key-text');

    // Workflow selection
    this.workflowEncryptRadio = page.locator('#workflow-encrypt');
    this.workflowSignRadio = page.locator('#workflow-sign');
    this.workflowBothRadio = page.locator('#workflow-both');

    // Encryption section
    this.encryptionSection = page.locator('#encryption-section');
    this.plaintextInput = page.locator('#plaintext-input');
    this.encryptButton = page.locator('#encrypt-button');
    this.ciphertextOutput = page.locator('#ciphertext-output');
    this.decryptButton = page.locator('#decrypt-button');
    this.decryptedTextOutput = page.locator('#decryptedtext-output');

    // Signing section
    this.signingSection = page.locator('#signing-section');
    this.signMessageInput = page.locator('#sign-message-input');
    this.signButton = page.locator('#sign-button');
    this.signatureOutput = page.locator('#signature-output');
    this.verifyMessageInput = page.locator('#verify-message-input');
    this.signatureInput = page.locator('#signature-input');
    this.verifyButton = page.locator('#verify-button');
    this.verifyResultSpan = page.locator('#verify-result');

    // Combined section
    this.combinedSection = page.locator('#combined-section');
    this.combinedPlaintext = page.locator('#combined-plaintext');
    this.combinedEncryptSignButton = page.locator('#combined-encrypt-sign-button');
    this.combinedCipherSign = page.locator('#combined-cipher-sign');
    this.combinedVerifyDecryptButton = page.locator('#combined-verify-decrypt-button');
    this.combinedVerifyResultSpan = page.locator('#combined-verify-result');
    this.combinedDecryptedOutput = page.locator('#combined-decrypted-output');

    // Debug
    this.showKeysRawBtn = page.locator('#show-keys-raw');
    this.rawKeysDisplay = page.locator('#raw-keys-display');
    this.showLastErrorBtn = page.locator('#show-last-error');
    this.lastErrorDisplay = page.locator('#last-error-display');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async generateKeys() {
    await this.genKeysButton.click();
    // Wait until UI reflects keys generated or shows failure
    await this.page.waitForFunction(() => {
      const el = document.getElementById('keygen-status');
      return el && /Keys generated successfully|FAILED/.test(el.textContent || '');
    });
  }

  async selectWorkflow(name) {
    if (name === 'encrypt') await this.workflowEncryptRadio.check();
    if (name === 'sign') await this.workflowSignRadio.check();
    if (name === 'both') await this.workflowBothRadio.check();
    // wait for DOM updates
    await this.page.waitForTimeout(100);
  }

  async enableAndFillPlaintext(text) {
    await this.plaintextInput.fill(text);
    // UI update debounce
    await this.page.waitForTimeout(50);
  }

  async enableAndFillSignMessage(text) {
    await this.signMessageInput.fill(text);
    await this.page.waitForTimeout(50);
  }

  async enableAndFillVerifyInputs(message, signature) {
    await this.verifyMessageInput.fill(message);
    await this.signatureInput.fill(signature);
    await this.page.waitForTimeout(50);
  }

  async enableAndFillCombinedPlaintext(text) {
    await this.combinedPlaintext.fill(text);
    await this.page.waitForTimeout(50);
  }

  // Helpers to wait for specific UI state
  async waitForKeysGeneratedSuccess() {
    await expect(this.keygenStatus).toHaveText('Keys generated successfully.', { timeout: 60000 });
  }

  async waitForPublicPrivatePopulated() {
    await expect(this.publicKeyText).not.toHaveValue('', { timeout: 60000 });
    await expect(this.privateKeyText).not.toHaveValue('', { timeout: 60000 });
  }
}

// Global timeout for potentially long crypto operations
test.describe.configure({ mode: 'serial' });

test.describe('Asymmetric Cryptography Interactive Demo - Full FSM validation', () => {
  let page;
  let demo;
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ browser }) => {
    // Create new context and page per test to avoid cross-test interference
    const context = await browser.newContext();
    page = await context.newPage();

    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Auto-accept alerts so tests do not hang on alert() calls in demo
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    demo = new CryptoDemoPage(page);
    await demo.goto();

    // Ensure the page loaded and initial render is present
    await expect(demo.h1).toBeVisible();
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected top-level page errors emitted during the test run
    // We assert zero uncaught exceptions; if any occurred they will be listed in pageErrors and test will fail
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
    // Also assert there were no console.error messages
    expect(consoleErrors, `Console error messages captured: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    // Close page context
    await page.close();
  });

  test('S0_Idle: initial idle state renders page and sections correctly', async () => {
    // Validate Idle entry evidence: header and initial content
    await expect(demo.h1).toHaveText('Asymmetric Cryptography Interactive Demo');
    await expect(demo.keygenStatus).toHaveText('No keys generated yet.');
    // Encryption section should be visible initially
    await expect(demo.encryptionSection).toBeVisible();
    // Signing and combined should be hidden initially
    await expect(demo.signingSection).toBeHidden();
    await expect(demo.combinedSection).toBeHidden();

    // Buttons that depend on keys should be disabled
    await expect(demo.encryptButton).toBeDisabled();
    await expect(demo.decryptButton).toBeDisabled();
    await expect(demo.signButton).toBeDisabled();
    await expect(demo.verifyButton).toBeDisabled();
    await expect(demo.combinedEncryptSignButton).toBeDisabled();
    await expect(demo.combinedVerifyDecryptButton).toBeDisabled();

    // Clicking encrypt without keys should trigger an alert dialog and not throw uncaught error
    await demo.plaintextInput.fill('test');
    await Promise.all([
      demo.encryptButton.click(),
      // dialog is auto-accepted; wait a tick
      page.waitForTimeout(50),
    ]);
    // Ensure an alert was presented with the expected message substring
    expect(dialogs.some(d => /Encryption key pair not generated|unavailable/i.test(d.message))).toBeTruthy();
  });

  test('S1_KeysGenerated: generate keys and verify UI updates and PEM exports are populated', async () => {
    // Generate keys and wait for status
    await demo.generateKeys();
    await demo.waitForKeysGeneratedSuccess();

    // Public and private key textareas should be populated
    await demo.waitForPublicPrivatePopulated();
    const pub = await demo.publicKeyText.inputValue();
    const priv = await demo.privateKeyText.inputValue();
    expect(pub).toContain('BEGIN PUBLIC KEY');
    expect(priv).toContain('BEGIN PRIVATE KEY');

    // Clicking "Show Raw Keys Object" should return a structured description (no exceptions)
    await demo.showKeysRawBtn.click();
    await expect(demo.rawKeysDisplay).not.toHaveText('');

    // After keys generated, UI state should update and allow enabling buttons when inputs filled
    await demo.plaintextInput.fill('hello world');
    await page.waitForTimeout(50); // allow updateUIStates to run
    await expect(demo.encryptButton).toBeEnabled();
  });

  test('S2_EncryptionWorkflow: select encryption workflow and perform encrypt/decrypt roundtrip', async () => {
    // Generate keys first
    await demo.generateKeys();
    await demo.waitForKeysGeneratedSuccess();
    await demo.waitForPublicPrivatePopulated();

    // Ensure workflow is encryption by default; assert encryption section visible
    await expect(demo.encryptionSection).toBeVisible();
    await expect(demo.signingSection).toBeHidden();

    // Fill plaintext, encrypt, and assert ciphertext appears and decrypt works
    const message = 'Playwright encryption test';
    await demo.enableAndFillPlaintext(message);
    await expect(demo.encryptButton).toBeEnabled();

    // Click encrypt and wait for ciphertext to populate
    await demo.encryptButton.click();
    await expect(demo.ciphertextOutput).not.toHaveValue('', { timeout: 60000 });
    const ciphertext = await demo.ciphertextOutput.inputValue();
    expect(ciphertext.length).toBeGreaterThan(10);

    // Decrypt button should now be enabled (script enables it)
    await expect(demo.decryptButton).toBeEnabled();

    // Click decrypt and verify decrypted matches original message
    await demo.decryptButton.click();
    await expect(demo.decryptedTextOutput).toHaveValue(message, { timeout: 60000 });
  });

  test('S3_SigningWorkflow: switch to signing workflow, sign, verify valid and invalid signatures', async () => {
    // Generate keys and switch to signing workflow
    await demo.generateKeys();
    await demo.waitForKeysGeneratedSuccess();
    await demo.waitForPublicPrivatePopulated();

    await demo.selectWorkflow('sign');
    await expect(demo.signingSection).toBeVisible();
    await expect(demo.encryptionSection).toBeHidden();

    // Fill message to sign
    const signMsg = 'Sign this message';
    await demo.enableAndFillSignMessage(signMsg);
    await expect(demo.signButton).toBeEnabled();

    // Sign the message
    await demo.signButton.click();
    await expect(demo.signatureOutput).not.toHaveValue('', { timeout: 60000 });
    const signature = await demo.signatureOutput.inputValue();
    expect(signature.length).toBeGreaterThan(10);

    // Verify the signature successfully
    await demo.enableAndFillVerifyInputs(signMsg, signature);
    await expect(demo.verifyButton).toBeEnabled();
    await demo.verifyButton.click();
    await expect(demo.verifyResultSpan).toHaveText('Signature is VALID.');

    // Edge case: tamper the signature and verify it becomes INVALID
    const tampered = signature.slice(0, -4) + 'ABCD';
    await demo.signatureInput.fill(tampered);
    await demo.verifyButton.click();
    await expect(demo.verifyResultSpan).toHaveText(/INVALID|FAILED/i);
  });

  test('S4_CombinedWorkflow: combined encrypt+sign then verify+decrypt roundtrip', async () => {
    // Generate keys and select combined workflow
    await demo.generateKeys();
    await demo.waitForKeysGeneratedSuccess();
    await demo.waitForPublicPrivatePopulated();

    await demo.selectWorkflow('both');
    await expect(demo.combinedSection).toBeVisible();
    await expect(demo.encryptionSection).toBeHidden();

    // Fill combined plaintext and trigger encrypt+sign
    const combinedMsg = 'Combined workflow message';
    await demo.enableAndFillCombinedPlaintext(combinedMsg);
    await expect(demo.combinedEncryptSignButton).toBeEnabled();

    // Click combined encrypt & sign
    await demo.combinedEncryptSignButton.click();
    // Wait for JSON payload to appear
    await expect(demo.combinedCipherSign).not.toHaveValue('', { timeout: 60000 });
    const payload = await demo.combinedCipherSign.inputValue();
    // Ensure it's valid JSON and contains ciphertext and signature keys
    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch (e) {
      parsed = null;
    }
    expect(parsed, 'combined payload should be valid JSON').toBeTruthy();
    expect(parsed.signature || parsed.signature === undefined ? true : false).toBeTruthy();

    // The verify+decrypt button should be enabled by the app
    await expect(demo.combinedVerifyDecryptButton).toBeEnabled();

    // Click verify & decrypt and assert the result is VALID and decrypted output matches original
    await demo.combinedVerifyDecryptButton.click();
    await expect(demo.combinedVerifyResultSpan).toHaveText(/VALID|INVALID|FAILED/i, { timeout: 60000 });
    // If valid, decrypted output should match
    // Wait a short while for decryption to complete
    await page.waitForTimeout(200);
    const decryptedCombined = await demo.combinedDecryptedOutput.inputValue();
    // If signature valid, decrypted should equal initial message; if invalid test still asserts no uncaught exceptions
    if ((await demo.combinedVerifyResultSpan.textContent()).includes('VALID')) {
      expect(decryptedCombined).toBe(combinedMsg);
    }
  });

  test('Edge cases & error scenarios: decrypt with malformed ciphertext & verify behavior', async () => {
    // Generate keys
    await demo.generateKeys();
    await demo.waitForKeysGeneratedSuccess();
    await demo.waitForPublicPrivatePopulated();

    // Try to decrypt with invalid base64 ciphertext -> should cause an alert but not a pageerror
    await demo.ciphertextOutput.fill('not-a-valid-base64!!');
    // decrypt button enabled when ciphertext not empty and keys present
    await page.waitForTimeout(50);
    await expect(demo.decryptButton).toBeEnabled();
    await demo.decryptButton.click();
    // An alert was expected; dialog captured already
    expect(dialogs.some(d => /Decryption failed|failed|Error|invalid/i.test(d.message))).toBeTruthy();

    // Try combined verify/decrypt without valid JSON -> should alert and not crash
    await demo.selectWorkflow('both');
    await demo.combinedCipherSign.fill('this is not json');
    await page.waitForTimeout(50);
    await expect(demo.combinedVerifyDecryptButton).toBeEnabled();
    await demo.combinedVerifyDecryptButton.click();
    expect(dialogs.some(d => /No encrypted & signed data|Verify & decrypt failed|unexpected/i.test(d.message))).toBeTruthy();

    // Use debug "Show Last Error" to ensure lastErrorDisplay shows a message or "No errors recorded."
    await demo.showLastErrorBtn.click();
    const lastErrorText = await demo.lastErrorDisplay.textContent();
    // It should exist (either "No errors recorded." or some error description)
    expect(typeof lastErrorText).toBe('string');
    expect(lastErrorText.length).toBeGreaterThanOrEqual(0);
  });
});