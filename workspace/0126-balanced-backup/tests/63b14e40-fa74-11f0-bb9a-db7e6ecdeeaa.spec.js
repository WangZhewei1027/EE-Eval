import { test, expect } from '@playwright/test';

// Test file: 63b14e40-fa74-11f0-bb9a-db7e6ecdeeaa.spec.js
// This suite validates the Linear Search Demonstration interactive app.
// It follows the FSM states: Idle (S0_Idle), Searching (S1_Searching),
// Result Found (S2_ResultFound), and Result Not Found (S3_ResultNotFound).
//
// The tests:
// - verify initial (idle) UI state
// - perform searches that lead to "found" and "not found" outcomes
// - validate alerts for invalid inputs (missing array, missing target, invalid number)
// - collect console messages and page errors and assert none occurred during correct flows
//
// Note: We do not modify the page source; we let dialogs and runtime errors occur naturally
// and assert their presence/absence as appropriate.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b14e40-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Linear Search page
class LinearSearchPage {
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchBtn = page.locator('#searchBtn');
    this.output = page.locator('#output');
    this.stepItems = page.locator('#output .step');
    this.arrayDisplay = page.locator('#output .array-display');
  }

  // Navigate to the app and wait for basic elements
  async goto() {
    await this.page.goto(APP_URL);
    await expect(this.arrayInput).toBeVisible();
    await expect(this.targetInput).toBeVisible();
    await expect(this.searchBtn).toBeVisible();
    await expect(this.output).toBeVisible();
  }

  // Helper to fill inputs
  async setArray(arrayStr) {
    await this.arrayInput.fill(arrayStr);
  }

  async setTarget(targetStr) {
    // targetInput is type=number; fill accepts string
    await this.targetInput.fill(targetStr);
  }

  // Click search and wait a short moment for DOM updates (linearSearch is synchronous)
  async clickSearch() {
    await this.searchBtn.click();
  }

  // Get innerHTML of output area
  async outputInnerHTML() {
    return await this.output.innerHTML();
  }

  // Get textContent of output area
  async outputText() {
    return await this.output.textContent();
  }

  // Count step elements
  async stepCount() {
    return await this.stepItems.count();
  }

  // Check if array display exists and its text
  async arrayDisplayText() {
    if (await this.arrayDisplay.count() === 0) return null;
    return await this.arrayDisplay.first().textContent();
  }
}

test.describe('Linear Search Algorithm Demo - FSM validation', () => {
  // Reusable variables for capturing console and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warn, error)
    page.on('console', msg => {
      // store type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // no-op here; per-test assertions are done inside each test
  });

  test.describe('Idle state (S0_Idle) validations', () => {
    test('Initial UI renders correctly with default array value and empty output', async ({ page }) => {
      // This test validates the S0_Idle state's entry evidence:
      // - arrayInput default value is present
      // - targetInput exists and is empty
      // - search button exists
      // - output area is present and initially empty
      const ls = new LinearSearchPage(page);
      await ls.goto();

      // Validate default array input value from FSM evidence
      await expect(ls.arrayInput).toHaveValue('4, 2, 7, 1, 3, 9, 8');

      // targetInput should be empty initially
      await expect(ls.targetInput).toHaveValue('');

      // output should be empty (no meaningful child content)
      const outputHTML = await ls.outputInnerHTML();
      expect(outputHTML.trim()).toBe('');

      // There should be no runtime page errors or console errors on initial load
      expect(pageErrors.length, 'No page errors on load').toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length, 'No console.error messages on load').toBe(0);
    });
  });

  test.describe('Searching (S1_Searching) and Results (S2_ResultFound, S3_ResultNotFound)', () => {
    test('Perform search that finds the target -> transitions to Result Found (S2_ResultFound)', async ({ page }) => {
      // This test validates:
      // - Clicking the search button triggers linearSearch (S1_Searching)
      // - Steps are displayed until match
      // - Final output includes "Target found at index <em>i</em>."
      const ls = new LinearSearchPage(page);
      await ls.goto();

      // Set a target that exists in the default array (7 at index 2)
      await ls.setTarget('7');

      // Click search and wait for synchronous updates
      await ls.clickSearch();

      // Output should include array display and a "Target value" label
      const outputHTML = await ls.outputInnerHTML();
      expect(outputHTML).toContain('Array to search:');
      expect(outputHTML).toContain('Target value:');

      // The array display should reflect the numeric array values
      const arrText = await ls.arrayDisplayText();
      expect(arrText).toBe('[ 4, 2, 7, 1, 3, 9, 8 ]');

      // Steps should be created until the found index (index 2 => 3 steps: indices 0,1,2)
      const steps = await ls.stepCount();
      expect(steps).toBe(3);

      // The final result should indicate found at index 2 (HTML uses <em>2</em>)
      expect(outputHTML).toContain('Result: Target found at index');
      expect(outputHTML).toContain('<em>2</em>');

      // Additionally, check that the matching step contains 'Match found' marker (✔️)
      const stepTexts = await Promise.all(
        Array.from({ length: steps }).map(async (_, i) => {
          return (await page.locator('#output .step').nth(i).textContent()).trim();
        })
      );
      // Last step (index 2) should show the check mark text
      expect(stepTexts[stepTexts.length - 1]).toContain('Match found');

      // Ensure no unexpected runtime errors were emitted during the synchronous search
      expect(pageErrors.length, 'No page errors during successful search').toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length, 'No console.error messages during successful search').toBe(0);
    });

    test('Perform search that does NOT find the target -> transitions to Result Not Found (S3_ResultNotFound)', async ({ page }) => {
      // This test validates:
      // - Clicking search with a missing target in array displays "Target not found..."
      // - Steps equal array length
      const ls = new LinearSearchPage(page);
      await ls.goto();

      // Use a target that does not exist in the default array
      await ls.setTarget('99');
      await ls.clickSearch();

      // Final output should contain "Target not found in the array."
      const outputHTML = await ls.outputInnerHTML();
      expect(outputHTML).toContain('Result: Target not found in the array.');

      // Steps should be equal to array length (7 elements in default)
      const steps = await ls.stepCount();
      expect(steps).toBe(7);

      // No runtime errors expected
      expect(pageErrors.length, 'No page errors during not-found search').toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length, 'No console.error messages during not-found search').toBe(0);
    });
  });

  test.describe('Invalid input and edge case alerts (InvalidInput, InvalidNumber events)', () => {
    test('Alert when array input is empty (InvalidInput event)', async ({ page }) => {
      // This test validates the alert triggered when the array input is empty.
      // We expect an alert dialog with the specific message.
      const ls = new LinearSearchPage(page);
      await ls.goto();

      // Clear array input and set a valid target
      await ls.setArray('');
      await ls.setTarget('7');

      // Capture dialog once
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        ls.clickSearch(), // triggers alert synchronously
      ]);

      // Validate alert message
      expect(dialog.message()).toBe('Please enter array elements.');
      await dialog.accept();

      // Because the search was aborted by alert, output should remain empty
      const outputHTML = await ls.outputInnerHTML();
      expect(outputHTML.trim()).toBe('');

      // No page runtime errors should be produced by this flow
      expect(pageErrors.length, 'No page errors when array input empty').toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length, 'No console.error messages when array input empty').toBe(0);
    });

    test('Alert when target input is empty (InvalidInput event)', async ({ page }) => {
      // This test validates the alert triggered when the target input is empty.
      const ls = new LinearSearchPage(page);
      await ls.goto();

      // Ensure array input has default; clear target
      await ls.setArray('4, 2, 7, 1, 3, 9, 8');
      await ls.setTarget(''); // empty target

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        ls.clickSearch(),
      ]);

      expect(dialog.message()).toBe('Please enter a target value to search.');
      await dialog.accept();

      // Output should remain empty
      const outputHTML = await ls.outputInnerHTML();
      expect(outputHTML.trim()).toBe('');

      // No runtime page errors expected
      expect(pageErrors.length, 'No page errors when target input empty').toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length, 'No console.error messages when target input empty').toBe(0);
    });

    test('Alert when array contains invalid number (InvalidNumber event)', async ({ page }) => {
      // This test provides an invalid array element (non-numeric) and expects a specific alert.
      const ls = new LinearSearchPage(page);
      await ls.goto();

      // Set an invalid array value (e.g., 'x') and a valid target
      await ls.setArray('4, x, 2');
      await ls.setTarget('2');

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        ls.clickSearch(),
      ]);

      // Expect the alert message includes the invalid token quoted as in source code
      expect(dialog.message()).toBe('Invalid number encountered in array: "x"');
      await dialog.accept();

      // Output should remain empty because parsing aborted
      const outputHTML = await ls.outputInnerHTML();
      expect(outputHTML.trim()).toBe('');

      // No runtime page errors expected from alert path
      expect(pageErrors.length, 'No page errors when invalid number encountered').toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length, 'No console.error messages when invalid number encountered').toBe(0);
    });
  });

  test.describe('Additional verifications and robustness checks', () => {
    test('Whitespace and trimming behavior for array and target inputs', async ({ page }) => {
      // Validate that leading/trailing whitespace in inputs are trimmed and parsed correctly.
      const ls = new LinearSearchPage(page);
      await ls.goto();

      // Provide inputs with extra whitespace
      await ls.setArray('  4 ,   2,7 ,  1 ');
      await ls.setTarget(' 7 ');

      await ls.clickSearch();

      // Found at index 2 (after trimming and parsing)
      const outputHTML = await ls.outputInnerHTML();
      expect(outputHTML).toContain('<em>2</em>');

      // No runtime errors
      expect(pageErrors.length, 'No page errors for trimmed inputs').toBe(0);
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length, 'No console.error messages for trimmed inputs').toBe(0);
    });

    test('Observe console and page errors over a typical user flow (no errors expected)', async ({ page }) => {
      // This test demonstrates observing console and page errors while performing a typical flow.
      const ls = new LinearSearchPage(page);
      await ls.goto();

      // Clear any previously captured messages
      consoleMessages = [];
      pageErrors = [];

      // Perform a successful search
      await ls.setTarget('1'); // exists at index 3 in default array
      await ls.clickSearch();

      // Allow a short microtask tick (search is synchronous, but keep for completeness)
      await page.waitForTimeout(50);

      // Assert that no uncaught exceptions were reported to page.on('pageerror')
      expect(pageErrors.length, 'No uncaught page errors during flow').toBe(0);

      // Assert no console.error messages were emitted
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length, 'No console.error emitted during flow').toBe(0);

      // Confirm UI shows found index 3
      const outputHTML = await ls.outputInnerHTML();
      expect(outputHTML).toContain('<em>3</em>');
    });
  });
});