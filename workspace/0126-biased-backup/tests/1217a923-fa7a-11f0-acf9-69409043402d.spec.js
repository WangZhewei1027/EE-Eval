import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1217a923-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the demo page to encapsulate interactions and selectors
class DemoPage {
  constructor(page, debugCollections) {
    this.page = page;
    this.debug = debugCollections; // { consoleMsgs:[], pageErrors:[], dialogs:[] }
    // selectors
    this.selectors = {
      algoSelect: '#algoSelect',
      keyInput: '#keyInput',
      keyHexCheckbox: '#keyHexCheckbox',
      ivInput: '#ivInput',
      generateRandomKeyBtn: '#generateRandomKeyBtn',
      generateRandomIvBtn: '#generateRandomIvBtn',
      plaintextInput: '#plaintextInput',
      encryptBtn: '#encryptBtn',
      ciphertextOutput: '#ciphertextOutput',
      copyCiphertextBtn: '#copyCiphertextBtn',
      clearCiphertextBtn: '#clearCiphertextBtn',
      ciphertextInput: '#ciphertextInput',
      decryptBtn: '#decryptBtn',
      decryptedOutput: '#decryptedOutput',
      clearPlaintextBtn: '#clearPlaintextBtn',
      keySizeRange: '#keySizeRange',
      keySizeLabel: '#keySizeLabel',
      modeSelect: '#modeSelect',
      applyAlgorithmChangesBtn: '#applyAlgorithmChangesBtn',
      showStateBtn: '#showStateBtn',
      clearStateBtn: '#clearStateBtn',
      stateDisplay: '#stateDisplay'
    };
  }

  // Navigation
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // allow initial script to run and update stateDisplay
    await this.page.waitForSelector(this.selectors.stateDisplay);
  }

  // State reading helpers
  async getStateDisplayText() {
    return (await this.page.locator(this.selectors.stateDisplay).innerText()).trim();
  }

  async getAlgorithmSelected() {
    return await this.page.$eval(this.selectors.algoSelect, el => el.value);
  }

  async getKeyInputValue() {
    return await this.page.$eval(this.selectors.keyInput, el => el.value);
  }

  async getIvInputValue() {
    return await this.page.$eval(this.selectors.ivInput, el => el.value);
  }

  async getPlaintextValue() {
    return await this.page.$eval(this.selectors.plaintextInput, el => el.value);
  }

  async getCiphertextOutputValue() {
    return await this.page.$eval(this.selectors.ciphertextOutput, el => el.value);
  }

  async getDecryptedOutputValue() {
    return await this.page.$eval(this.selectors.decryptedOutput, el => el.value);
  }

  // Actions
  async selectAlgorithm(value) {
    await this.page.selectOption(this.selectors.algoSelect, value);
    // wait for stateDisplay update
    await this.page.waitForTimeout(50);
  }

  async fillKey(value, asHex = false) {
    if (asHex) {
      await this.page.check(this.selectors.keyHexCheckbox);
    } else {
      // uncheck if already checked
      const isChecked = await this.page.$eval(this.selectors.keyHexCheckbox, el => el.checked);
      if (isChecked) await this.page.uncheck(this.selectors.keyHexCheckbox);
    }
    await this.page.fill(this.selectors.keyInput, value);
    // fire input event and wait briefly for update
    await this.page.waitForTimeout(50);
  }

  async fillIv(value) {
    await this.page.fill(this.selectors.ivInput, value);
    await this.page.waitForTimeout(50);
  }

  async clickGenerateRandomKey() {
    await this.page.click(this.selectors.generateRandomKeyBtn);
    // wait for update triggered by handler
    await this.page.waitForTimeout(100);
  }

  async clickGenerateRandomIv() {
    await this.page.click(this.selectors.generateRandomIvBtn);
    await this.page.waitForTimeout(100);
  }

  async fillPlaintext(value) {
    await this.page.fill(this.selectors.plaintextInput, value);
    await this.page.waitForTimeout(50);
  }

  async clickEncrypt() {
    await this.page.click(this.selectors.encryptBtn);
    // wait for potential async encryption and state update
    await this.page.waitForTimeout(250);
  }

  async clickClearCiphertext() {
    await this.page.click(this.selectors.clearCiphertextBtn);
    await this.page.waitForTimeout(50);
  }

  async fillCiphertextInput(value) {
    await this.page.fill(this.selectors.ciphertextInput, value);
    await this.page.waitForTimeout(50);
  }

  async clickDecrypt() {
    await this.page.click(this.selectors.decryptBtn);
    await this.page.waitForTimeout(250);
  }

  async clickClearState() {
    await this.page.click(this.selectors.clearStateBtn);
    await this.page.waitForTimeout(100);
  }

  async clickApplyAlgorithmChanges() {
    await this.page.click(this.selectors.applyAlgorithmChangesBtn);
    await this.page.waitForTimeout(100);
  }

  async setKeySizeRange(value) {
    // set range input using evaluate to ensure input event
    await this.page.$eval(this.selectors.keySizeRange, (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, value.toString());
    await this.page.waitForTimeout(50);
  }

  async setModeSelect(value) {
    await this.page.selectOption(this.selectors.modeSelect, value);
    await this.page.waitForTimeout(50);
  }

  async clickCopyCiphertext() {
    await this.page.click(this.selectors.copyCiphertextBtn);
    await this.page.waitForTimeout(50);
  }

  async clickShowState() {
    await this.page.click(this.selectors.showStateBtn);
    await this.page.waitForTimeout(50);
  }
}

test.describe('Symmetric Cryptography Interactive Demo - FSM validation', () => {
  let demo;
  let consoleMsgs;
  let pageErrors;
  let dialogMsgs;

  test.beforeEach(async ({ page }) => {
    consoleMsgs = [];
    pageErrors = [];
    dialogMsgs = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept dialogs but capture messages
    page.on('dialog', async dialog => {
      try {
        dialogMsgs.push(dialog.message());
        await dialog.accept();
      } catch {
        // ignore
      }
    });

    demo = new DemoPage(page, { consoleMsgs, pageErrors, dialogMsgs });
    await demo.goto();
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity checks about runtime errors after each test
    // Expect no unexpected uncaught exceptions on the page
    expect(pageErrors.length, `Page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Fail if console has any error-level messages (these indicate runtime issues)
    const errorConsole = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole.length, `Console errors/warnings: ${errorConsole.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Initial Idle state (S0_Idle) displays default internal state', async () => {
    // Validate initial stateDisplay contains default algorithm and no key/iv set
    const stateText = await demo.getStateDisplayText();
    expect(stateText).toContain('Current Internal State:');
    expect(stateText).toContain('Selected Algorithm: aes-128-cbc');
    expect(stateText).toContain('Key (0 bits): Not set');
    expect(stateText).toContain('IV/Nonce: Not set');
    expect(stateText).toContain('Last Encrypted (Base64): None');
    expect(stateText).toContain('Last Decrypted (UTF-8): None');
  });

  test('Algorithm change triggers Algorithm Selected (S1_AlgorithmSelected)', async () => {
    // Change algorithm to rc4 and verify state update
    await demo.selectAlgorithm('rc4');
    const stateText = await demo.getStateDisplayText();
    expect(stateText).toContain('Selected Algorithm: rc4');
  });

  test('Entering key transitions to Key Entered (S2_KeyEntered) and parsing hex/ASCII', async () => {
    // Provide a valid hex key and check that state display reports correct key bits and hex
    await demo.fillKey('0011223344556677', true); // 8 bytes -> 64 bits
    let stateText = await demo.getStateDisplayText();
    expect(stateText).toContain('Key (64 bits):');
    expect(stateText).toContain('0011223344556677');

    // Now enter ASCII key and ensure interpreted correctly (not hex)
    await demo.fillKey('hello-key', false);
    stateText = await demo.getStateDisplayText();
    // ASCII "hello-key" -> some number of bits; ensure Key not set is not present
    expect(stateText).not.toContain('Key (0 bits): Not set');
    expect(await demo.getKeyInputValue()).toBe('hello-key');
  });

  test('Entering IV transitions to IV Entered (S3_IVEntered)', async () => {
    // Provide a valid 16-byte hex IV and assert state shows it
    const ivHex = 'aabbccddeeff00112233445566778899'; // 32 hex chars -> 16 bytes
    await demo.fillIv(ivHex);
    const stateText = await demo.getStateDisplayText();
    expect(stateText).toContain('IV/Nonce:');
    expect(stateText).toContain('aabbccddeeff00112233445566778899');
  });

  test('Entering plaintext transitions to Plaintext Entered (S4_PlaintextEntered)', async () => {
    const sampleText = 'The quick brown fox jumps over the lazy dog';
    await demo.fillPlaintext(sampleText);
    // Plaintext isn't directly shown in stateDisplay, but the textarea should contain it
    expect(await demo.getPlaintextValue()).toBe(sampleText);
  });

  test('Encrypt with RC4 produces Ciphertext Generated (S5_CiphertextGenerated) and decrypt back (S7_PlaintextDecrypted)', async () => {
    // Choose RC4 which is implemented in JS (no IV required)
    await demo.selectAlgorithm('rc4');
    // Generate a random key for rc4
    await demo.clickGenerateRandomKey();
    const keyVal = await demo.getKeyInputValue();
    expect(keyVal.length).toBeGreaterThan(0);
    // Provide plaintext
    const plaintext = 'Secret message for RC4';
    await demo.fillPlaintext(plaintext);
    // Perform encryption
    await demo.clickEncrypt();
    const ct = await demo.getCiphertextOutputValue();
    expect(ct).toBeTruthy(); // ciphertext generated
    // Confirm stateDisplay shows last encrypted non-None
    let stateText = await demo.getStateDisplayText();
    expect(stateText).toMatch(/Last Encrypted \(Base64\): (?!None)/);

    // Clear ciphertext (transition S5 -> S6)
    await demo.clickClearCiphertext();
    const clearedCt = await demo.getCiphertextOutputValue();
    expect(clearedCt).toBe(''); // ciphertext cleared
    stateText = await demo.getStateDisplayText();
    expect(stateText).toContain('Last Encrypted (Base64): None');

    // Now re-encrypt so we have ciphertext to paste into decrypt
    await demo.clickEncrypt();
    const newCt = await demo.getCiphertextOutputValue();
    expect(newCt).toBeTruthy();

    // Paste ciphertext into ciphertextInput (S6_CiphertextEntered) and decrypt (S7)
    await demo.fillCiphertextInput(newCt);
    await demo.clickDecrypt();
    const decrypted = await demo.getDecryptedOutputValue();
    // For RC4 decryption should match original plaintext
    expect(decrypted).toBe(plaintext);
    // Ensure state displays last decrypted text
    stateText = await demo.getStateDisplayText();
    expect(stateText).toContain(`Last Decrypted (UTF-8): ${decrypted}`);
  });

  test('Clear all inputs and state returns to Idle (S0_Idle) from S7_PlaintextDecrypted', async () => {
    // Setup: select rc4, generate key, enter plaintext, encrypt & decrypt to reach S7
    await demo.selectAlgorithm('rc4');
    await demo.clickGenerateRandomKey();
    await demo.fillPlaintext('to be cleared');
    await demo.clickEncrypt();
    const ct = await demo.getCiphertextOutputValue();
    await demo.fillCiphertextInput(ct);
    await demo.clickDecrypt();
    const decrypted = await demo.getDecryptedOutputValue();
    expect(decrypted).toBe('to be cleared');

    // Now clear all state - this triggers an alert which we auto-accept and record
    await demo.clickClearState();
    // Check last dialog message includes expected message
    expect(dialogMsgs.some(msg => msg.includes('All inputs and internal state cleared.'))).toBeTruthy();

    // Verify stateDisplay shows no key/iv and no last encrypted/decrypted
    const stateText = await demo.getStateDisplayText();
    expect(stateText).toContain('Key (0 bits): Not set');
    expect(stateText).toContain('IV/Nonce: Not set');
    expect(stateText).toContain('Last Encrypted (Base64): None');
    expect(stateText).toContain('Last Decrypted (UTF-8): None');
  });

  test('Generate random key and IV for ChaCha20 and confirm inputs updated (GenerateRandomKey, GenerateRandomIV)', async () => {
    // Select ChaCha20
    await demo.selectAlgorithm('chacha20');
    // Generate key (should be 32 bytes => 64 hex chars)
    await demo.clickGenerateRandomKey();
    const keyHex = await demo.getKeyInputValue();
    expect(keyHex).toMatch(/^[0-9a-fA-F]+$/);
    expect(keyHex.length).toBeGreaterThanOrEqual(64); // 32 bytes hex
    // Checkbox should have been set to hex by the handler; ensure it persisted
    // Generate IV (should be 12 bytes => 24 hex chars)
    await demo.clickGenerateRandomIv();
    const ivHex = await demo.getIvInputValue();
    expect(ivHex).toMatch(/^[0-9a-fA-F]+$/);
    expect(ivHex.length).toBeGreaterThanOrEqual(24);
    // State display should reflect both key and iv
    const stateText = await demo.getStateDisplayText();
    expect(stateText).toMatch(/Selected Algorithm: chacha20/);
    expect(stateText).toMatch(/IV\/Nonce:/);
  });

  test('AES encrypt fails when IV missing (edge case and error scenario)', async () => {
    // Select AES-128-CBC (default already set, but ensure)
    await demo.selectAlgorithm('aes-128-cbc');
    // Generate a key but do NOT provide a valid IV
    await demo.clickGenerateRandomKey();
    // Clear iv if any
    await demo.fillIv('');
    // Attempt encryption - should produce an alert about missing IV for AES modes
    await demo.clickEncrypt();
    // Confirm we saw an alert with the expected message
    expect(dialogMsgs.some(msg => msg.includes('AES modes require a 16 byte (128 bit) IV'))).toBeTruthy();
  });

  test('Invalid hex key input results in Key not set (edge case)', async () => {
    // Check hex mode and enter invalid hex
    await demo.fillKey('zzzz-not-hex', true);
    const stateText = await demo.getStateDisplayText();
    // Key parse should fail and be reported as Not set
    expect(stateText).toContain('Key (0 bits): Not set');
  });

  test('Apply AES key size and mode change updates algo options and shows alert', async () => {
    // Change slider to 256 and mode to CTR, then apply
    await demo.setKeySizeRange(256);
    await demo.setModeSelect('ctr');
    await demo.clickApplyAlgorithmChanges();
    // An alert with algorithm update should have been displayed
    expect(dialogMsgs.some(m => m.includes('Algorithm updated to'))).toBeTruthy();
    // Now verify the algoSelect value reflects the chosen 256 and ctr
    const selectedAlgo = await demo.getAlgorithmSelected();
    expect(selectedAlgo).toBe('aes-256-ctr');
  });

  test('Copy ciphertext when there is none triggers No ciphertext to copy alert', async () => {
    // Ensure ciphertext output is empty
    expect(await demo.getCiphertextOutputValue()).toBe('');
    // Click copy - should alert 'No ciphertext to copy'
    await demo.clickCopyCiphertext();
    expect(dialogMsgs.some(msg => msg.includes('No ciphertext to copy'))).toBeTruthy();
  });

  test('Show current internal state (ShowState) triggers alert with state content', async () => {
    // Click showState which calls updateStateDisplay and alerts its content
    await demo.clickShowState();
    // We should have captured at least one dialog that includes 'Current Internal State'
    expect(dialogMsgs.some(msg => msg.includes('Current Internal State:'))).toBeTruthy();
  });
});