import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b03561-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('B+ Tree FSM - f5b03561-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (log, error, warning, etc.)
    page.on('console', (msg) => {
      const text = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  // Test: initial Idle state - page renders and shows the demo button
  test('S0_Idle: Page renders and contains the "Click to Rebalance and Search" button', async ({ page }) => {
    // Load the page and wait for load event
    const response = await page.goto(APP_URL, { waitUntil: 'load' });
    // Allow scripts to run and collect console/page errors
    await page.waitForTimeout(300);

    // Verify page loaded (response could be null if unavailable)
    expect(response).not.toBeNull();

    // Check the main evidence: the button exists and is visible
    const demoBtn = await page.locator('#demo');
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toHaveText('Click to Rebalance and Search');

    // There should be at least the initial DOM evidence for the Idle state
    // (We do not assert any runtime actions here beyond checking DOM presence)
  });

  // Test: application initialization produces runtime errors (we expect ReferenceError due to missing Node)
  test('Runtime: Page initialization should surface runtime errors (ReferenceError/TypeError) due to broken implementation', async ({ page }) => {
    // Start collecting events before navigation
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a short while to ensure inline scripts run and errors surface
    await page.waitForTimeout(500);

    // We expect at least one page error because the HTML/JS references undefined Node class
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the errors should mention 'Node' or be a ReferenceError
    const hasNodeRef = pageErrors.some(msg => /Node/.test(msg) || /ReferenceError/.test(msg) || /is not defined/.test(msg));
    expect(hasNodeRef).toBeTruthy();

    // Also capture console messages and ensure there are no successful "Key ... found" logs
    const foundKeyLog = consoleMessages.find(m => /Key .* found in the tree\./.test(m));
    expect(foundKeyLog).toBeUndefined();

    // Ensure the demo button is still present despite errors
    const demoBtn = page.locator('#demo');
    await expect(demoBtn).toBeVisible();
  });

  // Test: Clicking the demo button - FSM expects a rebalance and search event, but due to errors this should not complete
  test('Event ClickRebalance: clicking #demo should not complete rebalance/search due to runtime errors; assert no success logs and errors persist', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for initial scripts/errors
    await page.waitForTimeout(300);

    // Record errors/messages count before click
    const errorsBefore = pageErrors.length;
    const consoleBefore = consoleMessages.length;

    // Click the demo button (FSM transition trigger)
    const demoBtn = page.locator('#demo');
    await expect(demoBtn).toBeVisible();
    await demoBtn.click();

    // Allow any click handlers or subsequent errors to surface
    await page.waitForTimeout(300);

    // After clicking, because the implementation is broken, we still expect page errors (same or increased)
    expect(pageErrors.length).toBeGreaterThanOrEqual(errorsBefore);

    // No successful search messages should be present (e.g., "Key banana found in the tree.")
    const foundBanana = consoleMessages.find(m => /Key banana found in the tree\./.test(m));
    const foundCherry = consoleMessages.find(m => /Key cherry found in the tree\./.test(m));
    expect(foundBanana).toBeUndefined();
    expect(foundCherry).toBeUndefined();

    // Ensure no console message indicates a successful rebalance completion
    const rebalanceMsg = consoleMessages.find(m => /rebalance/i.test(m));
    // It's acceptable if there are messages mentioning rebalance only if they are errors; we assert there's no harmless "success" log for rebalance
    if (rebalanceMsg) {
      // If the message exists, ensure it's not a successful info log indicating completion
      expect(/completed|success|done/i.test(rebalanceMsg)).toBeFalsy();
    }
  });

  // Test: FSM final states S2_KeyFound and S3_KeyNotFound should not be reached due to runtime errors during initialization
  test('FSM Final States: ensure Key Found / Key Not Found logs are absent because tree.keys search did not execute', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for scripts to run and possibly throw
    await page.waitForTimeout(400);

    // Collect any matching console messages for key found/not found
    const keyFound = consoleMessages.filter(m => /Key .* found in the tree\./.test(m));
    const keyNotFound = consoleMessages.filter(m => /Key .* not found in the tree\./.test(m));

    // In a correct implementation we might see these logs; given this broken runtime we expect none to appear
    expect(keyFound.length).toBe(0);
    expect(keyNotFound.length).toBe(0);

    // Confirm that page errors prevented reaching final states (at least one error present)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  // Edge case: verify that including an external script (script.js) does not mask the runtime error and that the page still reports errors
  test('Edge Case: presence of external script tag should not suppress earlier runtime errors', async ({ page }) => {
    // Monitor network responses for the external script
    const responses = [];
    page.on('response', (response) => {
      const url = response.url();
      if (url.endsWith('/script.js')) {
        responses.push({ status: response.status(), ok: response.ok(), url });
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForTimeout(400);

    // If a response for script.js was made, capture it; it's acceptable whether 200 or 404,
    // but the earlier ReferenceError should still be present.
    if (responses.length > 0) {
      // Ensure we recorded at least one response for script.js
      expect(responses.length).toBeGreaterThanOrEqual(1);
    }

    // The runtime error from inline script should still be present
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  // Teardown: small verification that no test accidentally suppresses errors by re-defining globals (we did not)
  test('Sanity: ensure pageErrors are real Error messages and console messages captured correctly', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    // pageErrors should contain strings; verify types
    for (const err of pageErrors) {
      expect(typeof err).toBe('string');
      // Ensure they look like typical JS error messages
      expect(err.length).toBeGreaterThan(0);
    }

    // consoleMessages should also be non-empty array (may be empty if no console calls)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});