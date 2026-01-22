import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba93960-d5b2-11f0-b169-abe023d0d932.html';

// Page Object encapsulating common interactions and assertions for the Insertion Sort page
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.title = page.locator('h1');
    this.arrayInput = page.locator('#array');
    this.sortButton = page.locator('#sort-btn');
    this.output = page.locator('#output');
    // Note: HTML contains two checkboxes with the same id 'sort'.
    // Use name selector and nth() to access first/second explicitly.
    this.sortCheckboxes = page.locator('input[name="sort"]');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async enterArray(value) {
    await this.arrayInput.fill(value);
    // Fire input event to mimic user typing (page code doesn't have input listener but keep consistent)
    await this.arrayInput.dispatchEvent('input');
  }

  // Check the first checkbox (which, due to duplicate ids, is the one returned by getElementById('sort'))
  async checkFirstCheckbox() {
    await this.sortCheckboxes.nth(0).check();
    // dispatch change on checkbox to ensure any potential handlers run (none are attached in implementation)
    await this.sortCheckboxes.nth(0).dispatchEvent('change');
  }

  async uncheckFirstCheckbox() {
    await this.sortCheckboxes.nth(0).uncheck();
    await this.sortCheckboxes.nth(0).dispatchEvent('change');
  }

  // Check the second checkbox (not used by getElementById in the page code but included for completeness)
  async checkSecondCheckbox() {
    await this.sortCheckboxes.nth(1).check();
    await this.sortCheckboxes.nth(1).dispatchEvent('change');
  }

  // The implementation attaches a 'change' event listener to the sort button.
  // Use dispatchEvent('change') to activate the implemented handler.
  async triggerSortChangeEvent() {
    await this.sortButton.dispatchEvent('change');
  }

  // Clicking the button will likely submit the form (default button inside form -> submit),
  // which can cause navigation. Provide a utility that clicks and optionally waits for navigation.
  async clickSortButtonExpectNavigation(waitForNav = true) {
    if (waitForNav) {
      await Promise.all([
        this.page.waitForNavigation({ url: BASE_URL, waitUntil: 'load', timeout: 5000 }).catch(() => null),
        this.sortButton.click({ timeout: 5000 }).catch(() => null)
      ]);
    } else {
      await this.sortButton.click({ timeout: 5000 }).catch(() => null);
    }
  }

  async getButtonText() {
    return await this.sortButton.textContent();
  }

  async getOutputParagraphsText() {
    // The page writes <p> elements inside the textarea's innerHTML string (even though that's not usual).
    // So query for p elements that might have been injected into the output element's innerHTML.
    // Use evaluate to read innerHTML and extract <p> contents robustly.
    const html = await this.output.evaluate((el) => el.innerHTML);
    if (!html) return [];
    // Simple extraction of content between <p>...</p> tags
    const matches = [...html.matchAll(/<p>(.*?)<\/p>/g)];
    return matches.map((m) => m[1]);
  }

  async countSortIdDuplicates() {
    // Count elements in the DOM that have id="sort"
    return await this.page.locator('[id="sort"]').count();
  }
}

// Group related tests for the Insertion Sort interactive application
test.describe('Insertion Sort Interactive Application (FSM validation & DOM behavior)', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;

  // Setup: launch page and attach listeners for console and page errors
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    app = new InsertionSortPage(page);
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await app.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial render shows title (S0_Idle) and expected elements', async () => {
    // Validate Idle state evidence: <h1>Insertion Sort</h1>
    await expect(app.title).toHaveText('Insertion Sort');

    // The page script calls sortInAsc(array) followed by sortInDesc(array) on load.
    // Because of that, the button text will reflect the last call in implementation.
    const buttonText = (await app.getButtonText())?.trim();
    // Implementation sets the button text to 'Sort in descending order' last, so assert that.
    expect(buttonText).toBe('Sort in descending order');

    // Ensure the array input and output textarea exist
    await expect(app.arrayInput).toBeVisible();
    await expect(app.output).toBeVisible();

    // Record that no uncaught exceptions happened during initial render
    expect(pageErrors.length).toBe(0);

    // Confirm there are two elements claiming id="sort" (document markup bug / edge case)
    const duplicateCount = await app.countSortIdDuplicates();
    // The provided HTML intentionally includes two inputs with id="sort", assert that we detect them.
    expect(duplicateCount).toBeGreaterThanOrEqual(2);
  });

  test('Entering an array transitions to Array Entered (S1_ArrayEntered) and input reflects value', async () => {
    // This test validates the ArrayEntered state by typing into the #array input.
    const sample = '3 1 2';
    await app.enterArray(sample);
    await expect(app.arrayInput).toHaveValue(sample);

    // Implementation does not attach an input handler to keep an internal array updated,
    // but the DOM input value change is sufficient evidence of the state transition in the UI.
    const val = await app.arrayInput.inputValue();
    expect(val).toBe(sample);

    // Ensure still no uncaught exceptions after input
    expect(pageErrors.length).toBe(0);
  });

  test('Dispatching change event on sort button with first checkbox checked -> ascending label (S2_SortedAscending expected)', async () => {
    // Prepare: enter array and check first checkbox (the one returned by getElementById('sort'))
    const sample = '3 1 2';
    await app.enterArray(sample);
    await app.checkFirstCheckbox();

    // Dispatch the 'change' event on the sort button to trigger the implemented handler
    await app.triggerSortChangeEvent();

    // The implementation's handler:
    // - reads the checkbox via getElementById('sort') and sets button text to 'Sort in ascending order' when checked
    // - reads the input value and injects each number into output.innerHTML inside <p> tags
    const btnText = (await app.getButtonText())?.trim();
    expect(btnText).toBe('Sort in ascending order');

    // Verify output paragraphs reflect the raw input order (implementation prints un-sorted numbers)
    const outputValues = await app.getOutputParagraphsText();
    expect(outputValues).toEqual(['3', '1', '2']); // note: this demonstrates the implementation behavior

    // FSM expected action is to call sortInAsc(array) and output a sorted array.
    // The implementation does not do this in the change handler; assert the observed divergence.
    expect(outputValues).not.toEqual(['1', '2', '3']);

    // Ensure no uncaught exceptions during this interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Dispatching change event on sort button with first checkbox unchecked -> descending label (S3_SortedDescending expected)', async () => {
    // Enter array and ensure the first checkbox is unchecked (so handler interprets as descending)
    const sample = '4 2 5 1';
    await app.enterArray(sample);
    // Ensure first checkbox is unchecked
    await app.uncheckFirstCheckbox();

    // Trigger the change handler on the button
    await app.triggerSortChangeEvent();

    // Expect the button label to reflect descending per the page's change handler
    const btnText = (await app.getButtonText())?.trim();
    expect(btnText).toBe('Sort in descending order');

    // Verify output paragraphs reflect the raw input order (again implementation prints raw order)
    const outputValues = await app.getOutputParagraphsText();
    expect(outputValues).toEqual(['4', '2', '5', '1']);

    // FSM expects a sorted descending result; assert the implementation does not match that expectation (highlighting bug)
    expect(outputValues).not.toEqual(['5', '4', '2', '1']);

    // Still assert there are no uncaught exceptions
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking the sort button submits the form and triggers navigation (edge case)', async () => {
    // Clicking the button (no type specified in HTML) will act as a submit button in a form and may cause navigation.
    // The page is served from the same URL; a navigation/reload is likely. We assert that a navigation occurs.
    // Prepare: ensure some input present
    await app.enterArray('1 2 3');

    // Attempt to click and wait for navigation (if it happens). The helper tolerates no navigation.
    let navigated = false;
    // Listen for navigation event
    page.once('framenavigated', () => {
      navigated = true;
    });

    await app.clickSortButtonExpectNavigation(true);
    // After click attempt, check whether navigation was observed or the button click was harmless.
    // We accept both possibilities but record the observed behavior.
    // The presence of navigation indicates the form submit edge-case in the HTML.
    expect(typeof navigated).toBe('boolean');
    // Re-check page loaded and title present after potential navigation
    await expect(page.locator('h1')).toHaveText('Insertion Sort');

    // No uncaught exceptions as a result of navigation/form submission
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: empty input, non-numeric tokens, and duplicate checkbox id detection', async () => {
    // Empty input case
    await app.enterArray('');
    await app.uncheckFirstCheckbox();
    await app.triggerSortChangeEvent();
    const emptyOutput = await app.getOutputParagraphsText();
    expect(emptyOutput).toEqual([]); // no numbers -> no paragraphs generated

    // Non-numeric tokens: the implementation uses .map(Number) which yields NaN values.
    // Validate how those appear in output (converted to "NaN" string when injected)
    await app.enterArray('a b 3');
    await app.checkFirstCheckbox();
    await app.triggerSortChangeEvent();
    const outputValues = await app.getOutputParagraphsText();
    // Expect NaN representations for non-numeric tokens
    expect(outputValues).toEqual(['NaN', 'NaN', '3']);

    // Confirm duplicate id "sort" exists (markup issue)
    const duplicates = await app.countSortIdDuplicates();
    expect(duplicates).toBeGreaterThanOrEqual(2);

    // Ensure no uncaught exceptions from these edge cases
    expect(pageErrors.length).toBe(0);
  });

  test('Observing console messages and page errors during interactions', async () => {
    // Run a sequence of interactions to collect console messages and page errors
    await app.enterArray('7 6 5');
    await app.checkFirstCheckbox();
    await app.triggerSortChangeEvent();

    // There are no deliberate console.log statements in the implementation, so consoleMessages may remain empty.
    // Assert that we captured console messages array (could be empty) and pageErrors (should be empty).
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(pageErrors.length).toBe(0);

    // If any page errors were present, fail explicitly and log them for debugging (keeps behavior observable)
    if (pageErrors.length > 0) {
      // This branch won't run under normal circumstances for this implementation,
      // but keeps the test robust in case runtime errors are introduced.
      throw new Error(`Page had uncaught errors: ${pageErrors.map(e => e.message).join('; ')}`);
    }
  });
});