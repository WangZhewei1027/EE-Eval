import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00d102-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Binary Search Visualization page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.searchValue = page.locator('#searchValue');
    this.searchBtn = page.locator('#searchBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.autoBtn = page.locator('#autoBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.log = page.locator('#log');
    this.arrayElements = page.locator('#arrayContainer .array-element');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  // Reads the displayed array values (strings -> trimmed)
  async getArrayValues() {
    const count = await this.arrayElements.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const txt = await this.arrayElements.nth(i).innerText();
      values.push(txt.trim());
    }
    return values;
  }

  // Click helpers
  async clickSearch() {
    await this.searchBtn.click();
  }
  async clickReset() {
    await this.resetBtn.click();
  }
  async clickStep() {
    await this.stepBtn.click();
  }
  async clickAuto() {
    await this.autoBtn.click();
  }

  // Enter target and start search via button
  async startSearchWithValue(value) {
    await this.searchValue.fill(String(value));
    await this.clickSearch();
  }

  // Start search using Enter key in the input
  async startSearchWithEnter(value) {
    await this.searchValue.fill(String(value));
    await this.searchValue.press('Enter');
  }

  // Return current log text content
  async getLogText() {
    return (await this.log.innerText()).trim();
  }

  // Return array element classes at index
  async getElementClasses(index) {
    return (await this.arrayElements.nth(index).getAttribute('class')) || '';
  }

  // Return whether buttons are disabled
  async isButtonDisabled(buttonLocator) {
    return await buttonLocator.isDisabled();
  }

  // Helper to wait until isSearching becomes false by observing stepBtn disabled state
  async waitForSearchToComplete(timeout = 5000) {
    await this.page.waitForFunction(() => {
      const stepBtn = document.getElementById('stepBtn');
      return stepBtn && stepBtn.disabled === true;
    }, { timeout });
  }
}

test.describe('Binary Search Visualization - FSM behavior and UI interactions', () => {
  // Arrays to capture console messages and page errors
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console events
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) and record their messages; accept them so tests continue
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });
  });

  test.describe('Initial State (S0_Idle) and Reset behavior', () => {
    test('Initial UI shows Idle state: array initialized, controls reset and log message present', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      // Verify array initialized with 20 elements
      const values = await bs.getArrayValues();
      expect(values.length).toBe(20);

      // Verify input empty and enabled
      expect(await bs.searchValue.inputValue()).toBe('');

      // Buttons: search enabled, step and auto disabled as per resetSearch
      expect(await bs.isButtonDisabled(bs.searchBtn)).toBe(false);
      expect(await bs.isButtonDisabled(bs.stepBtn)).toBe(true);
      expect(await bs.isButtonDisabled(bs.autoBtn)).toBe(true);

      // Log should contain the reset message
      const logText = await bs.getLogText();
      expect(logText).toContain('Search reset. Ready for new search.');

      // No runtime page errors or console error messages should have occurred during init
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Reset button clears search state and UI, including stopping auto search interval if present', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      // Choose a value from the array (pick index 9)
      const arrVals = await bs.getArrayValues();
      const chosen = arrVals[9];
      // Start search and then immediately click reset to test transition S1 -> S0 via ResetClick
      await bs.searchValue.fill(chosen);
      await bs.clickSearch();

      // Immediately click reset
      await bs.clickReset();

      // After reset, search input should be enabled and empty
      expect(await bs.searchValue.inputValue()).toBe('');

      // Step and auto should be disabled after reset
      expect(await bs.isButtonDisabled(bs.stepBtn)).toBe(true);
      expect(await bs.isButtonDisabled(bs.autoBtn)).toBe(true);

      const logText = await bs.getLogText();
      expect(logText).toContain('Search reset. Ready for new search.');

      // No unexpected page errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Search interactions and transitions', () => {
    test('Clicking Search transitions to Searching (S1) and triggers an immediate step, can find the mid element (S2 Found)', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      // Read array values and pick the deterministic mid index value (index 9 for size 20)
      const values = await bs.getArrayValues();
      const midIndex = 9;
      const targetValue = values[midIndex];

      // Start search
      await bs.startSearchWithValue(targetValue);

      // After starting, input should be disabled and buttons updated
      expect(await bs.isButtonDisabled(bs.searchValue)).toBeTruthy(); // input disabled
      expect(await bs.isButtonDisabled(bs.searchBtn)).toBeTruthy(); // search disabled
      expect(await bs.isButtonDisabled(bs.stepBtn)).toBeTruthy(); // if found, step should be disabled
      expect(await bs.isButtonDisabled(bs.autoBtn)).toBeTruthy(); // if found, auto should be disabled

      // Log should contain starting message and a Found message
      const log = await bs.getLogText();
      expect(log).toContain(`Starting binary search for value: ${targetValue}`);
      // The found message uses strong tags in innerHTML; text content will include "Found target <value> at index <mid>!"
      expect(log).toMatch(new RegExp(`Found target\\s+${targetValue}\\s+at index\\s+${midIndex}`));

      // The mid element should have the 'found' class applied when found
      const classes = await bs.getElementClasses(midIndex);
      expect(classes).toMatch(/found|mid/);

      // Ensure no uncaught page errors occurred during search
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Performing a Step when searching updates mid and logs calculation, demonstrating S1 -> S1 transition', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      // Choose a value that is not the initial mid to force at least one non-terminal step.
      // We'll select index 5 to probably not equal initial mid of 9.
      const values = await bs.getArrayValues();
      const target = values[5];
      await bs.startSearchWithValue(target);

      // If it was found immediately (rare if target equals index9), test still validates logs.
      // Wait briefly to allow logs to be appended
      await page.waitForTimeout(200);

      // Log should show mid calculation at least once
      const logText = await bs.getLogText();
      expect(logText).toMatch(/Calculating mid: \(\d+ \+ \d+\) \/ 2 = \d+/);

      // If still searching, step button should be enabled; otherwise disabled when search finished
      // We assert that the application logged comparisons
      expect(logText).toMatch(new RegExp(`Comparing target ${target} with array\\[\\d+\\] = \\d+`));

      // No runtime page errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Starting search via Enter key triggers same behavior as clicking Search (EnterPress event)', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      const values = await bs.getArrayValues();
      const midIndex = 9;
      const targetValue = values[midIndex];

      // Use Enter key to start search (tests EnterPress event)
      await bs.startSearchWithEnter(targetValue);

      // Verify the Starting log message is present
      const logText = await bs.getLogText();
      expect(logText).toContain(`Starting binary search for value: ${targetValue}`);

      // Ensure search input was disabled
      expect(await bs.isButtonDisabled(bs.searchValue)).toBeTruthy();

      // No runtime page errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Step when not searching does nothing and does not produce errors (edge case)', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      // Ensure stepBtn is disabled in Idle; clicking disabled button should have no effect
      expect(await bs.isButtonDisabled(bs.stepBtn)).toBe(true);

      // Force a click on the disabled button via JS to emulate errant input is not allowed:
      // We do not execute page functions to modify behavior; instead attempt a user click (it will be ignored)
      await bs.clickStep();

      // Confirm logs unchanged except initial reset message
      const logText = await bs.getLogText();
      expect(logText).toContain('Search reset. Ready for new search.');

      // No runtime errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Auto Search behavior and toggling', () => {
    test('Auto Search toggles on, disables Step while running, then toggles off', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      const values = await bs.getArrayValues();
      // Pick a value likely to not be immediate mid to observe multiple steps; choose index 2
      const target = values[2];

      // Start search
      await bs.startSearchWithValue(target);

      // Start auto search
      await bs.clickAuto();

      // After starting auto, the auto button text should change to 'Stop Auto'
      await page.waitForTimeout(200); // allow text to update
      const autoText = await bs.autoBtn.innerText();
      expect(autoText).toMatch(/Stop Auto/i);

      // Step button should be disabled while auto is running
      expect(await bs.isButtonDisabled(bs.stepBtn)).toBe(true);

      // Wait up to 6s for search to finish (auto runs steps every 1s)
      await bs.waitForSearchToComplete(7000);

      // After completion, auto button text should revert to 'Auto Search' (or the interval cleared)
      const autoTextAfter = await bs.autoBtn.innerText();
      expect(autoTextAfter).toMatch(/Auto Search/i);

      // Log should contain either a Found or Not Found terminal message
      const logText = await bs.getLogText();
      const foundMatch = /Found target\s+\d+\s+at index\s+\d+/i.test(logText);
      const notFoundMatch = /Target\s+\d+\s+not found in the array/i.test(logText) || /not found/i.test(logText);
      expect(foundMatch || notFoundMatch).toBeTruthy();

      // No runtime page errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios (alerts and invalid input)', () => {
    test('Starting search with empty input triggers alert asking for valid number', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      // Ensure input empty
      await bs.searchValue.fill('');
      await bs.clickSearch();

      // dialogMessages should have captured the alert text
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[0]).toBe('Please enter a valid number');

      // No runtime page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Starting search with out-of-range input triggers out-of-range alert', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      // Read array bounds
      const values = await bs.getArrayValues();
      const minVal = Number(values[0]);
      const maxVal = Number(values[values.length - 1]);

      // Provide a value below min (out-of-range) - should trigger alert
      const below = minVal - 1;
      await bs.searchValue.fill(String(below));
      await bs.clickSearch();

      // Expect an alert about out of range
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogMessages[dialogMessages.length - 1];
      expect(lastDialog).toContain('Value is out of range');

      // Provide a value above max (out-of-range) - should trigger another alert
      await bs.searchValue.fill(String(maxVal + 1));
      await bs.clickSearch();

      expect(dialogMessages.length).toBeGreaterThanOrEqual(2);
      const lastDialog2 = dialogMessages[dialogMessages.length - 1];
      expect(lastDialog2).toContain('Value is out of range');

      // No runtime page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Runtime health: console and page errors observation', () => {
    test('No unexpected console errors or page exceptions during a variety of interactions', async ({ page }) => {
      const bs = new BinarySearchPage(page);
      await bs.goto();

      // Perform a sequence of interactions to exercise the app
      const values = await bs.getArrayValues();
      const targetA = values[1];
      const targetB = values[10];

      // Start search A
      await bs.startSearchWithValue(targetA);
      await page.waitForTimeout(200);

      // Reset
      await bs.clickReset();
      await page.waitForTimeout(200);

      // Start search B via Enter
      await bs.startSearchWithEnter(targetB);
      await page.waitForTimeout(200);

      // Toggle auto on and off
      await bs.clickAuto();
      await page.waitForTimeout(500);
      await bs.clickAuto();
      await page.waitForTimeout(200);

      // Final reset
      await bs.clickReset();

      // Inspect captured console errors and page errors
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // At end of each test, assert that no unhandled runtime errors were left uncaught
    // Note: any expected alerts/dialogs have been handled and recorded
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});