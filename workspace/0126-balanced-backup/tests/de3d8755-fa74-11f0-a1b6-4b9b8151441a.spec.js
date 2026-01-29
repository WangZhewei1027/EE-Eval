import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d8755-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Refactoring Demonstration - FSM states and transitions', () => {
  // Arrays to collect console messages and page errors for inspection in tests
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages from the page
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Load the page as-is and wait until basic DOM is ready
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({}, testInfo) => {
    // When a test fails, include captured console and page errors in the output for debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      for (const msg of consoleMessages) {
        console.log('Console:', msg);
      }
      for (const err of pageErrors) {
        console.log('PageError:', err && err.stack ? err.stack : String(err));
      }
    }
  });

  test('Initial Idle state: buttons present and result containers empty', async ({ page }) => {
    // Validate idle state: both Run buttons exist and result divs are empty
    // This corresponds to FSM state S0_Idle (entry_actions: renderPage() - not present in DOM)
    const originalButton = await page.$("button[onclick='runOriginal()']");
    const refactoredButton = await page.$("button[onclick='runRefactored()']");
    expect(originalButton).not.toBeNull();
    expect(refactoredButton).not.toBeNull();

    // Buttons should be visible and have expected text
    await expect(page.locator("button[onclick='runOriginal()']")).toHaveText('Run Original');
    await expect(page.locator("button[onclick='runRefactored()']")).toHaveText('Run Refactored');

    // Result divs initially empty
    const originalText = await page.$eval('#originalResult', (el) => el.textContent.trim());
    const refactoredText = await page.$eval('#refactoredResult', (el) => el.textContent.trim());
    expect(originalText).toBe(''); // Idle: no results yet
    expect(refactoredText).toBe('');
  });

  test('Run Original transition: clicking Run Original updates originalResult (S0_Idle -> S1_Original_Running)', async ({ page }) => {
    // Clicking 'Run Original' should trigger runOriginal() and update #originalResult
    // Expected value based on defined testItems in the page:
    // 50 + 120*0.9 + 80 + 200*0.9 = 418.00
    const expected = 'Total: $418.00 (Original)';

    // Ensure the runOriginal function exists on window and the onclick attribute is set
    const typeofRunOriginal = await page.evaluate(() => typeof runOriginal);
    expect(typeofRunOriginal).toBe('function');

    const onclickAttr = await page.$eval("button[onclick='runOriginal()']", (btn) => btn.getAttribute('onclick'));
    expect(onclickAttr).toBe('runOriginal()');

    // Click the button and wait for the DOM change
    await page.click("button[onclick='runOriginal()']");
    await expect(page.locator('#originalResult')).toHaveText(expected);

    // Ensure refactored result remains unchanged after running original
    await expect(page.locator('#refactoredResult')).toHaveText('');
  });

  test('Run Refactored transition: clicking Run Refactored updates refactoredResult (S0_Idle -> S2_Refactored_Running)', async ({ page }) => {
    // Clicking 'Run Refactored' should trigger runRefactored() and update #refactoredResult
    const expected = 'Total: $418.00 (Refactored)';

    // Ensure the runRefactored function exists on window and onclick attribute is set
    const typeofRunRefactored = await page.evaluate(() => typeof runRefactored);
    expect(typeofRunRefactored).toBe('function');

    const onclickAttr = await page.$eval("button[onclick='runRefactored()']", (btn) => btn.getAttribute('onclick'));
    expect(onclickAttr).toBe('runRefactored()');

    // Click and assert
    await page.click("button[onclick='runRefactored()']");
    await expect(page.locator('#refactoredResult')).toHaveText(expected);

    // Ensure original result remains unchanged if not triggered
    await expect(page.locator('#originalResult')).toHaveText('');
  });

  test('Idempotency and repeated clicks: repeated runs produce consistent results and formatting remains two decimals', async ({ page }) => {
    // Click Run Original twice and ensure same stable result and formatting
    const expectedOriginal = 'Total: $418.00 (Original)';
    await page.click("button[onclick='runOriginal()']");
    await expect(page.locator('#originalResult')).toHaveText(expectedOriginal);

    // Click again
    await page.click("button[onclick='runOriginal()']");
    await expect(page.locator('#originalResult')).toHaveText(expectedOriginal);

    // Click Run Refactored twice similarly
    const expectedRefactored = 'Total: $418.00 (Refactored)';
    await page.click("button[onclick='runRefactored()']");
    await expect(page.locator('#refactoredResult')).toHaveText(expectedRefactored);

    await page.click("button[onclick='runRefactored()']");
    await expect(page.locator('#refactoredResult')).toHaveText(expectedRefactored);
  });

  test('Programmatic invocation of the calculation functions: edge cases and small inputs', async ({ page }) => {
    // Directly call the page's calculateTotalOriginal and calculateTotalRefactored via evaluate
    // Edge case 1: empty list -> 0
    const origEmpty = await page.evaluate(() => calculateTotalOriginal([]));
    expect(origEmpty).toBe(0);

    const refEmpty = await page.evaluate(() => calculateTotalRefactored([]));
    expect(refEmpty).toBe(0);

    // Edge case 2: price exactly 100 -> no discount
    const orig100 = await page.evaluate(() => calculateTotalOriginal([{ name: 'X', price: 100 }]));
    expect(orig100).toBe(100);

    const ref100 = await page.evaluate(() => calculateTotalRefactored([{ name: 'X', price: 100 }]));
    expect(ref100).toBe(100);

    // Edge case 3: high-precision floats - formatting should round to 2 decimals when displayed
    const formatted = await page.evaluate(() => {
      const items = [{ name: 'Y', price: 33.3333 }, { name: 'Z', price: 66.6667 }];
      const res = calculateTotalRefactored(items);
      return res; // numeric value
    });
    // numeric sum should be approximately 100.0000
    expect(Number(formatted.toFixed(4))).toBeCloseTo(100.0000, 4);
  });

  test('FSM entry action verification: renderPage presence (onEnter) and behavior', async ({ page }) => {
    // The FSM description listed an entry_action renderPage() for the Idle state.
    // Verify whether renderPage exists on the window. We must not modify the page.
    // If renderPage is not defined, it indicates the FSM entry_action is not wired in this implementation.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // We expect the implementation DID NOT define renderPage, so type should be 'undefined'
    expect(renderPageType).toBe('undefined');
  });

  test('Monitor console and page errors: no unexpected ReferenceError/SyntaxError/TypeError on load and interactions', async ({ page }) => {
    // After navigation in beforeEach, we perform a few interactions to observe errors
    // Interactions: run both buttons
    await page.click("button[onclick='runOriginal()']");
    await page.click("button[onclick='runRefactored()']");

    // Give a short time for any async errors to surface
    await page.waitForTimeout(100);

    // Inspect collected pageErrors for severe JS runtime issues
    // We assert that there are no uncaught page errors (ReferenceError, TypeError, SyntaxError)
    // If any page error occurred, the test will fail and the afterEach hook will print them.
    expect(pageErrors.length).toBe(0);

    // Also ensure there are no console messages of type 'error' containing typical JS error names
    const errorConsoleMsgs = consoleMessages.filter((m) =>
      m.toLowerCase().includes('error') ||
      m.includes('ReferenceError') ||
      m.includes('TypeError') ||
      m.includes('SyntaxError')
    );
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Accessibility of interactive elements and basic attributes', async ({ page }) => {
    // Ensure result containers have expected class 'result' and are present in DOM
    const originalClass = await page.$eval('#originalResult', (el) => el.className);
    const refactoredClass = await page.$eval('#refactoredResult', (el) => el.className);
    expect(originalClass.split(' ')).toContain('result');
    expect(refactoredClass.split(' ')).toContain('result');

    // Ensure buttons have accessible names (text content)
    await expect(page.locator("button[onclick='runOriginal()']")).toBeVisible();
    await expect(page.locator("button[onclick='runRefactored()']")).toBeVisible();
  });

});