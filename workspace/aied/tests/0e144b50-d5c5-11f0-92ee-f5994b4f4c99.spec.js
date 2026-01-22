import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e144b50-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Deque Example (FSM: Idle state) - End-to-end checks', () => {
  // Arrays to collect runtime diagnostics for each test
  let consoleErrors = [];
  let consoleWarnings = [];
  let pageErrors = [];

  // Attach listeners before navigation so we capture errors during script execution
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];
    pageErrors = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      if (type === 'warning') consoleWarnings.push(text);
    });

    page.on('pageerror', error => {
      // error is an Error object from the page context
      pageErrors.push(error);
    });
  });

  // Test: Idle state should render the deque container and entry action should be attempted
  test('S0_Idle: page loads and #deque element is present; entry action (renderPage) is attempted', async ({ page }) => {
    // Navigate to the page and wait for load to finish
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Validate that the deque container exists in the DOM per FSM evidence
    const deque = page.locator('#deque');
    await expect(deque).toHaveCount(1);
    // The deque element might be empty; verify it is at least present in the DOM
    const dequeHTML = await deque.evaluate(el => el.outerHTML);
    expect(dequeHTML).toContain('id="deque"');

    // Collect all textual diagnostics from page errors and console errors/warnings
    const pageErrorMessages = pageErrors.map(e => (e && e.message) || String(e));
    const consoleErrorMessages = consoleErrors.slice();
    const consoleWarningMessages = consoleWarnings.slice();
    const combined = [...pageErrorMessages, ...consoleErrorMessages, ...consoleWarningMessages];

    // The FSM's entry action lists renderPage(), which may be invoked by script.js.
    // We must observe the runtime to see if an attempt was made. If renderPage is missing,
    // browsers typically emit a ReferenceError. Capture that behavior.
    // Per test instructions we must observe and assert that runtime errors (ReferenceError/SyntaxError/TypeError)
    // happen naturally if they do. This assertion expects at least one diagnostic message to exist.
    expect(combined.length).toBeGreaterThan(0);

    // Assert that at least one diagnostic references common JS error types or the renderPage identifier.
    const hasExpectedDiagnostic = combined.some(msg =>
      /ReferenceError|TypeError|SyntaxError|renderPage/.test(msg)
    );
    expect(hasExpectedDiagnostic).toBeTruthy();
  });

  // Test: There are no interactive elements (buttons/inputs/links) present as extracted by FSM
  test('FSM expectation: no interactive elements (no buttons, inputs, links) present in DOM', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Query for interactive controls that would typically drive transitions
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input, textarea, select').count();
    const links = await page.locator('a').count();

    // The FSM extraction summary indicated no interactive elements; assert counts are zero
    expect(buttons).toBe(0);
    expect(inputs).toBe(0);
    expect(links).toBe(0);
  });

  // Test: Capture script loading problems or resource errors reported via console (edge case)
  test('Edge case: script/resource load issues and console errors are captured', async ({ page }) => {
    // Some failures (like 404 for script.js) may only appear as console error messages rather than pageerror.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // We expect some console-level diagnostics to be present (network errors or JS runtime errors)
    // Combine console errors/warnings and pageErrors
    const combinedCount = consoleErrors.length + consoleWarnings.length + pageErrors.length;
    expect(combinedCount).toBeGreaterThan(0);

    // If there are console errors, ensure at least one mentions either the missing script or a JS error
    const combinedTexts = [
      ...consoleErrors,
      ...consoleWarnings,
      ...pageErrors.map(e => (e && e.message) || String(e))
    ];
    const detected = combinedTexts.some(t => /script\.js|renderPage|ReferenceError|TypeError|SyntaxError|Failed to load resource/.test(t));
    expect(detected).toBeTruthy();
  });

  // Test: Reloading the page should reproduce or surface errors consistently (robustness check)
  test('Reload: repeated loads reproduce runtime diagnostics (if present)', async ({ page }) => {
    // First load
    await page.goto(APP_URL, { waitUntil: 'load' });

    const firstDiagnostics = [
      ...consoleErrors,
      ...consoleWarnings,
      ...pageErrors.map(e => (e && e.message) || String(e))
    ];

    // Clear collectors and reload to capture second run diagnostics
    consoleErrors = [];
    consoleWarnings = [];
    pageErrors = [];

    await page.reload({ waitUntil: 'load' });

    const secondDiagnostics = [
      ...consoleErrors,
      ...consoleWarnings,
      ...pageErrors.map(e => (e && e.message) || String(e))
    ];

    // At least one of the loads should produce diagnostics (per test instructions, we assert errors occur)
    const combinedAny = [...firstDiagnostics, ...secondDiagnostics];
    expect(combinedAny.length).toBeGreaterThan(0);

    // If the first run had an error referencing renderPage, ensure the second run also mentions it or other JS errors.
    const hasRenderPageOrJS = combinedAny.some(t => /renderPage|ReferenceError|TypeError|SyntaxError/.test(t));
    expect(hasRenderPageOrJS).toBeTruthy();
  });
});