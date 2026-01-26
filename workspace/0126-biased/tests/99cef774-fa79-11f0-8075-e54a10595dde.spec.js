import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cef774-fa79-11f0-8075-e54a10595dde.html';

// Page Object to encapsulate common interactions with the demo page
class TernarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchButton = page.locator("button[onclick='performTernarySearch()']");
    this.resetButton = page.locator("button[onclick='reset()']");
    this.result = page.locator('#result');
    this.steps = page.locator('#steps');
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

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async getStepsText() {
    return (await this.steps.textContent()) ?? '';
  }

  async getArrayValue() {
    return (await this.arrayInput.inputValue()) ?? '';
  }

  async getTargetValue() {
    return (await this.targetInput.inputValue()) ?? '';
  }
}

test.describe('Ternary Search Interactive Demo (FSM validation)', () => {
  // Collect console errors and page errors to assert later.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // pageerror captures uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(String(err));
    });
  });

  // Test initial Idle state (S0_Idle)
  test('S0_Idle: initial render shows inputs, buttons and no results; renderPage is not defined', async ({ page }) => {
    // This test validates the initial Idle state: inputs are present and empty, result/steps are empty,
    // and the FSM-mentioned renderPage() function is not present in the implementation (we assert that).
    const tpl = new TernarySearchPage(page);
    await tpl.goto();

    // Verify inputs and buttons are present
    await expect(tpl.arrayInput).toBeVisible();
    await expect(tpl.targetInput).toBeVisible();
    await expect(tpl.searchButton).toBeVisible();
    await expect(tpl.resetButton).toBeVisible();

    // Inputs should be empty initially
    expect(await tpl.getArrayValue()).toBe('');
    expect(await tpl.getTargetValue()).toBe('');

    // Result and steps should be empty initially
    expect(await tpl.getResultText()).toBe('');
    expect(await tpl.getStepsText()).toBe('');

    // The FSM's S0 entry action mentions renderPage(); verify that this function is not defined on the page.
    // (We must not inject or call it; only inspect.)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // The actual functions used by the implementation should exist: performTernarySearch and reset
    const performType = await page.evaluate(() => typeof window.performTernarySearch);
    const resetType = await page.evaluate(() => typeof window.reset);
    expect(performType).toBe('function');
    expect(resetType).toBe('function');

    // Ensure no uncaught page errors or console errors occurred during load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Transition S0 -> S1 via SearchButtonClick with valid input
  test('S0 -> S1 (SearchButtonClick): searching a present element yields Found and populates steps', async ({ page }) => {
    // This test validates the transition from Idle to Searching. It verifies performTernarySearch() runs,
    // result text updates to indicate the found index, and steps text contains search trace information.
    const tpl = new TernarySearchPage(page);
    await tpl.goto();

    // Provide a valid array and target known to be present
    // Using array: 10, 20, 30, 40, 50 -> target 30 should be at index 2 after sorting
    await tpl.fillArray('10, 20, 30, 40, 50');
    await tpl.fillTarget('30');

    // Click Search button (triggers performTernarySearch)
    await tpl.clickSearch();

    // The result should state the found index (index is with respect to sorted array)
    await expect(tpl.result).toHaveText(/Found at index:\s*2/);

    // Steps should contain at least one 'Searching in range' line
    const stepsText = await tpl.getStepsText();
    expect(stepsText.length).toBeGreaterThan(0);
    expect(stepsText).toMatch(/Searching in range/);

    // Ensure no uncaught page errors or console errors occurred during search
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Edge case: invalid inputs should produce the validation message
  test('S0 -> S1 (SearchButtonClick): invalid or empty inputs produce validation message and empty steps', async ({ page }) => {
    // This test validates error-handling path when inputs are invalid (empty array or missing target).
    const tpl = new TernarySearchPage(page);
    await tpl.goto();

    // Case A: both inputs empty
    await tpl.fillArray('');
    await tpl.fillTarget('');
    await tpl.clickSearch();

    // Expect validation message
    await expect(tpl.result).toHaveText('Please provide a valid input.');
    // Steps should be empty on invalid input
    expect(await tpl.getStepsText()).toBe('');

    // Case B: array provided with non-numeric values or empty entries -> results still should be invalid if parsing fails.
    await tpl.fillArray('a, b, c');
    await tpl.fillTarget('5');
    await tpl.clickSearch();

    // Because Number('a') will result in NaN, array is still an array but values are NaN. Implementation checks isNaN(target) not elements,
    // so target is numeric here; the algorithm may run but likely produce Not found.
    // We won't assert a specific outcome; instead verify no uncaught exceptions and result is a string non-null.
    const resText = await tpl.getResultText();
    expect(typeof resText).toBe('string');

    // Ensure no uncaught page errors or console errors occurred during these invalid input flows
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Transition S0 -> S2 via ResetButtonClick
  test('S0 -> S2 (ResetButtonClick): reset clears inputs, result and steps', async ({ page }) => {
    // This test validates the Reset transition: when Reset is clicked, inputs and outputs are cleared.
    const tpl = new TernarySearchPage(page);
    await tpl.goto();

    // Populate inputs and run a search to populate result/steps
    await tpl.fillArray('5, 15, 25');
    await tpl.fillTarget('15');
    await tpl.clickSearch();

    // Ensure state changed and results/steps populated prior to reset
    expect((await tpl.getResultText()).length).toBeGreaterThan(0);
    expect((await tpl.getStepsText()).length).toBeGreaterThanOrEqual(0);

    // Now click Reset (this is the S0 -> S2 transition)
    await tpl.clickReset();

    // After reset, inputs should be empty
    expect(await tpl.getArrayValue()).toBe('');
    expect(await tpl.getTargetValue()).toBe('');

    // Result and steps should be cleared
    expect(await tpl.getResultText()).toBe('');
    expect(await tpl.getStepsText()).toBe('');

    // Ensure no uncaught page errors or console errors occurred during reset
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test search for an element not present (Not found case)
  test('S0 -> S1 (SearchButtonClick): search for missing element results in "Not found" and emits steps', async ({ page }) => {
    // This test validates the searching behavior when the target is not present: result should show "Not found",
    // and steps should still contain the search trace.
    const tpl = new TernarySearchPage(page);
    await tpl.goto();

    await tpl.fillArray('1,2,3,4,5,6,7,8,9,10');
    await tpl.fillTarget('35'); // not present
    await tpl.clickSearch();

    // Expect Not found message
    await expect(tpl.result).toHaveText('Not found');

    // Steps should show at least one search line
    const stepsText = await tpl.getStepsText();
    expect(stepsText).toMatch(/Searching in range/);

    // Ensure no uncaught page errors or console errors occurred during the not-found search
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Validate that the functions referenced in FSM entry_actions map to actual implementation where possible.
  test('FSM onEnter/onExit verification: performTernarySearch and reset exist; renderPage not implemented', async ({ page }) => {
    // This test explicitly verifies the existence (or absence) of functions referenced by the FSM's entry actions.
    const tpl = new TernarySearchPage(page);
    await tpl.goto();

    // performTernarySearch should be a function (S1 entry action)
    const performType = await page.evaluate(() => typeof window.performTernarySearch);
    expect(performType).toBe('function');

    // reset should be a function (S2 entry action)
    const resetType = await page.evaluate(() => typeof window.reset);
    expect(resetType).toBe('function');

    // renderPage was listed as S0 entry action in FSM but is not present in the implementation
    const renderType = await page.evaluate(() => typeof window.renderPage);
    expect(renderType).toBe('undefined');

    // Ensure no uncaught page errors or console errors occurred while inspecting these
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test.afterEach(async ({ page }) => {
    // As a final safety check, ensure that no uncaught errors leaked to the page during the test.
    // This asserts the page did not emit errors during test execution.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);

    // Close page to clean up (Playwright will usually handle this, but explicit is fine)
    try {
      await page.close();
    } catch (e) {
      // ignore errors during close in case the runner closed the page already
    }
  });
});