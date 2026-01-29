import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1217a922-fa7a-11f0-acf9-69409043402d.html';

// Page object helper for the Encryption Interactive Demo
class EncryptionPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  }

  // Elements
  plaintext() { return this.page.locator('#plaintext'); }
  ciphertext() { return this.page.locator('#ciphertext'); }
  output() { return this.page.locator('#output-text'); }
  algorithm() { return this.page.locator('#algorithm'); }
  caesarShift() { return this.page.locator('#caesar-shift'); }
  vigenereKey() { return this.page.locator('#vigenere-key'); }
  xorKey() { return this.page.locator('#xor-key'); }
  aesPassword() { return this.page.locator('#aes-password'); }
  aesIV() { return this.page.locator('#aes-iv'); }
  encryptBtn() { return this.page.locator('#encrypt-btn'); }
  decryptBtn() { return this.page.locator('#decrypt-btn'); }
  clearBtn() { return this.page.locator('#clear-btn'); }
  copyOutputBtn() { return this.page.locator('#copy-output'); }
  swapTextsBtn() { return this.page.locator('#swap-texts'); }
  autoDecodeBase64Btn() { return this.page.locator('#auto-decode-base64'); }
  autoDecodeHexBtn() { return this.page.locator('#auto-decode-hex'); }
  hexInput() { return this.page.locator('#hex-input'); }
  hexOutput() { return this.page.locator('#hex-output'); }
  hexEncodeBtn() { return this.page.locator('#hex-encode-btn'); }
  hexDecodeBtn() { return this.page.locator('#hex-decode-btn'); }
  analyzePlaintextBtn() { return this.page.locator('#analyze-plaintext'); }
  analyzeCiphertextBtn() { return this.page.locator('#analyze-ciphertext'); }
  analysisOutput() { return this.page.locator('#analysis-output'); }

  // Actions
  async selectAlgorithm(value) {
    await this.algorithm().selectOption(value);
  }

  async clickEncrypt() {
    await this.encryptBtn().click();
  }

  async clickDecrypt() {
    await this.decryptBtn().click();
  }

  async clickClear() {
    await this.clearBtn().click();
  }

  async clickCopyOutput() {
    await this.copyOutputBtn().click();
  }

  async clickSwapTexts() {
    await this.swapTextsBtn().click();
  }

  async clickAutoDecodeBase64() {
    await this.autoDecodeBase64Btn().click();
  }

  async clickAutoDecodeHex() {
    await this.autoDecodeHexBtn().click();
  }

  async clickHexEncode() {
    await this.hexEncodeBtn().click();
  }

  async clickHexDecode() {
    await this.hexDecodeBtn().click();
  }

  async clickAnalyzePlaintext() {
    await this.analyzePlaintextBtn().click();
  }

  async clickAnalyzeCiphertext() {
    await this.analyzeCiphertextBtn().click();
  }

  // Helpers for waiting states
  async waitForOutputToNotBe(text, timeout = 2000) {
    await this.page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        return el && el.value !== expected;
      },
      this.output().selector(),
      text,
      { timeout }
    );
  }
}

test.describe('Encryption Interactive Demonstration (1217a922-...)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    // New context to avoid cross-test interference
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture console messages and page errors for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg);
    });

    // Navigate to the demo page
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Assert no unexpected page errors or console 'error' messages occurred during the test
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console error messages: ${consoleErrors.map(m => m.text()).join('\n')}`).toBe(0);
    await page.close();
  });

  test('Initial render - Idle state and parameter visibility (S0_Idle)', async () => {
    // Validate the page rendered and initial state elements are present
    const p = new EncryptionPage(page);

    await expect(page.locator('h1')).toHaveText('Encryption Interactive Demonstration');

    // Verify default textarea placeholders and select default
    await expect(p.plaintext()).toHaveAttribute('placeholder', 'Enter text here');
    await expect(p.ciphertext()).toHaveAttribute('placeholder', 'Enter text here');

    // Default algorithm should be 'caesar' (first option)
    await expect(p.algorithm().inputValue()).resolves.toBe('caesar');

    // Caesar param group visible, others hidden
    await expect(p.caesarShift()).toBeVisible();
    await expect(page.locator('#param-vigenere')).toHaveCSS('display', 'none');
    await expect(page.locator('#param-xor')).toHaveCSS('display', 'none');
    await expect(page.locator('#param-base64')).toHaveCSS('display', 'none');
    await expect(page.locator('#param-aes')).toHaveCSS('display', 'none');
  });

  test('Caesar cipher: Encrypt and Decrypt transitions (EncryptClick, DecryptClick)', async () => {
    const p = new EncryptionPage(page);

    // Input plaintext and encrypt with default shift=3
    await p.plaintext().fill('abcXYZ');
    await p.clickEncrypt();

    // Output should be Caesar shifted by 3 => 'defABC'
    await expect(p.output()).toHaveValue('defABC');

    // Now prepare decrypt: put ciphertext into ciphertext field and clear others
    await p.ciphertext().fill('defABC');
    await p.plaintext().fill('');
    await p.clickDecrypt();

    // Expect decrypted back to original 'abcXYZ'
    await expect(p.output()).toHaveValue('abcXYZ');

    // Clear fields action returns to idle state and resets parameters
    await p.plaintext().fill('something');
    await p.ciphertext().fill('else');
    await p.output().fill('output');
    await p.clickClear();

    await expect(p.plaintext()).toHaveValue('');
    await expect(p.ciphertext()).toHaveValue('');
    await expect(p.output()).toHaveValue('');
    // defaults
    await expect(p.caesarShift()).toHaveValue('3');
    await expect(p.vigenereKey()).toHaveValue('KEY');
    await expect(p.xorKey()).toHaveValue('secret');
    await expect(p.aesPassword()).toHaveValue('');
    await expect(p.aesIV()).toHaveValue('');
  });

  test('Vigenère cipher: validation and round-trip', async () => {
    const p = new EncryptionPage(page);

    // Switch algorithm to vigenere and validate visibility
    await p.selectAlgorithm('vigenere');
    await expect(page.locator('#param-vigenere')).toHaveCSS('display', 'block');

    // Invalid key (contains digit) should show validation message
    await p.plaintext().fill('HELLO');
    await p.vigenereKey().fill('K3Y');
    await p.clickEncrypt();
    await expect(p.output()).toHaveValue('Vigenère key must contain letters only.');

    // Valid key should encrypt and decrypt correctly
    await p.vigenereKey().fill('KEY');
    await p.clickEncrypt();
    const ct = await p.output().inputValue();
    expect(ct.length).toBeGreaterThan(0);

    // Use ciphertext for decrypt
    await p.ciphertext().fill(ct);
    await p.plaintext().fill('');
    await p.clickDecrypt();
    await expect(p.output()).toHaveValue('HELLO');
  });

  test('XOR cipher: encrypt produces hex and decrypt round-trip', async () => {
    const p = new EncryptionPage(page);

    await p.selectAlgorithm('xor');
    await expect(page.locator('#param-xor')).toHaveCSS('display', 'block');

    // Empty key should be rejected
    await p.xorKey().fill('');
    await p.plaintext().fill('hello');
    await p.clickEncrypt();
    await expect(p.output()).toHaveValue('XOR key must not be empty.');

    // With key, encryption produces hex output; decrypt restores original
    await p.xorKey().fill('secret');
    await p.plaintext().fill('hello');
    await p.clickEncrypt();
    const xorCipherHex = await p.output().inputValue();
    expect(xorCipherHex).toMatch(/^[0-9a-fA-F]+$/);

    // Decrypt path: put hex into ciphertext and decrypt
    await p.ciphertext().fill(xorCipherHex);
    await p.plaintext().fill('');
    await p.clickDecrypt();
    await expect(p.output()).toHaveValue('hello');
  });

  test('Base64 encode/decode with unicode and auto-decode feature', async () => {
    const p = new EncryptionPage(page);

    await p.selectAlgorithm('base64');
    await expect(page.locator('#param-base64')).toHaveCSS('display', 'block');

    // Use unicode including emoji to ensure UTF-8 handling
    const plain = 'Hello 🌍';
    await p.plaintext().fill(plain);
    await p.clickEncrypt();
    const b64 = await p.output().inputValue();
    expect(b64.length).toBeGreaterThan(0);

    // Decrypt using base64 algorithm
    await p.selectAlgorithm('base64');
    await p.ciphertext().fill(b64);
    await p.clickDecrypt();
    await expect(p.output()).toHaveValue(plain);

    // Auto-decode base64 button should decode valid base64 placed in plaintext
    await p.plaintext().fill(b64);
    await p.clickAutoDecodeBase64();
    await expect(p.plaintext()).toHaveValue(plain);

    // If invalid base64, an alert is expected (handled internally);
    // we check that it doesn't cause console errors (checked in afterEach).
  });

  test('AES-GCM: shows Encrypting/Decrypting states and round-trip with IV', async () => {
    const p = new EncryptionPage(page);

    await p.selectAlgorithm('aes');
    await expect(page.locator('#param-aes')).toHaveCSS('display', 'block');

    // AES encryption without password yields validation
    await p.aesPassword().fill('');
    await p.plaintext().fill('secret message');
    await p.clickEncrypt();
    await expect(p.output()).toHaveValue('Password required for AES.');

    // With a password, clicking encrypt should immediately set "Encrypting..." (S1_Encrypting)
    await p.aesPassword().fill('mypassword');
    await p.plaintext().fill('super secret text');
    await p.clickEncrypt();

    // Immediately check the intermediary state
    await expect(p.output()).toHaveValue('Encrypting...');

    // Wait for encryption to finish and produce ciphertext base64
    await p.waitForOutputToNotBe('Encrypting...', 5000);
    const ciphertext = await p.output().inputValue();
    expect(ciphertext.length).toBeGreaterThan(0);

    // AES encryption sets the IV input field as Base64 string
    const ivValue = await p.aesIV().inputValue();
    expect(ivValue.length).toBeGreaterThan(0);

    // Now test decryption flow: place ciphertext into ciphertext field and click decrypt
    await p.ciphertext().fill(ciphertext);

    // Decrypt without IV should show "IV is required for AES decryption."
    // Clear IV and attempt decrypt to see UI validation
    await p.aesIV().fill('');
    await p.clickDecrypt();
    await expect(p.output()).toHaveValue('IV is required for AES decryption.');

    // Put IV back and decrypt properly
    await p.aesIV().fill(ivValue);
    await p.clickDecrypt();
    await expect(p.output()).toHaveValue('Decrypting...');
    // Wait until decrypt finishes
    await p.waitForOutputToNotBe('Decrypting...', 5000);
    await expect(p.output()).toHaveValue('super secret text');
  }, 20000); // increase timeout for crypto operations

  test('Hex encode/decode and auto-decode-hex edge cases', async () => {
    const p = new EncryptionPage(page);

    // Hex encode empty input -> hexOutput empty
    await p.hexInput().fill('');
    await p.clickHexEncode();
    await expect(p.hexOutput()).toHaveValue('');

    // Encode then decode
    await p.hexInput().fill('test');
    await p.clickHexEncode();
    const hexed = await p.hexOutput().inputValue();
    expect(hexed).toMatch(/^[0-9a-f]+$/);

    // Now place hex string and decode
    await p.hexInput().fill(hexed);
    await p.clickHexDecode();
    await expect(p.hexOutput()).toHaveValue('test');

    // Auto-decode hex on plaintext: provide a hex string and auto-decode should set plaintext to decoded value
    await p.plaintext().fill(hexed);
    await p.clickAutoDecodeHex();
    await expect(p.plaintext()).toHaveValue('test');

    // Invalid hex input (odd length) should trigger an alert but not console errors; verify function returns explanatory string when called directly
    // We cannot call internal functions; instead validate hex-decode shows message in output when used via UI hex-decode on invalid string
    await p.hexInput().fill('abc'); // odd length -> invalid
    await p.clickHexDecode();
    await expect(p.hexOutput()).toHaveValue('Invalid hex string length');
  });

  test('Analysis tools and swap/copy controls (AnalyzePlaintextClick, AnalyzeCiphertextClick, SwapTextsClick, CopyOutputClick)', async () => {
    const p = new EncryptionPage(page);

    // Prepare text for analysis
    await p.plaintext().fill('aaab\nc');
    await p.clickAnalyzePlaintext();
    const analysis = await p.analysisOutput().textContent();
    expect(analysis).toContain('Total characters: 5');
    expect(analysis).toContain('a: 3');

    // Analyze ciphertext - set ciphertext and analyze
    await p.ciphertext().fill('xxxy');
    await p.clickAnalyzeCiphertext();
    const analysis2 = await p.analysisOutput().textContent();
    expect(analysis2).toContain('Total characters: 4');
    expect(analysis2).toContain('x: 3');

    // Swap input fields
    await p.plaintext().fill('plain1');
    await p.ciphertext().fill('cipher1');
    await p.clickSwapTexts();
    await expect(p.plaintext()).toHaveValue('cipher1');
    await expect(p.ciphertext()).toHaveValue('plain1');

    // Copy output: ensure clicking copy does not throw console errors
    // Put known output to copy
    await p.plaintext().fill('copy-me');
    // Use base64 algorithm to produce stable printable output
    await p.selectAlgorithm('base64');
    await p.clickEncrypt();
    const out = await p.output().inputValue();
    expect(out.length).toBeGreaterThan(0);

    // Clicking copy should not cause console errors (checked in afterEach)
    await p.clickCopyOutput();

    // Note: we do not assert clipboard contents here to avoid requiring extra permissions.
  });

  test('Algorithm change toggles parameter groups (AlgorithmChange)', async () => {
    const p = new EncryptionPage(page);

    // Go through each algorithm and check visibility of correct parameter group
    await p.selectAlgorithm('caesar');
    await expect(page.locator('#param-caesar')).toHaveCSS('display', 'block');

    await p.selectAlgorithm('vigenere');
    await expect(page.locator('#param-vigenere')).toHaveCSS('display', 'block');

    await p.selectAlgorithm('xor');
    await expect(page.locator('#param-xor')).toHaveCSS('display', 'block');

    await p.selectAlgorithm('base64');
    await expect(page.locator('#param-base64')).toHaveCSS('display', 'block');

    await p.selectAlgorithm('aes');
    await expect(page.locator('#param-aes')).toHaveCSS('display', 'block');
  });
});