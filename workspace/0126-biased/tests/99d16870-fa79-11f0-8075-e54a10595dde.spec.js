import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d16870-fa79-11f0-8075-e54a10595dde.html';

// Helper: replicate xorCipher logic from the page so tests can compute expected values
function xorCipherJS(text, key) {
  let output = '';
  for (let i = 0; i < text.length; i++) {
    output += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return output;
}

// Helper: replicate caesarCipher logic from the page so tests can compute expected values
function caesarCipherJS(text, shift) {
  return text.split('').map(char => {
    if (!char.match(/[a-zA-Z]/)) return char;
    const code = char.charCodeAt(0);
    const base = code >= 65 && code <= 90 ? 65 : 97;
    return String.fromCharCode((code - base + shift + 26) % 26 + base);
  }).join('');
}

test.describe('Encryption Interface - FSM Validation (Application ID: 99d16870-...)', () => {
  // We'll collect console.error and page errors that occur while loading/interacting with the page.
  // Tests will assert that there are no unexpected runtime errors.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console errors and page errors for assertions later in each test.
    page['_capturedConsoleErrors'] = [];
    page['_capturedPageErrors'] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        page['_capturedConsoleErrors'].push(msg.text());
      }
    });

    page.on('pageerror', err => {
      page['_capturedPageErrors'].push(err.message);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure the page loaded the main header (Idle state's evidence)
    await expect(page.locator('h1')).toHaveText('Simple Encryption Tool');
  });

  test.afterEach(async ({ page }) => {
    // Assert that no runtime errors (pageerror or console.error) occurred during the test.
    // This validates the application runs without throwing ReferenceError/SyntaxError/TypeError.
    const consoleErrors = page['_capturedConsoleErrors'] || [];
    const pageErrors = page['_capturedPageErrors'] || [];

    // If errors exist, include them in assertion messages to aid debugging.
    expect(consoleErrors.length, `Expected no console.error messages. Found: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Expected no page errors. Found: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('Initial state (S0_Idle): page renders and components exist', async ({ page }) => {
    // Validate entry evidence for Idle state: header present
    const header = page.locator('h1');
    await expect(header).toHaveText('Simple Encryption Tool');

    // Verify core components are present in the DOM
    await expect(page.locator('#inputText')).toBeVisible();
    await expect(page.locator('#encryptionMethod')).toBeVisible();
    await expect(page.locator('#shift')).toBeVisible();
    await expect(page.locator('#xorKey')).toBeVisible();
    await expect(page.locator('#outputText')).toBeVisible();

    // Both settings panels should be hidden initially (page does not auto-call updateEncryptionMethod on load)
    await expect(page.locator('#caesarSettings')).toHaveClass(/hidden/);
    await expect(page.locator('#xorSettings')).toHaveClass(/hidden/);
  });

  test('EncryptionMethodChanged transitions: show XOR settings then Caesar settings (S0 -> S2 and S0 -> S1)', async ({ page }) => {
    // Initially both hidden
    await expect(page.locator('#caesarSettings')).toHaveClass(/hidden/);
    await expect(page.locator('#xorSettings')).toHaveClass(/hidden/);

    // Change to XOR: should reveal xorSettings and hide caesarSettings
    await page.selectOption('#encryptionMethod', 'xor');
    await expect(page.locator('#xorSettings')).not.toHaveClass(/hidden/);
    await expect(page.locator('#caesarSettings')).toHaveClass(/hidden/);

    // Change to Caesar: should reveal caesarSettings and hide xorSettings
    await page.selectOption('#encryptionMethod', 'caesar');
    await expect(page.locator('#caesarSettings')).not.toHaveClass(/hidden/);
    await expect(page.locator('#xorSettings')).toHaveClass(/hidden/);
  });

  test.describe('Caesar Cipher interactions (S1_CaesarSettingsVisible -> S0_Idle)', () => {
    test('Encrypt and Decrypt round-trip with default shift', async ({ page }) => {
      // Ensure Caesar is selected and visible
      await page.selectOption('#encryptionMethod', 'caesar');
      await expect(page.locator('#caesarSettings')).not.toHaveClass(/hidden/);

      // Input text and perform encrypt
      await page.fill('#inputText', 'abc');
      await page.click('button[onclick="encryptText()"]');

      // Expect outputText to reflect Caesar shift by default value 3 => 'def'
      await expect(page.locator('#outputText')).toHaveValue('def');

      // Click decrypt: decrypt uses outputText as input and writes result back to outputText
      await page.click('button[onclick="decryptText()"]');
      await expect(page.locator('#outputText')).toHaveValue('abc');
    });

    test('Encrypt/Decrypt preserves non-alphabet characters and handles negative shifts', async ({ page }) => {
      await page.selectOption('#encryptionMethod', 'caesar');

      const input = 'Hello, World! 123';
      await page.fill('#inputText', input);

      // set shift to 1 and encrypt
      await page.fill('#shift', '1');
      await page.click('button[onclick="encryptText()"]');

      // Compute expected using local caesar function with shift 1
      const expectedEncrypted = caesarCipherJS(input, 1);
      await expect(page.locator('#outputText')).toHaveValue(expectedEncrypted);

      // Decrypt (should subtract shift)
      await page.click('button[onclick="decryptText()"]');
      const expectedDecrypted = caesarCipherJS(expectedEncrypted, -1);
      await expect(page.locator('#outputText')).toHaveValue(input);
      expect(expectedDecrypted).toBe(input);
    });

    test('Clear button resets fields and settings for Caesar', async ({ page }) => {
      await page.selectOption('#encryptionMethod', 'caesar');
      await page.fill('#inputText', 'test clear');
      await page.fill('#shift', '5');
      await page.fill('#xorKey', 'modified'); // ensure xorKey changes do not affect clear logic for Caesar

      // Click clear and validate expected observables (inputText and outputText cleared, defaults reset)
      await page.click('button[onclick="clearFields()"]');

      await expect(page.locator('#inputText')).toHaveValue('');
      await expect(page.locator('#outputText')).toHaveValue('');
      await expect(page.locator('#shift')).toHaveValue('3'); // reset to default 3
      await expect(page.locator('#xorKey')).toHaveValue('mykey'); // xorKey reset
    });

    test('Edge case: encrypting empty input results in empty output', async ({ page }) => {
      await page.selectOption('#encryptionMethod', 'caesar');
      await page.fill('#inputText', '');
      await page.click('button[onclick="encryptText()"]');
      await expect(page.locator('#outputText')).toHaveValue('');
    });

    test('Edge case: large shift values handled (wrap-around)', async ({ page }) {
      await page.selectOption('#encryptionMethod', 'caesar');

      // shift 25 should map 'a' -> 'z'
      await page.fill('#inputText', 'a');
      await page.fill('#shift', '25');
      await page.click('button[onclick="encryptText()"]');
      await expect(page.locator('#outputText')).toHaveValue('z');

      // decrypt should return 'a'
      await page.click('button[onclick="decryptText()"]');
      await expect(page.locator('#outputText')).toHaveValue('a');
    });
  });

  test.describe('XOR Cipher interactions (S2_XORSettingsVisible -> S0_Idle)', () => {
    test('Encrypt and Decrypt round-trip with default key', async ({ page }) => {
      // Show XOR settings
      await page.selectOption('#encryptionMethod', 'xor');
      await expect(page.locator('#xorSettings')).not.toHaveClass(/hidden/);

      const plain = 'hello';
      const key = await page.locator('#xorKey').inputValue(); // default 'mykey'

      await page.fill('#inputText', plain);
      await page.click('button[onclick="encryptText()"]');

      // Compute expected xor output using same algorithm
      const expectedEncrypted = xorCipherJS(plain, key);
      // outputText may contain non-printable characters but inputValue will return them as a JS string
      await expect(page.locator('#outputText')).toHaveValue(expectedEncrypted);

      // Click decrypt: xor is symmetric, so decrypting encrypted text should restore original
      await page.click('button[onclick="decryptText()"]');
      await expect(page.locator('#outputText')).toHaveValue(plain);
    });

    test('Encrypt with custom XOR key and validate decrypt', async ({ page }) {
      await page.selectOption('#encryptionMethod', 'xor');

      const plain = 'Playwright-123';
      const key = 'K'; // simple single-char key to make results easy to reason about
      await page.fill('#xorKey', key);
      await page.fill('#inputText', plain);
      await page.click('button[onclick="encryptText()"]');

      const expectedEncrypted = xorCipherJS(plain, key);
      await expect(page.locator('#outputText')).toHaveValue(expectedEncrypted);

      // Decrypt should yield original
      await page.click('button[onclick="decryptText()"]');
      await expect(page.locator('#outputText')).toHaveValue(plain);
    });

    test('Clear button resets fields and settings for XOR', async ({ page }) => {
      await page.selectOption('#encryptionMethod', 'xor');
      await page.fill('#inputText', 'some text');
      await page.fill('#xorKey', 'tempkey');
      await page.click('button[onclick="clearFields()"]');

      // After clearFields, input and output should be empty and xorKey reset to 'mykey'
      await expect(page.locator('#inputText')).toHaveValue('');
      await expect(page.locator('#outputText')).toHaveValue('');
      await expect(page.locator('#xorKey')).toHaveValue('mykey');
      await expect(page.locator('#shift')).toHaveValue('3'); // shift also reset
    });

    test('Edge case: encrypting empty input with XOR yields empty output', async ({ page }) {
      await page.selectOption('#encryptionMethod', 'xor');
      await page.fill('#inputText', '');
      await page.click('button[onclick="encryptText()"]');
      await expect(page.locator('#outputText')).toHaveValue('');
    });
  });

  test('Clicking Decrypt with empty output stays empty (robustness)', async ({ page }) => {
    await page.selectOption('#encryptionMethod', 'caesar');
    // Ensure output is empty
    await expect(page.locator('#outputText')).toHaveValue('');
    // Clicking decrypt should not throw and should keep output empty
    await page.click('button[onclick="decryptText()"]');
    await expect(page.locator('#outputText')).toHaveValue('');
  });

  test('Verify onclick/onchange handlers are present and correctly wired', async ({ page }) => {
    // Check that the inline event handlers exist in the DOM attributes (evidence from FSM)
    const encryptionMethod = await page.locator('#encryptionMethod').getAttribute('onchange');
    const encryptBtnOnclick = await page.locator('button', { hasText: 'Encrypt' }).getAttribute('onclick');
    const decryptBtnOnclick = await page.locator('button', { hasText: 'Decrypt' }).getAttribute('onclick');
    const clearBtnOnclick = await page.locator('button', { hasText: 'Clear' }).getAttribute('onclick');

    expect(encryptionMethod).toBe('updateEncryptionMethod()');
    expect(encryptBtnOnclick).toBe('encryptText()');
    expect(decryptBtnOnclick).toBe('decryptText()');
    expect(clearBtnOnclick).toBe('clearFields()');
  });
});