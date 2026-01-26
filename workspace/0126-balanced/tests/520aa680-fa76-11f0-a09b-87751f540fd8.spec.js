import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520aa680-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Application 520aa680-fa76-11f0-a09b-87751f540fd8 - Transaction Example (FSM: Idle)', () => {
  // Arrays to capture console errors and page uncaught exceptions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // A small sanity read to keep page open until listeners processed.
    // Nothing to teardown explicitly — Playwright fixtures handle cleanup.
    await page.waitForTimeout(50);
  });

  test('Idle state: entry actions are invoked (displayTransactionDetails executed; displayTransactionHistory triggers runtime error)', async ({ page }) => {
    // This test validates the FSM Idle state's entry actions described in the FSM:
    // - displayTransactionDetails() should run and populate the first .transaction block
    // - displayTransactionHistory() is invoked but known to throw a TypeError (date is a string in history)
    //
    // We assert:
    //  - The first .transaction contains expected transaction details text set by displayTransactionDetails
    //  - The second .transaction retains the original static Transaction History block (since scripted history building failed)
    //  - A page error (TypeError) was emitted and a console error was logged mentioning toLocaleDateString or 'is not a function'

    // Verify the first .transaction block contains transaction detail fragments
    const firstTransaction = page.locator('.transaction').first();
    await expect(firstTransaction).toContainText('Transaction Details');
    await expect(firstTransaction).toContainText('Transaction ID: 12345');
    await expect(firstTransaction).toContainText('Transaction Amount: $100.00');
    await expect(firstTransaction).toContainText('Transaction Currency: USD');
    await expect(firstTransaction).toContainText('Transaction Time: 12:00 AM');

    // Verify the second .transaction block is the static Transaction History from HTML (unchanged)
    const secondTransaction = page.locator('.transaction').nth(1);
    await expect(secondTransaction).toContainText('Transaction History');
    await expect(secondTransaction).toContainText('Transaction 1: 2022-01-01');
    await expect(secondTransaction).toContainText('Transaction 2: 2022-01-02');
    await expect(secondTransaction).toContainText('Transaction 3: 2022-01-03');

    // Verify there are no interactive elements (as noted in FSM extraction summary)
    const buttonCount = await page.locator('button').count();
    const inputCount = await page.locator('input').count();
    await expect(buttonCount).toBe(0);
    await expect(inputCount).toBe(0);

    // Validate that an uncaught page error occurred (expected TypeError from displayTransactionHistory)
    // The implementation attempts to call toLocaleDateString on a string, which should throw.
    await expect(pageErrors.length).toBeGreaterThan(0);
    const pageErrorMessages = pageErrors.map(e => e?.message || String(e));
    // Assert at least one error message references toLocaleDateString or 'is not a function'
    const matches = pageErrorMessages.some(msg => /toLocaleDateString|is not a function/i.test(msg));
    expect(matches).toBeTruthy();

    // Validate at least one console error was emitted that mentions the toLocaleDateString issue
    const consoleTexts = consoleErrors.map(msg => msg.text());
    const consoleMatches = consoleTexts.some(text => /toLocaleDateString|is not a function/i.test(text));
    expect(consoleMatches).toBeTruthy();
  });

  test('Runtime functions exist on window and invoking displayTransactionHistory throws TypeError', async ({ page }) => {
    // This test checks that the two display functions are defined (as per the entry actions),
    // and that invoking displayTransactionHistory manually triggers a runtime error (TypeError).
    //
    // We intentionally allow the error to surface via page.evaluate and assert that the promise rejects
    // with an error message that matches the expected runtime failure.

    // Ensure functions are present
    const types = await page.evaluate(() => {
      return {
        detailsType: typeof displayTransactionDetails,
        historyType: typeof displayTransactionHistory
      };
    });
    expect(types.detailsType).toBe('function');
    expect(types.historyType).toBe('function');

    // Attempt to call displayTransactionHistory and assert it throws a runtime error.
    // Playwright's page.evaluate will reject if the function throws, which we assert.
    await expect(page.evaluate(() => {
      // call without try/catch so it propagates as an exception
      return displayTransactionHistory();
    })).rejects.toThrow(/toLocaleDateString|is not a function/i);

    // After intentionally invoking it, we should have at least one more page error recorded.
    // Wait a tick to ensure event handlers processed
    await page.waitForTimeout(50);
    const sawError = pageErrors.some(e => /toLocaleDateString|is not a function/i.test(e?.message || ''));
    expect(sawError).toBeTruthy();
  });

  test('Edge cases: re-running displayTransactionDetails does not throw and updates DOM as expected', async ({ page }) => {
    // This validates idempotence/behavior for re-invoking displayTransactionDetails:
    // - it should be a safe operation and should update the first .transaction block
    // - it should NOT throw an error when run again

    // Call displayTransactionDetails via page.evaluate and ensure it resolves
    await page.evaluate(() => {
      // call the function; if it throws, evaluate will reject
      displayTransactionDetails();
    });

    // Verify the first .transaction still contains the expected details after re-run
    const firstTransaction = page.locator('.transaction').first();
    await expect(firstTransaction).toContainText('Transaction Details');
    await expect(firstTransaction).toContainText('Transaction ID: 12345');
    await expect(firstTransaction).toContainText('Transaction Amount: $100.00');
  });

  test('FSM coverage sanity: there are no transitions/events to trigger (static content)', async ({ page }) => {
    // The FSM extraction indicates no events or transitions. This test asserts that there are
    // no interactive controls and the page behavior is purely static aside from the entry actions.
    //
    // We assert:
    // - no elements with role=button or actual <button> exist
    // - no elements with onclick attributes
    // - no input, select or textarea present

    // Buttons
    const buttons = await page.locator('button, [role="button"]').count();
    expect(buttons).toBe(0);

    // Inputs
    const inputs = await page.locator('input, select, textarea').count();
    expect(inputs).toBe(0);

    // Elements with inline onclick handlers
    const onclickCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => el.getAttribute && el.getAttribute('onclick')).length;
    });
    expect(onclickCount).toBe(0);
  });

  test('Observe and assert console and page error details include helpful context', async ({ page }) => {
    // This test demonstrates capturing error details for debugging and ensures the captured
    // messages contain useful context (file/line or function name where possible).
    //
    // We assert that either console or pageError messages include 'displayTransactionHistory' or 'toLocaleDateString'

    // Wait briefly to ensure messages are captured
    await page.waitForTimeout(50);

    const consoleTexts = consoleErrors.map(m => m.text()).join('\n');
    const pageErrTexts = pageErrors.map(e => e?.message || '').join('\n');

    // At least one of the aggregated logs should reference the failing function or method
    const combined = (consoleTexts + '\n' + pageErrTexts).toLowerCase();
    const hasContext = /displaytransactionhistory|tolocaledatestring|is not a function/.test(combined);
    expect(hasContext).toBeTruthy();
  });
});