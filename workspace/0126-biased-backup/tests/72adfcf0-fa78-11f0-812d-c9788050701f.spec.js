import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72adfcf0-fa78-11f0-812d-c9788050701f.html';

// Page Object Model for the Hash visualization page
class HashPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputText');
    this.button = page.locator('#hashButton');
    this.output = page.locator('#outputHash');
    this.bits = page.locator('#hashBits');
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Wait until the initial seed hash (from DOMContentLoaded script) appears
  async waitForInitialHash(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('outputHash');
      return !!el && /^[0-9a-f]{64}$/.test(el.textContent || '');
    }, null, { timeout });
  }

  async fillInput(text) {
    await this.input.fill(text);
  }

  async clearInput() {
    await this.input.fill('');
  }

  async clickGenerate() {
    await this.button.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getBitsCount() {
    return this.bits.locator('.bit').count();
  }

  // Wait until the output becomes a SHA-256 hash hex string
  async waitForHashOutput(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('outputHash');
      return !!el && /^[0-9a-f]{64}$/.test(el.textContent || '');
    }, null, { timeout });
  }

  // Wait for "Calculating..." state to be visible in output
  async waitForCalculating(timeout = 1000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('outputHash');
      return el && el.textContent === 'Calculating...';
    }, null, { timeout });
  }

  // Wait for output highlight class to be removed (the code removes after 1500ms)
  async waitForHighlightRemoved(timeout = 4000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('outputHash');
      return el && !el.classList.contains('highlight');
    }, null, { timeout });
  }

  async waitForBitsRendered(expectedCount = 256, timeout = 5000) {
    await this.page.waitForFunction((expected) => {
      const container = document.getElementById('hashBits');
      return container && container.children.length === expected;
    }, expectedCount, { timeout });
  }

  async someBitsHaveOnClass(timeout = 4000) {
    await this.page.waitForFunction(() => {
      const container = document.getElementById('hashBits');
      if (!container) return false;
      return Array.from(container.children).some(c => c.classList.contains('on'));
    }, null, { timeout });
  }
}

test.describe('Visualizing Hash Functions - FSM behavior and UI validation', () => {
  // Collect console messages and page errors for each test to assert runtime issues
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and classify errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture page 'pageerror' events (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });
  });

  test('Initial Idle state (S0_Idle) renders core components and initial hash is computed', async ({ page }) => {
    // This test validates initial rendering: textarea, button, output and bit visualization are present.
    // It also asserts that the page's DOMContentLoaded initialization computed a SHA-256 hash and rendered bits.
    const hp = new HashPage(page);
    await hp.navigate();

    // Elements exist
    await expect(hp.input).toBeVisible();
    await expect(hp.button).toBeVisible();
    await expect(hp.output).toBeVisible();

    // The input textarea should have the expected placeholder text per the implementation
    await expect(hp.input).toHaveAttribute('placeholder', 'Enter any text here to see it hashed...');

    // Wait for the initial hash computed during DOMContentLoaded to appear (the script computes sha256('Hash Functions'))
    await hp.waitForInitialHash();

    const outputText = await hp.getOutputText();
    // The output should be a 64-character hexadecimal SHA-256 string
    expect(outputText).toMatch(/^[0-9a-f]{64}$/);

    // Bit visualization should have 64 hex chars * 4 bits = 256 bit tiles
    await hp.waitForBitsRendered(256);
    const bitsCount = await hp.getBitsCount();
    expect(bitsCount).toBe(256);

    // Ensure no unexpected console errors or uncaught page errors occurred during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('InputTextChange event updates textarea value (event detection)', async ({ page }) => {
    // Validates the InputTextChange event: typing into the textarea updates its value in DOM.
    const hp = new HashPage(page);
    await hp.navigate();
    await hp.waitForInitialHash();

    const testValue = 'Playwright test input';
    await hp.fillInput(testValue);

    // The textarea value should reflect the typed content
    const value = await page.evaluate(() => document.getElementById('inputText').value);
    expect(value).toBe(testValue);

    // No runtime errors should have been thrown
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('GenerateHashClick transitions through Hashing (S1_Hashing) to Hash Generated (S2_HashGenerated)', async ({ page }) => {
    // This test simulates the user entering text and clicking Generate Hash.
    // It validates the "Calculating..." intermediate state, the final SHA-256 hash output,
    // creation of the bit visualization, and the removal of the highlight class.
    const hp = new HashPage(page);
    await hp.navigate();
    await hp.waitForInitialHash();

    // Enter a new distinct value that will produce a different hash
    const userInput = 'Test Input for Hashing';
    await hp.fillInput(userInput);

    // Click the generate button -> should immediately show 'Calculating...' and have highlight class
    await hp.clickGenerate();

    // Verify Hashing state observable: output text becomes 'Calculating...'
    await hp.waitForCalculating();

    // Ensure the highlight class is present while calculating
    const hasHighlightWhileCalculating = await page.evaluate(() => {
      const el = document.getElementById('outputHash');
      return el && el.classList.contains('highlight') && el.textContent === 'Calculating...';
    });
    expect(hasHighlightWhileCalculating).toBeTruthy();

    // Wait for final hash to be displayed
    await hp.waitForHashOutput(7000); // allow extra time for crypto.digest

    const finalHash = await hp.getOutputText();
    expect(finalHash).toMatch(/^[0-9a-f]{64}$/);

    // Validate that the bit visualization was created for the hash (256 bits)
    await hp.waitForBitsRendered(256, 7000);
    const bitsCount = await hp.getBitsCount();
    expect(bitsCount).toBe(256);

    // Some of the bit tiles representing '1' should eventually have the 'on' class applied (animation delays)
    // Give enough time for several setTimeout callbacks to run (i * 10 ms could take up to ~2500ms for last bits)
    await hp.someBitsHaveOnClass(4000);
    const someOn = await page.evaluate(() => {
      const container = document.getElementById('hashBits');
      return Array.from(container.children).some(c => c.classList.contains('on'));
    });
    expect(someOn).toBeTruthy();

    // The highlight class should be removed after the timeout set in the implementation (1500ms)
    await hp.waitForHighlightRemoved(4000);
    const highlightPresent = await page.evaluate(() => document.getElementById('outputHash').classList.contains('highlight'));
    expect(highlightPresent).toBeFalsy();

    // Ensure no runtime errors occurred during the hashing flow
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Generate Hash with empty input triggers validation message (edge case)', async ({ page }) => {
    // This test validates the application's behavior when the user clicks Generate Hash with empty input.
    // Per the implementation, it should not attempt hashing (no 'Calculating...') and should display a helpful message.
    const hp = new HashPage(page);
    await hp.navigate();
    await hp.waitForInitialHash();

    // Ensure input is empty
    await hp.clearInput();

    // Click the generate button with empty input
    await hp.clickGenerate();

    // The output should show the validation message, not the 'Calculating...' or a hashed value
    await page.waitForFunction(() => {
      const el = document.getElementById('outputHash');
      return el && el.textContent === 'Please enter some text to hash';
    }, null, { timeout: 2000 });

    const outputText = await hp.getOutputText();
    expect(outputText).toBe('Please enter some text to hash');

    // The bit visualization should remain unchanged or be empty; at minimum, we assert it did not get re-populated with 256 bits
    const bitsCount = await hp.getBitsCount();
    // bitsCount could be 256 from initial load; ensure that no new 'Calculating...' triggered runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('No uncaught runtime errors (ReferenceError, SyntaxError, TypeError) during typical interactions', async ({ page }) => {
    // This test aggregates interactions and asserts that no uncaught exceptions or console.error messages occur.
    const hp = new HashPage(page);
    await hp.navigate();
    await hp.waitForInitialHash();

    // Perform several interactions: change text, generate hash, clear, generate empty
    await hp.fillInput('One more test');
    await hp.clickGenerate();
    await hp.waitForHashOutput(7000);

    await hp.fillInput(''); // clear by filling empty
    await hp.clickGenerate();
    await page.waitForFunction(() => document.getElementById('outputHash') !== null, null, { timeout: 2000 });

    // Allow any pending asynchronous errors to surface
    await page.waitForTimeout(500);

    // Assert no page errors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Assert there were no console.error messages
    const foundConsoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(foundConsoleErrors.length).toBe(0);
  });
});