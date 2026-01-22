import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba91251-d5b2-11f0-b169-abe023d0d932.html';

// Page object for the Selection Sort app
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nInput = page.locator('#n');
    this.sortBtn = page.locator('#sort-btn');
    this.result = page.locator('#result');
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages
    this.page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    this.page.on('pageerror', error => {
      this.pageErrors.push(error);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Read current value of n input as string
  async getNValue() {
    return await this.nInput.inputValue();
  }

  // Set the n input (string value)
  async setNValue(val) {
    await this.nInput.fill(String(val));
  }

  // Click the Sort button, providing a list of prompt responses or special 'DISMISS' to cancel a prompt.
  // responses: array of strings or the special symbol SelectionSortPage.DISMISS
  async clickSortAndHandleDialogs(responses = []) {
    const page = this.page;
    let dialogCount = 0;

    const handler = async dialog => {
      const resp = responses[dialogCount];
      dialogCount++;
      if (resp === SelectionSortPage.DISMISS) {
        await dialog.dismiss();
      } else {
        // Accept with text (could be undefined -> accept without text)
        await dialog.accept(resp === undefined ? '' : String(resp));
      }
    };

    page.on('dialog', handler);

    // Click the button that triggers prompts
    await this.sortBtn.click();

    // Wait briefly to let prompts be handled and results rendered / errors thrown
    // We use a small timeout, but tests below will further wait/inspect specific results or errors.
    await page.waitForTimeout(150);

    // Clean up the dialog handler
    page.off('dialog', handler);
  }

  // Get visible result text
  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }
}

// Special symbol to indicate dismissing a prompt
SelectionSortPage.DISMISS = Symbol('DISMISS');

test.describe('Selection Sort App - FSM validation and edge cases', () => {
  let page;
  let app;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    app = new SelectionSortPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('S0_Idle: Initial rendering shows input, button and empty result (Idle state)', async () => {
    // Validate the page is in Idle state (S0_Idle) with expected DOM evidence
    // Check input exists, has default value "5", sort button exists, and result empty
    await expect(app.nInput).toBeVisible();
    const nValue = await app.getNValue();
    expect(nValue).toBe('5'); // evidence: <input id="n" value="5">
    await expect(app.sortBtn).toBeVisible();
    await expect(app.sortBtn).toHaveText('Sort'); // evidence: <button id="sort-btn">Sort</button>
    const resultText = await app.getResultText();
    expect(resultText).toBe(''); // evidence: <div id="result"></div> is empty initially

    // Ensure that no unexpected page errors occurred during initial load
    expect(app.pageErrors.length).toBe(0);

    // Also capture console messages (there shouldn't be errors logged)
    const errorConsoleMsgs = app.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('S1_Sorting: Clicking Sort prompts for elements and displays sorted array (normal flow)', async () => {
    // This validates the transition from S0_Idle -> S1_Sorting on Sort button click
    // Provide five element inputs via prompt dialogs and assert sorted result is shown
    const inputs = ['64', '25', '12', '22', '11']; // unsorted input
    // Ensure n input is 5 (default). For clarity, set explicitly.
    await app.setNValue('5');
    await app.clickSortAndHandleDialogs(inputs);

    // After prompts handled, result should contain the sorted numbers in ascending order
    const result = (await app.getResultText()).trim();
    // The page prints numbers followed by spaces, so we normalize whitespace
    expect(result.split(/\s+/).filter(Boolean)).toEqual(['11', '12', '22', '25', '64']);

    // No uncaught runtime errors should have occurred in the normal flow
    expect(app.pageErrors.length).toBe(0);

    // There should be no console errors
    const consoleErrors = app.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition behavior: n = 0 leads to no prompts and empty result', async () => {
    // Setting n to 0 should create an empty array: no prompts should appear and result remains empty
    await app.setNValue('0');
    // No prompt responses needed since 0 prompts expected
    await app.clickSortAndHandleDialogs([]);

    const result = (await app.getResultText()).trim();
    expect(result).toBe(''); // empty result expected

    // No runtime errors or console errors
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Edge case: User cancels a prompt -> NaN may appear in results and no crash', async () => {
    // Simulate cancelling the second prompt: first prompt accept '5', second prompt dismiss, third accept '1'
    await app.setNValue('3');
    await app.clickSortAndHandleDialogs(['5', SelectionSortPage.DISMISS, '1']);

    const result = await app.getResultText();
    // When prompt is dismissed, parseInt(null) becomes NaN and prints 'NaN' in output
    // We assert that result contains 'NaN'
    expect(result).toContain('NaN');

    // The page should not have thrown an uncaught exception for a canceled prompt scenario
    expect(app.pageErrors.length).toBe(0);

    // There should be no console errors
    expect(app.consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Error scenario: Non-numeric n (e.g., "abc") leads to invalid array length RangeError', async () => {
    // This test ensures we observe runtime errors that happen naturally (do not patch the code)
    // Set n to a non-numeric string so parseInt will be NaN and new Array(NaN) should throw RangeError.
    await app.setNValue('abc');

    // Prepare to wait for a page error to be emitted.
    // We trigger the click which will synchronously create new Array(NaN) inside the click handler and throw.
    // Click and allow small time for the error to be captured.
    await app.clickSortAndHandleDialogs([]);

    // Wait briefly to ensure any pageerror events are captured
    await page.waitForTimeout(100);

    // We expect at least one page error occurred
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);

    // Find a RangeError with message referencing invalid array length
    const hasRangeError = app.pageErrors.some(err => {
      const msg = String(err && err.message ? err.message : err);
      return msg.includes('Invalid array length') || msg.includes('invalid array length') || msg.includes('RangeError');
    });

    expect(hasRangeError).toBeTruthy();
  });

  test('Error scenario: Negative n (e.g., -1) leads to RangeError for invalid array length', async () => {
    // Negative array length should throw RangeError as well
    await app.setNValue('-1');

    await app.clickSortAndHandleDialogs([]);

    await page.waitForTimeout(100);

    expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);

    const hasRangeError = app.pageErrors.some(err => {
      const msg = String(err && err.message ? err.message : err);
      return msg.includes('Invalid array length') || msg.includes('invalid array length') || msg.includes('RangeError');
    });

    expect(hasRangeError).toBeTruthy();
  });

  test('Behavioral: Partial non-numeric element inputs produce NaN in array and sorting proceeds without crash', async () => {
    // Set n=4 and provide some non-numeric element strings; ensure sorting completes and NaN shows up
    await app.setNValue('4');
    // Provide inputs: '3', 'foo' (non-numeric -> NaN), '2', 'bar' (NaN)
    await app.clickSortAndHandleDialogs(['3', 'foo', '2', 'bar']);

    const result = await app.getResultText();
    // We expect 'NaN' to appear at least once, and numeric values present
    expect(result).toMatch(/NaN/);
    expect(result).toMatch(/3|2/);

    // No uncaught exceptions should have occurred
    expect(app.pageErrors.length).toBe(0);
  });
});