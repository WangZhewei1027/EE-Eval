import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ce4853-fa7c-11f0-ba20-415c525382ea.html';

/**
 * Page object encapsulating interactions with the Symmetric Cryptography demo page.
 */
class SymmetricCryptoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoBtn = page.locator('#demoBtn');
    this.demoOutput = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickShowDemo() {
    await this.demoBtn.click();
  }

  async getDemoOutputText() {
    return await this.demoOutput.textContent();
  }

  async waitForDemoOutputContains(substring, options = {}) {
    await this.page.waitForFunction(
      ({ selector, substring }) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        return el.textContent && el.textContent.includes(substring);
      },
      { selector: '#demoOutput', substring },
      options
    );
  }
}

test.describe('Symmetric Cryptography App - FSM tests', () => {
  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console and page errors for assertions
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Uncaught errors from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });
  });

  test('Initial state (S0_Idle): page renders with demo button and empty demo area', async ({ page }) => {
    // This test validates S0_Idle entry state: renderPage() semantics -> button present, demo area empty
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // Validate presence and attributes of the button (evidence from FSM)
    await expect(app.demoBtn).toBeVisible();
    await expect(app.demoBtn).toHaveAttribute('aria-label', 'Show Caesar cipher demo');
    await expect(app.demoBtn).toHaveText('Show Caesar Cipher Demo');

    // Validate demo output exists and is initially empty (evidence)
    await expect(app.demoOutput).toBeVisible();
    const initialText = await app.getDemoOutputText();
    // The demo area should start empty (entry state)
    expect(initialText === '' || initialText === null).toBeTruthy();

    // Visual / accessibility checks asserted by FSM components
    await expect(app.demoOutput).toHaveAttribute('class', /demo-area/);
    await expect(app.demoOutput).toHaveAttribute('aria-live', 'polite');
    await expect(app.demoOutput).toHaveAttribute('aria-atomic', 'true');

    // Assert there were no uncaught page errors or console errors at initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ShowCaesarCipherDemo (S0_Idle -> S1_DemoShown): clicking button displays plaintext, ciphertext and decryption', async ({ page }) => {
    // This test exercises the transition: clicking the demo button should set demoOutput.textContent
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // Click the demo button to trigger the transition
    await app.clickShowDemo();

    // Wait for expected pieces of the output to appear
    await app.waitForDemoOutputContains('Plaintext:');
    await app.waitForDemoOutputContains('Ciphertext:');
    await app.waitForDemoOutputContains('Decrypted Text:');

    const text = (await app.getDemoOutputText()) || '';

    // Assert content contains expected lines as per the FSM evidence and implementation
    expect(text).toContain('Plaintext:');
    expect(text).toContain('Key (shift): 3');
    expect(text).toContain('Ciphertext:');
    expect(text).toContain('Decrypted Text: HELLO WORLD');
    // Check that some of the explicit encryption steps are present
    expect(text).toContain('H → K');
    expect(text).toContain('K → H');

    // Clicking again should replace (not append) the textContent; validate idempotence
    await app.clickShowDemo();
    const textAfterSecondClick = (await app.getDemoOutputText()) || '';
    expect(textAfterSecondClick).toBe(text); // same content expected

    // Assert no page errors or console errors occurred during interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('caesarShift function - edge cases and correctness (uses page-defined function)', async ({ page }) => {
    // Validate behavior of the caesarShift function defined in the page for several edge cases
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // 1) Empty string should return empty string
    const emptyResult = await page.evaluate(() => {
      // call the function defined in the page; do not inject new functions
      return typeof caesarShift === 'function' ? caesarShift('', 3) : null;
    });
    expect(emptyResult).toBe('');

    // 2) Non-letter characters should be preserved
    const punctuation = await page.evaluate(() => caesarShift('123-! ?', 5));
    expect(punctuation).toBe('123-! ?');

    // 3) Negative shifts wrap around correctly: 'ABC' with -3 -> 'XYZ'
    const negativeShift = await page.evaluate(() => caesarShift('ABC', -3));
    expect(negativeShift).toBe('XYZ');

    // 4) Large shifts also wrap: shift by 29 equals shift by 3
    const largeShift = await page.evaluate(() => caesarShift('HELLO', 29));
    const expectedLargeShift = await page.evaluate(() => caesarShift('HELLO', 3));
    expect(largeShift).toBe(expectedLargeShift);

    // Ensure that calling the function did not produce uncaught page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge queries and resilience: missing elements and no unexpected runtime errors', async ({ page }) => {
    // This test asserts resilience: querying non-existent selectors should not break the page
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // Query a non-existent element - should simply not be found, not crash the page
    const nonExistent = await page.locator('#thisElementDoesNotExist');
    const count = await nonExistent.count();
    expect(count).toBe(0);

    // Try fetching a property that doesn't exist via evaluate in a safe way:
    // We will check for window.someNonExistentVar presence without causing exceptions.
    const hasUndefined = await page.evaluate(() => typeof window.someNonExistentVar === 'undefined');
    expect(hasUndefined).toBe(true);

    // No uncaught errors are expected as a result of benign queries
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture and report any console messages or page errors (for debugging)', async ({ page }) => {
    // This test purposefully collects console messages to ensure visibility into runtime behavior.
    const app = new SymmetricCryptoPage(page);
    await app.goto();

    // Click the demo to generate text output; this may not produce console messages, but we capture what exists
    await app.clickShowDemo();
    await app.waitForDemoOutputContains('Plaintext:');

    // Provide assertions about the console stream: we expect no error-level messages in normal operation
    // but we still surface what was captured in case of test failure.
    // For test stability, assert there were no console.error messages
    expect(consoleErrors.length).toBe(0);

    // Also assert no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // If there are any console.debug/info messages, ensure they are strings and non-empty
    for (const msg of consoleMessages) {
      expect(typeof msg.type).toBe('string');
      expect(typeof msg.text).toBe('string');
    }
  });
});