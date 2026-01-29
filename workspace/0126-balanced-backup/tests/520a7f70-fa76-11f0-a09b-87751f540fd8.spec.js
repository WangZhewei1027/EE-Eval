import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a7f70-fa76-11f0-a09b-87751f540fd8.html';

test.describe('520a7f70-fa76-11f0-a09b-87751f540fd8 - SQL Demo (FSM S0_Initial)', () => {

  // Validate the static initial UI elements described by the FSM state S0_Initial.
  test('Initial State: page renders title, heading and descriptive paragraph', async ({ page }) => {
    // Navigate to the page
    await page.goto(URL);

    // The page title should match the FSM evidence
    await expect(page).toHaveTitle('SQL Demo');

    // The H1 heading should be present and match expected text
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('SQL Demo');

    // The paragraph describing the connection should be present
    const p = page.locator('p');
    await expect(p).toHaveCount(1);
    await expect(p).toHaveText('Connecting to a SQLite Database');
  });

  // Verify that the inline script produces a runtime ReferenceError because "SQLite" is not defined.
  // We attach console and pageerror listeners before navigation so we capture events emitted during script execution.
  test('Script runtime error: ReferenceError for missing SQLite is emitted as a pageerror', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', msg => {
      // Collect console messages for later assertions
      // Convert arguments into a single string for easier matching
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Wait for the first pageerror which is expected due to "new SQLite.Database(...)" in the inline script.
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Trigger navigation after listeners are attached
    await page.goto(URL);

    // Await the pageerror event
    const error = await pageErrorPromise;

    // The thrown error should be a ReferenceError originating from the missing SQLite global
    expect(error).toBeInstanceOf(Error);
    // Message often contains "SQLite is not defined" in browsers; be permissive with matching
    expect(error.message).toMatch(/SQLite is not defined|SQLite is undefined|SQLite is not defined/i);

    // Ensure that the page still rendered the static content despite the runtime error
    await expect(page.locator('h1')).toHaveText('SQL Demo');
    await expect(page.locator('p')).toHaveText('Connecting to a SQLite Database');

    // Confirm that no console.log printed the inserted email (since DB operations didn't succeed due to the error)
    // This is an edge-assertion: we expect that application did not successfully log rows containing the inserted email.
    const anyLoggedEmail = consoleMessages.some(msg => /john\.doe@example\.com|john\.doe2@example\.com/i.test(msg));
    expect(anyLoggedEmail).toBeFalsy();
  });

  // The FSM entry action mentions renderPage(). Verify that renderPage is not defined on the page,
  // and that attempting to call it results in a ReferenceError in the page context.
  test('Entry action renderPage(): not defined and calling it surfaces ReferenceError', async ({ page }) => {
    // Attach a handler to capture any pageerrors caused by our intentional call
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    // Navigate to the page to establish baseline state
    await page.goto(URL);

    // Verify that the global renderPage is not defined on window
    const hasRenderPage = await page.evaluate(() => {
      return typeof window.renderPage !== 'function';
    });
    expect(hasRenderPage).toBe(true); // true means renderPage is NOT a function / not defined

    // Intentionally call renderPage via page.evaluate and assert it rejects with ReferenceError
    // This lets us observe a natural ReferenceError in the page runtime (as required).
    await expect(page.evaluate(() => {
      // This will throw in the page context if renderPage is not defined.
      // We do not catch it here so the promise rejects and Playwright surfaces the error for the assertion.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|renderPage is undefined|undefined is not a function/i);

    // Ensure the pageerror event was recorded by the page (the thrown ReferenceError should have been emitted)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors[0].message).toMatch(/renderPage is not defined|renderPage is undefined/i);
  });

  // FSM defines no transitions and the HTML shows no interactive controls. Assert no interactive elements exist.
  test('No transitions: verify there are no interactive elements (buttons, inputs, selects, etc.) to trigger transitions', async ({ page }) => {
    await page.goto(URL);

    // Look for common interactive elements
    const interactiveLocator = page.locator('button, input, textarea, select, [role="button"], a[href]');
    // a[href] is included but may be present in other apps; in this HTML there should be none.
    const count = await interactiveLocator.count();
    // The implementation contains no interactive UI elements by design; assert count is 0.
    expect(count).toBe(0);
  });

  // Edge case: If the inline script threw early, later operations like console.log(rows) wouldn't execute.
  // We assert that the "rows" output was not logged and that no success messages indicating DB work exist.
  test('Edge case: no DB operation success logs are present due to early runtime failure', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', msg => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Navigate and wait for the expected runtime error to ensure script executed
    const pageErrorPromise = page.waitForEvent('pageerror');
    await page.goto(URL);
    await pageErrorPromise;

    // After the error, inspect collected console messages for any sign of successful DB operations
    const loggedRows = consoleMessages.some(msg => /\[.*\]/.test(msg) || /John Doe|john\.doe@example\.com|john\.doe2@example\.com/i.test(msg));
    expect(loggedRows).toBeFalsy();
  });

});