import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b12733-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page Object for the TimSort demo page.
 * Encapsulates common interactions and queries for tests.
 */
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.arrayInput = page.locator('#arrayInput');
    this.stepLog = page.locator('#steplog');
    this.stepLogEntries = () => this.stepLog.locator('div');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    return await this.arrayInput.inputValue();
  }

  async setInputValue(value) {
    await this.arrayInput.fill(value);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async waitForStartingLog(timeout = 3000) {
    await expect(this.stepLog).toContainText('Starting TimSort', { timeout });
  }

  async waitForFinalSortedArrayText(expectedSnippet, timeout = 5000) {
    // Wait until the steplog contains the final sorted array marker text
    await expect(this.stepLog).toContainText('Final sorted array', { timeout });
    // And also confirm expectedSnippet is present
    await expect(this.stepLog).toContainText(expectedSnippet, { timeout });
  }

  async getAllStepLogTexts() {
    return await this.stepLog.evaluate((el) => Array.from(el.querySelectorAll('div')).map(d => d.textContent || ''));
  }

  async countStepLogEntries() {
    return await this.stepLogEntries().count();
  }
}

test.describe('TimSort Demonstration - FSM states & transitions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages and page errors for assertions and diagnostics
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // give a tiny pause so any late console messages or page errors are captured
    await page.waitForTimeout(50);
    // Attach errors to test output when they exist to aid debugging
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Page errors observed:', pageErrors);
    }
    if (consoleMessages.some(m => m.type === 'error')) {
      // eslint-disable-next-line no-console
      console.error('Console error messages observed:', consoleMessages.filter(m => m.type === 'error'));
    }
  });

  test('S0_Idle: Initial render shows controls and empty steplog (Idle state)', async ({ page }) => {
    // Validate initial UI - Idle state expectations
    const tim = new TimSortPage(page);

    // Ensure controls exist and are visible
    await expect(tim.startBtn).toBeVisible();
    await expect(tim.arrayInput).toBeVisible();
    await expect(tim.stepLog).toBeVisible();

    // The textarea should contain the default array as per HTML implementation
    const inputValue = await tim.getInputValue();
    expect(inputValue.trim()).toBe('5, 21, 7, 23, 19, 3, 17, 11, 9, 15, 14, 8');

    // The steplog should start empty on initial load
    const entryCount = await tim.countStepLogEntries();
    expect(entryCount).toBe(0);

    // There should be no uncaught page errors on initial render
    expect(pageErrors.length).toBe(0);
    // There should be no console errors
    expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
  });

  test('StartSort event transitions to S1_Sorting and then S2_Sorted producing expected logs', async ({ page }) => {
    // This test performs the StartSort click and verifies both the "Starting TimSort" (Sorting state)
    // and the "Final sorted array" (Sorted final state) messages are emitted into the steplog,
    // checks for merge-step/run-detection-step entries, and ensures no page errors occurred.
    const tim = new TimSortPage(page);

    // Ensure Idle precondition
    await expect(tim.startBtn).toBeVisible();

    // Click start to trigger sorter.timSort() (S0 -> S1)
    await tim.clickStart();

    // Wait for Sorting entry log to appear
    await tim.waitForStartingLog(5000);

    // Confirm that at least one run-detection-step exists and one merge-step exists during sorting
    // (they are styled via CSS classes 'run-detection-step' and 'merge-step' on divs)
    // We query inside #steplog for elements with those classes
    const runDetectCount = await page.locator('#steplog .run-detection-step').count();
    const mergeStepCount = await page.locator('#steplog .merge-step').count();

    expect(runDetectCount).toBeGreaterThanOrEqual(1);
    expect(mergeStepCount).toBeGreaterThanOrEqual(1);

    // Wait for final sorted array to be logged (S1 -> S2)
    const expectedFinal = '[3, 5, 7, 8, 9, 11, 14, 15, 17, 19, 21, 23]';
    await tim.waitForFinalSortedArrayText(expectedFinal, 7000);

    // Verify that the final state log contains the exact final sorted array
    const logs = await tim.getAllStepLogTexts();
    const hasFinal = logs.some(l => l.includes('Final sorted array') && l.includes('[') && l.includes(']'));
    expect(hasFinal).toBe(true);

    // The last occurrence of the bracketed list should match expectedFinal
    const lastLogWithBrackets = logs.slice().reverse().find(l => l.includes('[') && l.includes(']'));
    expect(lastLogWithBrackets).toContain(expectedFinal);

    // Ensure there are no uncaught page errors and no console errors during sorting
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
  });

  test('Re-running sorting with a new input clears previous logs and produces new final output', async ({ page }) => {
    // Validate that the log gets cleared at the start of a new run (logElement.innerHTML = '')
    const tim = new TimSortPage(page);

    // Run once with default input
    await tim.clickStart();
    await tim.waitForFinalSortedArrayText('[3, 5, 7, 8, 9, 11, 14, 15, 17, 19, 21, 23]', 7000);

    const firstRunEntries = await tim.countStepLogEntries();
    expect(firstRunEntries).toBeGreaterThan(0);

    // Change input to a small custom array so final output is easy to assert and differs from first run
    await tim.setInputValue('2, 1, 3');

    // Start again; the implementation clears the steplog.innerHTML at the beginning of the handler
    await tim.clickStart();

    // Now the final sorted array should be [1, 2, 3]
    await tim.waitForFinalSortedArrayText('[1, 2, 3]', 5000);

    // Check that entries were produced for the second run
    const secondRunEntries = await tim.countStepLogEntries();
    expect(secondRunEntries).toBeGreaterThan(0);

    // Confirm the final array from the second run is indeed the expected one and different from the first final
    const logsAfterSecond = await tim.getAllStepLogTexts();
    const finalEntry = logsAfterSecond.slice().reverse().find(l => l.includes('Final sorted array'));
    expect(finalEntry).toBeTruthy();
    expect(finalEntry).toContain('[1, 2, 3]');
  });

  test('Edge case: empty input triggers alert with appropriate message', async ({ page }) => {
    // When textarea is empty, clicking Start should show an alert with the expected message
    const tim = new TimSortPage(page);

    // Clear input
    await tim.setInputValue('');

    // Wait for dialog and assert message
    const dialogPromise = page.waitForEvent('dialog');
    await tim.clickStart();
    const dialog = await dialogPromise;
    try {
      expect(dialog.message()).toBe('Please enter a comma separated list of numbers.');
    } finally {
      await dialog.accept();
    }

    // No page errors should have been thrown
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid/non-numeric input triggers alert indicating invalid numbers', async ({ page }) => {
    const tim = new TimSortPage(page);

    // Set invalid input
    await tim.setInputValue('a, b, c');

    // Wait for dialog
    const dialogPromise = page.waitForEvent('dialog');
    await tim.clickStart();
    const dialog = await dialogPromise;
    try {
      expect(dialog.message()).toBe('Please enter valid numbers.');
    } finally {
      await dialog.accept();
    }

    expect(pageErrors.length).toBe(0);
  });

  test('Implementation logs include expected informational messages (run detection and merging)', async ({ page }) => {
    // Validate presence of multiple different kinds of log messages showing the algorithm steps
    const tim = new TimSortPage(page);

    await tim.clickStart();

    // Wait for algorithm to complete
    await tim.waitForFinalSortedArrayText('[3, 5, 7, 8, 9, 11, 14, 15, 17, 19, 21, 23]', 7000);

    // Confirm there are messages describing insertion sorts and run detection
    const runDetectElements = await page.locator('#steplog .run-detection-step').allTextContents();
    expect(runDetectElements.length).toBeGreaterThanOrEqual(1);
    // Check at least one merge-step exists with the phrase "Merging runs"
    const mergeTexts = await page.locator('#steplog .merge-step').allTextContents();
    const hasMergingPhrase = mergeTexts.some(t => t.includes('Merging runs'));
    expect(hasMergingPhrase).toBe(true);

    // No runtime page errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBe(false);
  });
});