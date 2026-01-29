import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cea953-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Insertion Sort Demo page
class InsertionSortPage {
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.generateButton = page.locator("button[onclick='generateArray()']");
    this.startButton = page.locator("button[onclick='startInsertionSort()']");
    this.resetButton = page.locator("button[onclick='reset()']");
    this.speedInput = page.locator('#speed');
    this.arrayDisplay = page.locator('#arrayDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async setArrayInput(value) {
    await this.arrayInput.fill(value);
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async setSpeed(ms) {
    await this.speedInput.fill(String(ms));
  }

  async pressEnterInInput() {
    await this.arrayInput.press('Enter');
  }

  async getDisplayText() {
    return (await this.arrayDisplay.innerText()).trim();
  }
}

test.describe('Insertion Sort Interactive Demo - FSM validation (Application ID: 99cea953-fa79-11f0-8075-e54a10595dde)', () => {
  // Collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // store level and text for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page-level errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Initial page render shows Idle state controls and no page errors', async ({ page }) => {
      // Setup page object
      const p = new InsertionSortPage(page);
      // Navigate to the app page exactly as-is
      await p.goto();

      // Validate presence of UI elements described in FSM S0_Idle
      await expect(p.arrayInput).toBeVisible();
      await expect(p.generateButton).toBeVisible();
      await expect(p.startButton).toBeVisible();
      await expect(p.resetButton).toBeVisible();
      await expect(p.arrayDisplay).toBeVisible();
      await expect(p.speedInput).toBeVisible();

      // Validate initial display text per FSM evidence ("Array: ")
      const text = await p.getDisplayText();
      expect(text).toBe('Array: ');

      // Ensure no runtime page errors or console 'error' messages on initial load
      expect(pageErrors.length, 'expected no uncaught page errors on load').toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length, 'expected no console.error messages on load').toBe(0);
    });
  });

  test.describe('Transition S0_Idle -> S1_ArrayGenerated (Generate Array)', () => {
    test('Click Generate Array updates display to show parsed numbers', async ({ page }) => {
      const p = new InsertionSortPage(page);
      await p.goto();

      // Provide a comma-separated numeric input and generate the array
      await p.setArrayInput('5,2,9,1');
      await p.clickGenerate();

      // The implementation uses Number() and join(', '), so we expect spaces after commas
      await expect.poll(() => p.getDisplayText(), { timeout: 2000 }).toBe('Array: 5, 2, 9, 1');

      // No uncaught errors should have been thrown during generation
      expect(pageErrors.length, 'no page errors during generateArray').toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length, 'no console.error during generateArray').toBe(0);
    });

    test('Edge case: empty input leads to numeric conversion behavior', async ({ page }) => {
      const p = new InsertionSortPage(page);
      await p.goto();

      // Empty string: input.split(',') -> ['']; Number('') === 0, so array becomes [0]
      await p.setArrayInput('');
      await p.clickGenerate();

      await expect.poll(() => p.getDisplayText(), { timeout: 2000 }).toBe('Array: 0');

      // Again assert no uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: non-numeric input produces NaN entries in display', async ({ page }) => {
      const p = new InsertionSortPage(page);
      await p.goto();

      await p.setArrayInput('a,b');
      await p.clickGenerate();

      // Number('a') => NaN, join(', ') will display 'NaN, NaN'
      await expect.poll(() => p.getDisplayText(), { timeout: 2000 }).toBe('Array: NaN, NaN');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition S1_ArrayGenerated -> S2_Sorting (Start Insertion Sort)', () => {
    test('Start Insertion Sort begins stepwise updates including Key and j indicators', async ({ page }) => {
      const p = new InsertionSortPage(page);
      await p.goto();

      // Prepare array and speed to make sorting observable quickly
      await p.setArrayInput('4,3,2');
      await p.clickGenerate();
      await p.setSpeed(100); // faster interval to observe steps quicker

      // Start sorting
      await p.clickStart();

      // Wait for the sorter to display either "Key:" or "Key Inserted" which are evidence of sorting
      await page.waitForFunction(() => {
        const el = document.getElementById('arrayDisplay');
        if (!el) return false;
        const t = el.innerText || '';
        return t.includes('Key:') || t.includes('Key Inserted:');
      }, null, { timeout: 3000 });

      const displayText = await p.getDisplayText();
      expect(displayText.includes('Array:'), 'display contains Array prefix while sorting').toBeTruthy();
      // Expect at least one of the sorting markers
      expect(displayText.includes('Key:') || displayText.includes('Key Inserted:'), 'display includes Key or Key Inserted during sorting').toBeTruthy();

      // Ensure no uncaught exceptions thrown during sorting
      expect(pageErrors.length).toBe(0);
    });

    test('While sorting, pressing Enter in input triggers Generate Array (EnterKeyPress event)', async ({ page }) => {
      const p = new InsertionSortPage(page);
      await p.goto();

      // Generate an initial array and start sorting
      await p.setArrayInput('7,1,5');
      await p.clickGenerate();
      await p.setSpeed(100);
      await p.clickStart();

      // Ensure sorting has started (some key info displayed)
      await page.waitForFunction(() => {
        const el = document.getElementById('arrayDisplay');
        if (!el) return false;
        const t = el.innerText || '';
        return t.includes('Key:') || t.includes('Key Inserted:');
      }, null, { timeout: 3000 });

      // Now change the input to a different array and press Enter to trigger generateArray()
      await p.setArrayInput('10,20,30');
      await p.pressEnterInInput();

      // After pressing Enter, the display should reflect the newly generated array values
      await expect.poll(() => p.getDisplayText(), { timeout: 2000 }).toBe('Array: 10, 20, 30');

      // No uncaught exceptions must have been thrown by the Enter handler
      expect(pageErrors.length).toBe(0);
    });

    test('Reset during sorting stops updates and clears array (transition to S3_Reset)', async ({ page }) => {
      const p = new InsertionSortPage(page);
      await p.goto();

      // Start with array and sort
      await p.setArrayInput('3,2,1');
      await p.clickGenerate();
      await p.setSpeed(100);
      await p.clickStart();

      // Wait for sorting to show progress
      await page.waitForFunction(() => {
        const el = document.getElementById('arrayDisplay');
        return el && (el.innerText.includes('Key:') || el.innerText.includes('Key Inserted:'));
      }, null, { timeout: 3000 });

      // Click reset while sorting should clear interval and arrays
      await p.clickReset();

      // Immediately, UI should show cleared array and input emptied
      await expect.poll(async () => {
        const disp = await p.getDisplayText();
        const inputVal = await page.evaluate(() => document.getElementById('arrayInput').value);
        return disp === 'Array: ' && inputVal === '';
      }, { timeout: 2000 }).toBeTruthy();

      // Wait longer than the sorting interval to ensure no further updates occur after reset (verifies clearInterval(timer) exit action)
      await page.waitForTimeout(700);
      const finalDisplay = await p.getDisplayText();
      expect(finalDisplay).toBe('Array: ');

      // No uncaught exceptions should have been recorded during reset
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('General robustness and error observation', () => {
    test('No unexpected console.error or uncaught exceptions during a full interaction scenario', async ({ page }) => {
      const p = new InsertionSortPage(page);
      await p.goto();

      // Perform a sequence: generate, start, press enter, reset to exercise code paths
      await p.setArrayInput('9,8,7');
      await p.clickGenerate();
      await p.setSpeed(100);
      await p.clickStart();

      // Wait for a sorting step to confirm active sorting
      await page.waitForFunction(() => {
        const el = document.getElementById('arrayDisplay');
        return el && (el.innerText.includes('Key:') || el.innerText.includes('Key Inserted:'));
      }, null, { timeout: 3000 });

      // Press Enter to regenerate while sorting
      await p.setArrayInput('1,2,3');
      await p.pressEnterInInput();
      await expect.poll(() => p.getDisplayText(), { timeout: 2000 }).toBe('Array: 1, 2, 3');

      // Finally reset
      await p.clickReset();
      await expect.poll(() => p.getDisplayText(), { timeout: 2000 }).toBe('Array: ');
      await page.waitForTimeout(500); // give a bit of time to ensure intervals are cleared

      // Assert that the browser did not emit any uncaught page errors during this interaction
      expect(pageErrors.length, `expected zero uncaught page errors but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

      // Also assert there were no console.error messages (if any found, fail and dump them)
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length, `expected no console.error messages but found: ${errorConsoleMessages.map(e => e.text).join(' || ')}`).toBe(0);
    });
  });
});