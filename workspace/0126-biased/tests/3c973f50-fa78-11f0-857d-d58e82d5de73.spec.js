import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c973f50-fa78-11f0-857d-d58e82d5de73.html';

// Increase default timeout for tests that may wait through animation loops
test.setTimeout(45000);

/**
 * Page Object for the Linear Search Visualization app.
 * Encapsulates common interactions and queries so tests stay readable.
 */
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = '#array-container';
    this.searchInput = '#search-input';
    this.startBtn = '#start-btn';
    this.explanation = '#explanation';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the array container and input/button to be present
    await Promise.all([
      this.page.waitForSelector(this.arrayContainer),
      this.page.waitForSelector(this.searchInput),
      this.page.waitForSelector(this.startBtn),
    ]);
  }

  async getExplanationText() {
    return (await this.page.locator(this.explanation).innerText()).trim();
  }

  async getArrayItemsCount() {
    return this.page.locator(`${this.arrayContainer} .array-item`).count();
  }

  async getArrayValues() {
    return this.page.$$eval(`${this.arrayContainer} .array-item`, nodes =>
      nodes.map(n => n.textContent.trim())
    );
  }

  async getItemClassesByIndex(idx) {
    return this.page.$eval(
      `${this.arrayContainer} .array-item[data-index="${idx}"]`,
      el => Array.from(el.classList)
    );
  }

  async fillInput(value) {
    await this.page.fill(this.searchInput, String(value));
  }

  async clickStart() {
    await this.page.click(this.startBtn);
  }

  async pressEnterInInput() {
    await this.page.press(this.searchInput, 'Enter');
  }

  async isStartBtnDisabled() {
    return this.page.$eval(this.startBtn, btn => btn.disabled);
  }

  async startSearchWithValue(value) {
    await this.fillInput(value);
    await this.clickStart();
  }

  // Wait until at least one element has 'found' class and return its index (data-index).
  async waitForFound(timeout = 10000) {
    const foundEl = await this.page.waitForSelector(
      `${this.arrayContainer} .array-item.found`,
      { timeout }
    );
    return foundEl.getAttribute('data-index');
  }

  // Wait for notfound state text in explanation (used for full-pass not found)
  async waitForNotFoundText(target, timeout = 30000) {
    await this.page.waitForFunction(
      (sel, tgt) => {
        const el = document.querySelector(sel);
        return el && el.textContent.includes(`Target value ${tgt} not found in the array.`);
      },
      this.explanation,
      target,
      { timeout }
    );
  }

  // Get boolean whether all items have class 'notfound'
  async allItemsHaveNotFoundClass() {
    return this.page.$$eval(
      `${this.arrayContainer} .array-item`,
      items => items.every(it => it.classList.contains('notfound'))
    );
  }
}

test.describe('Linear Search Visualization - FSM tests', () => {
  // Capture console messages and page errors to assert on them later
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test('Initial Idle State (S0_Idle) should build the array on load', async ({ page }) => {
    const app = new LinearSearchPage(page);
    await app.goto();

    // Validate buildArray() entry action by verifying the DOM array items exist and explanation text initialized
    const count = await app.getArrayItemsCount();
    // The provided implementation builds a 15-item array
    expect(count).toBe(15);

    const explanation = await app.getExplanationText();
    expect(explanation).toContain('Enter a target number above and press "Start Search" to see linear search in action.');

    // Confirm no uncaught page errors occurred during initialization
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Searching: clicking Start Search triggers searching behavior', async ({ page }) => {
    const app = new LinearSearchPage(page);
    await app.goto();

    // Start search for a known value but do not wait full run here; just assert immediate Searching state
    await app.fillInput(27);
    await app.clickStart();

    // Immediately after clicking, start button should be disabled and show 'Searching...'
    const disabled = await app.isStartBtnDisabled();
    expect(disabled).toBe(true);

    // Explanation should reflect the starting state for the target
    await page.waitForFunction(
      (sel, tgt) => document.querySelector(sel)?.textContent.includes(`Starting linear search for ${tgt}...`),
      app.explanation,
      27,
      { timeout: 3000 }
    );

    const explanation = await app.getExplanationText();
    expect(explanation).toContain('Starting linear search for 27');

    // No page errors observed so far
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_Searching -> S2_Found: target present in array leads to Found state', async ({ page }) => {
    const app = new LinearSearchPage(page);
    await app.goto();

    // Choose a value known to be in the array: 27 at index 2 in the implementation
    await app.startSearchWithValue(27);

    // Wait for the element to become .found (timeout accounts for animation delays)
    const foundIndex = await app.waitForFound(10000);
    expect(foundIndex).toBe('2'); // Confirm correct index

    // Explanation should state the found message with index
    await page.waitForFunction(
      (sel, tgt, idx) => document.querySelector(sel)?.textContent.includes(`Found ${tgt} at index ${idx}. Search complete!`),
      app.explanation,
      27,
      2,
      { timeout: 2000 }
    );
    const explanation = await app.getExplanationText();
    expect(explanation).toContain('Found 27 at index 2. Search complete!');

    // After search completes, controls should be re-enabled and start button text reset
    const disabledAfter = await app.isStartBtnDisabled();
    expect(disabledAfter).toBe(false);
    const startText = await page.locator(app.startBtn).innerText();
    expect(startText).toBe('Start Search');

    // Ensure no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_Searching -> S3_NotFound: target not present results in Not Found state', async ({ page }) => {
    const app = new LinearSearchPage(page);
    await app.goto();

    // Use a value outside the array (e.g., 99). This will require the full pass.
    await app.startSearchWithValue(99);

    // Wait until explanation indicates not found. This may take up to arr.length * delay time.
    await app.waitForNotFoundText(99, 35000);

    const explanation = await app.getExplanationText();
    expect(explanation).toContain('Target value 99 not found in the array.');

    // Verify all items are subtly highlighted as notfound
    const allNotFound = await app.allItemsHaveNotFoundClass();
    expect(allNotFound).toBe(true);

    // Controls re-enabled after completion
    const disabledAfter = await app.isStartBtnDisabled();
    expect(disabledAfter).toBe(false);

    // Ensure no page errors occurred during full run
    expect(pageErrors.length).toBe(0);
  });

  test('Event SearchInputEnter: pressing Enter triggers the search and can reach Found', async ({ page }) => {
    const app = new LinearSearchPage(page);
    await app.goto();

    // Use value 5 which exists in the array at index 8 in the provided arr
    await app.fillInput(5);
    await app.pressEnterInInput();

    // Wait for found
    const foundIndex = await app.waitForFound(15000);
    expect(foundIndex).toBe('8');

    const explanation = await app.getExplanationText();
    expect(explanation).toContain('Found 5 at index 8. Search complete!');

    // Ensure controls reset
    expect(await app.isStartBtnDisabled()).toBe(false);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid input (blank) shows validation message and does not start search', async ({ page }) => {
    const app = new LinearSearchPage(page);
    await app.goto();

    // Ensure input is blank and click start
    await app.fillInput('');
    await app.clickStart();

    // Explanation should show validation message
    await page.waitForFunction(
      sel => document.querySelector(sel)?.textContent.includes('Please enter a valid number to search for.'),
      app.explanation,
      { timeout: 2000 }
    );
    const explanation = await app.getExplanationText();
    expect(explanation).toContain('Please enter a valid number to search for.');

    // Buttons should not be disabled
    expect(await app.isStartBtnDisabled()).toBe(false);

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: out-of-range input shows range validation message', async ({ page }) => {
    const app = new LinearSearchPage(page);
    await app.goto();

    // Enter a number outside allowed 0-99 range
    await app.fillInput(150);
    await app.clickStart();

    await page.waitForFunction(
      sel => document.querySelector(sel)?.textContent.includes('Please enter a number between 0 and 99.'),
      app.explanation,
      { timeout: 2000 }
    );

    const explanation = await app.getExplanationText();
    expect(explanation).toContain('Please enter a number between 0 and 99.');

    // Controls remain enabled
    expect(await app.isStartBtnDisabled()).toBe(false);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error observation - no uncaught errors during typical flows', async ({ page }) => {
    const app = new LinearSearchPage(page);
    await app.goto();

    // Perform quick interactions: start a found and a notfound to exercise scripts
    await app.startSearchWithValue(27);
    await app.waitForSelector?.call(await page, `${app.arrayContainer} .array-item.found`, { timeout: 10000 }).catch(() => {});

    // Now start a not-found search but we will not wait for full duration here; just ensure no immediate errors
    await app.startSearchWithValue(99);

    // Small wait to catch any immediate runtime errors
    await page.waitForTimeout(500);

    // Assert we did not observe uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Also inspect collected console messages and ensure there are no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});