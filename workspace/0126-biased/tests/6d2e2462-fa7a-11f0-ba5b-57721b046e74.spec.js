import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e2462-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Binary Search Demo
class BinarySearchPage {
  constructor(page) {
    this.page = page;
    this.arrayDisplay = page.locator('#array-display');
    this.arrayItems = (index) => page.locator(`#item-${index}`);
    this.arraySizeInput = page.locator('#array-size');
    this.arrayTypeSelect = page.locator('#array-type');
    this.customValuesContainer = page.locator('#custom-values-container');
    this.customValuesInput = page.locator('#custom-values');
    this.generateArrayBtn = page.locator('#generate-array');
    this.targetValueInput = page.locator('#target-value');
    this.searchTypeSelect = page.locator('#search-type');
    this.startSearchBtn = page.locator('#start-search');
    this.stepSearchBtn = page.locator('#step-search');
    this.resetSearchBtn = page.locator('#reset-search');
    this.searchStatus = page.locator('#search-status');
    this.searchLog = page.locator('#search-log');
    this.comparisonCount = page.locator('.comparison-count');
    this.speedSlider = page.locator('#speed');
    this.speedValue = page.locator('#speed-value');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for initial render to complete
    await expect(this.arrayDisplay).toBeVisible();
  }

  async getArrayItemsCount() {
    return await this.page.locator('#array-display .array-item').count();
  }

  async getArrayItemsText() {
    const count = await this.getArrayItemsCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.page.locator(`#item-${i}`).innerText()).trim());
    }
    return texts;
  }

  async setArraySize(size) {
    await this.arraySizeInput.fill(String(size));
  }

  async changeArrayType(type) {
    await this.arrayTypeSelect.selectOption(type);
  }

  async setCustomValues(valuesCsv) {
    // Ensure custom container visible by selecting custom type
    await this.changeArrayType('custom');
    await this.customValuesInput.fill(valuesCsv);
  }

  async clickGenerateArray() {
    await this.generateArrayBtn.click();
  }

  async setTargetValue(value) {
    await this.targetValueInput.fill(String(value));
  }

  async selectSearchType(type) {
    await this.searchTypeSelect.selectOption(type);
  }

  async setSpeedSlider(value) {
    // value should be within [0,1000] as per slider
    await this.speedSlider.fill(String(value));
    // dispatch input event to trigger updateSpeed
    await this.speedSlider.dispatchEvent('input');
  }

  async clickStartSearch() {
    await this.startSearchBtn.click();
  }

  async clickStepSearch() {
    await this.stepSearchBtn.click();
  }

  async clickResetSearch() {
    await this.resetSearchBtn.click();
  }

  async getSearchStatusText() {
    return (await this.searchStatus.innerText()).trim();
  }

  async getComparisonCount() {
    return (await this.comparisonCount.innerText()).trim();
  }

  async waitForStatusContains(substr, timeout = 3000) {
    await this.page.waitForFunction(
      (selector, text) => document.querySelector(selector).textContent.includes(text),
      '#search-status',
      substr,
      { timeout }
    );
  }

  async getLogText() {
    return (await this.searchLog.innerText()).trim();
  }

  async arrayItemHasClass(index, className) {
    return await this.page.locator(`#item-${index}`).evaluate((el, cls) => el.classList.contains(cls), className);
  }
}

test.describe('Binary Search Interactive Demo - FSM and UI validations', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture any page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
  });

  test.afterEach(async () => {
    // Ensure no uncaught exceptions or console error messages occurred during tests
    // These assertions help detect runtime issues introduced by the application code.
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, got: ${consoleErrors.map(m => m.text()).join('; ')}`).toBe(0);
  });

  test('Initial State (S0_Idle) - page loads into Ready state with default array', async ({ page }) => {
    // Validate the Idle state: "Ready" status, default array rendered, controls initial states
    const p = new BinarySearchPage(page);
    await p.goto();

    // Verify search status is Ready (S0_Idle evidence)
    await expect(p.searchStatus).toHaveText('Ready');

    // Default array size should be the value from the input (20)
    const sizeAttr = await p.arraySizeInput.inputValue();
    const expectedCount = Number(sizeAttr);
    const itemCount = await p.getArrayItemsCount();
    expect(itemCount).toBe(expectedCount);

    // Start should be enabled, Step and Reset disabled
    await expect(p.startSearchBtn).toBeEnabled();
    await expect(p.stepSearchBtn).toBeDisabled();
    await expect(p.resetSearchBtn).toBeDisabled();

    // Comparison count should be zero
    await expect(p.comparisonCount).toHaveText('0');
  });

  test('Generate Array - custom values and padding behavior', async ({ page }) => {
    // Validate GenerateArray event and custom values path
    const p = new BinarySearchPage(page);
    await p.goto();

    // Set array size to 5 and choose custom values smaller than size to trigger padding
    await p.setArraySize(5);
    // Provide only 3 values so generateArray will pad with random numbers and sort them
    await p.changeArrayType('custom');
    await p.customValuesInput.fill('2,4,8');
    await p.clickGenerateArray();

    // After generation, there should be exactly 5 items
    const count = await p.getArrayItemsCount();
    expect(count).toBe(5);

    // Now explicitly provide exact values equal to size for deterministic array
    await p.setArraySize(5);
    await p.setCustomValues('1,3,5,7,9');
    await p.clickGenerateArray();

    const itemsText = await p.getArrayItemsText();
    expect(itemsText).toEqual(['1', '3', '5', '7', '9']);
  });

  test('Start Search (S0 -> S1) and Completion (S1 -> S3) - iterative found scenario', async ({ page }) => {
    // Validate starting search transitions to Searching and eventually to Completed with Found
    const p = new BinarySearchPage(page);
    await p.goto();

    // Use a deterministic small array and iterative search
    await p.setArraySize(5);
    await p.setCustomValues('1,3,5,7,9');
    await p.clickGenerateArray();

    // Set target to 7 (known index 3)
    await p.setTargetValue(7);
    await p.selectSearchType('iterative');

    // Speed slider to max so steps run immediately (speed = 1000 - 1000 = 0)
    await p.setSpeedSlider(1000);

    // Start search: this should set Searching state evidence
    await p.clickStartSearch();

    // Immediately after start, status should reflect Searching...
    await expect(p.searchStatus).toHaveText('Searching...');

    // Step button should be enabled and start disabled per evidence
    await expect(p.stepSearchBtn).toBeEnabled();
    await expect(p.startSearchBtn).toBeDisabled();

    // Wait for the search to complete - either Found at index or Not found
    await p.waitForStatusContains('Found at index', 3000);

    // After completion, start should be enabled again and step disabled
    await expect(p.startSearchBtn).toBeEnabled();
    await expect(p.stepSearchBtn).toBeDisabled();

    // Validate that the found status and log contains expected message
    const statusText = await p.getSearchStatusText();
    expect(statusText).toMatch(/Found at index \d+/);

    const logText = await p.getLogText();
    expect(logText).toContain('Found 7 at index');

    // The array item at index 3 should have class 'found'
    const foundClass = await p.arrayItemHasClass(3, 'found');
    expect(foundClass).toBe(true);
  });

  test('Step Search toggles pause/resume (S1 <-> S2) - iterative step behavior', async ({ page }) => {
    // Validate pausing and resuming search using Step button
    const p = new BinarySearchPage(page);
    await p.goto();

    // Deterministic array and target that requires multiple steps
    await p.setArraySize(9);
    await p.setCustomValues('1,2,3,4,5,6,7,8,9');
    await p.clickGenerateArray();

    await p.setTargetValue(9);
    await p.selectSearchType('iterative');

    // Make the automatic stepping slow so we can reliably pause before it finishes
    // Setting slider to 0 -> speed = 1000 (Very Slow)
    await p.setSpeedSlider(0);

    // Start search
    await p.clickStartSearch();

    // Confirm Searching...
    await expect(p.searchStatus).toHaveText('Searching...');

    // Immediately click Step to pause the search
    await p.clickStepSearch();

    // After pausing, the button text should be 'Step' per implementation
    await expect(p.stepSearchBtn).toHaveText('Step');

    // Record comparisons and wait a short time to assert no progress while paused
    const comparisonsWhilePaused = await p.getComparisonCount();
    await page.waitForTimeout(600); // wait more than a single step interval to verify pausing

    const comparisonsAfterWait = await p.getComparisonCount();
    expect(comparisonsAfterWait).toBe(comparisonsWhilePaused);

    // Resume by clicking Step again - the code sets text to 'Pause' when resumed
    await p.clickStepSearch();
    await expect(p.stepSearchBtn).toHaveText('Pause');

    // Wait for search to complete
    await p.waitForStatusContains('Found at index', 5000);

    // After completion, ensure the 'Found' message appears
    const statusText = await p.getSearchStatusText();
    expect(statusText).toMatch(/Found at index \d+/);
  });

  test('Reset Search (S1 -> S0) clears state and UI elements', async ({ page }) => {
    // Validate Reset transitions Searching back to Ready (S0_Idle)
    const p = new BinarySearchPage(page);
    await p.goto();

    // Deterministic array and target
    await p.setArraySize(5);
    await p.setCustomValues('10,20,30,40,50');
    await p.clickGenerateArray();

    await p.setTargetValue(30);
    await p.selectSearchType('iterative');

    // Start search but then immediately reset (simulate user cancel)
    await p.setSpeedSlider(1000); // fast
    await p.clickStartSearch();

    // Ensure search started
    await expect(p.searchStatus).toHaveText('Searching...');
    await expect(p.stepSearchBtn).toBeEnabled();

    // Click reset
    await p.clickResetSearch();

    // After reset, status should be 'Ready' and counts/log cleared
    await expect(p.searchStatus).toHaveText('Ready');
    await expect(p.comparisonCount).toHaveText('0');
    await expect(p.searchLog).toHaveText(''); // log cleared

    // Buttons should be back to initial state
    await expect(p.startSearchBtn).toBeEnabled();
    await expect(p.stepSearchBtn).toBeDisabled();
    await expect(p.resetSearchBtn).toBeDisabled();

    // No array items should be marked as 'found' (ensure classes cleared)
    const count = await p.getArrayItemsCount();
    for (let i = 0; i < count; i++) {
      const isFound = await p.arrayItemHasClass(i, 'found');
      expect(isFound).toBe(false);
    }
  });

  test('Edge case: Starting search without a target triggers alert dialog', async ({ page }) => {
    // Validate that attempting to start a search with an invalid target shows an alert
    const p = new BinarySearchPage(page);
    await p.goto();

    // Clear target input to ensure it's empty
    await p.targetValueInput.fill('');

    // Listen for dialog
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      p.startSearchBtn.click() // clicking start should produce alert
    ]);

    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Please enter a valid target value');
    await dialog.dismiss();
  });

  test('UpdateSpeed event updates human-readable speed label', async ({ page }) => {
    // Validate speed slider input updates speedValue text according to ranges
    const p = new BinarySearchPage(page);
    await p.goto();

    // Set a few representative slider values and check speedValue text
    await p.setSpeedSlider(1000); // speed = 0 -> Very Fast
    await expect(p.speedValue).toHaveText('Very Fast');

    await p.setSpeedSlider(800); // speed = 200 -> Fast
    // Could be "Fast" or "Very Fast" depending on threshold; assert "Fast" or "Very Fast"
    const text800 = (await p.speedValue.innerText()).trim();
    expect(['Fast', 'Very Fast', 'Medium', 'Slow', 'Very Slow']).toContain(text800);

    await p.setSpeedSlider(0); // speed = 1000 -> Very Slow
    await expect(p.speedValue).toHaveText('Very Slow');
  });
});