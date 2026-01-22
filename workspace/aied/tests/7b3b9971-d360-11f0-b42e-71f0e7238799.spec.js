import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3b9971-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Linear Search Demo page
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = APP_URL;
    this.selectors = {
      input: '#searchValue',
      button: '#searchButton',
      result: '#result',
      heading: 'h1'
    };
  }

  // Navigate to the app and wait for basic elements
  async goto() {
    await this.page.goto(this.url);
    // Wait for input and button to be visible as part of initial render (S0_Idle)
    await this.page.waitForSelector(this.selectors.input);
    await this.page.waitForSelector(this.selectors.button);
    await this.page.waitForSelector(this.selectors.result);
  }

  // Fill the input (as a string) and click search
  async search(value) {
    // Fill input: clear then fill
    await this.page.fill(this.selectors.input, String(value));
    await Promise.all([
      this.page.waitForResponse(response => true).catch(() => undefined), // be tolerant; not relying on network responses
      this.page.click(this.selectors.button)
    ]);
  }

  // Get result text content
  async getResultText() {
    const el = await this.page.$(this.selectors.result);
    if (!el) return null;
    return (await el.textContent()).trim();
  }

  // Utility to assert input placeholder
  async getInputPlaceholder() {
    return this.page.getAttribute(this.selectors.input, 'placeholder');
  }

  async getButtonText() {
    const el = await this.page.$(this.selectors.button);
    return el ? (await el.textContent()).trim() : null;
  }
}

test.describe('Linear Search Demo (FSM validation)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  // Attach listeners and reset arrays before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages and filter for errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  // After each test ensure there were no unexpected page errors or console error messages
  test.afterEach(async () => {
    // Assert there were no uncaught exceptions on the page
    expect(pageErrors, 'There should be no uncaught page errors').toEqual([]);
    // Assert there were no console errors emitted by the page
    expect(consoleErrors, 'There should be no console.error messages').toEqual([]);
  });

  test.describe('Initial State: S0_Idle', () => {
    test('renders input, button, and empty result on load (renderPage entry action)', async ({ page }) => {
      const app = new LinearSearchPage(page);
      // Navigate to the page and ensure elements are present
      await app.goto();

      // Validate heading exists (basic sanity)
      const heading = await page.textContent(app.selectors.heading);
      expect(heading).toContain('Linear Search Demo');

      // Input presence and placeholder
      const placeholder = await app.getInputPlaceholder();
      expect(placeholder).toBe('Enter number to find');

      // Button text
      const buttonText = await app.getButtonText();
      expect(buttonText).toBe('Search');

      // Result should be initially empty (S0_Idle evidence)
      const resultText = await app.getResultText();
      expect(resultText).toBe('');
    });
  });

  test.describe('Searching and Result States', () => {
    test('transition S0_Idle -> S1_Searching -> S2_ResultFound for element present (index 0)', async ({ page }) => {
      const app = new LinearSearchPage(page);
      await app.goto();

      // Perform search for a value we know is in the array: 34 (index 0)
      await app.search(34);

      // Wait for result text to change and assert expected final state (S2_ResultFound)
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.trim().length > 0,
        app.selectors.result
      );

      const resultText = await app.getResultText();
      expect(resultText).toBe('Element found at index: 0');
    });

    test('transition S1_Searching -> S2_ResultFound for element present (middle index)', async ({ page }) => {
      const app = new LinearSearchPage(page);
      await app.goto();

      // Search for 32 which is present at an intermediate index (index 3 in the array)
      await app.search(32);

      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.trim().length > 0,
        app.selectors.result
      );

      const resultText = await app.getResultText();
      expect(resultText).toBe('Element found at index: 3');
    });

    test('transition S1_Searching -> S2_ResultFound for element present (last index)', async ({ page }) => {
      const app = new LinearSearchPage(page);
      await app.goto();

      // Search for 83 which is present at the last index (index 9)
      await app.search(83);

      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.trim().length > 0,
        app.selectors.result
      );

      const resultText = await app.getResultText();
      expect(resultText).toBe('Element found at index: 9');
    });

    test('transition S1_Searching -> S3_ResultNotFound for element not present', async ({ page }) => {
      const app = new LinearSearchPage(page);
      await app.goto();

      // Search for a value not in the array to exercise not-found guard (index === -1)
      await app.search(9999);

      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.trim().length > 0,
        app.selectors.result
      );

      const resultText = await app.getResultText();
      expect(resultText).toBe('Element not found in the array.');
    });

    test('sequential searches update the result element correctly (state transitions repeated)', async ({ page }) => {
      const app = new LinearSearchPage(page);
      await app.goto();

      // First search: found
      await app.search(23); // index 2
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.includes('Element found at index'),
        app.selectors.result
      );
      let resultText = await app.getResultText();
      expect(resultText).toBe('Element found at index: 2');

      // Second search: not found
      await app.search(0);
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.includes('Element not found'),
        app.selectors.result
      );
      resultText = await app.getResultText();
      expect(resultText).toBe('Element not found in the array.');

      // Third search: found again
      await app.search(5); // index 4
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.includes('Element found at index'),
        app.selectors.result
      );
      resultText = await app.getResultText();
      expect(resultText).toBe('Element found at index: 4');
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('empty input results in "Element not found" (parseInt of empty string -> NaN -> no match)', async ({ page }) => {
      const app = new LinearSearchPage(page);
      await app.goto();

      // Ensure the input is empty and click search
      await app.search(''); // simulate submitting empty input
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.trim().length > 0,
        app.selectors.result
      );

      const resultText = await app.getResultText();
      expect(resultText).toBe('Element not found in the array.');
    });

    test('non-numeric characters in input (type=number constraints aside) - parseInt behavior', async ({ page }) => {
      const app = new LinearSearchPage(page);
      await app.goto();

      // Directly set the input value via evaluate to simulate unusual input (bypassing the number-only UI)
      await page.evaluate(() => {
        const inp = document.getElementById('searchValue');
        // Force a value that parseInt would parse partially, e.g., "34abc" -> 34
        inp.value = '34abc';
      });

      // Click the search button
      await page.click('#searchButton');

      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.trim().length > 0,
        app.selectors.result
      );

      const resultText = await app.getResultText();
      // parseInt('34abc') === 34, so should find index 0
      expect(resultText).toBe('Element found at index: 0');
    });

    test('very large negative or positive numbers not in array produce not-found', async ({ page }) => {
      const app = new LinearSearchPage(page);
      await app.goto();

      await app.search(-999999999);
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.trim().length > 0,
        app.selectors.result
      );
      let resultText = await app.getResultText();
      expect(resultText).toBe('Element not found in the array.');

      await app.search(1e12);
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.trim().length > 0,
        app.selectors.result
      );
      resultText = await app.getResultText();
      expect(resultText).toBe('Element not found in the array.');
    });
  });

  test.describe('Observability: console and runtime errors', () => {
    test('page should not emit console.error or uncaught exceptions during normal use', async ({ page }) => {
      const app = new LinearSearchPage(page);

      // Navigate and exercise a couple of interactions
      await app.goto();
      await app.search(34);
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.includes('Element found at index'),
        app.selectors.result
      );
      await app.search(9999);
      await page.waitForFunction(
        selector => document.querySelector(selector).textContent.includes('Element not found'),
        app.selectors.result
      );

      // At the end of the test the afterEach hook will assert there were no page errors or console errors.
      // We explicitly also assert here to make the intent clear for this observability test.
      expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);
      expect(consoleErrors.length, 'No console.error messages should be emitted').toBe(0);
    });
  });
});