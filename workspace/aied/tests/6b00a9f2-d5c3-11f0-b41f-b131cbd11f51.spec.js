import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00a9f2-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Counting Sort Visualization app
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      input: '#inputArray',
      sortButton: "button[onclick='runCountingSort()']",
      stepsContainer: '#stepsContainer',
      result: '#result',
      stepHeaders: '#stepsContainer .step h3',
      stepElements: '#stepsContainer .step',
      resultArrayElements: '#result .array-display .array-element',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async setInput(value) {
    await this.page.fill(this.selectors.input, value);
  }

  async clickSort() {
    await this.page.click(this.selectors.sortButton);
  }

  async isResultVisible() {
    const style = await this.page.$eval(this.selectors.result, el => el.style.display || window.getComputedStyle(el).display);
    return style !== 'none';
  }

  async getResultArray() {
    // Returns array of numbers displayed in the result area
    const elements = await this.page.$$(this.selectors.resultArrayElements);
    const texts = await Promise.all(elements.map(async el => (await el.textContent()).trim()));
    return texts.map(t => (t === '' ? t : Number(t)));
  }

  async getStepCount() {
    return this.page.$$eval(this.selectors.stepElements, els => els.length);
  }

  async getStepHeadersText() {
    return this.page.$$eval(this.selectors.stepHeaders, els => els.map(e => e.textContent.trim()));
  }

  async getResultInnerHTML() {
    return this.page.$eval(this.selectors.result, el => el.innerHTML);
  }
}

// Utility to collect console and page errors
function setupConsoleAndPageErrorCapture(page, store) {
  page.on('console', msg => {
    store.console.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    // store the full error (message & name)
    store.pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
  });
}

test.describe('Counting Sort Visualization - FSM-driven tests', () => {
  // Each test will collect console messages and page errors into these lists
  test.beforeEach(async ({ page }) => {
    // nothing global needed here; per-test setup done inside tests
  });

  test('Initial load should run counting sort automatically and display final sorted result (S0 -> S1 -> S3)', async ({ page }) => {
    // This test validates initial entry action (window.onload -> runCountingSort),
    // that the sorting completes (result shown), and the final array is correctly sorted.
    const consoleStore = { console: [], pageErrors: [] };
    setupConsoleAndPageErrorCapture(page, consoleStore);

    const app = new CountingSortPage(page);
    await app.goto();

    // The page's window.onload triggers runCountingSort on load. Wait for result to be visible.
    await page.waitForSelector('#result', { state: 'visible', timeout: 5000 });

    // Verify result display style is 'block' (evidence for S3_Result entry)
    const isVisible = await app.isResultVisible();
    expect(isVisible).toBeTruthy();

    // Verify final sorted array matches expected sorted order of default input "4,2,2,8,3,3,1"
    const resultArray = await app.getResultArray();
    expect(resultArray).toEqual([1,2,2,3,3,4,8]);

    // Verify at least the expected 5 step headers are present (Step 1 .. Step 5)
    const headers = await app.getStepHeadersText();
    // There should be at least 5 step headings
    expect(headers.length).toBeGreaterThanOrEqual(5);
    expect(headers.slice(0,5)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Step 1'),
        expect.stringContaining('Step 2'),
        expect.stringContaining('Step 3'),
        expect.stringContaining('Step 4'),
        expect.stringContaining('Step 5'),
      ])
    );

    // Verify there were no uncaught page errors (ReferenceError/SyntaxError/TypeError etc.)
    expect(consoleStore.pageErrors.length).toBe(0);

    // And no console messages of type 'error'
    const consoleErrors = consoleStore.console.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Sort sorts new input and updates result (S0 -> S1 -> S3 on explicit button click)', async ({ page }) => {
    // This test validates the transition triggered by the Sort button click,
    // ensuring sorting runs again and the result updates correctly.
    const consoleStore = { console: [], pageErrors: [] };
    setupConsoleAndPageErrorCapture(page, consoleStore);

    const app = new CountingSortPage(page);
    await app.goto();

    // Wait for initial automatic run to finish
    await page.waitForSelector('#result', { state: 'visible', timeout: 5000 });

    // Change input value and click Sort to trigger new runCountingSort invocation
    await app.setInput('3,1,2');
    // Clear steps container before clicking to differentiate runs
    await page.evaluate(() => { document.getElementById('stepsContainer').innerHTML = ''; document.getElementById('result').style.display = 'none'; });

    await app.clickSort();

    // Wait for result visible again
    await page.waitForSelector('#result', { state: 'visible', timeout: 5000 });

    // Check sorted output
    const resultArray = await app.getResultArray();
    expect(resultArray).toEqual([1,2,3]);

    // Verify step headings exist for this run (at least 5 steps)
    const stepCount = await app.getStepCount();
    expect(stepCount).toBeGreaterThanOrEqual(5);

    // Ensure no page errors or console errors
    expect(consoleStore.pageErrors.length).toBe(0);
    const consoleErrors = consoleStore.console.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Invalid non-numeric input triggers error alert and does not show result (S1 -> S2)', async ({ page }) => {
    // This test validates the InputError transition: when user provides invalid input (non-numeric),
    // runCountingSort should throw an Error, which is caught and results in an alert with the expected message.
    const consoleStore = { console: [], pageErrors: [] };
    setupConsoleAndPageErrorCapture(page, consoleStore);

    const app = new CountingSortPage(page);
    await app.goto();

    // Wait for initial sorting run to complete
    await page.waitForSelector('#result', { state: 'visible', timeout: 5000 });

    // Set invalid input containing a non-number
    await app.setInput('4,2,a,3');

    // Listen for the alert dialog and assert its message
    let alertMessage = null;
    page.once('dialog', async dialog => {
      try {
        expect(dialog.type()).toBe('alert');
        alertMessage = dialog.message();
      } finally {
        await dialog.accept();
      }
    });

    // Clear steps and hide result to observe result not shown after invalid input
    await page.evaluate(() => { document.getElementById('stepsContainer').innerHTML = ''; document.getElementById('result').style.display = 'none'; });

    // Click the Sort button to trigger validation path
    await app.clickSort();

    // Give small time for alert to fire and be handled
    await page.waitForTimeout(200);

    // Validate alert text matches expected error for non-numeric input
    expect(alertMessage).toBe('Error: Please enter valid numbers only');

    // After invalid input, result should remain hidden
    const isVisible = await app.isResultVisible();
    expect(isVisible).toBeFalsy();

    // Steps container should be empty because sorting aborted early
    const stepsAfter = await app.getStepCount();
    expect(stepsAfter).toBe(0);

    // No unexpected runtime errors should have been thrown to the page error handler
    expect(consoleStore.pageErrors.length).toBe(0);

    // No console 'error' messages
    const consoleErrors = consoleStore.console.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Negative numbers input triggers error alert (Counting sort requires non-negative integers)', async ({ page }) => {
    // This test validates that negative numbers are rejected with the expected alert message.
    const consoleStore = { console: [], pageErrors: [] };
    setupConsoleAndPageErrorCapture(page, consoleStore);

    const app = new CountingSortPage(page);
    await app.goto();

    // Wait for initial run to finish
    await page.waitForSelector('#result', { state: 'visible', timeout: 5000 });

    // Provide negative numbers
    await app.setInput('3,-1,2');

    // Prepare to capture alert
    let alertMessage = null;
    page.once('dialog', async dialog => {
      try {
        expect(dialog.type()).toBe('alert');
        alertMessage = dialog.message();
      } finally {
        await dialog.accept();
      }
    });

    // Clear UI to distinguish run
    await page.evaluate(() => { document.getElementById('stepsContainer').innerHTML = ''; document.getElementById('result').style.display = 'none'; });

    // Click sort
    await app.clickSort();

    await page.waitForTimeout(200);

    expect(alertMessage).toBe('Error: Counting sort requires non-negative integers');

    // Result should not be visible
    const isVisible = await app.isResultVisible();
    expect(isVisible).toBeFalsy();

    // No uncaught page errors and no console errors
    expect(consoleStore.pageErrors.length).toBe(0);
    expect(consoleStore.console.filter(c => c.type === 'error').length).toBe(0);
  });

  test('Empty input triggers validation error alert (edge case)', async ({ page }) => {
    // Empty input -> parseInt('') yields NaN -> should alert "Please enter valid numbers only"
    const consoleStore = { console: [], pageErrors: [] };
    setupConsoleAndPageErrorCapture(page, consoleStore);

    const app = new CountingSortPage(page);
    await app.goto();

    // Wait for initial run
    await page.waitForSelector('#result', { state: 'visible', timeout: 5000 });

    // Set empty input
    await app.setInput('');

    let alertMessage = null;
    page.once('dialog', async dialog => {
      try {
        expect(dialog.type()).toBe('alert');
        alertMessage = dialog.message();
      } finally {
        await dialog.accept();
      }
    });

    // Clear UI
    await page.evaluate(() => { document.getElementById('stepsContainer').innerHTML = ''; document.getElementById('result').style.display = 'none'; });

    // Click Sort
    await app.clickSort();

    await page.waitForTimeout(200);

    expect(alertMessage).toBe('Error: Please enter valid numbers only');

    // No result shown
    expect(await app.isResultVisible()).toBeFalsy();

    // No runtime uncaught errors
    expect(consoleStore.pageErrors.length).toBe(0);
    expect(consoleStore.console.filter(c => c.type === 'error').length).toBe(0);
  });

  test('Verifies visual evidence for S3 (result element style changed to block) after sorting completes', async ({ page }) => {
    // This test explicitly asserts that resultDiv.style.display = 'block' occurs as evidence of S3_Result
    const consoleStore = { console: [], pageErrors: [] };
    setupConsoleAndPageErrorCapture(page, consoleStore);

    const app = new CountingSortPage(page);
    await app.goto();

    // Wait for result to be visible
    await page.waitForSelector('#result', { state: 'visible', timeout: 5000 });

    // Inspect the inline style attribute on the result element
    const displayStyle = await page.$eval('#result', el => el.style.display);
    expect(displayStyle).toBe('block');

    // Ensure the innerHTML contains the "Final Sorted Array" header
    const inner = await app.getResultInnerHTML();
    expect(inner).toContain('Final Sorted Array');

    // No page errors or console errors
    expect(consoleStore.pageErrors.length).toBe(0);
    expect(consoleStore.console.filter(c => c.type === 'error').length).toBe(0);
  });
});