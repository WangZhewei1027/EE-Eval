import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b03cd1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Simple page object for the Set demonstration page
class SetDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBasic = page.locator('#run-basic');
    this.runIterate = page.locator('#run-iterate');
    this.runUnique = page.locator('#run-unique');

    this.outputBasic = page.locator('#output-basic');
    this.outputIterate = page.locator('#output-iterate');
    this.outputUnique = page.locator('#output-unique');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickBasic() {
    await this.runBasic.click();
  }
  async clickIterate() {
    await this.runIterate.click();
  }
  async clickUnique() {
    await this.runUnique.click();
  }

  async getBasicText() {
    return (await this.outputBasic.textContent()) ?? '';
  }
  async getIterateText() {
    return (await this.outputIterate.textContent()) ?? '';
  }
  async getUniqueText() {
    return (await this.outputUnique.textContent()) ?? '';
  }

  // Utility to count occurrences of substring in output text
  static countOccurrences(text, sub) {
    if (!text) return 0;
    return (text.match(new RegExp(sub.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }
}

test.describe('JavaScript Set Demonstration - FSM states and transitions', () => {
  // Arrays to record console errors and page errors
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions later
    page.on('console', msg => {
      // Record only error-level console messages to consoleErrors
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
      // We still keep other console messages available in the test by printing them to test output if needed
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    const demo = new SetDemoPage(page);
    await demo.goto();
    // Ensure initial load - the page should render the three buttons and outputs
    await expect(demo.runBasic).toBeVisible();
    await expect(demo.runIterate).toBeVisible();
    await expect(demo.runUnique).toBeVisible();

    // Ensure output areas are present
    await expect(demo.outputBasic).toBeVisible();
    await expect(demo.outputIterate).toBeVisible();
    await expect(demo.outputUnique).toBeVisible();
  });

  test('Initial Idle state: page renders expected components and empty outputs', async ({ page }) => {
    const demo = new SetDemoPage(page);

    // Validate that the buttons have correct labels and are available
    await expect(demo.runBasic).toHaveText('Run Basic Example');
    await expect(demo.runIterate).toHaveText('Run Iteration Example');
    await expect(demo.runUnique).toHaveText('Run Remove Duplicates');

    // Validate outputs are initially empty (Idle state's evidence)
    expect(await demo.getBasicText()).toBe('');
    expect(await demo.getIterateText()).toBe('');
    expect(await demo.getUniqueText()).toBe('');

    // No uncaught page errors should be present on initial load
    expect(pageErrors.length).toBe(0);
    // No console.error messages should have been emitted during load
    expect(consoleErrors.length).toBe(0);
  });

  test('Run Basic Example transition: clicking #run-basic runs exampleBasic and updates output-basic', async ({ page }) => {
    const demo = new SetDemoPage(page);

    // Click the "Run Basic Example" button to trigger the transition S0_Idle -> S1_BasicExampleRunning
    await demo.clickBasic();

    // Wait for output to be populated (runAndCapture writes multiple lines)
    await page.waitForTimeout(50); // small wait to allow synchronous run to complete

    const text = await demo.getBasicText();

    // Validate expected lines appear in the output:
    // - Size: 4 (Set with 4 unique values after adding duplicates)
    // - Has 5? true (presence check)
    // - Values: (array display includes 'hello' and an object JSON)
    expect(text).toContain('Size: 4');
    expect(text).toContain('Has 5? true');
    expect(text).toContain('Values:');
    // Ensure a value from the set ('hello') is present in the output
    expect(text).toContain('hello');

    // No uncaught page errors should have been triggered by clicking this button
    expect(pageErrors.length).toBe(0);
    // Ensure no console.error messages were emitted (runAndCapture intercepts console.log)
    expect(consoleErrors.length).toBe(0);
  });

  test('Run Iteration Example transition: clicking #run-iterate runs exampleIterate and logs values', async ({ page }) => {
    const demo = new SetDemoPage(page);

    // Click the "Run Iteration Example" button to trigger the transition S0_Idle -> S2_IterationExampleRunning
    await demo.clickIterate();

    // Wait briefly for synchronous function to complete and output to show
    await page.waitForTimeout(50);

    const text = await demo.getIterateText();

    // Validate evidence of iteration:
    // - The "Using for...of:" and "Using forEach:" markers should be present
    // - Numeric values 10 and 40 (first and last) should be present
    expect(text).toContain('Using for...of:');
    expect(text).toContain('Using forEach:');
    expect(text).toContain('10');
    expect(text).toContain('40');

    // No uncaught page errors or console.error messages should be present
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Run Remove Duplicates transition: clicking #run-unique runs exampleUnique and displays unique array', async ({ page }) => {
    const demo = new SetDemoPage(page);

    // Click the "Run Remove Duplicates" button to trigger S0_Idle -> S3_RemoveDuplicatesRunning
    await demo.clickUnique();

    // Allow synchronous logging to complete
    await page.waitForTimeout(50);

    const text = await demo.getUniqueText();

    // The output should contain a JSON-ish array with unique values [1,2,3,4,5]
    expect(text).toContain('1');
    expect(text).toContain('5');
    // Ensure there is at least one bracket indicating array output
    expect(text).toMatch(/\[.*\]/s);

    // No uncaught page errors or console.error messages should be present
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Idempotence/Repeat runs: clicking the run button multiple times resets the output and does not accumulate previous runs', async ({ page }) => {
    const demo = new SetDemoPage(page);

    // Click basic example twice in succession
    await demo.clickBasic();
    await page.waitForTimeout(20);
    await demo.clickBasic();
    await page.waitForTimeout(50);

    const text = await demo.getBasicText();

    // runAndCapture clears output before each run, so the marker 'Size:' should appear exactly once
    const occurrences = SetDemoPage.countOccurrences(text, 'Size:');
    expect(occurrences).toBe(1);

    // Confirm expected content still present
    expect(text).toContain('Has 5? true');

    // No page errors or console.error messages emitted during repeated runs
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: runAndCapture captures errors from thrown functions and writes to the output', async ({ page }) => {
    const demo = new SetDemoPage(page);

    // Use runAndCapture from the page to execute a function that throws a TypeError.
    // We intentionally exercise the error-catching path inside runAndCapture.
    await page.evaluate(() => {
      // The page defines runAndCapture; call it with a function that throws.
      // This should not throw out to the page environment because runAndCapture catches.
      // We target the output-basic element so that test can read the result.
      runAndCapture(() => {
        // Throw a deliberate TypeError to validate error handling and output formatting
        throw new TypeError('Intentional error for test');
      }, document.getElementById('output-basic'));
    });

    // Allow update to propagate
    await page.waitForTimeout(20);

    const text = await demo.getBasicText();

    // The runAndCapture catch block appends: 'Error: ' + e.message
    expect(text).toContain('Error: Intentional error for test');

    // No uncaught page errors should have been raised (the error was caught and handled)
    expect(pageErrors.length).toBe(0);

    // There should be no console.error messages emitted by this flow because the error is handled internally
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: monitor console and page errors across interactions', async ({ page }) => {
    const demo = new SetDemoPage(page);

    // Interact with all three buttons to ensure full coverage while monitoring errors
    await demo.clickBasic();
    await page.waitForTimeout(20);
    await demo.clickIterate();
    await page.waitForTimeout(20);
    await demo.clickUnique();
    await page.waitForTimeout(20);

    // Collect final outputs to make sure they were updated
    const basicText = await demo.getBasicText();
    const iterateText = await demo.getIterateText();
    const uniqueText = await demo.getUniqueText();

    // All outputs should be non-empty after runs
    expect(basicText.length).toBeGreaterThan(0);
    expect(iterateText.length).toBeGreaterThan(0);
    expect(uniqueText.length).toBeGreaterThan(0);

    // Assert there were no page-level uncaught exceptions or console.error messages during these interactions
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });
});