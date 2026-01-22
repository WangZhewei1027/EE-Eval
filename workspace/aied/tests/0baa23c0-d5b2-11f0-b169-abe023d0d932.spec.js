import { test, expect } from '@playwright/test';

// Test file: 0baa23c0-d5b2-11f0-b169-abe023d0d932.spec.js
// Application URL (served by the test environment)
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa23c0-d5b2-11f0-b169-abe023d0d932.html';

// Page Object Model for the Fibonacci app
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numTermsInput = page.locator('#numTerms');
    this.generateButton = page.locator('#generateButton');
    this.sequenceParagraph = page.locator('#sequence');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getDefaultNumTermsValue() {
    return await this.numTermsInput.inputValue();
  }

  async setNumTerms(value) {
    // Clear then type to ensure consistent state
    await this.numTermsInput.fill(String(value));
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async getSequenceText() {
    // Use innerText to reflect rendered text
    return await this.sequenceParagraph.innerText();
  }

  async expectSequenceTextToContain(substring) {
    const text = await this.getSequenceText();
    expect(text).toContain(substring);
  }
}

test.describe('Fibonacci Sequence App - FSM validation', () => {
  // Shared arrays to capture console messages and page errors per test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors before each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is Error object
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test make sure no unexpected JS runtime errors occurred on the page.
    // The app as provided is correct and shouldn't throw runtime errors.
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should be emitted').toBe(0);
  });

  test.describe('Initial Idle state', () => {
    test('renders input, button and empty sequence (Idle state evidence)', async ({ page }) => {
      // This test validates the Idle state evidence: presence of input, button and default value.
      const app = new FibonacciPage(page);
      await app.goto();

      // Verify input exists and default value is "5"
      await expect(app.numTermsInput).toBeVisible();
      const defaultVal = await app.getDefaultNumTermsValue();
      expect(defaultVal).toBe('5');

      // Verify button exists and has expected label
      await expect(app.generateButton).toBeVisible();
      await expect(app.generateButton).toHaveText('Generate Fibonacci Sequence');

      // Sequence paragraph should be present and initially empty
      const seqText = await app.getSequenceText();
      expect(seqText).toBe('');
    });
  });

  test.describe('Generate Fibonacci - SequenceGenerated transitions', () => {
    test('clicking generate with default (5) produces expected 5-term sequence (S1_SequenceGenerated)', async ({ page }) => {
      // Validates transition S0_Idle -> S1_SequenceGenerated for 5 terms
      const app = new FibonacciPage(page);
      await app.goto();

      // Click generate and assert text
      await app.clickGenerate();

      // Expected sequence for 5 terms based on implementation:
      // initial array [0,1] and while loop builds up to length 5: [0,1,1,2,3]
      const expected = 'Fibonacci Sequence for 5 terms: 0, 1, 1, 2, 3';
      const actual = await app.getSequenceText();
      expect(actual).toBe(expected);
    });

    test('numTerms = 2 produces two-term sequence (S1_SequenceGenerated)', async ({ page }) => {
      // Validates edge case where numTerms equals the initial length of the internal sequence
      const app = new FibonacciPage(page);
      await app.goto();

      await app.setNumTerms(2);
      await app.clickGenerate();

      // Implementation starts with [0,1] so for 2 we expect exactly the initial two terms
      const expected = 'Fibonacci Sequence for 2 terms: 0, 1';
      const actual = await app.getSequenceText();
      expect(actual).toBe(expected);
    });

    test('numTerms = 1 demonstrates behavior for numTerms < internal initial length (S1_SequenceGenerated)', async ({ page }) => {
      // This test highlights an implementation nuance: when numTerms = 1,
      // the function still shows the initial array [0,1] because it does not trim the array.
      const app = new FibonacciPage(page);
      await app.goto();

      await app.setNumTerms(1);
      await app.clickGenerate();

      // Assert the actual behavior (not the ideal one)
      const expected = 'Fibonacci Sequence for 1 terms: 0, 1';
      const actual = await app.getSequenceText();
      expect(actual).toBe(expected);
    });

    test('decimal input (4.7) is parsed with parseInt and produces 4-term sequence', async ({ page }) => {
      // Verifies that parseInt behavior is used (4.7 -> 4)
      const app = new FibonacciPage(page);
      await app.goto();

      await app.setNumTerms('4.7');
      await app.clickGenerate();

      const expected = 'Fibonacci Sequence for 4 terms: 0, 1, 1, 2';
      const actual = await app.getSequenceText();
      expect(actual).toBe(expected);
    });

    test('larger input (10) produces the expected 10-term sequence', async ({ page }) => {
      // Verifies generation for a larger, but reasonable, number of terms
      const app = new FibonacciPage(page);
      await app.goto();

      await app.setNumTerms(10);
      await app.clickGenerate();

      const actual = await app.getSequenceText();
      // Check that it starts with the expected prefix and has 10 comma-separated numbers
      expect(actual).toContain('Fibonacci Sequence for 10 terms:');
      const numbersPart = actual.split(':')[1].trim();
      const numbers = numbersPart.split(',').map(s => s.trim());
      expect(numbers.length).toBe(10);
      // spot-check first few values
      expect(numbers.slice(0, 5)).toEqual(['0', '1', '1', '2', '3']);
    });
  });

  test.describe('Invalid Input transitions (S2_InvalidInput)', () => {
    test('numTerms = 0 yields invalid input message (Please enter a positive number.)', async ({ page }) => {
      // Validates transition S0_Idle -> S2_InvalidInput for zero input
      const app = new FibonacciPage(page);
      await app.goto();

      await app.setNumTerms(0);
      await app.clickGenerate();

      const actual = await app.getSequenceText();
      expect(actual).toBe('Please enter a positive number.');
    });

    test('negative numTerms yields invalid input message (Please enter a positive number.)', async ({ page }) => {
      // Validates transition S0_Idle -> S2_InvalidInput for negative input
      const app = new FibonacciPage(page);
      await app.goto();

      await app.setNumTerms(-5);
      await app.clickGenerate();

      const actual = await app.getSequenceText();
      expect(actual).toBe('Please enter a positive number.');
    });

    test('empty input (no value) behaves as parseInt(NaN) -> NaN -> treated as invalid', async ({ page }) => {
      // If the input is cleared, parseInt('') is NaN -> comparison <= 0 yields false
      // However, parseInt('') returns NaN, and NaN <= 0 is false, so the function may attempt to build the sequence.
      // This test documents actual behavior of the provided implementation.
      const app = new FibonacciPage(page);
      await app.goto();

      // Clear the input entirely
      await app.numTermsInput.fill('');
      await app.clickGenerate();

      // Because parseInt('') is NaN, numTermsValue <= 0 is false and the while loop compares sequence.length < NaN -> false,
      // sequence remains [0,1] and the final text includes "NaN terms" in the message.
      const actual = await app.getSequenceText();
      // We expect that the page shows "Fibonacci Sequence for NaN terms: 0, 1"
      expect(actual).toBe('Fibonacci Sequence for NaN terms: 0, 1');
    });
  });

  test.describe('Event wiring and console/page error observation', () => {
    test('generate button has click handler and clicking triggers behavior (observing console and page errors)', async ({ page }) => {
      // This test ensures the GenerateFibonacci event is wired and that clicking it produces no runtime errors.
      const app = new FibonacciPage(page);

      // Prepare listeners for this test specifically (re-attach since beforeEach attaches generic listeners)
      const localConsole = [];
      const localPageErrors = [];
      page.on('console', (msg) => {
        localConsole.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', (err) => {
        localPageErrors.push(err);
      });

      await app.goto();

      // Sanity: the event handler wiring is present in the source as addEventListener.
      // We cannot directly introspect listeners, but behaviorally clicking should change the DOM
      await app.setNumTerms(3);
      await app.clickGenerate();

      // Assert DOM state updated as a result of the click
      const expected = 'Fibonacci Sequence for 3 terms: 0, 1, 1';
      const actual = await app.getSequenceText();
      expect(actual).toBe(expected);

      // Assert no runtime errors were emitted during this interaction
      expect(localPageErrors.length, 'no page errors during generate click').toBe(0);
      const consoleErrorMessages = localConsole.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length, 'no console.error messages during generate click').toBe(0);
    });
  });
});