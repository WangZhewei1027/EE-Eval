import { test, expect } from '@playwright/test';

// Page object for the Tim Sort demo page
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3bb293-fa74-11f0-a1b6-4b9b8151441a.html';
    this.input = page.locator('#arrayInput');
    this.runButton = page.locator("button[onclick='runTimSort()']");
    this.output = page.locator('#output');
    this.steps = page.locator('#steps');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async getInputValue() {
    return await this.input.inputValue();
  }

  async setInputValue(value) {
    await this.input.fill(value);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getStepsText() {
    return (await this.steps.textContent()) ?? '';
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  async isRunTimSortDefined() {
    return await this.page.evaluate(() => typeof window.runTimSort !== 'undefined');
  }
}

test.describe('Tim Sort Demonstration - FSM states and transitions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions
    pageErrors = [];
    consoleMessages = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      // capture console messages for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Idle state: initial render shows input, button, and empty output/steps', async ({ page }) => {
    // This test validates the S0_Idle state: presence of input, default value, button,
    // empty output and steps, and that the FSM-declared renderPage() is not present on window.
    const ts = new TimSortPage(page);
    await ts.goto();

    // Verify default input value matches FSM component evidence
    const inputVal = await ts.getInputValue();
    expect(inputVal).toContain('34'); // sanity check for the provided default
    expect(inputVal.split(',').length).toBeGreaterThanOrEqual(1);

    // Button should be visible and have the expected onclick handler attribute in DOM
    await expect(ts.runButton).toBeVisible();
    const runButtonHandle = await page.$("button[onclick='runTimSort()']");
    expect(runButtonHandle).not.toBeNull();

    // Steps and output should be empty at initial render
    const stepsText = await ts.getStepsText();
    const outputText = await ts.getOutputText();
    expect(stepsText.trim()).toBe(''); // no pre-existing steps
    expect(outputText.trim()).toBe(''); // no output yet

    // The FSM listed an entry action renderPage() for S0_Idle, but the implementation does not define it.
    // Validate that renderPage is not defined (we must not modify page globals).
    const hasRenderPage = await ts.isRenderPageDefined();
    expect(hasRenderPage).toBe(false);

    // Confirm the main runTimSort function is defined (it should be present)
    const hasRunTimSort = await ts.isRunTimSortDefined();
    expect(hasRunTimSort).toBe(true);

    // Ensure no unexpected page errors were emitted during initial load
    expect(pageErrors.map(e => e.message)).toEqual([]);

    // Console messages may vary; at minimum ensure no console errors were logged
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition RunTimSort: clicking Run Tim Sort enters Sorting state and logs/outputs results', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_Sorting by clicking the button.
    // It asserts that runTimSort() executed (via observable DOM changes), steps were logged,
    // and the output displays both original and sorted arrays.
    const ts = new TimSortPage(page);
    await ts.goto();

    // Read the input and compute expected sorted array using numeric sort for verification
    const rawInput = await ts.getInputValue();
    const parsed = rawInput.split(',').map(s => s.trim()).map(s => parseInt(s, 10));
    // Create expected sorted result (handle NaN by leaving as NaN in string representation)
    const expectedSorted = [...parsed].sort((a, b) => {
      // treat NaN as greater than any number so sort keeps NaN at the end consistently
      const aNaN = Number.isNaN(a);
      const bNaN = Number.isNaN(b);
      if (aNaN && bNaN) return 0;
      if (aNaN) return 1;
      if (bNaN) return -1;
      return a - b;
    });

    // Click the Run Tim Sort button
    await ts.clickRun();

    // Wait for steps to be populated (they are appended by runTimSort via logStep())
    await page.waitForFunction(() => {
      const el = document.getElementById('steps');
      return el && el.innerText.trim().length > 0;
    });

    const stepsText = await ts.getStepsText();
    // Expect steps to include the input array line and some merge/insertion lines
    expect(stepsText).toContain('Input array:');
    expect(stepsText).toMatch(/Array length:\s*\d+/); // should log array length and min run
    expect(stepsText).toMatch(/Min run:/);
    expect(stepsText).toContain('After initial insertion sorts');

    // Output should include both Original and Sorted arrays
    const outputText = await ts.getOutputText();
    expect(outputText).toContain('Original Array');
    expect(outputText).toContain('Sorted Array');

    // Verify sorted values in the output text match the expectedSorted computed above
    const sortedTextMatch = outputText.match(/Sorted Array:\*\*?\]?:?\s*\[([^\]]*)\]/) || outputText.match(/Sorted Array:\s*\[([^\]]*)\]/);
    // If regex didn't capture due to formatting, fall back to checking for numbers sequence occurrence
    if (sortedTextMatch && sortedTextMatch[1] !== undefined) {
      const sortedStr = sortedTextMatch[1].trim();
      // Build expected string representation consistent with page's join(', ')
      const expectedSortedStr = expectedSorted.join(', ');
      expect(sortedStr).toBe(expectedSortedStr);
    } else {
      // Fallback: ensure every expected element appears in output text (order-aware)
      const expectedStr = expectedSorted.map(x => String(x)).join(', ');
      expect(outputText.replace(/\s+/g, ' ')).toContain(expectedStr);
    }

    // Verify that steps were reset/cleared on each run (we can click again and check behavior)
    // Click again and ensure steps are newly populated (i.e., start from fresh)
    await ts.clickRun();
    await page.waitForFunction(() => {
      const el = document.getElementById('steps');
      return el && el.innerText.includes('Input array:');
    });
    const stepsAfterSecondRun = await ts.getStepsText();
    // The steps should still contain an Input array entry; ensure not cumulatively doubling old logs without reset
    // Since runTimSort clears stepsElement.innerHTML at start, the first line must be Input array for the second run.
    const firstLine = stepsAfterSecondRun.split('\n').find(l => l.trim().length > 0);
    expect(firstLine).toContain('Input array:');

    // Ensure no uncaught page errors during sorting
    expect(pageErrors.map(e => e.message)).toEqual([]);

    // Ensure no console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Empty input string produces a NaN element but does not throw runtime errors', async ({ page }) => {
      // Validate behavior when the input is empty - parseInt('') => NaN.
      const ts = new TimSortPage(page);
      await ts.goto();

      // Set input to empty and run
      await ts.setInputValue('');
      await ts.clickRun();

      // Wait for steps to include Input array
      await page.waitForFunction(() => {
        const el = document.getElementById('steps');
        return el && el.innerText.includes('Input array:');
      });

      const stepsText = await ts.getStepsText();
      expect(stepsText).toContain('Input array: [NaN]');

      const outputText = await ts.getOutputText();
      // Expect output to show NaN in arrays
      expect(outputText).toContain('Original Array');
      expect(outputText).toContain('NaN');

      // No page errors should have occurred (the implementation handles small arrays safely)
      expect(pageErrors.map(e => e.message)).toEqual([]);

      // No console error logs
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Non-numeric tokens result in NaN entries and no exceptions', async ({ page }) => {
      // Validate input containing invalid tokens like "a, 3, 2"
      const ts = new TimSortPage(page);
      await ts.goto();

      await ts.setInputValue('a, 3, 2');
      await ts.clickRun();

      await page.waitForFunction(() => {
        const el = document.getElementById('steps');
        return el && el.innerText.includes('Input array:');
      });

      const stepsText = await ts.getStepsText();
      expect(stepsText).toContain('Input array: [NaN, 3, 2]');

      const outputText = await ts.getOutputText();
      // Output should include NaN and numeric values
      expect(outputText).toContain('NaN');
      expect(outputText).toContain('3');
      expect(outputText).toContain('2');

      // Check no runtime pageerrors occurred
      expect(pageErrors.map(e => e.message)).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Negative numbers and duplicates are sorted correctly', async ({ page }) => {
      const ts = new TimSortPage(page);
      await ts.goto();

      await ts.setInputValue('5, -1, 5, 3, -1, 0');
      await ts.clickRun();

      await page.waitForFunction(() => {
        const el = document.getElementById('steps');
        return el && el.innerText.includes('Input array:');
      });

      const outputText = await ts.getOutputText();
      // The sorted result expected: [-1, -1, 0, 3, 5, 5]
      expect(outputText.replace(/\s+/g, ' ')).toContain('[-1, -1, 0, 3, 5, 5]');

      // Ensure no runtime errors occurred
      expect(pageErrors.map(e => e.message)).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Large input remains stable and does not throw errors (performance sanity)', async ({ page }) => {
      const ts = new TimSortPage(page);
      await ts.goto();

      // Create a moderate-sized input (e.g., 100 elements) to ensure sorting runs without crash
      const arr = Array.from({ length: 100 }, (_, i) => Math.floor(Math.random() * 1000) - 500);
      await ts.setInputValue(arr.join(', '));
      await ts.clickRun();

      // Wait until steps log the initial insertion sorts or merging steps
      await page.waitForFunction(() => {
        const el = document.getElementById('steps');
        return el && el.innerText.includes('After initial insertion sorts');
      }, { timeout: 5000 });

      const stepsText = await ts.getStepsText();
      expect(stepsText.length).toBeGreaterThan(0);

      // Confirm output contains Sorted Array marker
      const outputText = await ts.getOutputText();
      expect(outputText).toContain('Sorted Array');

      // No uncaught exceptions should be present
      expect(pageErrors.map(e => e.message)).toEqual([]);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safeguard: ensure no unexpected runtime errors surfaced during any test
    // (we already asserted in tests, but keep this as teardown verification)
    if (pageErrors.length > 0) {
      // If there are page errors, fail explicitly with diagnostic info
      throw new Error('Page errors detected during test run: ' + pageErrors.map(e => e.message).join('; '));
    }
  });
});