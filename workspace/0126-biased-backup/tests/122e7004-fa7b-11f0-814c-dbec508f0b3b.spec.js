import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e7004-fa7b-11f0-814c-dbec508f0b3b.html';

class HashDemoPage {
  /**
   * Page Object for the Hash Functions Demo app.
   * Encapsulates common interactions and element accessors.
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input');
    this.hashButton = page.locator('#hash-button');
    this.generateBtn = page.locator('#generate-btn');
    this.lengthSelect = page.locator('#length');
    this.algorithmSelect = page.locator('#algorithm');
    this.hashOutput = page.locator('#hash');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(text) {
    await this.input.fill(text);
  }

  async selectLength(value) {
    await this.lengthSelect.selectOption({ value: String(value) });
  }

  async selectAlgorithm(value) {
    await this.algorithmSelect.selectOption({ value });
  }

  async clickHash() {
    await this.hashButton.click();
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async getHashText() {
    return (await this.hashOutput.textContent()) ?? '';
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }
}

test.describe('Hash Functions Demo (Application ID: 122e7004-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Each test will navigate to the page and attach listeners for observing runtime errors and console messages.
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh page state per test
    await page.goto('about:blank');
  });

  test('Initial Idle state: UI elements present and outputs empty', async ({ page }) => {
    // This test validates the initial "Idle" state (S0_Idle) expectations:
    // - The input, buttons, selects and output visuals exist and are visible.
    // - The output areas are empty (no hash calculated yet).
    const demo = new HashDemoPage(page);
    await demo.goto();

    // Verify core controls are visible
    await expect(demo.input).toBeVisible();
    await expect(demo.hashButton).toBeVisible();
    await expect(demo.generateBtn).toBeVisible();
    await expect(demo.lengthSelect).toBeVisible();
    await expect(demo.algorithmSelect).toBeVisible();
    await expect(demo.hashOutput).toBeVisible();
    await expect(demo.output).toBeVisible();

    // Verify placeholders and default select values
    await expect(demo.input).toHaveAttribute('placeholder', 'Enter a string');
    await expect(demo.lengthSelect).toHaveValue('32'); // default first option
    await expect(demo.algorithmSelect).toHaveValue('sha256'); // default first option

    // No hash should be displayed yet
    const hashText = await demo.getHashText();
    const outputText = await demo.getOutputText();
    expect(hashText.trim()).toBe('', 'Expected no initial text in #hash pre element');
    expect(outputText.trim()).toBe('', 'Expected no initial text in #output pre element');
  });

  test('Click "Calculate Hash" (#hash-button) triggers runtime error (crypto.createHash) and does not populate output', async ({ page }) => {
    // This test simulates the Calculate Hash transition (CalculateHashClick).
    // The implementation uses crypto.createHash in the browser context which is not available;
    // we must observe the resulting runtime error and verify no output was produced.
    const demo = new HashDemoPage(page);
    await demo.goto();

    // Prepare to capture page errors produced by the runtime
    const errorPromise = page.waitForEvent('pageerror');

    // Fill example input
    await demo.fillInput('hello world');

    // Trigger the click that should call generateHash and (in this broken environment) throw.
    // Wait for the pageerror event to ensure the exception is observed.
    const error = await Promise.all([errorPromise, demo.clickHash()]).then(([e]) => e);

    // Assert that an error occurred and that it is related to missing Node-style crypto.createHash
    expect(error).toBeTruthy();
    // Different browsers may vary slightly in wording; check for presence of "createHash" to ensure it's the expected failure
    expect(error.message).toMatch(/createHash/i);

    // Verify that the hash output did not get populated due to the error
    const hashTextAfter = await demo.getHashText();
    expect(hashTextAfter.trim()).toBe('', 'Expected #hash to remain empty after runtime error');

    const outputTextAfter = await demo.getOutputText();
    expect(outputTextAfter.trim()).toBe('', 'Expected #output to remain empty after runtime error');
  });

  test('Click "Generate Hash" (#generate-btn) triggers same runtime error and leaves outputs unchanged', async ({ page }) => {
    // This test covers the GenerateHashClick event/transition.
    const demo = new HashDemoPage(page);
    await demo.goto();

    // Monitor for runtime exception
    const errorPromise = page.waitForEvent('pageerror');

    // Provide input and click the generate button
    await demo.fillInput('another test string');

    // Click and wait for the page error produced by the handler
    const error = await Promise.all([errorPromise, demo.clickGenerate()]).then(([e]) => e);
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/createHash/i);

    // Confirm that neither the #hash nor #output elements contain a calculated hash
    expect((await demo.getHashText()).trim()).toBe('');
    expect((await demo.getOutputText()).trim()).toBe('');
  });

  test('Changing length and algorithm options still results in the same runtime error when generating', async ({ page }) => {
    // This test ensures that the UI controls (length & algorithm) are interactive,
    // but the underlying runtime error still occurs independent of those values.
    const demo = new HashDemoPage(page);
    await demo.goto();

    // Verify we can change selects
    await demo.selectLength('64');
    await expect(demo.lengthSelect).toHaveValue('64');

    await demo.selectAlgorithm('md5');
    await expect(demo.algorithmSelect).toHaveValue('md5');

    // Prepare to capture the runtime error
    const errorPromise = page.waitForEvent('pageerror');

    // Input and click generate
    await demo.fillInput('input for md5 test');
    const error = await Promise.all([errorPromise, demo.clickGenerate()]).then(([e]) => e);
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/createHash/i);

    // Ensure output still empty
    expect((await demo.getHashText()).trim()).toBe('');
    expect((await demo.getOutputText()).trim()).toBe('');
  });

  test('Edge case: empty input still triggers runtime error and no output is produced', async ({ page }) => {
    // Even with empty input (edge case), the event handler runs and the runtime crypto issue surfaces.
    const demo = new HashDemoPage(page);
    await demo.goto();

    // Ensure input is empty
    await demo.fillInput('');
    await expect(demo.input).toHaveValue('');

    // Capture error
    const errorPromise = page.waitForEvent('pageerror');
    const error = await Promise.all([errorPromise, demo.clickHash()]).then(([e]) => e);
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/createHash/i);

    // No output expected
    expect((await demo.getHashText()).trim()).toBe('');
    expect((await demo.getOutputText()).trim()).toBe('');
  });

  test('Edge case: very long input triggers the same runtime error (stress input)', async ({ page }) => {
    // Provide a very large input string to exercise potential input-handling paths.
    const demo = new HashDemoPage(page);
    await demo.goto();

    const longInput = 'A'.repeat(10000); // 10k characters
    await demo.fillInput(longInput);

    // Capture page error that should result from calling crypto.createHash in the browser
    const errorPromise = page.waitForEvent('pageerror');
    const error = await Promise.all([errorPromise, demo.clickGenerate()]).then(([e]) => e);
    expect(error).toBeTruthy();
    expect(error.message).toMatch(/createHash/i);

    // Outputs should remain unchanged
    expect((await demo.getHashText()).trim()).toBe('');
    expect((await demo.getOutputText()).trim()).toBe('');
  });

  test('Behavioral observation: event listeners for buttons are wired (click triggers handler even if it errors)', async ({ page }) => {
    // This test verifies that clicking the buttons triggers the attached handlers (the handler runs and errors).
    // It does not attempt to access generateHash directly (top-level const is not on window).
    const demo = new HashDemoPage(page);
    await demo.goto();

    // Use page.on to capture console events and page errors to ensure the click executes script path.
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', e => pageErrors.push(e));
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    // Click the hash button and wait for the error
    await Promise.all([page.waitForEvent('pageerror'), demo.clickHash()]);

    // After click, we should have recorded at least one runtime error confirming the handler executed
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors[0].message).toMatch(/createHash/i);

    // There may or may not be console messages, but ensure that the click did not silently do nothing.
    // The existence of a pageerror is our evidence that the event listener was invoked.
    expect((await demo.getHashText()).trim()).toBe('');
  });
});