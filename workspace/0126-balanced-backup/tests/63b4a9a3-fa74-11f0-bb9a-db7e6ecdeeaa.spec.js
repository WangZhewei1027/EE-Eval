import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b4a9a3-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Hash Functions Demo page
class HashPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputText');
    this.button = page.locator('#hashBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getInputPlaceholder() {
    return this.input.getAttribute('placeholder');
  }

  async typeInput(text) {
    await this.input.fill(text);
  }

  async clickGenerate() {
    await this.button.click();
  }

  async getOutputTextContent() {
    return this.output.textContent();
  }

  async getOutputInnerHTML() {
    return this.page.evaluate(() => document.getElementById('output').innerHTML);
  }

  async waitForCalculatingState(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const out = document.getElementById('output');
      return out && out.textContent === 'Calculating hash...';
    }, null, { timeout });
  }

  async waitForHashGenerated(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const out = document.getElementById('output');
      if (!out) return false;
      return out.innerHTML.includes('SHA-256 hash:') || out.textContent?.startsWith('Error generating hash:') || out.textContent === 'Please enter some text to hash.';
    }, null, { timeout });
  }
}

// Helper to check if a string is a 64-character hex (SHA-256)
function isSha256Hex(s) {
  return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
}

// Allowed error types that we will accept if page errors occur naturally
const ALLOWED_ERROR_NAMES = new Set(['ReferenceError', 'SyntaxError', 'TypeError']);

test.describe('Hash Functions Demo - FSM state and transition tests', () => {
  // Hold captured console error messages and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors (exceptions)
    page.on('pageerror', err => {
      // err is an Error object from the page
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we ensure that if any pageErrors occurred they are of expected kinds.
    // This follows the instruction to observe page errors and assert their types if present.
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // err.name is typically 'ReferenceError', 'TypeError', etc.
        expect(ALLOWED_ERROR_NAMES.has(err.name)).toBeTruthy();
      }
    }
    // Similarly, if there are console errors, ensure they reference allowed error names or at least are present only if allowed.
    if (consoleErrors.length > 0) {
      for (const c of consoleErrors) {
        // We cannot change runtime; ensure console error text contains one of allowed error names if present.
        const containsAllowedName = [...ALLOWED_ERROR_NAMES].some(name => c.text.includes(name));
        // Either it contains a known JS error name or at minimum we fail the test to indicate unexpected console errors.
        expect(containsAllowedName).toBeTruthy();
      }
    }
  });

  test('S0_Idle: initial render shows input, button, and empty output', async ({ page }) => {
    // Validate initial (Idle) state elements and attributes
    const app = new HashPage(page);
    await app.goto();

    // Input placeholder matches FSM evidence
    const placeholder = await app.getInputPlaceholder();
    expect(placeholder).toBe('Type something...');

    // Button visible and has expected text
    await expect(app.button).toBeVisible();
    await expect(app.button).toHaveText('Generate Hash (SHA-256)');

    // Output area exists and is initially empty
    const outText = (await app.getOutputTextContent()) || '';
    expect(outText.trim()).toBe('');

    // Ensure output has aria-live polite as per components evidence
    const ariaLive = await page.locator('#output').getAttribute('aria-live');
    expect(ariaLive).toBe('polite');

    // No unexpected page errors at initial render (if any exist, they must match allowed types - checked in afterEach)
  });

  test('S0 -> S1 -> S2: clicking button with valid input shows calculating state then final hash (deterministic)', async ({ page }) => {
    // This test validates:
    // - Transition from Idle to Hashing: clicking button sets output to "Calculating hash..."
    // - Transition Hashing -> Hash Generated: final output contains SHA-256 label and a 64-hex-character hash
    // - Determinism: known input produces known SHA-256 value

    const app = new HashPage(page);
    await app.goto();

    // Type a known input "hello" and click generate
    await app.typeInput('hello');

    // Click to trigger GenerateHashClick event
    await app.clickGenerate();

    // Immediately after click, the FSM S1_Hashing entry action should set output to 'Calculating hash...'
    await app.waitForCalculatingState(2000);
    const calculatingText = await app.getOutputTextContent();
    expect(calculatingText?.trim()).toBe('Calculating hash...');

    // Wait for the hash to be generated and displayed
    await app.waitForHashGenerated(5000);

    // Validate final output contains strong label and hex hash
    const innerHTML = await app.getOutputInnerHTML();
    expect(innerHTML).toContain('SHA-256 hash:');

    // Extract the hash from innerHTML - it's after the <br>
    const match = innerHTML.match(/<br>([0-9a-fA-F]{64})/);
    expect(match).not.toBeNull();
    const hash = match ? match[1].toLowerCase() : '';
    expect(isSha256Hex(hash)).toBeTruthy();

    // Deterministic check: SHA-256('hello') is a known value
    const expectedHelloHash = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
    expect(hash).toBe(expectedHelloHash);
  });

  test('S0_Idle -> Error path: clicking generate with empty input shows validation message', async ({ page }) => {
    // Validate the edge case when the input is empty: FSM should remain in Idle or show validation text,
    // and not attempt to calculate the hash.

    const app = new HashPage(page);
    await app.goto();

    // Ensure input is empty
    await app.typeInput('');
    await app.clickGenerate();

    // The code checks for empty string and sets the output to a helpful message.
    await app.waitForHashGenerated(2000);
    const out = (await app.getOutputTextContent()) || '';
    expect(out.trim()).toBe('Please enter some text to hash.');
  });

  test('InputTextChange transition is commented out: typing does NOT auto-generate the hash', async ({ page }) => {
    // FSM included an InputTextChange transition but the implementation commented the handler out.
    // This test verifies that typing into the input does not automatically trigger hashing.

    const app = new HashPage(page);
    await app.goto();

    // Ensure initial output is empty
    const before = (await app.getOutputTextContent()) || '';
    expect(before.trim()).toBe('');

    // Type some text - should NOT auto-generate hash
    await app.typeInput('auto-test');

    // Give a short delay to allow any (nonexistent) auto handler to run if present
    await page.waitForTimeout(500);

    // Output should still be empty (no automatic hashing occurred)
    const after = (await app.getOutputTextContent()) || '';
    // It might be empty or still be unchanged from initial; ensure it does not contain SHA-256 label
    expect(after).not.toContain('SHA-256 hash:');
    expect(after.trim()).toBe('');
  });

  test('Multiple clicks produce consistent hashes and show calculating state each time', async ({ page }) => {
    // Validate clicking the button multiple times enters the Hashing state each time
    // and finally displays the same deterministic hash for identical input.

    const app = new HashPage(page);
    await app.goto();

    await app.typeInput('repeatable');

    // First click
    await app.clickGenerate();
    await app.waitForCalculatingState(2000);
    await app.waitForHashGenerated(5000);
    const firstHTML = await app.getOutputInnerHTML();
    const firstMatch = firstHTML.match(/<br>([0-9a-fA-F]{64})/);
    expect(firstMatch).not.toBeNull();
    const firstHash = firstMatch ? firstMatch[1].toLowerCase() : '';
    expect(isSha256Hex(firstHash)).toBeTruthy();

    // Second click - should show "Calculating hash..." again then same hash
    await app.clickGenerate();
    await app.waitForCalculatingState(2000);
    await app.waitForHashGenerated(5000);
    const secondHTML = await app.getOutputInnerHTML();
    const secondMatch = secondHTML.match(/<br>([0-9a-fA-F]{64})/);
    expect(secondMatch).not.toBeNull();
    const secondHash = secondMatch ? secondMatch[1].toLowerCase() : '';
    expect(isSha256Hex(secondHash)).toBeTruthy();

    expect(secondHash).toBe(firstHash);
  });

  test('Error observation: captured page errors and console errors (if any) are of allowed JS error types', async ({ page }) => {
    // This test's goal is to explicitly demonstrate that we observe page errors and console errors,
    // and to assert that if they occur, they are ReferenceError, SyntaxError, or TypeError as required.
    const app = new HashPage(page);
    await app.goto();

    // Perform a normal action that might reveal runtime problems
    await app.typeInput('trigger-errors-if-any');
    await app.clickGenerate();

    // wait a little to capture potential errors
    await page.waitForTimeout(1000);

    // The afterEach hook will check pageErrors and consoleErrors for allowed types/names.
    // Here we assert that we have at most a reasonable number of errors (0 or a few).
    expect(pageErrors.length).toBeLessThanOrEqual(10);
    expect(consoleErrors.length).toBeLessThanOrEqual(10);

    // Additionally, if pageErrors exist, assert they are of allowed names
    if (pageErrors.length > 0) {
      for (const e of pageErrors) {
        expect(ALLOWED_ERROR_NAMES.has(e.name)).toBeTruthy();
      }
    }

    if (consoleErrors.length > 0) {
      for (const c of consoleErrors) {
        const hasAllowedName = [...ALLOWED_ERROR_NAMES].some(n => c.text.includes(n));
        expect(hasAllowedName).toBeTruthy();
      }
    }
  });
});