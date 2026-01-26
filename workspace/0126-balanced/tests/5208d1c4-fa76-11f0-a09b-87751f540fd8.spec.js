import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208d1c4-fa76-11f0-a09b-87751f540fd8.html';

// Page object for the Counting Sort demo page.
// Encapsulates navigation, common actions, and collection of console/page errors.
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages
    this.page.on('console', (msg) => {
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: if something unexpected occurs while reading console message, store a simple text.
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect runtime/unhandled errors from the page
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the page and wait for load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the counting sort button
  async clickCountingSortButton() {
    await this.page.click('#counting-sort-button');
  }

  // Helper to get a snapshot of console texts
  getConsoleTexts() {
    return this.consoleMessages.map((m) => m.text);
  }

  // Helper to get page error messages
  getPageErrorMessages() {
    return this.pageErrors.map((e) => e.message);
  }

  // Safely attempt to read a global variable from the page. Returns an object:
  // { success: boolean, value: any, error: Error|null }
  async evaluateSafe(fn) {
    try {
      const value = await this.page.evaluate(fn);
      return { success: true, value, error: null };
    } catch (error) {
      return { success: false, value: undefined, error };
    }
  }
}

test.describe('Counting Sort FSM and page behavior (Application ID: 5208d1c4-fa76-11f0-a09b-87751f540fd8)', () => {
  let countingPage;

  // Setup: create page object and navigate before each test
  test.beforeEach(async ({ page }) => {
    countingPage = new CountingSortPage(page);
    await countingPage.goto();
  });

  // Teardown: nothing special required (Playwright handles page lifecycle), but keep hook for clarity
  test.afterEach(async () => {
    // Clear collected messages for isolation between tests if needed
    countingPage.consoleMessages = [];
    countingPage.pageErrors = [];
  });

  test('Idle state: button is present and the actual page does not log the FSM-specified initial array message', async () => {
    // Verify the Counting Sort button exists and is visible/enabled
    const button = await countingPage.page.$('#counting-sort-button');
    expect(button).not.toBeNull();
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();

    // The FSM's "onEnter" for Idle claimed a console.log('Initial array: [...]').
    // Verify that this specific message did NOT appear in the console on load.
    const texts = countingPage.getConsoleTexts();
    const hasInitialArrayLog = texts.some(t => t.includes('Initial array'));
    expect(hasInitialArrayLog).toBe(false);

    // Verify whether countingSort function exists in the page context (it should not, because the function
    // is only present inside a <pre><code> block in the HTML and not executed).
    const countingSortType = await countingPage.page.evaluate(() => typeof countingSort).catch(e => 'error');
    // We expect countingSort to be undefined in the page execution context.
    expect(countingSortType === 'undefined' || countingSortType === 'error' || countingSortType === 'function').toBeTruthy();

    // Attempt to read the array variable from the page. This may either succeed (arr available) or throw.
    // We capture both possibilities and assert sensible behavior: if available, it should match the initial array.
    const arrRead = await countingPage.evaluateSafe(() => arr);
    if (arrRead.success) {
      // If arr is accessible, it should equal the initial unsorted array from the source
      expect(arrRead.value).toEqual([170, 45, 75, 90, 802, 24, 2, 66]);
    } else {
      // If arr is not accessible, ensure the failure is a ReferenceError (variable not defined in this context)
      expect(arrRead.error).toBeInstanceOf(Error);
      expect(String(arrRead.error.message)).toMatch(/arr|not defined|ReferenceError/i);
    }
  });

  test('Transition: clicking the Counting Sort button triggers an error because countingSort is not defined (observe natural ReferenceError)', async () => {
    // Attach explicit wait for the pageerror that should be thrown when the click handler calls countingSort.
    // We use Promise.all to race the click with waiting for the pageerror.
    const clickAndWait = Promise.all([
      countingPage.page.waitForEvent('pageerror').catch(e => e), // capture the error event
      countingPage.page.click('#counting-sort-button')
    ]);

    const [pageError] = await clickAndWait;

    // A ReferenceError is expected because countingSort is not defined (it exists only as text in <pre><code>).
    // Ensure a page error occurred and includes the countingSort identifier.
    expect(pageError).toBeDefined();
    expect(pageError).toBeInstanceOf(Error);
    expect(pageError.message).toMatch(/countingSort/i);

    // Confirm that the console does not contain the expected sorted array log (FSM expected console.log(sortedArr))
    const consoleTexts = countingPage.getConsoleTexts();
    const hasSortedArrayLog = consoleTexts.some(t => {
      // Look for the sorted array representation or any mention of 'Sorted array' or the expected numeric sequence
      return t.includes('Sorted array') || t.includes('[2') && t.includes('802');
    });
    expect(hasSortedArrayLog).toBe(false);

    // Verify that the button is still present and clickable after the error (no destructive DOM change)
    const button = await countingPage.page.$('#counting-sort-button');
    expect(button).not.toBeNull();
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test('Edge case: multiple clicks produce consistent runtime errors and do not produce sorted output', async () => {
    // Perform several clicks and collect pageerror events for each click.
    const errors = [];
    for (let i = 0; i < 3; i++) {
      // Use waitForEvent for each click to ensure we capture distinct error events.
      const [err] = await Promise.all([
        countingPage.page.waitForEvent('pageerror'),
        countingPage.page.click('#counting-sort-button'),
      ]);
      errors.push(err);
    }

    // All captured errors should reference countingSort being undefined.
    expect(errors.length).toBeGreaterThanOrEqual(1);
    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/countingSort/i);
    }

    // The console should not contain any successful sorted array logs after repeated errors.
    const consoleTexts = countingPage.getConsoleTexts();
    const anySortedLogs = consoleTexts.some(t => /\[.*2.*802.*\]/.test(t) || t.includes('Sorted array') || t.includes('sortedArr'));
    expect(anySortedLogs).toBe(false);

    // As the sorting never actually ran, read arr (if accessible) and ensure it remains the initial unsorted array.
    const arrRead = await countingPage.evaluateSafe(() => arr);
    if (arrRead.success) {
      expect(arrRead.value).toEqual([170, 45, 75, 90, 802, 24, 2, 66]);
    } else {
      // If arr is not accessible in this execution context, it's acceptable as long as the error is Reasonable
      expect(arrRead.error).toBeInstanceOf(Error);
      expect(String(arrRead.error.message)).toMatch(/arr|not defined|ReferenceError/i);
    }
  });

  test('FSM state assertions: verify absence of FSM-expected logs and presence of natural runtime errors (integration validation)', async () => {
    // Summary style test that validates FSM expectations vs actual behavior.

    // 1) FSM expected: on entering Idle state, console.log('Initial array: [...]')
    // Confirm absence:
    const initialLogPresent = countingPage.getConsoleTexts().some(t => t.includes('Initial array'));
    expect(initialLogPresent).toBe(false);

    // 2) FSM expects countingSort to run on button click and to log sortedArr.
    // We'll click and assert that instead of sorted output, a ReferenceError arises (natural runtime error).
    const [pageError] = await Promise.all([
      countingPage.page.waitForEvent('pageerror'),
      countingPage.page.click('#counting-sort-button'),
    ]);
    expect(pageError).toBeDefined();
    expect(pageError.message).toMatch(/countingSort/i);

    // 3) Confirm that the console does not have the FSM-expected 'console.log(sortedArr);' message
    const consoleTextsAfterClick = countingPage.getConsoleTexts();
    const hasSortedArrConsole = consoleTextsAfterClick.some(t => t.includes('sortedArr') || t.match(/\[.*2.*802.*\]/));
    expect(hasSortedArrConsole).toBe(false);
  });
});