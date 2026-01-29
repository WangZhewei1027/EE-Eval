import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1217d031-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page Object Model for the Hash Functions Explorer page.
 * Encapsulates selectors and common actions to keep tests readable.
 */
class HashExplorerPage {
  constructor(page) {
    this.page = page;
    // Inputs / controls
    this.inputText = page.locator('#inputText');
    this.inputHex = page.locator('#inputHex');
    this.hashAlgorithm = page.locator('#hashAlgorithm');
    this.customHashDiv = page.locator('#customHashDiv');
    this.customHashCode = page.locator('#customHashCode');
    this.computeHashBtn = page.locator('#computeHash');
    this.hashOutputDec = page.locator('#hashOutputDec');
    this.hashOutputHex = page.locator('#hashOutputHex');

    // Collision
    this.targetCollisionDec = page.locator('#targetCollisionDec');
    this.collisionMaxLen = page.locator('#collisionMaxLen');
    this.runCollisionSearchBtn = page.locator('#runCollisionSearch');
    this.stopCollisionSearchBtn = page.locator('#stopCollisionSearch');
    this.collisionShowAll = page.locator('#collisionShowAll');
    this.collisionAsciiOnly = page.locator('#collisionAsciiOnly');
    this.collisionUseHex = page.locator('#collisionUseHex');
    this.collisionStatus = page.locator('#collisionStatus');
    this.collisionResults = page.locator('#collisionResults');

    // Byte extraction
    this.byteOffset = page.locator('#byteOffset');
    this.extractByteBtn = page.locator('#extractByteBtn');
    this.extractedByte = page.locator('#extractedByte');

    // Steps generation
    this.stepBy = page.locator('#stepBy');
    this.stepRange = page.locator('#stepRange');
    this.generateStepsBtn = page.locator('#generateSteps');
    this.stepsOutput = page.locator('#stepsOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main element to be ready
    await expect(this.inputText).toBeVisible();
  }

  // Helper to read textarea or input value via DOM property
  async getValue(locator) {
    return await locator.evaluate((el) => el.value);
  }

  async getTextContent(locator) {
    return await locator.evaluate((el) => el.textContent);
  }

  // Compute hash by clicking button (or pressing Enter in textarea)
  async computeHashByClick() {
    await this.computeHashBtn.click();
  }

  async computeHashByEnter() {
    await this.inputText.press('Enter');
  }

  // Toggle checkboxes
  async toggleInputHex() {
    await this.inputHex.click();
  }

  async toggleCollisionUseHex() {
    await this.collisionUseHex.click();
  }

  async selectAlgorithm(value) {
    await this.hashAlgorithm.selectOption(value);
  }

  async setCustomHashCode(code) {
    await this.customHashCode.fill(code);
  }

  async runCollisionSearch() {
    await this.runCollisionSearchBtn.click();
  }

  async stopCollisionSearch() {
    await this.stopCollisionSearchBtn.click();
  }

  async extractByte() {
    await this.extractByteBtn.click();
  }

  async generateSteps() {
    await this.generateStepsBtn.click();
  }
}

test.describe('Hash Functions Explorer - FSM and UI behavior', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions later
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    app = new HashExplorerPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial state (S0_Idle): default hash outputs initialize to 0', async () => {
    // On load, updateHashOutputs() is called. With empty input and default algorithm (simpleSum) result should be 0.
    const dec = await app.getValue(app.hashOutputDec);
    const hex = await app.getValue(app.hashOutputHex);

    // Validate the entry_action updateHashOutputs produced outputs
    expect(dec).toBe('0');
    expect(hex.toLowerCase()).toBe('00000000');

    // Ensure there were no uncaught page errors during initialization
    expect(pageErrors.length).toBe(0);
    // No console errors expected
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test.describe('Hash computation interactions (S1_HashComputed transitions)', () => {
    test('Compute hash via button click updates decimal and hex outputs', async () => {
      // Type a single character and compute
      await app.inputText.fill('A'); // ASCII 65
      await app.computeHashByClick();

      const dec = await app.getValue(app.hashOutputDec);
      const hex = await app.getValue(app.hashOutputHex);

      // For simpleSum, sum of bytes of 'A' => 65
      expect(dec).toBe(String(65));
      expect(hex.toLowerCase()).toBe('00000041');
    });

    test('Compute hash via Enter key in textarea triggers update', async () => {
      await app.inputText.fill('B'); // ASCII 66
      // Press Enter (no Shift) triggers keydown handler
      await app.inputText.press('Enter');

      const dec = await app.getValue(app.hashOutputDec);
      const hex = await app.getValue(app.hashOutputHex);

      expect(dec).toBe(String(66));
      expect(hex.toLowerCase()).toBe('00000042');
    });

    test('Toggle HEX interpretation recomputes and handles invalid HEX errors', async () => {
      // Enter an odd-length hex string to trigger parse error
      await app.inputText.fill('A'); // single char
      // Toggle HEX mode on
      await app.toggleInputHex();

      // Because of updateHashOutputs on change, the invalid hex length should be caught
      const decAfterToggle = await app.getValue(app.hashOutputDec);
      expect(decAfterToggle).toContain('HEX input length must be even');

      // Now provide valid hex for 'A' (41)
      await app.inputText.fill('41');
      // Toggling isn't necessary; change in input text does not auto-call updateHashOutputs for textarea input except on keydown,
      // but inputHex change already bound to update; to force update, click compute
      await app.computeHashByClick();

      const decValid = await app.getValue(app.hashOutputDec);
      const hexValid = await app.getValue(app.hashOutputHex);
      expect(decValid).toBe(String(65));
      expect(hexValid.toLowerCase()).toBe('00000041');

      // Turn HEX back off and ensure behavior remains consistent after recompute
      await app.toggleInputHex(); // disable hex interpretation
      await app.computeHashByClick();
      const decPlain = await app.getValue(app.hashOutputDec);
      // Now '41' as UTF-8 yields two characters '4' '1' -> bytes [52,49] sum = 101
      expect(decPlain).toBe(String(52 + 49));
    });

    test('Changing hash algorithm triggers recompute and custom algorithm UI visibility', async () => {
      // Selecting custom should display the custom hash code area
      await app.selectAlgorithm('custom');
      await expect(app.customHashDiv).toBeVisible();

      // With empty custom code, compute should produce an error message in the decimal output
      // (getHashFunction throws "Custom hash function code is empty", which updateHashOutputs catches)
      await app.computeHashByClick();
      const decErr = await app.getValue(app.hashOutputDec);
      expect(decErr).toContain('Custom hash function code is empty');

      // Provide a valid custom hash function that returns a fixed number
      const goodCode = 'function hash(bytes) { return 123; }';
      await app.setCustomHashCode(goodCode);
      // compute
      await app.computeHashByClick();
      const decGood = await app.getValue(app.hashOutputDec);
      const hexGood = await app.getValue(app.hashOutputHex);
      expect(decGood).toBe('123');
      expect(hexGood.toLowerCase()).toBe('0000007b');

      // Provide custom code that returns non-number -> should be reported as compile error
      const badReturnCode = 'function hash(bytes) { return "not-a-number"; }';
      await app.setCustomHashCode(badReturnCode);
      await app.computeHashByClick();
      const decBad = await app.getValue(app.hashOutputDec);
      expect(decBad).toContain('Hash function should return a number');
    });

    test('Editing custom hash code clears outputs until recompute (CustomHashCodeInput transition)', async () => {
      await app.selectAlgorithm('custom');
      const code = 'function hash(bytes) { return 7; }';
      await app.setCustomHashCode(code);
      await app.computeHashByClick();
      const decBefore = await app.getValue(app.hashOutputDec);
      expect(decBefore).toBe('7');

      // Modify custom code (trigger 'input' event) and expect outputs cleared automatically
      await app.customHashCode.fill('function hash(bytes) { return 9; }');
      // The event handler should clear hashOutputDec and hashOutputHex
      const decAfter = await app.getValue(app.hashOutputDec);
      const hexAfter = await app.getValue(app.hashOutputHex);
      expect(decAfter).toBe('');
      expect(hexAfter).toBe('');
    });
  });

  test.describe('Collision search behavior (S2_CollisionSearchRunning -> S3_CollisionSearchStopped)', () => {
    test('Running without target yields validation message', async () => {
      // Ensure target is empty
      await app.targetCollisionDec.fill('');
      await app.runCollisionSearch();

      const status = await app.getTextContent(app.collisionStatus);
      expect(status).toContain('Please enter the target hash value');
    });

    test('Invalid HEX target when collisionUseHex checked reported to user', async () => {
      await app.collisionUseHex.check();
      await app.targetCollisionDec.fill('ZZ'); // invalid hex
      await app.runCollisionSearch();

      const status = await app.getTextContent(app.collisionStatus);
      expect(status).toContain('Invalid hex target input');
      // Reset checkbox
      await app.collisionUseHex.uncheck();
    });

    test('Start then stop collision search toggles buttons and updates status', async () => {
      // Provide a valid numeric target that will let the search start.
      // Use target 0 which is valid decimal.
      await app.targetCollisionDec.fill('0');
      await app.collisionMaxLen.fill('1'); // keep search small so it doesn't run long
      // Ensure asciiOnly is checked (default), keep showAll unchecked
      await app.runCollisionSearch();

      // After clicking run, run button should be disabled and stop enabled
      await expect(app.runCollisionSearchBtn).toBeDisabled();
      await expect(app.stopCollisionSearchBtn).toBeEnabled();

      // Click stop to request cancellation
      await app.stopCollisionSearch();

      // The click handler sets collisionSearchRunning = false and updates status text and disables stop btn
      // Verify stop button becomes disabled after click
      await expect(app.stopCollisionSearchBtn).toBeDisabled();

      const status = (await app.getTextContent(app.collisionStatus)).toLowerCase();
      expect(status).toContain('stopping');

      // After stopping, the UI may take time to fully reset run/stop buttons (search loop yields),
      // but the immediate expectation is the stop button has been disabled.
    });
  });

  test.describe('Byte extraction (S4_ByteExtracted)', () => {
    test('Extract LSB byte after computing hash', async () => {
      // Input 'ABC' -> bytes 65,66,67 sum = 198 for simpleSum
      await app.selectAlgorithm('simpleSum');
      await app.inputHex.uncheck().catch(() => {}); // ensure plain text
      await app.inputText.fill('ABC');
      await app.computeHashByClick();

      const dec = await app.getValue(app.hashOutputDec);
      expect(dec).toBe(String(65 + 66 + 67));

      // Default byteOffset 0 -> LSB
      await app.byteOffset.fill('0');
      await app.extractByte();
      const extracted0 = await app.getValue(app.extractedByte);
      // 198 & 0xFF = 198
      expect(Number(extracted0)).toBe((65 + 66 + 67) & 0xFF);

      // offset 1 -> should be 0 for small sum
      await app.byteOffset.fill('1');
      await app.extractByte();
      const extracted1 = await app.getValue(app.extractedByte);
      expect(Number(extracted1)).toBe(0);
    });

    test('Extract byte handles missing currentHashValue gracefully (no crash)', async () => {
      // Ensure no hash computed (clear input and switch to custom with empty code to clear currentHashValue)
      await app.inputText.fill('');
      await app.selectAlgorithm('custom');
      // Ensure custom area visible
      await app.customHashCode.fill(''); // empty -> updateHashOutputs will error on compute, but currentHashValue null
      // Directly click extract without a valid currentHashValue
      await app.extractByte();
      // Should set extractedByte to empty string (per code)
      const extracted = await app.getValue(app.extractedByte);
      expect(extracted).toBe('');
    });
  });

  test.describe('Steps generation (S5_StepsGenerated)', () => {
    test('Generate step hashes produces expected number of lines and header', async () => {
      // Use a simple input and small range for quick generation
      await app.inputText.fill('A'); // bytes length 1
      await app.selectAlgorithm('simpleSum');
      await app.stepBy.fill('1');
      await app.stepRange.fill('4'); // small number of steps
      await app.generateSteps();

      const out = await app.getTextContent(app.stepsOutput);
      expect(out).toContain('Index | Input (hex bytes)');
      // Two header lines + stepRange lines
      const lines = out.split('\n').filter(l => l.length > 0);
      // We expect at least 2 header lines + 4 data lines = 6 lines
      expect(lines.length).toBeGreaterThanOrEqual(6);
    });

    test('Generate steps with invalid input parsing shows error message', async () => {
      // Force hex mode and give invalid hex to trigger parsing error
      await app.inputText.fill('Z'); // invalid hex
      await app.inputHex.check();
      await app.stepBy.fill('1');
      await app.stepRange.fill('2');
      await app.generateSteps();

      const out = await app.getTextContent(app.stepsOutput);
      expect(out).toContain('Error parsing input:');
      // Reset inputHex
      await app.inputHex.uncheck().catch(() => {});
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError occurred during interactions', async () => {
      // Perform a variety of quick interactions to surface potential runtime errors
      await app.inputText.fill('Hello');
      await app.computeHashByClick();
      await app.selectAlgorithm('fnv1a32');
      await app.computeHashByClick();
      await app.selectAlgorithm('xorBytes');
      await app.computeHashByClick();
      await app.selectAlgorithm('rot13Sum');
      await app.computeHashByClick();
      await app.selectAlgorithm('jsHash');
      await app.computeHashByClick();

      // Start a collision search with invalid input to exercise validation code
      await app.targetCollisionDec.fill('');
      await app.runCollisionSearch();

      // Check collected page errors and console errors and assert none are fatal runtime exceptions
      // We expect the app to handle errors internally; pageErrors should be empty.
      expect(pageErrors.length).toBe(0);

      // Also assert there are no console messages with severity 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // If there were any console warnings or infos, that's acceptable; we only fail on errors
    });
  });
});