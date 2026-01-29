import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bdf01-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Overfitting Example (Application ID: 520bdf01-fa76-11f0-a09b-87751f540fd8)', () => {
  // Each test navigates to the page fresh to observe runtime behavior/errors as-is.

  test('S0_Idle state: Verify core visual components exist in DOM and are initially empty', async ({ page }) => {
    // Validate that the elements described in the FSM evidence (#chart, #label, #value) exist
    await page.goto(APP_URL, { waitUntil: 'load' });

    // #chart is present (visual element). It is a div in the implementation.
    const chartLocator = page.locator('#chart');
    await expect(chartLocator).toHaveCount(1);
    await expect(chartLocator).toBeVisible();

    // #label and #value should exist but likely remain empty due to script errors
    const labelLocator = page.locator('#label');
    const valueLocator = page.locator('#value');
    await expect(labelLocator).toHaveCount(1);
    await expect(valueLocator).toHaveCount(1);

    // Assert that label and value are empty strings (implementation attempts to set them, but script errors prevent that)
    await expect(labelLocator).toHaveText('', { timeout: 1000 });
    await expect(valueLocator).toHaveText('', { timeout: 1000 });
  });

  test('JS runtime errors occur on page load (expect getContext / Chart related errors)', async ({ page }) => {
    // Capture page errors and console error messages while loading the page
    const pageErrors = [];
    page.on('pageerror', (err) => {
      // err.message is the runtime error message
      pageErrors.push(String(err?.message || err));
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait briefly to allow any asynchronous errors/console messages to appear
    await page.waitForTimeout(200);

    // We expect at least one runtime error due to the script being executed in the head before DOM elements:
    // common failures include "Cannot read properties of null (reading 'getContext')", "getContext is not a function",
    // or "Chart is not defined". We'll assert that at least one error message mentions one of these keywords.
    const combinedErrors = [...pageErrors, ...consoleErrors].join('\n');

    expect(combinedErrors.length).toBeGreaterThan(0);

    // Flexible matching for likely error signatures
    const hasGetContext = /getContext/i.test(combinedErrors);
    const hasChartUndefined = /Chart is not defined/i.test(combinedErrors);
    const hasCannotRead = /cannot read properties of null/i.test(combinedErrors) || /cannot read properties/i.test(combinedErrors);

    expect(hasGetContext || hasChartUndefined || hasCannotRead).toBeTruthy();
  });

  test('FSM entry action "renderPage" is not present and no interactive controls exist', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // The FSM lists renderPage() as an entry action. Verify that no global renderPage function exists.
    const renderPageType = await page.evaluate(() => {
      try {
        return typeof renderPage;
      } catch (e) {
        // Accessing an undefined global should just return 'undefined'; guard in case of restricted access
        return 'error';
      }
    });
    expect(renderPageType).toBe('undefined');

    // Verify there are no interactive form controls or buttons as noted in the FSM extraction_summary
    const interactiveCount = await page.evaluate(() => {
      return document.querySelectorAll('button,input,select,textarea').length;
    });
    expect(interactiveCount).toBe(0);
  });

  test('No transitions/events: interacting with the page does not trigger new errors or state changes', async ({ page }) => {
    // Capture errors and console errors before and after interaction
    const pageErrors1 = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.message || err)));
    const consoleErrors1 = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Record counts after initial load
    await page.waitForTimeout(200);
    const initialPageErrorCount = pageErrors.length;
    const initialConsoleErrorCount = consoleErrors.length;

    // Attempt to simulate a user interaction on the chart element (click). The FSM indicates no events/transitions exist.
    const chart = page.locator('#chart');
    // Action may be a no-op; ensure it does not produce additional runtime exceptions
    await chart.click({ timeout: 1000 }).catch(() => {
      // If click fails (e.g., element not clickable), that's acceptable; we will still assert no new errors were introduced.
    });

    // Wait briefly for any new errors that might arise from interaction
    await page.waitForTimeout(200);

    expect(pageErrors.length).toBe(initialPageErrorCount);
    expect(consoleErrors.length).toBe(initialConsoleErrorCount);

    // Also verify that clicking did not change the label/value content (no transitions)
    const labelText = await page.locator('#label').innerText().catch(() => '');
    const valueText = await page.locator('#value').innerText().catch(() => '');
    expect(labelText).toBe('');
    expect(valueText).toBe('');
  });

  test('Edge case: confirm that the script executed before DOM nodes and caused null access (detectable via error messages)', async ({ page }) => {
    // Collect pageerror events specifically to check for null-access pattern
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err?.message || err)));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Allow time for errors to surface
    await page.waitForTimeout(200);

    // At least one error should mention accessing properties of null or undefined (due to getElementById returning null)
    const anyMatches = errors.some(msg =>
      /cannot read properties of null/i.test(msg) ||
      /cannot read property 'getContext' of null/i.test(msg) ||
      /getContext is not a function/i.test(msg) ||
      /Chart is not defined/i.test(msg)
    );

    expect(anyMatches).toBeTruthy();
  });
});