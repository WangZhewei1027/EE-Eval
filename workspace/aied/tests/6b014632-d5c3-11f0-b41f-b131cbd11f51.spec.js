import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b014632-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Fibonacci app
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.countInput = page.locator('#count');
    this.generateBtn = page.locator('#generate-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.exampleBtn = page.locator('#example-btn');
    this.resultDiv = page.locator('#result');
    this.termCountSpan = page.locator('#term-count');
    this.sequenceDiv = page.locator('#sequence');
    this.fibNumberSpans = page.locator('.fib-number');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getInputValue() {
    return this.countInput.inputValue();
  }

  async setInputValue(value) {
    // Use fill to set the value reliably
    await this.countInput.fill(String(value));
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickExample() {
    await this.exampleBtn.click();
  }

  async pressEnterOnInput() {
    await this.countInput.press('Enter');
  }

  async isResultVisible() {
    return this.resultDiv.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none';
    });
  }

  async getTermCountText() {
    return this.termCountSpan.textContent();
  }

  async getSequenceNumbers() {
    // returns array of text contents of each .fib-number span
    return this.fibNumberSpans.allTextContents();
  }

  async getSequenceSpanCount() {
    return this.fibNumberSpans.count();
  }

  async getSequenceInnerHTML() {
    return this.sequenceDiv.innerHTML();
  }
}

// Helper to compute fibonacci sequence for assertions
function computeFibonacci(n) {
  n = Number(n);
  if (n <= 0) return [];
  if (n === 1) return [0];
  const seq = [0, 1];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq;
}

test.describe('Fibonacci Sequence Generator - FSM Validation', () => {
  // Arrays to collect console errors and page errors per test
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Capture dialogs (alerts) and auto-accept them so tests continue
    page.on('dialog', async (dlg) => {
      dialogs.push(dlg.message());
      await dlg.accept();
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure page has had time to run its DOMContentLoaded handler
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    // Additional safety: give time for any background errors to surface
    await page.waitForTimeout(50);
  });

  test.describe('States and initial rendering', () => {
    test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
      // Validate initial page structure and Idle state evidence
      const app = new FibonacciPage(page);

      // Input exists and default value is "10"
      await expect(app.countInput).toBeVisible();
      const inputValue = await app.getInputValue();
      expect(inputValue).toBe('10');

      // Result area should be hidden initially
      const visible = await app.isResultVisible();
      expect(visible).toBe(false);

      // Term count should show "0 terms" as per extracted evidence
      const termText = await app.getTermCountText();
      expect(termText.trim()).toBe('0 terms');

      // Sequence area should be empty
      const seqCount = await app.getSequenceSpanCount();
      expect(seqCount).toBe(0);

      // No console errors or page errors should have occurred during initial rendering
      expect(consoleErrors.length, 'no console error messages on load').toBe(0);
      expect(pageErrors.length, 'no page errors on load').toBe(0);
    });
  });

  test.describe('Events and transitions', () => {
    test('GenerateSequence: clicking Generate Sequence shows the Fibonacci sequence (S0 -> S1)', async ({ page }) => {
      const app = new FibonacciPage(page);

      // Click generate with default value (10)
      await app.clickGenerate();

      // The result container should be visible
      await expect(app.resultDiv).toBeVisible();

      // Term count should be updated to "10 terms"
      await expect(app.termCountSpan).toHaveText('10 terms');

      // There should be 10 .fib-number spans
      const numbers = await app.getSequenceNumbers();
      expect(numbers.length).toBe(10);

      // Validate the first few values and overall correct sequence
      const expected = computeFibonacci(10).map(String);
      expect(numbers).toEqual(expected);

      // Ensure no runtime console/page errors
      expect(consoleErrors.length, 'no console errors after generating').toBe(0);
      expect(pageErrors.length, 'no page errors after generating').toBe(0);
    });

    test('ShowExample: clicking Show Example sets count to 15 and displays 15 terms (S0 -> S1)', async ({ page }) => {
      const app = new FibonacciPage(page);

      // Click example
      await app.clickExample();

      // Input should be updated to "15"
      await expect(app.countInput).toHaveValue('15');

      // Result should be visible and term count updated
      await expect(app.resultDiv).toBeVisible();
      await expect(app.termCountSpan).toHaveText('15 terms');

      // Validate sequence length and some values
      const numbers = await app.getSequenceNumbers();
      expect(numbers.length).toBe(15);
      const expected = computeFibonacci(15).map(String);
      expect(numbers).toEqual(expected);

      expect(consoleErrors.length, 'no console errors after example').toBe(0);
      expect(pageErrors.length, 'no page errors after example').toBe(0);
    });

    test('EnterKey: pressing Enter in the input triggers generation (S0 -> S1)', async ({ page }) => {
      const app = new FibonacciPage(page);

      // Set input to 7 and press Enter
      await app.setInputValue('7');
      await app.pressEnterOnInput();

      // Verify result is shown and has 7 entries
      await expect(app.resultDiv).toBeVisible();
      await expect(app.termCountSpan).toHaveText('7 terms');
      const numbers = await app.getSequenceNumbers();
      expect(numbers.length).toBe(7);
      expect(numbers).toEqual(computeFibonacci(7).map(String));

      expect(consoleErrors.length, 'no console errors after Enter key').toBe(0);
      expect(pageErrors.length, 'no page errors after Enter key').toBe(0);
    });

    test('ClearSequence: after generating, clicking Clear resets the UI to Idle (S1 -> S0)', async ({ page }) => {
      const app = new FibonacciPage(page);

      // Generate a small sequence to get into S1
      await app.setInputValue('5');
      await app.clickGenerate();

      // Precondition checks
      await expect(app.resultDiv).toBeVisible();
      await expect(app.termCountSpan).toHaveText('5 terms');
      expect(await app.getSequenceSpanCount()).toBe(5);

      // Click clear to return to Idle
      await app.clickClear();

      // Sequence should be empty
      expect(await app.getSequenceSpanCount()).toBe(0);

      // Result should be hidden
      const visibleAfterClear = await app.isResultVisible();
      expect(visibleAfterClear).toBe(false);

      // Input should be reset to '10' per FSM exit actions
      expect(await app.getInputValue()).toBe('10');

      expect(consoleErrors.length, 'no console errors after clear').toBe(0);
      expect(pageErrors.length, 'no page errors after clear').toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Invalid inputs trigger alert and do not display sequence (edge cases)', async ({ page }) => {
      const app = new FibonacciPage(page);

      // We'll test multiple invalid inputs and ensure an alert is shown each time with expected message
      const invalidValues = ['', '0', '-5', '101', 'abc'];

      for (const val of invalidValues) {
        // Use a one-off dialog handler so that each iteration asserts the dialog message
        const [dialog] = await Promise.all([
          page.waitForEvent('dialog'),
          // For empty string input, use fill('') to clear
          (async () => {
            await app.setInputValue(val);
            await app.clickGenerate();
          })(),
        ]);
        // Assert expected alert message
        expect(dialog.message()).toBe('Please enter a valid number between 1 and 100');

        // After dismissing the alert (we auto-accept in the global handler), ensure result remains hidden
        const visible = await app.isResultVisible();
        expect(visible).toBe(false);
      }

      // No uncaught console/page errors should have occurred during these validations
      expect(consoleErrors.length, 'no console errors during invalid input tests').toBe(0);
      expect(pageErrors.length, 'no page errors during invalid input tests').toBe(0);
    });

    test('Large valid input within bounds generates correct count of terms', async ({ page }) {
      const app = new FibonacciPage(page);

      // Use a large but allowed value: 100
      await app.setInputValue('100');
      await app.clickGenerate();

      // Validate that result is visible and term count reflects 100 terms
      await expect(app.resultDiv).toBeVisible();
      await expect(app.termCountSpan).toHaveText('100 terms');

      // Validate that the number of .fib-number spans equals 100
      const count = await app.getSequenceSpanCount();
      expect(count).toBe(100);

      // Spot-check first few and last few elements for consistency (first two must be 0,1)
      const texts = await app.getSequenceNumbers();
      expect(texts[0]).toBe('0');
      expect(texts[1]).toBe('1');

      // Ensure no console or page errors occurred while generating large sequence
      expect(consoleErrors.length, 'no console errors for large input').toBe(0);
      expect(pageErrors.length, 'no page errors for large input').toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No unexpected console or page errors during normal usage', async ({ page }) => {
      const app = new FibonacciPage(page);

      // Perform a sequence of user interactions to try to reveal runtime errors
      await app.setInputValue('6');
      await app.clickGenerate();
      await app.clickClear();
      await app.clickExample();
      await app.setInputValue('3');
      await app.pressEnterOnInput();

      // Short wait to allow any asynchronous errors to surface
      await page.waitForTimeout(100);

      // Assert we observed no console.error messages and no uncaught page errors
      expect(consoleErrors.length, 'no console.error messages during interactions').toBe(0);
      expect(pageErrors.length, 'no uncaught page exceptions during interactions').toBe(0);
    });
  });
});