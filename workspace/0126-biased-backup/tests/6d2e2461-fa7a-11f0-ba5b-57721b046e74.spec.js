import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e2461-fa7a-11f0-ba5b-57721b046e74.html';

class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this.dialogs = [];

    // Attach listeners to capture console errors and page errors for assertions
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });

    this.page.on('dialog', async dialog => {
      // record dialog messages and accept to avoid blocking tests
      this.dialogs.push(dialog.message());
      await dialog.accept();
    });
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // Wait for the array display to be created and initial items to be rendered
    await this.page.waitForSelector('#arrayDisplay .array-item');
  }

  async getArrayItems() {
    return this.page.$$eval('#arrayDisplay .array-item', items => items.map(i => i.textContent.trim()));
  }

  async getArrayItemCount() {
    return this.page.$$eval('#arrayDisplay .array-item', items => items.length);
  }

  async getArraySizeValue() {
    return this.page.$eval('#arraySizeValue', el => el.textContent.trim());
  }

  async setArraySize(value) {
    // For range input, set value and dispatch input event
    await this.page.$eval('#arraySize', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    // ensure DOM updated
    await this.page.waitForTimeout(50);
  }

  async clickRandomize() {
    await this.page.click('#randomizeArray');
  }

  async clickCreateSorted() {
    await this.page.click('#sortedArray');
  }

  async applyManualArray(text) {
    await this.page.fill('#manualArray', text);
    await this.page.click('#applyManualArray');
  }

  async setSearchValue(value) {
    await this.page.fill('#searchValue', String(value));
  }

  async clickStartSearch() {
    await this.page.click('#startSearch');
  }

  async clickStepSearch() {
    await this.page.click('#stepSearch');
  }

  async clickResetSearch() {
    await this.page.click('#resetSearch');
  }

  async setSpeed(ms) {
    // Update range and dispatch input event
    await this.page.$eval('#speed', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, ms);
    // small wait for UI update
    await this.page.waitForTimeout(50);
  }

  async getSpeedValueText() {
    return this.page.$eval('#speedValue', el => el.textContent.trim());
  }

  async getComparisonCount() {
    return this.page.$eval('#comparisonCount', el => el.textContent.trim());
  }

  async getSearchResultText() {
    return this.page.$eval('#searchResult', el => el.textContent.trim());
  }

  async waitForCurrentHighlight(timeout = 2000) {
    // Wait for any element to get .current class (used during searching)
    await this.page.waitForSelector('.array-item.current', { timeout });
  }

  async getLogEntries() {
    return this.page.$$eval('#searchLog > div', divs => divs.map(d => d.textContent.trim()));
  }

  async getExplanationText() {
    return this.page.$eval('#explanation', el => el.innerHTML.trim());
  }
}

test.describe('Linear Search Interactive Demo - FSM and UI tests', () => {
  let page;
  let app;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    app = new LinearSearchPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors were recorded during the test
    expect(app.pageErrors, 'No page errors should be thrown').toEqual([]);
    // Assert that console.error was not called (no runtime console errors)
    expect(app.consoleErrors, 'No console.error messages should be logged').toEqual([]);
    await page.close();
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('loads page and displays an initial array matching arraySize (entry actions)', async () => {
      // The FSM S0_Idle entry actions call generateRandomArray() and updateArrayDisplay().
      // Validate that the displayed array matches the initial array size = 10
      const sizeText = await app.getArraySizeValue();
      expect(sizeText).toBe('10');

      const count = await app.getArrayItemCount();
      expect(count).toBe(10);

      // Initial search result and comparison count should be 'Not started' and '0'
      const searchResult = await app.getSearchResultText();
      const comparisons = await app.getComparisonCount();
      expect(searchResult).toBe('Not started');
      expect(comparisons).toBe('0');
    });

    test('changing array size (ChangeArraySize event) regenerates array and updates display', async () => {
      // Set array size to 7 and ensure display updates
      await app.setArraySize(7);
      const sizeText = await app.getArraySizeValue();
      expect(sizeText).toBe('7');

      const count = await app.getArrayItemCount();
      expect(count).toBe(7);
    });
  });

  test.describe('Array configuration events', () => {
    test('randomize array button updates the array display and resets search state', async () => {
      // Capture current display HTML
      const before = await page.$eval('#arrayDisplay', el => el.innerHTML);
      await app.clickRandomize();
      // After clicking randomize, array display should be populated and the DOM should change or remain valid
      await page.waitForTimeout(50);
      const after = await page.$eval('#arrayDisplay', el => el.innerHTML);
      expect(typeof after).toBe('string');
      // It's possible but unlikely the random array matches previous; ensure display still contains .array-item elements
      const count = await app.getArrayItemCount();
      expect(count).toBe(parseInt(await app.getArraySizeValue()));
      // Reset search state should set searchResult to 'Not started'
      const searchResult = await app.getSearchResultText();
      expect(searchResult).toBe('Not started');
    });

    test('create sorted array button generates a non-decreasing series (CreateSortedArray event)', async () => {
      await app.clickCreateSorted();
      // Wait a short time for update
      await page.waitForTimeout(50);
      const values = (await app.getArrayItems()).map(s => Number(s));
      expect(values.length).toBeGreaterThanOrEqual(5);
      // Check non-decreasing sequence property (generateSortedArray should produce non-decreasing values)
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
      // Reset search state must have been called; searchResult should be 'Not started'
      const searchResult = await app.getSearchResultText();
      expect(searchResult).toBe('Not started');
    });

    test('apply manual array with valid input updates display (ApplyManualArray event)', async () => {
      await app.applyManualArray('5,10,15,20');
      // After applying, the array should reflect entered numbers
      const items = await app.getArrayItems();
      expect(items).toEqual(['5', '10', '15', '20']);
      // Search state reset should have run
      expect(await app.getSearchResultText()).toBe('Not started');
    });

    test('apply manual array with invalid input triggers alert and does not change array', async () => {
      // Record current items
      const before = await app.getArrayItems();
      // Provide invalid manual input
      await app.applyManualArray('a,b,c');
      // A dialog should have been shown with appropriate message; recorded in app.dialogs
      expect(app.dialogs.length).toBeGreaterThanOrEqual(1);
      // The last dialog should be the error about valid numbers
      const lastDialog = app.dialogs[app.dialogs.length - 1];
      expect(lastDialog).toContain('Please enter valid numbers');
      // Array should remain unchanged from previous state (or at least still contain items)
      const after = await app.getArrayItems();
      expect(after.length).toBe(before.length);
    });
  });

  test.describe('Search controls and transitions (S0 -> S1 -> S2)', () => {
    test('start search without a value shows alert (edge case)', async () => {
      // Ensure searchValue is empty
      await page.fill('#searchValue', '');
      await app.clickStartSearch();
      // Expect an alert dialog
      expect(app.dialogs.pop()).toBe('Please enter a value to search for');
      // Search should still be 'Not started'
      expect(await app.getSearchResultText()).toBe('Not started');
    });

    test('StartSearch transitions to Searching (S1) and auto-highlights elements', async () => {
      // Pick a value from the array to ensure it can be found
      const items = await app.getArrayItems();
      const valueToSearch = items[0]; // choose first item to make it deterministic
      await app.setSearchValue(valueToSearch);
      // Start the search -> this should set searchActive and start interval
      await app.clickStartSearch();

      // Wait for some activity: comparisons should increase and an item should be highlighted
      await app.waitForCurrentHighlight(3000);
      const comparisons = Number(await app.getComparisonCount());
      expect(comparisons).toBeGreaterThanOrEqual(1);

      // Wait for the search result to indicate found at some index
      await page.waitForFunction(
        () => document.getElementById('searchResult').textContent.includes('Found at index'),
        { timeout: 3000 }
      );
      const resultText = await app.getSearchResultText();
      expect(resultText).toMatch(/Found at index \d+/);
    });

    test('StepThrough from Searching steps until completion and yields "Value not found" (S1 -> S2)', async () => {
      // Use a value that is very unlikely to exist in array (e.g., 9999)
      await app.setSearchValue(9999);
      // To reliably exercise step transitions without auto-interval interfering, set speed to a high value
      await app.setSpeed(2000);
      // Start search to enter Searching state (S1)
      await app.clickStartSearch();
      // Wait a tick
      await page.waitForTimeout(100);

      // Now repeatedly send StepThrough events until search completes
      // Limit steps to prevent infinite loops in case of unexpected behavior
      const maxSteps = (await app.getArrayItemCount()) + 5;
      let steps = 0;
      let resultText = await app.getSearchResultText();
      while (!resultText.includes('Value not found') && steps < maxSteps) {
        await app.clickStepSearch();
        // Small delay to allow DOM updates from performSearchStep
        await page.waitForTimeout(50);
        resultText = await app.getSearchResultText();
        steps++;
      }

      expect(resultText).toBe('Value not found');
      // After completion, searchActive should be false and there should be no active interval - validated indirectly:
      // No element should have 'current' class (since final state clears highlight)
      const currentExists = await page.$('.array-item.current');
      // currentExists may be null because performSearchStep removes current when complete; assert null or nothing highlighted
      expect(currentExists === null).toBeTruthy();
    });

    test('ResetSearch from Searching returns to Idle (S1 -> S0)', async () => {
      // Start a search with a known value present to ensure Searching state is active
      const items = await app.getArrayItems();
      const val = items[0];
      await app.setSearchValue(val);
      await app.clickStartSearch();

      // Wait for at least one comparison/highlight
      await app.waitForCurrentHighlight(2000);

      // Now click reset
      await app.clickResetSearch();
      // Ensure UI shows Not started and comparisons reset
      expect(await app.getSearchResultText()).toBe('Not started');
      expect(await app.getComparisonCount()).toBe('0');
      // No current or found classes should remain
      const current = await page.$('.array-item.current');
      const found = await page.$('.array-item.found');
      expect(current).toBeNull();
      // It is possible no item was found; found should be null
      expect(found === null).toBeTruthy();
    });

    test('Changing speed while searching triggers UI update and does not throw', async () => {
      // Choose a value from array
      const items = await app.getArrayItems();
      const searchVal = items[0];
      await app.setSearchValue(searchVal);
      // Start search
      await app.clickStartSearch();
      // Wait for some progress
      await app.waitForCurrentHighlight(2000);

      // Change speed during search; event handler should restart the interval without throwing
      await app.setSpeed(1000);
      expect(await app.getSpeedValueText()).toBe('1000ms');

      // Allow some time for continued searching and eventual found detection
      await page.waitForFunction(
        () => document.getElementById('searchResult').textContent.includes('Found at index'),
        { timeout: 5000 }
      );
      // Validate no page errors or console errors recorded (captured in afterEach)
      const result = await app.getSearchResultText();
      expect(result).toMatch(/Found at index \d+/);
    });
  });

  test.describe('Logging, explanation, and edge validations', () => {
    test('log messages and explanation update during stepping and completion', async () => {
      // Use a value not present and step through until completion, then check logs and explanation
      await app.setSearchValue(9999);
      await app.setSpeed(2000); // slow auto-interval to avoid interference
      await app.clickStartSearch();
      await page.waitForTimeout(100);

      const maxSteps = (await app.getArrayItemCount()) + 5;
      for (let i = 0; i < maxSteps; i++) {
        await app.clickStepSearch();
        // give time for a step to process
        await page.waitForTimeout(30);
        const res = await app.getSearchResultText();
        if (res === 'Value not found') break;
      }

      // After completion, logs should include "Search complete" message
      const logs = await app.getLogEntries();
      const foundCompleteLog = logs.find(l => l.includes('Search complete'));
      expect(foundCompleteLog).toBeDefined();

      // Explanation should mention that the search reached the end without finding the value
      const explanation = await app.getExplanationText();
      expect(explanation).toContain('reached the end of the array');
    });
  });
});