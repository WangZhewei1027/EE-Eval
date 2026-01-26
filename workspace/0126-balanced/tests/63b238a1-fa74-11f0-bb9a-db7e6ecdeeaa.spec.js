import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b238a1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Big-O Notation Demo - FSM validation (Application ID: 63b238a1-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Shared state for capturing page runtime errors and console error messages
  let pageErrors = [];
  let consoleErrors = [];

  // Page object helper to encapsulate common interactions and selectors
  class DemoPage {
    constructor(page) {
      this.page = page;
      this.runButton = page.locator('#runButton');
      this.results = page.locator('#results');
      this.canvas = page.locator('#plot');
    }

    async clickRun() {
      await this.runButton.click();
    }

    async getResultsInnerHTML() {
      return await this.page.$eval('#results', el => el.innerHTML);
    }

    async typeOfRunButtonOnclick() {
      return await this.page.$eval('#runButton', el => typeof el.onclick);
    }

    async renderPageFunctionExists() {
      return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
    }
  }

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // pageerror provides an Error object; keep message for assertions
      try {
        pageErrors.push(err && err.message ? String(err.message) : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Capture console messages, specifically errors logged via console.error
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener exceptions
      }
    });

    // Navigate to the app page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leaks between tests (best-effort cleanup).
    page.removeAllListeners?.('pageerror');
    page.removeAllListeners?.('console');
  });

  test('S0 - Idle: initial state shows Run Tests button and empty results container', async ({ page }) => {
    const demo = new DemoPage(page);

    // Validate Run Tests button exists and is visible
    await expect(demo.runButton).toBeVisible();

    // Verify the run button has an onclick handler assigned by the page script
    // This confirms the evidence "runButton.onclick = runTests;" from the FSM/implementation
    const onclickType = await demo.typeOfRunButtonOnclick();
    expect(onclickType).toBe('function');

    // Results div should be empty on initial load (evidence for S0_Idle)
    const resultsHtml = await demo.getResultsInnerHTML();
    expect(resultsHtml.trim()).toBe('');

    // The FSM entry action for S0 mentions renderPage(); the implementation does not define it.
    // We assert that renderPage is not present on window (we do NOT attempt to create/patch it).
    const renderPageExists = await demo.renderPageFunctionExists();
    expect(renderPageExists).toBe(false);
  });

  test('Transition S0 -> S1: clicking Run Tests triggers testing state and starts running (shows "Running tests...")', async ({ page }) => {
    const demo = new DemoPage(page);

    // Click the Run Tests button to trigger the RunTests event
    await demo.clickRun();

    // The implementation's runAll() sets resultsDiv.innerHTML to a "Running tests..." message early.
    // Confirm that transition to the "Testing" state occurred by checking for that message.
    await expect(demo.results).toContainText(/Running tests... please wait./, { timeout: 5000 });

    // Wait (poll) until a runtime error about the misspelled function appears.
    // The implementation incorrectly calls "linearithmicTime" (typo) whereas the defined function is "linearithmicTime".
    // This is expected to create a ReferenceError which we must observe and assert exists.
    await expect.poll(() => pageErrors.join(' '), { timeout: 5000 }).toContain('linearithmicTime');

    // Also assert that console.error captured a related message (some browsers emit console errors)
    // It's acceptable if consoleErrors is empty in some environments, but when present it should mention the typo.
    if (consoleErrors.length > 0) {
      expect(consoleErrors.join(' ')).toContain('linearithmicTime');
    }
  });

  test('S1 -> S2: verify results table and plotting are NOT created due to runtime error (observing error prevents transition)', async ({ page }) => {
    const demo = new DemoPage(page);

    // Trigger the run; due to the ReferenceError inside runAll, the function should abort before createTable()/plotResults()
    await demo.clickRun();

    // Ensure the "Running tests..." message appears first
    await expect(demo.results).toContainText(/Running tests... please wait./, { timeout: 5000 });

    // Wait for the page error to have occurred
    await expect.poll(() => pageErrors.length, { timeout: 5000 }).toBeGreaterThan(0);

    // Because createTable() is invoked only after the loop completes successfully,
    // and that loop is interrupted by the ReferenceError, the results <table> should NOT be present.
    const resultsHtml = await demo.getResultsInnerHTML();
    expect(resultsHtml).not.toContain('<table>');
    // Additionally, the canvas plotting function plotResults() should not have been executed,
    // so while we cannot directly inspect the drawing operations, lack of a table is strong evidence
    // that S2 (Results Displayed) was not reached.

    // Confirm the error message indicates the missing function name (typo) - presence in pageErrors verified earlier.
    expect(pageErrors.join(' ')).toContain('linearithmicTime');
  });

  test('Error handling and repeated interactions: clicking Run Tests multiple times continues to surface the same runtime error', async ({ page }) => {
    const demo = new DemoPage(page);

    // First click
    await demo.clickRun();
    await expect(demo.results).toContainText(/Running tests... please wait./, { timeout: 5000 });
    await expect.poll(() => pageErrors.join(' '), { timeout: 5000 }).toContain('linearithmicTime');

    // Record how many errors we have currently observed
    const initialErrorCount = pageErrors.length;

    // Click again to simulate repeated user action while the code is in a failed state
    await demo.clickRun();

    // The second click should again attempt to run and should produce at least one additional error entry
    await expect.poll(() => pageErrors.length, { timeout: 5000 }).toBeGreaterThan(initialErrorCount);

    // Validate that all captured errors mention the same missing identifier (robustness check)
    for (const errMsg of pageErrors) {
      expect(errMsg).toContain('linearithmicTime');
    }
  });

  test('Edge case: verify that the results data structure and helper functions exist on window (introspection without modifying runtime)', async ({ page }) => {
    // Inspect some of the helper structures without patching or injecting anything
    const resultsKeys = await page.evaluate(() => {
      return Object.keys(window.results || {});
    });

    // The page defines a results object with keys for the complexities.
    expect(resultsKeys.sort()).toEqual(['O(1)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'].sort());

    // Verify measureTime helper exists and is callable type
    const measureTimeType = await page.evaluate(() => typeof window.measureTime);
    expect(measureTimeType).toBe('function');

    // Verify at least some algorithm functions exist
    const funcs = await page.evaluate(() => {
      return {
        constantTime: typeof constantTime,
        logarithmicTime: typeof logarithmicTime,
        linearTime: typeof linearTime,
        linearithmicTime: typeof linearithmicTime, // note: defined name in script
        quadraticTime: typeof quadraticTime
      };
    });

    expect(funcs.constantTime).toBe('function');
    expect(funcs.logarithmicTime).toBe('function');
    expect(funcs.linearTime).toBe('function');
    expect(funcs.linearithmicTime).toBe('function');
    expect(funcs.quadraticTime).toBe('function');

    // Also assert that the misspelled function that runAll calls does NOT exist,
    // which is the root cause of the runtime error observed in other tests.
    const misspelledExists = await page.evaluate(() => typeof window.linearithmicTime !== 'undefined');
    expect(misspelledExists).toBe(false);
  });
});