import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2cd70-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('f5b2cd70-fa7c-11f0-adc7-178f556b1ee0 - Query Optimization FSM tests', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Hook to run before each test: prepare fresh arrays and navigate to the page,
  // while listening to console and pageerror events so we can assert on them.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console events
    page.on('console', msg => {
      // record type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors
    page.on('pageerror', error => {
      // record full error message
      pageErrors.push(error);
    });

    // Navigate to the app URL
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
  });

  // Basic cleanup - no special teardown required as Playwright test runner handles pages.

  test('S0_Idle: initial Idle state renders button and static content', async ({ page }) => {
    // This test validates the Idle state evidence:
    // - The button #query-optimization-demo exists, is visible, and has correct text.
    // - The descriptive content is present.
    // - There are no unexpected page errors on initial render.

    // Verify the button exists and is visible
    const button = page.locator('#query-optimization-demo');
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Click to Demonstrate Query Optimization');

    // Verify some static explanatory content exists (evidence of the page render)
    const header = page.locator('.text-explanation h2');
    await expect(header).toHaveText('Query Optimization');

    // Ensure no unhandled page errors occurred on load
    // If errors occurred, they will be present in pageErrors array.
    expect(pageErrors.length).toBe(0);

    // Ensure no console log entries were produced on load (implementation logs only on click)
    // We assert that no 'Query optimization technique demonstrated!' log exists before click.
    const foundDemoLogOnLoad = consoleMessages.some(m => m.text.includes('Query optimization technique demonstrated!'));
    expect(foundDemoLogOnLoad).toBeFalsy();
  });

  test('Transition ClickDemonstrate: clicking the button moves to Demonstration and logs message', async ({ page }) => {
    // This test validates the transition:
    // - User clicks #query-optimization-demo
    // - Console.log("Query optimization technique demonstrated!") is produced (S1 entry action)
    // - No unexpected page errors are thrown during/after the click
    // - DOM remains stable (button still present)

    const button = page.locator('#query-optimization-demo');
    await expect(button).toBeVisible();

    // Click the button once and wait briefly for console event to be emitted
    await button.click();
    // small wait to ensure console listeners capture logs
    await page.waitForTimeout(100);

    // Check that the console captured the expected demonstration message
    const demoLogs = consoleMessages.filter(m => m.text === 'Query optimization technique demonstrated!' && m.type === 'log');
    expect(demoLogs.length).toBeGreaterThanOrEqual(1);

    // Ensure no unhandled errors occurred as a result of the click
    expect(pageErrors.length).toBe(0);

    // Verify the button still exists (no navigation or DOM removal expected)
    await expect(button).toBeVisible();

    // Click again to assert repeated transition/log behavior (edge case: multiple clicks)
    await button.click();
    await page.waitForTimeout(100);

    const demoLogsAfterSecondClick = consoleMessages.filter(m => m.text === 'Query optimization technique demonstrated!' && m.type === 'log');
    // There should be at least two such log entries now (one per click)
    expect(demoLogsAfterSecondClick.length).toBeGreaterThanOrEqual(2);
  });

  test('FSM actions verification: S1 entry_action observed, and S0 entry_action absence noted', async ({ page }) => {
    // This test ensures:
    // - The S1 entry action (console.log) is observable when triggering ClickDemonstrate
    // - If FSM mentions an S0 entry_action (renderPage), but it's not defined in the page,
    //   we detect that it is not present on the global window (we do NOT call or define it).

    // Confirm renderPage is not defined on window (S0 entry_action mentioned in FSM but
    // not implemented in the provided HTML). We check presence without modifying environment.
    const hasRenderPage = await page.evaluate(() => {
      // Read-only check: returns boolean whether renderPage is defined
      return typeof window.renderPage !== 'undefined';
    });
    // We expect renderPage to be undefined given the implementation provided.
    expect(hasRenderPage).toBe(false);

    // Now trigger the demonstration to observe S1 console.log
    const button = page.locator('#query-optimization-demo');
    await button.click();
    await page.waitForTimeout(100);

    // Validate the log exists
    const found = consoleMessages.find(m => m.text === 'Query optimization technique demonstrated!' && m.type === 'log');
    expect(found).toBeTruthy();

    // Assert that there were no pageerrors such as ReferenceError, SyntaxError or TypeError thrown automatically.
    // If pageErrors is non-empty, include their messages in assertion failure for debugging.
    if (pageErrors.length > 0) {
      const messages = pageErrors.map(e => e.message).join(' | ');
      // Fail the test with the aggregated messages so issues are visible in test output
      expect(pageErrors.length, `Unexpected page errors: ${messages}`).toBe(0);
    } else {
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Edge case: rapid multi-click stress test produces multiple logs and no errors', async ({ page }) => {
    // This test performs a rapid sequence of clicks to ensure the event handler is robust.
    const button = page.locator('#query-optimization-demo');
    await expect(button).toBeVisible();

    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      await button.click();
    }

    // small wait to allow all console events to be processed
    await page.waitForTimeout(200);

    // Count matching logs
    const demoLogCount = consoleMessages.filter(m => m.text === 'Query optimization technique demonstrated!' && m.type === 'log').length;
    expect(demoLogCount).toBeGreaterThanOrEqual(clicks);

    // Ensure no page errors were produced during the rapid clicking
    expect(pageErrors.length).toBe(0);
  });

  test('Error observation test: capture and report any ReferenceError/SyntaxError/TypeError if they occur naturally', async ({ page }) => {
    // This test is explicitly meant to observe runtime errors if they happen naturally.
    // We do not inject or modify global scope; we merely assert the presence or absence of such errors.

    // Trigger the known action that logs to the console
    await page.locator('#query-optimization-demo').click();
    await page.waitForTimeout(100);

    // Inspect any captured page errors for ReferenceError, SyntaxError, or TypeError
    const errorTypes = pageErrors.map(e => {
      // Use name property if available, fallback to parsing message
      return e.name || (e.message && e.message.split(':')[0]) || 'UnknownError';
    });

    // If any of these specific error types exist, fail the test while showing their messages.
    const problematic = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError' ||
      (e.message && (e.message.includes('ReferenceError') || e.message.includes('SyntaxError') || e.message.includes('TypeError')))
    );

    // The implementation as provided should not throw these errors; assert none present.
    // If problematic errors exist, include the messages to help debugging.
    if (problematic.length > 0) {
      const details = problematic.map(e => `${e.name}: ${e.message}`).join(' | ');
      expect(problematic.length, `Detected runtime errors: ${details}`).toBe(0);
    } else {
      expect(problematic.length).toBe(0);
    }
  });
});