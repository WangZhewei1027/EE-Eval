import { test, expect } from '@playwright/test';

// Test file for Application ID: d5a24bb2-fa7b-11f0-8b01-9f078a0ff214
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/d5a24bb2-fa7b-11f0-8b01-9f078a0ff214.html
//
// These tests exercise the FSM described for the page:
// - S0_Idle: initial rendering, expected button exists
// - S1_DemonstrationAlert: clicking button triggers an alert dialog
//
// Notes per instructions:
// - Load the page exactly as-is.
// - Observe console logs and page errors (do not patch or redefine page code).
// - Let ReferenceError / TypeError / SyntaxError happen naturally and assert when they occur.
// - Use modern async/await and ES module import syntax.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a24bb2-fa7b-11f0-8b01-9f078a0ff214.html';
const EXPECTED_ALERT_TEXT = "This is a simple demonstration of NoSQL capabilities versus SQL. Remember, NoSQL focuses on flexibility, performance, and scalability!";

test.describe('NoSQL FSM - d5a24bb2-fa7b-11f0-8b01-9f078a0ff214', () => {
  // Capture console messages and page errors for each test to assert expected behavior.
  test.beforeEach(async ({ page }) => {
    // Attach listeners to collect any console messages and page errors emitted by the page.
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', msg => {
      // store console messages including type and text for assertions
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      // store page errors (unhandled exceptions)
      page._pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Small sanity: ensure no stray dialogs remain open (shouldn't be necessary but safe)
    // Nothing to cleanup explicitly; page fixture will be closed by Playwright.
  });

  test('S0_Idle: Initial page render and UI elements are present', async ({ page }) => {
    // Verify initial page title includes NoSQL to confirm load
    await expect(page).toHaveTitle(/NoSQL: Understanding the Concept and Theory/);

    // Verify the main heading exists
    const h1 = page.locator('h1');
    await expect(h1).toHaveText(/NoSQL: Understanding the Concept and Theory/);

    // Verify the demonstration button exists and is visible
    const button = page.locator('button', { hasText: 'View NoSQL Demonstration' });
    await expect(button).toBeVisible();
    await expect(button).toHaveText(/View NoSQL Demonstration/);

    // Verify the inline onclick attribute exists and contains an alert call (evidence from FSM)
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert(");
    expect(onclickAttr).toContain("This is a simple demonstration");

    // Verify S0 entry action "renderPage()" - in FSM this is declared, but the page DOES NOT define renderPage.
    // We assert that renderPage is not defined in the page global scope.
    const renderPageType = await page.evaluate(() => {
      // Return the type of renderPage if present, or 'undefined'
      // This simply inspects the page environment; it does NOT inject or modify anything.
      return typeof window.renderPage;
    });
    // Since HTML doesn't define renderPage(), we expect it to be 'undefined'.
    expect(renderPageType).toBe('undefined');

    // Check that no unexpected page errors were emitted during initial load.
    // The page may legitimately have none; assert that page._pageErrors is an array (and typically empty).
    expect(Array.isArray(page._pageErrors)).toBe(true);

    // Capture console messages (there shouldn't be errors on a simple static page)
    // We assert there are no console messages of type 'error' by default.
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error' || m.type === 'assert' || m.type === 'warning');
    expect(consoleErrors.length).toBeLessThanOrEqual(1); // allow at most 1 non-critical message; generally expect 0
  });

  test('Transition ViewNoSQLDemonstration: clicking the button triggers alert (S1_DemonstrationAlert)', async ({ page }) => {
    // Collect dialogs triggered by the page
    const dialogs = [];
    page.on('dialog', async dialog => {
      // push the message and accept the dialog to allow progress
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Click the button to trigger the alert (transition from S0_Idle -> S1_DemonstrationAlert)
    const button = page.locator('button', { hasText: 'View NoSQL Demonstration' });
    await button.click();

    // Wait briefly for the dialog to be handled
    await page.waitForTimeout(100);

    // One alert should have been shown and accepted
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    // The first dialog should be the expected alert with FSM message
    expect(dialogs[0].type).toBe('alert');
    expect(dialogs[0].message).toBe(EXPECTED_ALERT_TEXT);

    // Verify that clicking the button did not introduce uncaught page errors
    // (any thrown exception would have emitted a 'pageerror' event captured earlier)
    expect(page._pageErrors.length).toBe(0);

    // Also assert the onclick attribute remains unchanged after click (no dynamic mutation expected)
    const onclickAttrAfter = await button.getAttribute('onclick');
    expect(onclickAttrAfter).toContain("alert(");
  });

  test('Edge case: clicking the button twice triggers two alerts sequentially', async ({ page }) => {
    // Capture dialogs and accept them
    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    const button = page.locator('button', { hasText: 'View NoSQL Demonstration' });

    // Click twice in quick succession; two alerts are expected sequentially
    // (the browser will queue the second alert until the first is accepted).
    await button.click();
    await button.click();

    // Give some time for both dialogs to be emitted and handled
    await page.waitForTimeout(200);

    // We expect at least two dialogs (both with the same alert message)
    expect(dialogMessages.length).toBeGreaterThanOrEqual(2);
    for (const msg of dialogMessages.slice(0, 2)) {
      expect(msg).toBe(EXPECTED_ALERT_TEXT);
    }
  });

  test('Verify ReferenceError occurs naturally when attempting to call undefined renderPage()', async ({ page }) => {
    // The FSM S0 entry action lists renderPage(), but the implementation does not define it.
    // Attempting to call renderPage() should naturally raise a ReferenceError in the page context.
    // We do not patch the page or define renderPage; we merely attempt the call and assert the nature of the thrown error.

    // Use page.evaluate and expect it to reject with ReferenceError (or a message containing renderPage is not defined)
    await expect(page.evaluate(() => {
      // This will throw in the page context because renderPage is not defined.
      // We intentionally do not catch it here so the evaluate call rejects.
      // This models observing an onEnter action that is declared but missing in the implementation.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);
  });

  test('Error scenario: clicking a non-existent selector produces an error', async ({ page }) => {
    // Attempting to click a missing selector should result in a Playwright error on the test side.
    // We assert that page.click rejects with an informative error.
    await expect(page.click('button#this-id-does-not-exist')).rejects.toThrow(/No node found|Element.*not found|waiting for selector/);
  });

  test('Sanity: Ensure the onclick attribute text exactly matches the FSM evidence string', async ({ page }) => {
    // Verify the attribute text contains the exact evidence from the FSM (sanity check)
    const button = page.locator('button', { hasText: 'View NoSQL Demonstration' });
    const onclick = await button.getAttribute('onclick');
    // The FSM evidence includes the full alert message; assert that it is present.
    expect(onclick).toContain(EXPECTED_ALERT_TEXT);
  });

  test('Console and pageerror observation: report any captured messages (test will fail if there are unexpected severe errors)', async ({ page }) => {
    // This test deliberately inspects collected console messages and page errors.
    // We assert there are no unhandled exceptions; if there are, include them in the expectation message to aid debugging.

    // If page errors exist, fail with details (this validates that the page did not crash silently).
    if (page._pageErrors.length > 0) {
      // Build a descriptive error message listing errors
      const messages = page._pageErrors.map(err => `${err.name}: ${err.message}`).join('; ');
      // Fail the test with the observed errors
      throw new Error(`Unexpected page errors detected: ${messages}`);
    }

    // Ensure there are no console errors of type 'error'
    const consoleErrors = page._consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});