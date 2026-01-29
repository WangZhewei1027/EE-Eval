import { test, expect } from '@playwright/test';

// Page Object for the Sliding Window demo page
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c75e0-fa74-11f0-a1b6-4b9b8151441a.html';
    this.arrayDisplay = page.locator('#array-display');
    this.prevBtn = page.locator('#prev-btn');
    this.nextBtn = page.locator('#next-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.result = page.locator('#result');
  }

  // Navigate to the demo page and wait for initial rendering
  async goto() {
    await this.page.goto(this.url);
    // Wait until the array display has children (renderStep runs on init)
    await this.page.waitForSelector('#array-display .array-element');
    // Ensure result element has initial content
    await this.page.waitForSelector('#result');
  }

  // Click next step
  async clickNext() {
    await this.nextBtn.click();
  }

  // Click previous step
  async clickPrev() {
    await this.prevBtn.click();
  }

  // Click reset
  async clickReset() {
    await this.resetBtn.click();
  }

  // Get currentStep global variable from page (declared in script)
  async getCurrentStep() {
    return await this.page.evaluate(() => (typeof currentStep !== 'undefined' ? currentStep : null));
  }

  // Get number of steps precomputed on page
  async getStepsCount() {
    return await this.page.evaluate(() => (Array.isArray(steps) ? steps.length : null));
  }

  // Get array elements values as strings
  async getArrayValues() {
    return await this.page.$$eval('#array-display .array-element', els => els.map(e => e.textContent.trim()));
  }

  // Get indices that have class 'window'
  async getWindowIndices() {
    return await this.page.$$eval('#array-display .array-element', els =>
      els.map((e, i) => ({ i, isWindow: e.classList.contains('window'), isCurrent: e.classList.contains('current') }))
    );
  }

  // Get text content of the result container (renderStep writes detailed info there)
  async getResultText() {
    return (await this.result.textContent())?.trim() ?? '';
  }

  // Helper to click next multiple times
  async clickNextTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.clickNext();
      // small wait to allow DOM update
      await this.page.waitForTimeout(50);
    }
  }

  // Helper to click prev multiple times
  async clickPrevTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.clickPrev();
      await this.page.waitForTimeout(50);
    }
  }
}

test.describe('Sliding Window Demo - FSM states and transitions', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collections for each test
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Collect console messages and in particular error-level console entries
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });
  });

  test('Initial state (S0_Initial) renders correctly and has no runtime errors', async ({ page }) => {
    // This test validates the initial state's onEnter actions (renderStep(0)) and ensures
    // the DOM reflects the first window and that there are no runtime errors during load.

    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Validate currentStep is 0 (evidence from FSM initial state's entry action)
    const currentStep = await sw.getCurrentStep();
    expect(currentStep).toBe(0);

    // Validate steps count is expected: arr.length - k + 1 = 8 - 3 + 1 = 6
    const stepsCount = await sw.getStepsCount();
    expect(stepsCount).toBe(6);

    // Validate array elements are present and count matches original array length (8)
    const values = await sw.getArrayValues();
    expect(values.length).toBe(8);
    // Check a few known values from the HTML script's array
    expect(values[0]).toBe('2');
    expect(values[1]).toBe('1');
    expect(values[2]).toBe('5');

    // Validate the window indices (first window should be indices 0..2 and have 3 window elements)
    const indices = await sw.getWindowIndices();
    const windowIndices = indices.filter(x => x.isWindow).map(x => x.i);
    expect(windowIndices).toEqual([0, 1, 2]); // initial window span

    // Validate 'current' class applied to window boundaries (start and end)
    const currentFlags = indices.filter(x => x.isCurrent).map(x => x.i);
    // For initial window start=0 and end=2, both marked current
    expect(currentFlags).toEqual([0, 2]);

    // Validate displayed result text includes expected sums for initial window (2+1+5 = 8)
    const resultText = await sw.getResultText();
    expect(resultText).toContain('Current window sum: 8');
    expect(resultText).toContain('Maximum sum so far: 8');

    // Ensure no uncaught page errors and no console.error messages occurred during load
    expect(pageErrors, 'No uncaught page errors should occur on load').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be logged on load').toEqual([]);
  });

  test('NextStep event transitions forward and updates visualization (S0 -> S1 and S1->S1)', async ({ page }) => {
    // This test validates NextStep behavior:
    // - advances currentStep by 1 when possible
    // - updates the visual window and result text
    // - does nothing when at the final step
    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Click Next once to move from step 0 to step 1
    await sw.clickNext();
    await page.waitForTimeout(50);

    let currentStep = await sw.getCurrentStep();
    expect(currentStep).toBe(1);

    // For step 1 window should be indices 1..3. Validate DOM
    let indices = await sw.getWindowIndices();
    let windowIndices = indices.filter(x => x.isWindow).map(x => x.i);
    expect(windowIndices).toEqual([1, 2, 3]);

    // Validate current edge highlights (start=1 and end=3)
    const currentFlags = indices.filter(x => x.isCurrent).map(x => x.i);
    expect(currentFlags).toEqual([1, 3]);

    // Validate window sum shown for step 1: previous windowSum 8 - arr[0] (2) + arr[3] (1) = 7
    let resultText = await sw.getResultText();
    expect(resultText).toContain('Current window sum: 7');
    expect(resultText).toContain('Maximum sum so far: 8'); // max remains 8 at step1

    // Advance repeatedly to the last step and validate monotonic behavior
    const stepsCount = await sw.getStepsCount(); // expected 6
    // Click to the last step index = stepsCount - 1
    await sw.clickNextTimes(stepsCount); // extra clicks intentionally to verify boundary protection
    await page.waitForTimeout(100);

    currentStep = await sw.getCurrentStep();
    expect(currentStep).toBe(stepsCount - 1);

    // Final step window should be last three elements indices 5..7
    indices = await sw.getWindowIndices();
    windowIndices = indices.filter(x => x.isWindow).map(x => x.i);
    expect(windowIndices).toEqual([5, 6, 7]);

    // Final window sum expected: arr[5]+arr[6]+arr[7] = 2+8+4 = 14
    resultText = await sw.getResultText();
    expect(resultText).toContain('Current window sum: 14');
    expect(resultText).toContain('Maximum sum so far: 14');

    // Clicking next while at last step should NOT change currentStep (boundary check)
    await sw.clickNext();
    await page.waitForTimeout(50);
    const afterClickStep = await sw.getCurrentStep();
    expect(afterClickStep).toBe(currentStep);

    // Ensure no runtime errors occurred during the sequence of Next clicks
    expect(pageErrors, 'No uncaught page errors during Next interactions').toEqual([]);
    expect(consoleErrors, 'No console.error during Next interactions').toEqual([]);
  });

  test('PreviousStep event transitions backward and updates visualization (S1 -> S2 and S2->S2)', async ({ page }) => {
    // This test validates PreviousStep behavior:
    // - moves currentStep backward when possible
    // - updates DOM classes and result text
    // - does nothing when at the initial step
    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Move to the last step first to then traverse backwards
    const stepsCount = await sw.getStepsCount();
    await sw.clickNextTimes(stepsCount); // go to final (extra safe)
    await page.waitForTimeout(50);
    let currentStep = await sw.getCurrentStep();
    expect(currentStep).toBe(stepsCount - 1);

    // Click Prev once to move backward
    await sw.clickPrev();
    await page.waitForTimeout(50);
    currentStep = await sw.getCurrentStep();
    expect(currentStep).toBe(stepsCount - 2);

    // Validate the window indices moved back by one
    let indices = await sw.getWindowIndices();
    let windowIndices = indices.filter(x => x.isWindow).map(x => x.i);
    // For step (stepsCount-2) = 4, window should be indices 4..6
    expect(windowIndices).toEqual([4, 5, 6]);

    // Validate result text matches expected window sum for that step
    const resultText = await sw.getResultText();
    // Compute expected window sum for indices 4..6: arr[4]+arr[5]+arr[6] = 3+2+8 = 13
    expect(resultText).toContain('Current window sum: 13');

    // Move back to initial step using multiple previous clicks
    await sw.clickPrevTimes(10); // lots of clicks to ensure boundary protection
    await page.waitForTimeout(100);
    currentStep = await sw.getCurrentStep();
    expect(currentStep).toBe(0);

    // At initial state, clicking prev should not change step
    await sw.clickPrev();
    await page.waitForTimeout(50);
    expect(await sw.getCurrentStep()).toBe(0);

    // Ensure result reflects initial window after returning
    const initialResultText = await sw.getResultText();
    expect(initialResultText).toContain('Current window sum: 8');
    expect(initialResultText).toContain('Maximum sum so far: 8');

    // Ensure no runtime errors occurred during Previous interactions
    expect(pageErrors, 'No uncaught page errors during Previous interactions').toEqual([]);
    expect(consoleErrors, 'No console.error during Previous interactions').toEqual([]);
  });

  test('Reset event returns to initial state from different states and triggers render (S* -> S0)', async ({ page }) => {
    // This test validates the Reset button behavior from various states and checks that on reset:
    // - currentStep becomes 0
    // - renderStep(0) re-renders the initial window and result
    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Move forward to step 3 and then reset
    await sw.clickNextTimes(3);
    await page.waitForTimeout(50);
    expect(await sw.getCurrentStep()).toBe(3);

    // Click Reset and validate we are back at 0
    await sw.clickReset();
    await page.waitForTimeout(50);
    expect(await sw.getCurrentStep()).toBe(0);

    // Validate result and window are initial
    let indices = await sw.getWindowIndices();
    let windowIndices = indices.filter(x => x.isWindow).map(x => x.i);
    expect(windowIndices).toEqual([0, 1, 2]);
    let resultText = await sw.getResultText();
    expect(resultText).toContain('Current window sum: 8');

    // Move to last step then reset again
    const stepsCount = await sw.getStepsCount();
    await sw.clickNextTimes(stepsCount);
    await page.waitForTimeout(50);
    expect(await sw.getCurrentStep()).toBe(stepsCount - 1);

    await sw.clickReset();
    await page.waitForTimeout(50);
    expect(await sw.getCurrentStep()).toBe(0);

    // Final assertion: ensure no page errors nor console.error during resets
    expect(pageErrors, 'No uncaught page errors during Reset interactions').toEqual([]);
    expect(consoleErrors, 'No console.error during Reset interactions').toEqual([]);
  });

  test('Edge cases and robustness: rapid clicks and DOM integrity', async ({ page }) => {
    // This test presses buttons rapidly to ensure DOM and state remain consistent and that
    // no exceptions are thrown or unhandled during high-frequency interactions.
    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Rapidly alternate next and prev
    for (let i = 0; i < 20; i++) {
      await sw.clickNext();
      await sw.clickPrev();
    }

    // After rapid toggling, ensure we are still within valid bounds and DOM contains expected elements
    const currentStep = await sw.getCurrentStep();
    expect(currentStep).not.toBeNull();
    expect(currentStep).toBeGreaterThanOrEqual(0);
    const stepsCount = await sw.getStepsCount();
    expect(currentStep).toBeLessThan(stepsCount);

    // The array display should still have 8 elements
    const values = await sw.getArrayValues();
    expect(values.length).toBe(8);

    // Ensure result container contains 'Current window sum' phrase indicating renderStep executed
    const resultText = await sw.getResultText();
    expect(resultText).toContain('Current window sum');

    // Ensure no page errors or console.error produced by rapid interactions
    expect(pageErrors, 'No uncaught page errors during rapid interactions').toEqual([]);
    expect(consoleErrors, 'No console.error during rapid interactions').toEqual([]);
  });

  test('Observe console and page errors: assert no ReferenceError/SyntaxError/TypeError occurred', async ({ page }) => {
    // This test specifically examines the captured console and page errors to ensure no common runtime errors occurred.
    const sw = new SlidingWindowPage(page);
    await sw.goto();

    // Collect current error arrays (from beforeEach handlers)
    // Assert that none of the pageErrors or consoleErrors contain ReferenceError, SyntaxError, or TypeError
    const forbiddenPatterns = ['ReferenceError', 'SyntaxError', 'TypeError'];

    for (const errMsg of pageErrors) {
      for (const pat of forbiddenPatterns) {
        expect(errMsg.includes(pat)).toBeFalsy();
      }
    }

    for (const consoleMsg of consoleMessages) {
      // If message type is error, the text should not contain those error names
      if (consoleMsg.type === 'error') {
        for (const pat of forbiddenPatterns) {
          expect(consoleMsg.text.includes(pat)).toBeFalsy();
        }
      }
    }

    // Also assert that globally we did not capture any pageErrors or consoleErrors
    expect(pageErrors, 'pageErrors should be empty').toEqual([]);
    expect(consoleErrors, 'consoleErrors should be empty').toEqual([]);
  });
});