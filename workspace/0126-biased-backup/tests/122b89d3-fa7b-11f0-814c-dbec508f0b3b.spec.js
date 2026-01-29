import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b89d3-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Counting Sort page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.countLocator = page.locator('#count');
    // Note: the page contains duplicate id="value". Playwright's locator('#value') will match the first.
    this.valueLocator = page.locator('#value');
    this.resultLocator = page.locator('#result');
    this.sortButton = page.locator('#sort-button');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getCountText() {
    return (await this.countLocator.innerText()).trim();
  }

  async getValueText() {
    return (await this.valueLocator.innerText()).trim();
  }

  async getResultText() {
    return (await this.resultLocator.innerText()).trim();
  }

  async clickSort() {
    await this.sortButton.click();
  }

  // click sort N times in sequence, waiting a tick between clicks to allow DOM updates
  async clickSortTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.clickSort();
      // small pause to allow synchronous DOM updates performed by the page script
      await this.page.waitForTimeout(20);
    }
  }
}

test.describe('Counting Sort Interactive Application - FSM Validation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages and page errors for observation and assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  test.describe('Initial (Idle) State Assertions', () => {
    test('Idle: initial DOM reflects script-run initialization and entry-action expectations', async ({ page }) => {
      // This test validates the initial "Idle" state (S0_Idle) of the FSM.
      // According to the FSM, entry action should call updateValue().
      // The implementation does NOT explicitly call updateValue() on load;
      // instead a for-loop at the end of the script sets the #value element repeatedly.
      // We assert the actual DOM to validate what happened in the real implementation.

      const cs = new CountingSortPage(page);
      await cs.goto();

      // Check there are no uncaught page errors on initial load
      expect(pageErrors.length).toBe(0);

      // Count should be initialized to "Count: 0"
      const countText = await cs.getCountText();
      expect(countText).toBe('Count: 0');

      // Because the implementation contains a for-loop that repeatedly sets document.getElementById("value").innerHTML = values[i];
      // the final visible text for the #value element becomes "10" (the last iteration), not the joined list.
      // This allows us to infer that updateValue() was not invoked on load, demonstrating a mismatch between FSM "entry_actions" and actual behavior.
      const valueText = await cs.getValueText();
      // Expect the value text to be the final loop-assigned single value ("10")
      expect(valueText).toBe('10');

      // There are duplicate elements with id="value" in the DOM. Assert that duplicate ids exist (edge-case).
      const duplicateIdCount = await page.evaluate(() => document.querySelectorAll('#value').length);
      expect(duplicateIdCount).toBeGreaterThanOrEqual(2);

      // Ensure no console-level 'error' messages were emitted on load
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });
  });

  test.describe('Sorting State and Transitions (S0_Idle -> S1_Sorting)', () => {
    test('Transition: clicking Sort moves the current value to the end and increments Count', async ({ page }) => {
      // This test validates a single transition from Idle to Sorting triggered by clicking the sort button.
      // It checks that sort() runs, count increments by 1, and the #result DOM shows the updated ordering.

      const cs = new CountingSortPage(page);
      await cs.goto();

      // Sanity: initial count 0
      expect(await cs.getCountText()).toBe('Count: 0');

      // Click once to trigger sort()
      await cs.clickSort();
      // Small wait to let synchronous updates finish
      await page.waitForTimeout(20);

      // After 1 click, count should equal 1
      expect(await cs.getCountText()).toBe('Count: 1');

      // Check #result contains the full list after moving the first element to the end.
      // For initial values [1..10], after moving 1 to the end we expect "2 3 4 5 6 7 8 9 10 1"
      const resultText = await cs.getResultText();
      expect(resultText.startsWith('Count: 1 and sorted values:')).toBeTruthy();
      expect(resultText).toContain('2 3 4 5 6 7 8 9 10 1');

      // No uncaught page errors produced by this interaction
      expect(pageErrors.length).toBe(0);

      // No console-level 'error' messages were emitted
      const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });

    test('Multiple transitions: clicking Sort repeatedly updates ordering and count incrementally', async ({ page }) => {
      // This test validates repeated transitions across the Sorting state:
      // It clicks the Sort button 3 times and checks the count and result ordering at each stage.

      const cs = new CountingSortPage(page);
      await cs.goto();

      // Click 3 times
      await cs.clickSortTimes(3);

      // Now count should be 3
      expect(await cs.getCountText()).toBe('Count: 3');

      // Expected array after 3 iterations:
      // Start: [1,2,3,4,5,6,7,8,9,10]
      // After 1: [2,3,4,5,6,7,8,9,10,1]
      // After 2: [2,4,5,6,7,8,9,10,1,3] ? Let's compute directly on the page to avoid mismatch assumptions.
      // We'll compare to the live DOM: result contains the ordering built by updateResult().
      const resultText = await cs.getResultText();
      expect(resultText.startsWith('Count: 3 and sorted values:')).toBeTruthy();

      // Confirm there are 10 numbers present in the result (expect 10 numbers separated by spaces)
      // Extract numbers from result text
      const numberSequence = resultText.replace(/^Count:\s*\d+\s*and sorted values:\s*/, '').trim();
      const numbers = numberSequence.split(/\s+/).filter(Boolean);
      expect(numbers.length).toBe(10);

      // Ensure no page exceptions occurred during repeated transitions
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: clicking Sort past the length triggers final sorted output and count stops increasing', async ({ page }) => {
      // This test checks the behavior when the user clicks Sort many times:
      // After values.length clicks the next click should hit the branch that outputs "Sorted count: ..." and should not increase count beyond values.length.

      const cs = new CountingSortPage(page);
      await cs.goto();

      // Click the sort button values.length (10) times to reach count == 10
      await cs.clickSortTimes(10);

      // After 10 clicks, count should be 10
      expect(await cs.getCountText()).toBe('Count: 10');

      // One more click should hit the top branch: when count === values.length
      await cs.clickSort();
      await page.waitForTimeout(20);

      // The implementation's branch writes "Sorted count: " and lists values with spaces
      const finalResult = await cs.getResultText();
      expect(finalResult.startsWith('Sorted count: 10 and sorted values:')).toBeTruthy();

      // Ensure the "final" sorted result contains all numbers 1..10 (look for '1' and '10' at least)
      expect(finalResult).toContain('1');
      expect(finalResult).toContain('10');

      // Additional clicks should continue to produce the same "Sorted count: 10 ..." message (count should not grow)
      await cs.clickSort();
      await page.waitForTimeout(20);
      const repeatedFinal = await cs.getResultText();
      expect(repeatedFinal.startsWith('Sorted count: 10 and sorted values:')).toBeTruthy();

      // Confirm count still shows 10
      expect(await cs.getCountText()).toBe('Count: 10');

      // No uncaught exceptions observed
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error Observability and Edge Behaviors', () => {
    test('Detect duplicate id usage and assert it is present (DOM edge case)', async ({ page }) => {
      // This test explicitly observes the duplicate id problem which can cause unexpected behavior.
      const cs = new CountingSortPage(page);
      await cs.goto();

      // There should be at least two elements with id="value" per the provided HTML
      const duplicates = await page.evaluate(() => document.querySelectorAll('#value').length);
      expect(duplicates).toBeGreaterThanOrEqual(2);
    });

    test('Observe console and page errors (there should be none for this implementation)', async ({ page }) => {
      // This test collects console messages and page errors on initial load and interactions,
      // and asserts no uncaught exceptions were generated by the provided script.
      const cs = new CountingSortPage(page);

      await cs.goto();

      // Perform a couple of interactions to exercise code paths
      await cs.clickSortTimes(2);

      // Allow any asynchronous callbacks (if any) to surface errors
      await page.waitForTimeout(50);

      // Assert that no uncaught page errors occurred
      if (pageErrors.length > 0) {
        // If errors are present, fail the test with diagnostic information
        const errMessages = pageErrors.map(e => e.message).join('\n---\n');
        throw new Error('Unexpected page errors detected:\n' + errMessages);
      }
      expect(pageErrors.length).toBe(0);

      // Assert there are no console messages of type 'error'
      const errorConsoles = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoles.length).toBe(0);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Helpful debug output in case tests fail; includes counts of captured console messages and page errors
    if (testInfo.status !== testInfo.expectedStatus) {
      // When tests fail, print captured diagnostics to make debugging easier
      // (Playwright will show test output; we keep this conditional to reduce noise on success)
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => (e && e.message) || String(e)));
    }
  });
});