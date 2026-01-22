import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b43a91-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the Fibonacci page to encapsulate interactions and queries
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.form = page.locator('#fibForm');
    this.input = page.locator('#countInput');
    this.submitButton = page.locator('button[type="submit"]');
    this.output = page.locator('#output');
    this.heading = page.locator('h1');
  }

  async navigate() {
    await this.page.goto(URL);
  }

  async getHeadingText() {
    return (await this.heading.textContent())?.trim() ?? '';
  }

  async getInputValue() {
    // Use evaluate to get the underlying .value to avoid formatting surprises
    return await this.input.evaluate((el) => el.value);
  }

  async setInputValue(value) {
    // For numeric input, using evaluate can set any string (including non-numeric) to test edge cases
    await this.page.evaluate((v) => {
      const el = document.getElementById('countInput');
      el.value = v;
    }, String(value));
  }

  async fillInput(value) {
    // Preferred when entering valid numeric strings
    await this.input.fill(String(value));
  }

  async submit() {
    // Click the submit button to trigger the form submit handler
    await this.submitButton.click();
    // The handler runs synchronously on click; wait for output to change or be visible
    // Small wait to allow DOM updates (should be immediate, but keep small safeguard)
    await this.page.waitForTimeout(10);
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async outputHasErrorClass() {
    return await this.output.evaluate((el) => el.classList.contains('error'));
  }
}

// Helper to compute expected Fibonacci sequence text (mirrors app logic)
function computeFibonacciText(n) {
  const fib = [];
  if (n >= 1) fib.push(0);
  if (n >= 2) fib.push(1);
  for (let i = 2; i < n; i++) {
    fib[i] = fib[i - 1] + fib[i - 2];
  }
  return `First ${n} terms of the Fibonacci sequence:\n` + fib.join(', ');
}

test.describe('Fibonacci Sequence Generator - FSM tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors to observe runtime problems without modifying the app
    pageErrors = [];
    consoleErrors = [];
    page.on('pageerror', (err) => {
      // Capture page errors (unhandled exceptions)
      pageErrors.push(String(err?.message ?? err));
    });
    page.on('console', (msg) => {
      // Capture console.error messages
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(URL);
  });

  // Initial Idle state validation
  test('Initial Idle state: page loads and renders expected elements (renderPage evidence)', async ({ page }) => {
    // This test validates the FSM initial state S0_Idle: page rendered with heading and form
    const fib = new FibonacciPage(page);

    // Verify heading exists and matches expected title
    const heading = await fib.getHeadingText();
    expect(heading).toBe('Fibonacci Sequence Generator');

    // Verify form and input exist with expected attributes (evidence of Idle state)
    const inputValue = await fib.getInputValue();
    // Default value in HTML is "10"
    expect(inputValue).toBe('10');

    // Output should initially be empty
    const outputText = await fib.getOutputText();
    expect(outputText.trim()).toBe('');

    // No runtime errors should have occurred during initial render
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Error state validations for invalid submissions
  test.describe('Error state transitions (S0_Idle -> S1_Error) for invalid inputs', () => {
    test('Submitting 0 (below min) shows error message and adds .error class', async ({ page }) => {
      // Validate guard count < 1 triggers S1_Error
      const fib = new FibonacciPage(page);
      await fib.fillInput('0');
      await fib.submit();

      const out = await fib.getOutputText();
      expect(out).toBe('Please enter a whole number between 1 and 100.');
      expect(await fib.outputHasErrorClass()).toBe(true);

      // No unexpected JS runtime errors
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Submitting 101 (above max) shows error message and adds .error class', async ({ page }) => {
      // Validate guard count > 100 triggers S1_Error
      const fib = new FibonacciPage(page);
      await fib.fillInput('101');
      await fib.submit();

      const out = await fib.getOutputText();
      expect(out).toBe('Please enter a whole number between 1 and 100.');
      expect(await fib.outputHasErrorClass()).toBe(true);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Submitting a decimal (3.5) shows error message due to non-integer', async ({ page }) => {
      // Validate non-integer inputs trigger S1_Error
      const fib = new FibonacciPage(page);
      // Fill with '3.5' - numeric input may allow this string; Number('3.5') becomes 3.5 -> not integer
      await fib.fillInput('3.5');
      await fib.submit();

      const out = await fib.getOutputText();
      expect(out).toBe('Please enter a whole number between 1 and 100.');
      expect(await fib.outputHasErrorClass()).toBe(true);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Submitting a non-numeric string via direct value assignment triggers error state', async ({ page }) => {
      // Some browsers prevent non-numeric characters in number inputs via UI;
      // We set the value via evaluate to simulate malformed input that becomes NaN
      const fib = new FibonacciPage(page);
      await fib.setInputValue('abc'); // set via evaluate to ensure string assigned
      await fib.submit();

      const out = await fib.getOutputText();
      // Number('abc') -> NaN -> guard should treat as invalid
      expect(out).toBe('Please enter a whole number between 1 and 100.');
      expect(await fib.outputHasErrorClass()).toBe(true);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  // Generated state validations for valid submissions
  test.describe('Generated state transitions (S0_Idle -> S2_Generated) for valid inputs', () => {
    test('Submitting 1 generates the correct Fibonacci sequence (single term)', async ({ page }) => {
      // Validate guard count >=1 && count <=100 triggers S2_Generated
      const fib = new FibonacciPage(page);
      await fib.fillInput('1');
      await fib.submit();

      const out = await fib.getOutputText();
      expect(out).toBe(computeFibonacciText(1));
      // Error class should not be present in generated state
      expect(await fib.outputHasErrorClass()).toBe(false);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Submitting 2 generates the correct Fibonacci sequence (two terms)', async ({ page }) => {
      const fib = new FibonacciPage(page);
      await fib.fillInput('2');
      await fib.submit();

      const out = await fib.getOutputText();
      expect(out).toBe(computeFibonacciText(2));
      expect(await fib.outputHasErrorClass()).toBe(false);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Submitting 10 (default) generates the expected 10-term Fibonacci sequence', async ({ page }) => {
      const fib = new FibonacciPage(page);
      // Default value is 10; submit without changing to exercise initial input default
      await fib.submit();

      const out = await fib.getOutputText();
      expect(out).toBe(computeFibonacciText(10));
      expect(await fib.outputHasErrorClass()).toBe(false);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Large valid submission (100) produces a sequence (sanity check on boundaries)', async ({ page }) => {
      const fib = new FibonacciPage(page);
      // Only a sanity check: ensure the page handles the upper bound without errors.
      // We will not assert the full sequence content here (length check instead).
      await fib.fillInput('100');
      await fib.submit();

      const out = await fib.getOutputText();
      expect(out.startsWith('First 100 terms of the Fibonacci sequence:')).toBe(true);

      // Ensure the output has 100 numbers when splitting the CSV (basic integrity check)
      const seqPart = out.split('\n')[1] ?? '';
      const items = seqPart.split(',').map(s => s.trim()).filter(Boolean);
      expect(items.length).toBe(100);

      expect(await fib.outputHasErrorClass()).toBe(false);
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  // Transition behaviour: moving from Error state back to Generated state should remove error indicators
  test('Transition from Error -> Generated removes .error class and shows new sequence', async ({ page }) => {
    const fib = new FibonacciPage(page);

    // Trigger error state first
    await fib.fillInput('0');
    await fib.submit();
    expect(await fib.outputHasErrorClass()).toBe(true);
    expect(await fib.getOutputText()).toBe('Please enter a whole number between 1 and 100.');

    // Then submit a valid value and ensure error class removed and generated content displayed
    await fib.fillInput('5');
    await fib.submit();

    expect(await fib.outputHasErrorClass()).toBe(false);
    expect(await fib.getOutputText()).toBe(computeFibonacciText(5));

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Observability tests: ensure event handler is wired (submit event) by preventing default and producing output
  test('Form submit event handler is installed and prevents default behavior', async ({ page }) => {
    const fib = new FibonacciPage(page);
    // To check that the submit handler runs and prevents a navigation, we will:
    // - add a temporary action to the form's onsubmit attribute via evaluate? NOT allowed by constraints to modify code.
    // Instead, we observe behavior: clicking submit does not navigate away and output updates.
    // Ensure submitting does not cause navigation (stays on same URL)
    const beforeURL = page.url();
    await fib.fillInput('3');
    await fib.submit();
    const afterURL = page.url();
    expect(afterURL).toBe(beforeURL);

    // Output should reflect generated sequence
    expect(await fib.getOutputText()).toBe(computeFibonacciText(3));
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});