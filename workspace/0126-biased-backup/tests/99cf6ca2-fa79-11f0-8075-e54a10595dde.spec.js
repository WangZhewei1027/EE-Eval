import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf6ca2-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions with the Branch and Bound example page
class BranchAndBoundPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for the main heading to confirm page load
    await this.page.waitForSelector('h1:has-text("Branch and Bound Example")');
  }

  async setItemsNumber(value) {
    await this.page.fill('#items', String(value));
  }

  async setCapacity(value) {
    await this.page.fill('#capacity', String(value));
  }

  async clickGenerateItems() {
    await this.page.click("button[onclick='generateItems()']");
  }

  async clickStartBranchAndBound() {
    await this.page.click("button[onclick='startBranchAndBound()']");
  }

  async getItemListCount() {
    return await this.page.$$eval('#itemList li', els => els.length);
  }

  async getItemListTexts() {
    return await this.page.$$eval('#itemList li', els => els.map(e => e.textContent.trim()));
  }

  async getResultsInnerHTML() {
    return await this.page.$eval('#results', el => el.innerHTML.trim());
  }

  async getItemsValue() {
    return await this.page.$eval('#items', el => el.value);
  }

  async getCapacityValue() {
    return await this.page.$eval('#capacity', el => el.value);
  }

  // Access internal JS state objects on the page (items, weights, values)
  async getWindowItemsLength() {
    return await this.page.evaluate(() => (window.items ? items.length : 0));
  }

  async getWindowWeightsLength() {
    return await this.page.evaluate(() => (window.weights ? weights.length : 0));
  }

  async getWindowValuesLength() {
    return await this.page.evaluate(() => (window.values ? values.length : 0));
  }

  async callBranchAndBound(capacity) {
    return await this.page.evaluate((c) => {
      // ensure capacity is a number
      return branchAndBound(Number(c));
    }, capacity);
  }

  async hasGlobalFunction(name) {
    return await this.page.evaluate((n) => typeof window[n] === 'function', name);
  }
}

// Group tests for the Branch and Bound interactive example
test.describe('Branch and Bound Interactive Example - FSM and UI tests', () => {
  // We'll collect console messages and page errors in each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test the initial S0_Idle state (initial render)
  test('S0_Idle: initial render shows heading, description, inputs and no results/items', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Validate presence of static content per FSM evidence
    await expect(page.locator('h1')).toHaveText('Branch and Bound Example');
    await expect(page.locator('p')).toContainText('Use the controls below to explore the Branch and Bound algorithm for solving optimization problems.');

    // Verify input defaults and presence
    const itemsValue = await app.getItemsValue();
    expect(itemsValue).toBe('5'); // per HTML default

    const capacityValue = await app.getCapacityValue();
    expect(capacityValue).toBe('15'); // per HTML default

    // Initially, item list should be empty and results should be empty
    const initialItemCount = await app.getItemListCount();
    expect(initialItemCount).toBe(0);

    const resultsHTML = await app.getResultsInnerHTML();
    expect(resultsHTML).toBe(''); // no results yet

    // The FSM mentioned an entry action renderPage(); verify it's not defined in the actual implementation
    const hasRenderPage = await app.hasGlobalFunction('renderPage');
    expect(hasRenderPage).toBe(false);

    // Confirm the expected interactive functions are available
    expect(await app.hasGlobalFunction('generateItems')).toBe(true);
    expect(await app.hasGlobalFunction('startBranchAndBound')).toBe(true);
    expect(await app.hasGlobalFunction('branchAndBound')).toBe(true);
    expect(await app.hasGlobalFunction('displayItems')).toBe(true);
    expect(await app.hasGlobalFunction('displayResults')).toBe(true);

    // There should be no uncaught errors or console errors on fresh load
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Test the GenerateItems event and the transition to S1_ItemsGenerated
  test('GenerateItems event: generates correct number of items and populates item list (S0 -> S1)', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Set a specific number of items to test reproducibly
    await app.setItemsNumber(4);
    expect(await app.getItemsValue()).toBe('4');

    // Trigger generation
    await app.clickGenerateItems();

    // After generating, item list should be populated with the expected count
    const itemCount = await app.getItemListCount();
    expect(itemCount).toBe(4);

    // Each li should include weight and value information
    const texts = await app.getItemListTexts();
    for (const t of texts) {
      expect(t).toMatch(/Item \d+: Weight - \d+, Value - \d+/);
    }

    // Verify internal JS state was updated (items, weights, values arrays exist and are consistent)
    const itemsLen = await app.getWindowItemsLength();
    const weightsLen = await app.getWindowWeightsLength();
    const valuesLen = await app.getWindowValuesLength();
    expect(itemsLen).toBe(4);
    expect(weightsLen).toBeGreaterThanOrEqual(4); // since weights array is appended continuously by implementation
    expect(valuesLen).toBeGreaterThanOrEqual(4);

    // No uncaught page errors or console errors should have occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Test the StartBranchAndBound event after items generated (S1 -> S2)
  test('StartBranchAndBound event: computes and displays results (S1 -> S2)', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Generate items first
    await app.setItemsNumber(5);
    await app.clickGenerateItems();

    // Use a specific capacity and run algorithm via UI
    await app.setCapacity(15);
    const capacity = await app.getCapacityValue();
    expect(capacity).toBe('15');

    // For verification, obtain the algorithm result from the page context directly
    const directResult = await app.callBranchAndBound(capacity);

    // Trigger via UI and then read displayed results
    await app.clickStartBranchAndBound();

    const resultsHTML = await app.getResultsInnerHTML();
    // Basic expected structure
    expect(resultsHTML).toContain('Maximum Value:');
    expect(resultsHTML).toContain('Items Included:');

    // Check that the displayed max value matches the direct algorithm call
    expect(resultsHTML).toContain(String(directResult.maxValue));
    // Verify items included string matches (format "Item X" entries)
    const displayedItemsText = resultsHTML.split('Items Included:')[1].trim();
    // If directResult.bestItems is empty, the string might be empty; otherwise should include Item numbers
    const expectedDisplayedItems = directResult.bestItems.map(i => `Item ${i + 1}`).join(', ');
    expect(displayedItemsText).toBe(expectedDisplayedItems);

    // Confirm no uncaught errors
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Edge case: starting branch and bound before generating items (should handle empty items)
  test('Edge case: Start branch and bound before generating items produces zero result and no crash', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Ensure items are empty initially
    expect(await app.getItemListCount()).toBe(0);
    expect(await app.getWindowItemsLength()).toBe(0);

    // Start algorithm without generating items
    await app.clickStartBranchAndBound();

    // Results should show Maximum Value: 0 and no items included
    const resultsHTML = await app.getResultsInnerHTML();
    expect(resultsHTML).toContain('Maximum Value: 0');
    // Items Included: may be an empty string after the colon
    expect(resultsHTML).toContain('Items Included:');

    // Also verify algorithm result returned by branchAndBound matches display
    const directResult = await app.callBranchAndBound(await app.getCapacityValue());
    expect(directResult.maxValue).toBe(0);
    expect(directResult.bestItems.length).toBe(0);

    // No uncaught runtime errors should have occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Edge case: capacity zero or negative - algorithm should return zero maximum value (no items fit)
  test('Edge case: capacity zero or negative yields maxValue 0 and no crash', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    await app.setItemsNumber(3);
    await app.clickGenerateItems();

    // Set capacity to zero
    await app.setCapacity(0);
    await app.clickStartBranchAndBound();
    let resultsHTML = await app.getResultsInnerHTML();
    expect(resultsHTML).toContain('Maximum Value: 0');

    // Set capacity to a negative number and re-run
    await app.setCapacity(-5);
    await app.clickStartBranchAndBound();
    resultsHTML = await app.getResultsInnerHTML();
    expect(resultsHTML).toContain('Maximum Value: 0');

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Edge case: fractional number of items in the input - observe actual behavior (implementation detail)
  test('Edge case: fractional items input results in predictable number of generated items', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Input a fractional value
    await app.setItemsNumber('3.5');
    expect(await app.getItemsValue()).toBe('3.5');

    await app.clickGenerateItems();

    // The implementation loops i < numItems where numItems is coerced to Number(value).
    // For positive fractional x, number of iterations equals Math.ceil(x).
    const expectedCount = Math.ceil(Number('3.5'));
    const actualCount = await app.getItemListCount();
    expect(actualCount).toBe(expectedCount);

    // No errors should have occurred
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Verify global functions from the FSM mapping exist and are callable (smoke test)
  test('Implementation exposes expected global functions and they are callable', async ({ page }) => {
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Confirm presence of functions the FSM expects (some were only mentioned in FSM)
    const expectedFunctions = [
      'generateItems',
      'displayItems',
      'startBranchAndBound',
      'branchAndBound',
      'displayResults'
    ];
    for (const fn of expectedFunctions) {
      const exists = await app.hasGlobalFunction(fn);
      expect(exists, `Expected global function ${fn} to be defined`).toBe(true);
    }

    // Call generateItems and displayItems as a smoke test (should not throw)
    await app.setItemsNumber(2);
    await app.clickGenerateItems();
    // ensure no uncaught errors after calling these functions
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });
});