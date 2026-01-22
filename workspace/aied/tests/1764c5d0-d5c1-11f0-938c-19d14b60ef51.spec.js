import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1764c5d0-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object Model for the Two Pointers demo page
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.findButton = page.locator('button[onclick="findPairs()"]');
    this.resultDiv = page.locator('#result');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillArray(value) {
    await this.arrayInput.fill(value);
  }

  async fillTarget(value) {
    // value can be string or number
    await this.targetInput.fill(String(value));
  }

  async clickFind() {
    await this.findButton.click();
  }

  async getResultText() {
    return (await this.resultDiv.innerText()).trim();
  }

  async getHeaderText() {
    return (await this.header.innerText()).trim();
  }

  // helper to clear inputs
  async clearInputs() {
    await this.arrayInput.fill('');
    await this.targetInput.fill('');
  }
}

test.describe('Two Pointers Algorithm App - FSM comprehensive tests', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (including errors) for the test
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // capturing shouldn't interfere with test runtime
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page (listeners attached before navigation to catch load-time errors)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown needed beyond Playwright's default, but hooks exist for clarity.
  });

  test('S0_Idle: Initial page render - header and empty result area', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry action renderPage()
    // Ensure the main header exists and the result div is empty on load.
    const app = new TwoPointersPage(page);

    const headerText = await app.getHeaderText();
    expect(headerText).toBe('Demonstration of Two Pointers Algorithm');

    const resultText = await app.getResultText();
    expect(resultText).toBe(''); // result should be empty initially

    // Assert that no uncaught page errors occurred during initial render.
    expect(pageErrors.length).toBe(0);

    // Assert there are no console error-level messages (if any console messages exist, ensure none are errors)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0 -> S1 -> S2: Valid input produces correct pairs (multiple pairs)', async ({ page }) => {
    // This test validates reading inputs (S1_InputReceived) and displaying results (S2_ResultsDisplayed)
    // Example: array 1,2,3,4,5 with target 5 should yield (1, 4), (2, 3)
    const app = new TwoPointersPage(page);

    await app.clearInputs();
    await app.fillArray('1,2,3,4,5');
    await app.fillTarget('5');

    // Click the Find Pairs button (FindPairs_Click event)
    await app.clickFind();

    // Verify resultDiv shows the expected pairs exactly as the implementation formats them
    const resultText = await app.getResultText();
    expect(resultText).toBe('Pairs that sum to 5: (1, 4), (2, 3)');

    // Ensure no runtime page errors or console errors occurred while processing this interaction
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('S2_ResultsDisplayed: No pairs found scenario', async ({ page }) => {
    // This test validates that when no pairs sum to the target, the "No pairs found" message is shown.
    const app = new TwoPointersPage(page);

    await app.clearInputs();
    await app.fillArray('1,2,3');
    await app.fillTarget('10');

    await app.clickFind();

    const resultText = await app.getResultText();
    expect(resultText).toBe('No pairs found that sum to 10.');

    // No page errors or console errors expected
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('S3_InvalidInput: Empty inputs produce validation message', async ({ page }) => {
    // This test validates the Invalid Input state (S3_InvalidInput) when inputs are missing.
    const app = new TwoPointersPage(page);

    // Ensure both inputs are empty
    await app.clearInputs();

    await app.clickFind();

    const resultText = await app.getResultText();
    expect(resultText).toBe('Please enter a valid array and target sum.');

    // Validate no unexpected runtime errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('S3_InvalidInput: Non-numeric array entries parsed to empty -> validation message', async ({ page }) => {
    // If the array input contains only non-numeric tokens, the parsed array length will be 0
    // and the app should show the invalid input message.
    const app = new TwoPointersPage(page);

    await app.clearInputs();
    await app.fillArray('a, b, foo');
    await app.fillTarget('5');

    await app.clickFind();

    const resultText = await app.getResultText();
    expect(resultText).toBe('Please enter a valid array and target sum.');

    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case: duplicate pairs and repeated values handled correctly', async ({ page }) => {
    // This test checks behavior with duplicates where algorithm should report multiple pairs if pointers find them.
    // Example: array "1,1,4,4" with target 5 should produce two pairs: (1, 4), (1, 4)
    const app = new TwoPointersPage(page);

    await app.clearInputs();
    await app.fillArray('1,1,4,4');
    await app.fillTarget('5');

    await app.clickFind();

    const resultText = await app.getResultText();
    expect(resultText).toBe('Pairs that sum to 5: (1, 4), (1, 4)');

    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case: negative numbers and zeros', async ({ page }) => {
    // Verify that negative numbers and zeros are handled by the two pointers approach as implemented.
    // Example: array "-2,0,2,3" target 0 should yield (-2, 2)
    const app = new TwoPointersPage(page);

    await app.clearInputs();
    await app.fillArray('-2,0,2,3');
    await app.fillTarget('0');

    await app.clickFind();

    const resultText = await app.getResultText();
    expect(resultText).toBe('Pairs that sum to 0: (-2, 2)');

    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition re-entrancy: consecutive searches update results appropriately', async ({ page }) => {
    // This test validates that repeated interactions (multiple clicks with different inputs)
    // transition between S1 and S2/S3 properly and produce the correct output each time.
    const app = new TwoPointersPage(page);

    // First valid search
    await app.clearInputs();
    await app.fillArray('1,2,3,4');
    await app.fillTarget('6');
    await app.clickFind();
    expect(await app.getResultText()).toBe('Pairs that sum to 6: (2, 4)');

    // Next search with no pairs
    await app.fillArray('1,2,3');
    await app.fillTarget('7');
    await app.clickFind();
    expect(await app.getResultText()).toBe('No pairs found that sum to 7.');

    // Finally invalid input
    await app.fillArray('');
    await app.fillTarget('');
    await app.clickFind();
    expect(await app.getResultText()).toBe('Please enter a valid array and target sum.');

    // Throughout these transitions, assert no uncaught exceptions occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });
});