import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cef770-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Binary Search Visualizer page
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchButton = page.locator('#searchButton');
    this.resetButton = page.locator('#resetButton');
    this.resultsDiv = page.locator('#results');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillArray(value) {
    await this.arrayInput.fill(value);
  }

  async fillTarget(value) {
    // Accept string or number
    await this.targetInput.fill(String(value));
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getResultsHTML() {
    return await this.resultsDiv.innerHTML();
  }

  async getArrayValue() {
    return await this.arrayInput.inputValue();
  }

  async getTargetValue() {
    return await this.targetInput.inputValue();
  }
}

test.describe('Binary Search Visualizer - FSM tests', () => {
  // Will collect console messages and page errors for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages including their type
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  // Idle state: verify page renders inputs, placeholders, and results empty
  test('S0_Idle: Page renders inputs and placeholders (Idle state)', async ({ page }) => {
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Validate presence and placeholders for array and target inputs
    await expect(page.locator('#arrayInput')).toBeVisible();
    await expect(page.locator('#targetInput')).toBeVisible();
    await expect(page.locator('#searchButton')).toBeVisible();
    await expect(page.locator('#resetButton')).toBeVisible();
    await expect(page.locator('#results')).toBeVisible();

    // Check placeholders match the FSM/evidence
    await expect(page.locator('#arrayInput')).toHaveAttribute('placeholder', '1,2,3,4,5,6,7,8,9,10');
    await expect(page.locator('#targetInput')).toHaveAttribute('placeholder', '5');

    // Results should be empty on initial render (entry action: renderPage())
    const resultsHtml = await bsp.getResultsHTML();
    expect(resultsHtml).toBe('', 'Expected results div to be empty in Idle state');

    // Validate that no runtime page errors occurred during initial render
    expect(pageErrors.length).toBe(0);
    // Validate that no console error-level messages were emitted
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Searching state: search for an existing target and validate results (S1 -> S2)
  test('S1_Searching -> S2_ResultsDisplayed: Successful search displays steps and found index', async ({ page }) => {
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Input a sorted array and a target known to be in the array
    await bsp.fillArray('1,2,3,4,5,6,7,8,9,10');
    await bsp.fillTarget(5);

    // Trigger the search (SearchButtonClick event)
    await bsp.clickSearch();

    // Results should contain the sequence of checks and a Found message
    const resultsHtml = await bsp.getResultsHTML();
    // It should include at least one 'Checking middle index' line and the 'Found' line per implementation
    expect(resultsHtml).toContain('Checking middle index', 'Expected algorithm step logs to be displayed');
    expect(resultsHtml).toContain('Found 5 at index', 'Expected the results to say the target was found');

    // The specific index for 5 in the provided array should be 4 (0-based)
    expect(resultsHtml).toContain('Found 5 at index 4', 'Expected found index 4 for value 5');

    // Ensure no page errors or console errors occurred while searching
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Searching for a non-existent target
  test('S1_Searching -> S2_ResultsDisplayed: Searching for non-existent target shows not found message', async ({ page }) => {
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    await bsp.fillArray('1,2,3,4,5,6,7,8,9,10');
    await bsp.fillTarget(11);
    await bsp.clickSearch();

    const resultsHtml = await bsp.getResultsHTML();
    expect(resultsHtml).toContain('Target 11 not found', 'Expected "not found" message for target 11');

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Reset transition: ensure inputs and results are cleared and page returns to Idle
  test('ResetButtonClick: Reset clears inputs and results (S0_Idle from S0_Idle via ResetButtonClick)', async ({ page }) => {
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Set values and perform a search to populate results
    await bsp.fillArray('1,2,3,4,5');
    await bsp.fillTarget(3);
    await bsp.clickSearch();

    // Sanity check: results were produced
    let resultsHtml = await bsp.getResultsHTML();
    expect(resultsHtml.length).toBeGreaterThan(0, 'Expected non-empty results before reset');

    // Click reset (ResetButtonClick event)
    await bsp.clickReset();

    // After reset, inputs and results should be cleared per FSM transition actions
    expect(await bsp.getArrayValue()).toBe('', 'arrayInput should be cleared by reset');
    expect(await bsp.getTargetValue()).toBe('', 'targetInput should be cleared by reset');
    expect(await bsp.getResultsHTML()).toBe('', 'resultsDiv should be cleared by reset');

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Edge case: empty inputs (search without providing values)
  test('Edge case: Clicking search with empty inputs results in handling of NaN target', async ({ page }) => {
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Ensure both inputs are empty
    await bsp.fillArray('');
    await bsp.fillTarget('');
    await bsp.clickSearch();

    // The implementation uses parseInt on empty string -> NaN, results should reflect that flow
    const resultsHtml = await bsp.getResultsHTML();
    // We expect the implementation to produce some output mentioning 'Target NaN' or to end with 'not found'
    const observed = resultsHtml;
    expect(
      observed.includes('Target NaN') || observed.includes('not found'),
      'Expected either mention of Target NaN or a "not found" message when inputs are empty'
    ).toBeTruthy();

    // No runtime exceptions expected (the app gracefully handles empty inputs)
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Edge case: malformed array (non-numeric values)
  test('Edge case: Malformed array input (non-numeric) does not crash and yields predictable output', async ({ page }) => {
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    // Put non-numeric values in array input
    await bsp.fillArray('a,b,c,d');
    await bsp.fillTarget(1);
    await bsp.clickSearch();

    const resultsHtml = await bsp.getResultsHTML();
    // The implementation uses parseInt => NaN for non-numeric tokens; algorithm should not throw and should complete
    expect(resultsHtml.length).toBeGreaterThan(0, 'Expected output even when array contains non-numeric values');
    // It should either indicate not found or show comparisons involving NaN; just assert no crash
    expect(resultsHtml).toMatch(/not found|Found|Checking middle index/i);

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });

  // Sequential searches: ensure results update on successive searches
  test('Sequential searches update results correctly (search -> search with different target)', async ({ page }) => {
    const bsp = new BinarySearchPage(page);
    await bsp.goto();

    await bsp.fillArray('1,2,3,4,5,6,7,8,9,10');

    // First search for 2
    await bsp.fillTarget(2);
    await bsp.clickSearch();
    const firstResults = await bsp.getResultsHTML();
    expect(firstResults).toContain('Found 2 at index', 'First search should find 2');

    // Second search for 8 without resetting array input
    await bsp.fillTarget(8);
    await bsp.clickSearch();
    const secondResults = await bsp.getResultsHTML();
    expect(secondResults).toContain('Found 8 at index', 'Second search should find 8');
    // Ensure results updated (should not equal previous results)
    expect(secondResults).not.toBe(firstResults);

    // No runtime errors expected during sequential operations
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMessages.length).toBe(0);
  });
});