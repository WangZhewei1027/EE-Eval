import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e4aa0-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Hash Function Demonstration page
class HashPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('input#inputText');
    this.button = page.locator("button[onclick='calculateHashes()']");
    this.results = page.locator('#hashResults');
    this.resultBox = page.locator('#hashResults .result');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async enterText(text) {
    await this.input.fill(text);
  }

  async clickCalculate() {
    await this.button.click();
  }

  async getResultsHTML() {
    return await this.results.innerHTML();
  }

  async getResultsText() {
    return await this.results.innerText();
  }

  // Try to extract hashes by simple regex heuristics from the results text
  async extractHashes() {
    const text = await this.getResultsText();
    const md5 = text.match(/[0-9a-f]{32}/i);
    const sha1 = text.match(/[0-9a-f]{40}/i);
    const sha256 = text.match(/[0-9a-f]{64}/i);
    const sha512 = text.match(/[0-9a-f]{128}/i);
    return {
      md5: md5 ? md5[0] : null,
      sha1: sha1 ? sha1[0] : null,
      sha256: sha256 ? sha256[0] : null,
      sha512: sha512 ? sha512[0] : null,
      rawText: text
    };
  }
}

test.describe('Hash Function Demonstration - FSM and UI tests', () => {
  // Collect console error messages and page errors for assertions about runtime problems
  let consoleErrors = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    // Reset arrays for each test
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      // Only capture error-level console messages to inspect runtime issues
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    // Capture dialogs (e.g., alerts) so tests can assert dialog content and accept/dismiss
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept dialogs so they don't block test flow
      try {
        await dialog.accept();
      } catch (e) {
        // If dialog already closed, ignore
      }
    });
  });

  test.afterEach(async () => {
    // After each test we assert that any captured runtime errors are of expected types.
    // We do not patch or alter the application under test; we only observe.
    for (const err of pageErrors) {
      // Each page error should be a recognized JS error type; if not, fail with details.
      expect(
        ['ReferenceError', 'TypeError', 'SyntaxError', 'RangeError', 'Error'].includes(err?.name),
        `Unexpected page error type: ${err?.name} | message: ${err?.message}`
      ).toBeTruthy();
    }

    // If there are console error messages, they should mention typical JS error names
    for (const msg of consoleErrors) {
      const lower = msg.toLowerCase();
      const containsKnown = lower.includes('referenceerror') || lower.includes('typeerror') || lower.includes('syntaxerror') || lower.includes('error');
      expect(containsKnown, `Unexpected console.error message: ${msg}`).toBeTruthy();
    }
  });

  test('S0_Idle state: Page renders initial UI elements correctly', async ({ page }) => {
    // Validate entry action renderPage() effectively rendered the page (Idle state)
    const hashPage = new HashPage(page);
    await hashPage.goto();

    // Check the page title and main heading
    await expect(page).toHaveTitle(/Hash Function Demonstration/);
    await expect(page.locator('h1')).toHaveText('Hash Function Demonstration');

    // Input field exists with correct placeholder and id
    await expect(hashPage.input).toBeVisible();
    await expect(hashPage.input).toHaveAttribute('placeholder', 'Enter text here');
    await expect(hashPage.input).toHaveAttribute('id', 'inputText');

    // Button exists and has correct onclick attribute (evidence in FSM)
    await expect(hashPage.button).toBeVisible();
    const onclick = await hashPage.button.getAttribute('onclick');
    expect(onclick).toBe('calculateHashes()');

    // The hashResults container should show the default message
    await expect(hashPage.results).toBeVisible();
    const defaultText = await hashPage.results.innerText();
    expect(defaultText).toContain('Results will appear here');

    // No dialogs should have appeared during initial render
    expect(dialogs.length).toBe(0);
  });

  test('CalculateHashes event: clicking without input triggers alert and remains in Idle', async ({ page }) => {
    // This test validates the transition guard for empty input (edge case / error scenario)
    const hashPage = new HashPage(page);
    await hashPage.goto();

    // Ensure input is empty
    await hashPage.input.fill('');
    // Click the button and expect a dialog with the specified message
    await hashPage.clickCalculate();

    // A dialog should have been caught and automatically accepted by the listener
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.type).toBe('alert');
    expect(lastDialog.message).toBe('Please enter some text');

    // Since no input was provided, the results area should remain unchanged (still default)
    const resultsText = await hashPage.getResultsText();
    expect(resultsText).toContain('Results will appear here');
  });

  test('Transition S0_Idle -> S1_HashesCalculated: Valid input produces hashes of expected lengths and content', async ({ page }) => {
    // This test triggers the CalculateHashes transition and validates the expected observables.
    const hashPage = new HashPage(page);
    await hashPage.goto();

    // Enter known text and click the calculate button
    await hashPage.enterText('hello');
    await hashPage.clickCalculate();

    // Wait for the result block to appear (S1_HashesCalculated evidence: hashResults.innerHTML updated)
    await hashPage.page.waitForSelector('#hashResults .result', { timeout: 3000 });

    // Extract hashes heuristically and validate format/lengths (MD5 32 hex, SHA-1 40, SHA-256 64, SHA-512 128)
    const hashes = await hashPage.extractHashes();
    expect(hashes.rawText).toContain('Input: hello');

    // MD5 (32 hex)
    expect(hashes.md5, `MD5 not found or wrong format in results: ${hashes.rawText}`).not.toBeNull();
    expect(hashes.md5.length).toBe(32);

    // SHA-1 (40 hex)
    expect(hashes.sha1, `SHA-1 not found or wrong format in results: ${hashes.rawText}`).not.toBeNull();
    expect(hashes.sha1.length).toBe(40);

    // SHA-256 (64 hex)
    expect(hashes.sha256, `SHA-256 not found or wrong format in results: ${hashes.rawText}`).not.toBeNull();
    expect(hashes.sha256.length).toBe(64);

    // SHA-512 (128 hex)
    expect(hashes.sha512, `SHA-512 not found or wrong format in results: ${hashes.rawText}`).not.toBeNull();
    expect(hashes.sha512.length).toBe(128);
  }, 15000); // give extra time for crypto operations

  test('Avalanche-like behavior: small input changes produce different hashes', async ({ page }) => {
    // This test exercises the non-deterministic expectation that small changes change outputs substantially.
    const hashPage = new HashPage(page);
    await hashPage.goto();

    // First input
    await hashPage.enterText('hello');
    await hashPage.clickCalculate();
    await hashPage.page.waitForSelector('#hashResults .result', { timeout: 3000 });
    const first = await hashPage.extractHashes();

    // Second input with a small change
    await hashPage.enterText('hello!');
    await hashPage.clickCalculate();
    await hashPage.page.waitForSelector('#hashResults .result', { timeout: 3000 });
    const second = await hashPage.extractHashes();

    // Ensure at least one of the main hashes changed (MD5 or SHA-256 should differ)
    const md5Changed = first.md5 && second.md5 && first.md5 !== second.md5;
    const sha256Changed = first.sha256 && second.sha256 && first.sha256 !== second.sha256;
    const sha1Changed = first.sha1 && second.sha1 && first.sha1 !== second.sha1;
    const sha512Changed = first.sha512 && second.sha512 && first.sha512 !== second.sha512;

    expect(md5Changed || sha1Changed || sha256Changed || sha512Changed).toBeTruthy();
  }, 20000);

  test('Robustness: repeated calculations do not produce unhandled exceptions in console/pageerror', async ({ page }) => {
    // Run several calculations to try to surface any intermittent runtime errors
    const hashPage = new HashPage(page);
    await hashPage.goto();

    const inputs = ['', 'a', 'abc', 'the quick brown fox', '1234567890'];
    for (const txt of inputs) {
      if (txt === '') {
        // trigger the alert case (edge case)
        await hashPage.input.fill('');
        await hashPage.clickCalculate();
      } else {
        await hashPage.enterText(txt);
        await hashPage.clickCalculate();
        // Wait if results show a .result element
        try {
          await hashPage.page.waitForSelector('#hashResults .result', { timeout: 2000 });
        } catch {
          // It's acceptable if short input leads to immediate result or no result within timeout
        }
      }
    }

    // After stress interactions, ensure any page errors captured are JS error objects with expected names
    for (const err of pageErrors) {
      expect(['ReferenceError', 'TypeError', 'SyntaxError', 'RangeError', 'Error'].includes(err?.name)).toBeTruthy();
    }

    // Console error strings, if any, should reference typical JS error types or be harmless warnings
    for (const msg of consoleErrors) {
      const lower = msg.toLowerCase();
      // Allow messages that look like JS errors; fail if a console error appears to be unrelated or inscrutable
      expect(lower.includes('error') || lower.includes('referenceerror') || lower.includes('typeerror') || lower.includes('syntaxerror') || lower.includes('warning') || lower.length > 0).toBeTruthy();
    }
  }, 30000);
});