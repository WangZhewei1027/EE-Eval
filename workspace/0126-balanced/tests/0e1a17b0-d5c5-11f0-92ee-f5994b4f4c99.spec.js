import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e1a17b0-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Knapsack FSM - 0e1a17b0-d5c5-11f0-92ee-f5994b4f4c99', () => {
  // Arrays to collect runtime problems and console output for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object; push its message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture console messages for additional diagnostics / evidence checks
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Navigate to the application page for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // give any pending page errors a moment to surface (defensive)
    await page.waitForTimeout(50);
  });

  test('Initial Idle state: page loads with Add Item button and knapsack container, no runtime errors on load', async ({ page }) => {
    // Validate the Add Item button exists and matches the selector specified in the FSM
    const addButton = page.locator('button[onclick="addItem()"]');
    await expect(addButton).toHaveCount(1);
    await expect(addButton).toHaveText('Add Item');

    // Validate the knapsack container exists
    const knapsack = page.locator('#knapsack');
    await expect(knapsack).toHaveCount(1);

    // The FSM entry action "renderPage()" is not present in the HTML/JS,
    // so we assert that no ReferenceError about renderPage was thrown on load.
    // Also assert there were no page errors during initial load.
    expect(pageErrors.length).toBe(0);

    // Sanity: no list items should be present initially inside #knapsack
    const initialInnerHTML = await page.locator('#knapsack').innerHTML();
    expect(initialInnerHTML).toBe('');
  });

  test('Transition AddItem: clicking Add Item calls addItem and results in runtime error (TypeError) due to missing DOM variables', async ({ page }) => {
    // Ensure the function addItem exists on the page
    const addItemType = await page.evaluate(() => (typeof window.addItem));
    expect(addItemType).toBe('function');

    // Click the Add Item button to trigger the transition event
    await page.click('button[onclick="addItem()"]');

    // Wait briefly to allow synchronous errors to be captured
    await page.waitForTimeout(100);

    // The implementation contains references to elements/variables that don't exist,
    // so the click should produce a runtime error. We expect at least one page error.
    expect(pageErrors.length).toBeGreaterThan(0);

    // The code attempts to read item.name where item is null -> TypeError is expected.
    // Different engines emit slightly different messages; check for common substrings.
    const hasNameError = pageErrors.some(msg =>
      msg.includes('Cannot read properties') && msg.includes('name')
      || msg.includes("Cannot read property 'name'")
      || (msg.includes('Cannot read') && msg.includes('name'))
      || msg.toLowerCase().includes('typeerror')
    );
    expect(hasNameError).toBeTruthy();

    // Verify that because of the error, the knapsack container did not receive the appended item.
    const knapsackChildren = await page.$$eval('#knapsack > li', els => els.length);
    expect(knapsackChildren).toBe(0);

    // For additional evidence, ensure the addItem source contains expected FSM evidence strings.
    const addItemSourceContainsEvidence = await page.evaluate(() => {
      try {
        return addItem.toString().includes('knapsack.appendChild');
      } catch (e) {
        return false;
      }
    });
    expect(addItemSourceContainsEvidence).toBe(true);
  });

  test('Edge cases & repeated interactions: multiple clicks produce repeated errors and missing elements are null', async ({ page }) => {
    // Verify that expected DOM elements referenced by the script are missing
    const itemHandle = await page.$('#item');
    const typeHandle = await page.$('#type');
    const kipsackHandle = await page.$('#kipsack'); // note misspelling used in the script

    expect(itemHandle).toBeNull(); // <div id="item"> does not exist in the HTML
    expect(typeHandle).toBeNull(); // <div id="type"> does not exist in the HTML
    expect(kipsackHandle).toBeNull(); // 'kipsack' ID is not present

    // Clear any previous pageErrors captured during navigation
    pageErrors = [];

    // Click the Add Item button twice to validate consistent error behavior on repeated events
    await page.click('button[onclick="addItem()"]');
    await page.waitForTimeout(80);
    await page.click('button[onclick="addItem()"]');
    await page.waitForTimeout(80);

    // Expect at least two errors (one per invocation) or at minimum repeated error messages
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Ensure that each recorded error message references the same root cause pattern (reading .name or similar)
    const allContainNameOrType = pageErrors.every(msg =>
      msg.includes('name') || msg.toLowerCase().includes('typeerror') || msg.includes('Cannot read')
    );
    expect(allContainNameOrType).toBeTruthy();

    // Ensure the knapsack still contains no list items after repeated failing attempts
    const totalItems = await page.$$eval('#knapsack > li', els => els.length);
    expect(totalItems).toBe(0);
  });

  test('FSM onEnter/onExit actions verification: renderPage entry action is not executed (no ReferenceError for renderPage)', async ({ page }) => {
    // The FSM mentions an entry action renderPage(), but the HTML/JS does not call it.
    // Confirm that no ReferenceError mentioning 'renderPage' was produced during load.
    const foundRenderPageError = pageErrors.some(msg => msg && msg.includes('renderPage'));
    expect(foundRenderPageError).toBeFalsy();

    // Additionally, confirm that the page did not emit any SyntaxError on load (script is syntactically valid)
    const hasSyntaxError = pageErrors.some(msg => msg.toLowerCase().includes('syntaxerror'));
    expect(hasSyntaxError).toBeFalsy();
  });

  test('Diagnostics: collect console messages and page errors for debugging evidence', async ({ page }) => {
    // This test demonstrates capturing console messages and errors after a single click.
    // It also asserts that console messages (if any) are recorded and that runtime errors occurred.
    await page.click('button[onclick="addItem()"]');
    await page.waitForTimeout(80);

    // We expect at least one page error (runtime exception) from the failing addItem implementation
    expect(pageErrors.length).toBeGreaterThan(0);

    // Console messages may or may not exist; ensure our capture mechanism worked if any exist.
    // This assertion is lenient: consoleMessages is an array and should be defined.
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Log the first error message to be available in the test output if needed
    // (we assert the content to ensure it matches the expected failure modes)
    const firstError = pageErrors[0] || '';
    expect(typeof firstError).toBe('string');
    expect(firstError.length).toBeGreaterThan(0);
  });
});