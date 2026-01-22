import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b3c561-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the Binary Search Demo page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchBtn = page.locator('#searchBtn');
    this.output = page.locator('#output');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setArray(value) {
    await this.arrayInput.fill('');
    if (value !== null) {
      await this.arrayInput.fill(value);
    }
  }

  async setTarget(value) {
    await this.targetInput.fill('');
    if (value !== null) {
      await this.targetInput.fill(value);
    }
  }

  async clickSearch() {
    await this.searchBtn.click();
  }

  async getOutputText() {
    // Use innerText to get the rendered text including newlines
    return await this.output.innerText();
  }

  async waitForOutputToContain(text, timeout = 2000) {
    await expect(this.output).toContainText(text, { timeout });
  }
}

test.describe('Binary Search Demo - FSM and UI verification', () => {
  // Collect page errors and console messages per test to assert on them.
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      // store the error object for assertions later
      pageErrors.push(err);
    });

    // Capture all console messages (info, error, warn, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ text: msg.text(), type: msg.type() });
    });
  });

  // Test the initial Idle state: the page should render the header and inputs.
  test('Initial state (S0_Idle): page renders header and inputs', async ({ page }) => {
    const app = new BinarySearchPage(page);
    // Navigate to the app
    await app.goto();

    // Validate the heading exists as evidence of the Idle state rendering
    await expect(app.header).toHaveText('Binary Search Demonstration');

    // Validate presence of input controls and output area
    await expect(app.arrayInput).toBeVisible();
    await expect(app.targetInput).toBeVisible();
    await expect(app.searchBtn).toBeVisible();
    await expect(app.output).toBeVisible();

    // There should be no uncaught page errors on initial load
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);

    // Console should not have error-level messages on load (we allow other console messages, but check no 'error' types)
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length, `Console contained error messages: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  // Transition tests for various input error scenarios (S1_InputError)
  test.describe('Input validation error transitions (S1_InputError)', () => {
    test('Missing array input -> shows "Please enter a sorted array."', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Provide a valid target but leave array empty
      await app.setArray('');
      await app.setTarget('7');

      // Click search and assert the array-missing error message appears
      await app.clickSearch();
      await expect(app.output).toHaveText('Please enter a sorted array.');

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });

    test('Missing target input -> shows "Please enter the target value."', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Provide a valid array but leave target empty
      await app.setArray('1,3,5');
      await app.setTarget('');

      // Click search and assert the target-missing error message appears
      await app.clickSearch();
      await expect(app.output).toHaveText('Please enter the target value.');

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });

    test('Array contains invalid numbers -> shows numeric-array error', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Provide an array that includes an invalid number token
      await app.setArray('1, 2, notanumber, 4');
      await app.setTarget('2');

      await app.clickSearch();
      await expect(app.output).toHaveText('Array contains invalid numbers. Please enter a valid numeric array.');

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });

    test('Array not sorted ascendingly -> shows sorted-array error', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Provide an unsorted array
      await app.setArray('5, 3, 4, 1');
      await app.setTarget('3');

      await app.clickSearch();
      await expect(app.output).toHaveText('Array is not sorted ascendingly. Please enter a sorted array.');

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });

    test('Target not a valid number -> shows target-number error', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Provide a valid sorted array but an invalid target
      await app.setArray('1,2,3,4,5');
      await app.setTarget('notnum');

      await app.clickSearch();
      await expect(app.output).toHaveText('Target value is not a valid number.');

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });
  });

  // Tests for processing state and final outcomes (S2 -> S3 or S4)
  test.describe('Binary search processing and results (S2_BinarySearchInProgress -> S3/S4)', () => {
    test('Binary search in progress and target found (S3_TargetFound)', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Provide a sorted array where the target exists
      await app.setArray('1,3,5,7,9');
      await app.setTarget('7');

      // Click search to trigger binary search
      await app.clickSearch();

      // The output should start with the "Starting binary search" message (S2 evidence)
      await app.waitForOutputToContain('Starting binary search for target: 7');

      // Eventually the "Target found" message should appear (S3 evidence)
      await app.waitForOutputToContain('Target found at index 3');

      // Also verify total steps message is present
      await app.waitForOutputToContain('Total steps');

      // Read final output and perform additional assertions on content structure
      const finalOutput = await app.getOutputText();
      expect(finalOutput).toContain('Starting binary search for target: 7');
      expect(finalOutput).toMatch(/Target found at index\s*3/);
      expect(finalOutput).toMatch(/Total steps:\s*\d+/);

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });

    test('Binary search in progress and target not found (S4_TargetNotFound)', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Provide a sorted array where the target does NOT exist
      await app.setArray('1,2,3,4,5');
      await app.setTarget('7');

      // Click search to start binary search
      await app.clickSearch();

      // S2 evidence: starting message should be present
      await app.waitForOutputToContain('Starting binary search for target: 7');

      // S4 evidence: target not found message should appear
      await app.waitForOutputToContain('Target not found in array.');

      // Also verify total steps message is present
      await app.waitForOutputToContain('Total steps');

      const finalOutput = await app.getOutputText();
      expect(finalOutput).toContain('Starting binary search for target: 7');
      expect(finalOutput).toMatch(/Target not found in array\./);
      expect(finalOutput).toMatch(/Total steps:\s*\d+/);

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });
  });

  // Additional edge-case tests and sanity checks
  test.describe('Edge cases and integration checks', () => {
    test('Handles extra spaces and empty tokens in array input gracefully', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Array input contains extra commas and spaces; should be parsed correctly
      await app.setArray(' 1,  , 3 ,   5 , ');
      await app.setTarget('3');

      await app.clickSearch();

      // Should start searching and find the target 3
      await app.waitForOutputToContain('Starting binary search for target: 3');
      await app.waitForOutputToContain('Target found at index');

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });

    test('No unexpected console error messages produced during interactions', async ({ page }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Do a valid run that produces a few console messages or DOM updates
      await app.setArray('2,4,6,8,10');
      await app.setTarget('6');
      await app.clickSearch();
      await app.waitForOutputToContain('Target found at index');

      // Inspect collected console messages for 'error' type
      const errorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorMsgs.length, `Unexpected console.error messages: ${JSON.stringify(errorMsgs)}`).toBe(0);

      // Ensure no uncaught runtime page errors occurred
      expect(pageErrors.length, `Page errors occurred: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    });
  });
});