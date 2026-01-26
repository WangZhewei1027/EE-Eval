import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b3a883-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to SQL (Application ID: f0b3a883-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset captured errors for each test
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Basic sanity: unless the test expects errors, there should be no console/page errors.
    // Specific tests may assert otherwise; those tests will handle their own expectations.
  });

  test.describe('State S0_Idle (Initial State)', () => {
    test('Initial render shows "Run Demo Query" button and demo output is hidden', async ({ page }) => {
      // Validate presence of the Run Demo Query button (evidence for S0_Idle)
      const runButton = page.locator("button[onclick='runDemo()']");
      await expect(runButton).toHaveCount(1);
      await expect(runButton).toBeVisible();
      await expect(runButton).toHaveText(/Run Demo Query/);

      // Validate #demoOutput exists and is initially hidden (display: none)
      const demoOutput = page.locator('#demoOutput');
      await expect(demoOutput).toHaveCount(1);
      const initialDisplay = await demoOutput.evaluate(el => getComputedStyle(el).display);
      expect(initialDisplay).toBe('none');

      // Ensure the runDemo function exists on the window (it's expected for the transition)
      const runDemoExists = await page.evaluate(() => typeof window.runDemo === 'function');
      expect(runDemoExists).toBe(true);

      // No console errors or page errors should have occurred on initial load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Missing entry action renderPage() is NOT defined and calling it throws ReferenceError', async ({ page }) => {
      // The FSM declares an entry action renderPage() for S0_Idle, but the implementation does not define it.
      // This test ensures that attempting to call renderPage() in the page context results in a ReferenceError naturally.
      // We do not patch or define renderPage(); we let the runtime throw and assert that it does.

      // Attempt to evaluate renderPage() in page context and expect it to reject with a ReferenceError.
      const evalPromise = page.evaluate(() => {
        // Intentionally call the missing function to allow the ReferenceError to occur naturally.
        // This error will be propagated to the test runner.
        // Do NOT define renderPage anywhere.
        return renderPage();
      });

      // Playwright's expect can assert promise rejection
      await expect(evalPromise).rejects.toThrow(/renderPage is not defined|ReferenceError/);

      // The pageerror event should capture the ReferenceError as well (at least one page error expected)
      // We give a short delay to ensure pageerror handlers have time to run
      await page.waitForTimeout(50);
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const hasRenderPageError = pageErrors.some(msg => /renderPage/i.test(msg) || /ReferenceError/i.test(msg));
      expect(hasRenderPageError).toBe(true);
    });
  });

  test.describe('Transition: RunDemo (S0_Idle -> S1_DemoRunning)', () => {
    test('Clicking the Run Demo Query button triggers runDemo(), displays demo output, and shows expected rows', async ({ page }) => {
      const runButton = page.locator("button[onclick='runDemo()']");
      const demoOutput = page.locator('#demoOutput');

      // Precondition: output hidden
      const preDisplay = await demoOutput.evaluate(el => getComputedStyle(el).display);
      expect(preDisplay).toBe('none');

      // Click the button to trigger the transition and entry action runDemo()
      await runButton.click();

      // After click: demoOutput should be visible (evidence of S1_DemoRunning)
      await expect(demoOutput).toBeVisible();
      const displayAfter = await demoOutput.evaluate(el => getComputedStyle(el).display);
      expect(displayAfter).toBe('block');

      // The demo HTML should contain the query header and a table with the results
      const html = await demoOutput.innerHTML();
      expect(html).toContain('SELECT first_name, last_name FROM employees WHERE salary > 70000 ORDER BY last_name');
      expect(html).toContain('<table>');
      expect(html).toContain('Returned');

      // Verify the returned rows count text
      const returnedText = await demoOutput.locator('p').last().innerText();
      expect(returnedText).toMatch(/Returned\s*2\s*rows/i);

      // Verify table rows: header + 2 data rows -> total 3 <tr>
      const rows = demoOutput.locator('table tr');
      await expect(rows).toHaveCount(3);

      // Verify ordering: results are sorted by last_name ascending; expected: Jane Doe then John Smith
      const firstDataRowTds = rows.nth(1).locator('td');
      const secondDataRowTds = rows.nth(2).locator('td');
      await expect(firstDataRowTds.nth(0)).toHaveText('Jane'); // first_name of first result
      await expect(firstDataRowTds.nth(1)).toHaveText('Doe');  // last_name of first result
      await expect(secondDataRowTds.nth(0)).toHaveText('John'); // first_name of second result
      await expect(secondDataRowTds.nth(1)).toHaveText('Smith'); // last_name of second result

      // Ensure no console or page errors were emitted during this normal transition
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking the Run Demo Query button multiple times remains idempotent and does not duplicate results', async ({ page }) => {
      const runButton = page.locator("button[onclick='runDemo()']");
      const demoOutput = page.locator('#demoOutput');

      // First click
      await runButton.click();
      await expect(demoOutput).toBeVisible();
      const rowsAfterFirst = await demoOutput.locator('table tr').count();
      expect(rowsAfterFirst).toBe(3); // header + 2 data rows

      // Store innerHTML after first click
      const htmlAfterFirst = await demoOutput.innerHTML();

      // Second click - should re-render same content (not append)
      await runButton.click();
      await expect(demoOutput).toBeVisible();
      const rowsAfterSecond = await demoOutput.locator('table tr').count();
      expect(rowsAfterSecond).toBe(3); // still header + 2 data rows

      const htmlAfterSecond = await demoOutput.innerHTML();
      expect(htmlAfterSecond).toBe(htmlAfterFirst); // identical content, confirming idempotency

      // No console or page errors should be introduced by repeated clicks
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('runDemo() exists and is callable directly from page context', async ({ page }) => {
      // Confirm runDemo is a function and calling it returns undefined (it manipulates DOM)
      const isFunction = await page.evaluate(() => typeof window.runDemo === 'function');
      expect(isFunction).toBe(true);

      // Call runDemo directly from the page context to ensure the function executes without throwing
      // It returns undefined; we assert the call does not throw.
      await page.evaluate(() => {
        // The function modifies DOM; do not intercept or redefine anything.
        runDemo();
      });

      // After calling, demoOutput should be visible and populated
      const demoOutput = page.locator('#demoOutput');
      await expect(demoOutput).toBeVisible();
      const rows = demoOutput.locator('table tr');
      await expect(rows).toHaveCount(3);

      // No unexpected console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Attempting to call a clearly non-existent function produces a ReferenceError (observed naturally)', async ({ page }) => {
      // This test intentionally invokes a missing global to allow a ReferenceError to occur naturally.
      // We don't patch or define the function; we let the runtime produce the error and assert it happens.
      const missingCall = page.evaluate(() => {
        // eslint-disable-next-line no-undef
        return definitelyDoesNotExist12345();
      });

      await expect(missingCall).rejects.toThrow(/is not defined|ReferenceError/);

      // Allow some time for the pageerror event to be emitted and captured
      await page.waitForTimeout(50);
      const hasRefError = pageErrors.some(msg => /is not defined|ReferenceError/i.test(msg));
      expect(hasRefError).toBe(true);
    });
  });
});