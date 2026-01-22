import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e149970-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Hash Table - FSM state validation and runtime error observation', () => {

  // Validate the Idle state rendering and static DOM evidence described in the FSM.
  test('Idle state: page renders static header and table structure', async ({ page }) => {
    // Navigate to the page exactly as-is
    await page.goto(APP_URL);

    // Verify the main header exists and has the expected text
    const header = page.locator('h1');
    await expect(header).toHaveCount(1);
    await expect(header).toHaveText('Hash Table');

    // Verify the table is present and has the expected header columns
    const table = page.locator('table');
    await expect(table).toHaveCount(1);

    const ths = table.locator('th');
    await expect(ths).toHaveCount(3);
    await expect(ths.nth(0)).toHaveText('ID');
    await expect(ths.nth(1)).toHaveText('Name');
    await expect(ths.nth(2)).toHaveText('Email');

    // Verify the number of rows: 1 header row + 2 data rows = 3 <tr> elements
    const rows = table.locator('tr');
    await expect(rows).toHaveCount(3);

    // Check the content of the first data row (row index 1)
    const firstDataRowCells = rows.nth(1).locator('td');
    await expect(firstDataRowCells.nth(0)).toHaveText('1');
    await expect(firstDataRowCells.nth(1)).toHaveText('John Doe');
    await expect(firstDataRowCells.nth(2)).toHaveText('johndoe@example.com');

    // Check the second data row
    const secondDataRowCells = rows.nth(2).locator('td');
    await expect(secondDataRowCells.nth(0)).toHaveText('2');
    await expect(secondDataRowCells.nth(1)).toHaveText('Jane Smith');
    await expect(secondDataRowCells.nth(2)).toHaveText('janesmith@example.com');
  });

  // Validate that the page script generates a runtime error due to missing element 'hashTable'.
  test('Script runtime error: accessing missing #hashTable should produce a page error', async ({ page }) => {
    // Capture console messages during navigation
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Wait for the pageerror event which should occur when the inline script tries to access null.innerHTML
    const [pageError] = await Promise.all([
      // waitForEvent resolves when a pageerror occurs
      page.waitForEvent('pageerror'),
      // navigate triggers the inline script execution
      page.goto(APP_URL)
    ]);

    // The page should have emitted a pageerror
    expect(pageError).toBeTruthy();

    // The message should indicate a problem reading innerHTML from null (varies by engine)
    // Accept common variants: mentions "innerHTML" or "Cannot read property" or "Cannot read properties"
    const errMsg = pageError.message || '';
    const matchesExpected = /innerHTML|Cannot read property|Cannot read properties|null/i.test(errMsg);
    expect(matchesExpected).toBeTruthy();

    // Ensure that no "data row" console.log entries were produced (the for-loop shouldn't have run)
    const loggedDataEntries = consoleMessages.filter(m => /:/.test(m.text) && m.type === 'log');
    expect(loggedDataEntries.length).toBe(0);

    // Also assert that at least one console message indicates an error (may or may not be present depending on runtime),
    // but since we observed pageerror, ensure we reflect that as well.
    const hasConsoleError = consoleMessages.some(m => m.type === 'error' || /innerHTML|Cannot read/i.test(m.text));
    expect(hasConsoleError || !!pageError).toBeTruthy();
  });

  // Verify absence of interactive elements and that the app matches FSM notes (static, no event handlers).
  test('FSM notes: no interactive elements, no event handlers, and renderPage not defined', async ({ page }) => {
    await page.goto(APP_URL);

    // There should be no interactive form controls or buttons (as per FSM extraction notes)
    const interactiveCount = await page.locator('button, input, textarea, select').count();
    expect(interactiveCount).toBe(0);

    // Check that there are no clickable anchors that would imply transitions
    const anchorsCount = await page.locator('a').count();
    // The page does not contain link anchors in the provided HTML; allow 0 expected.
    expect(anchorsCount).toBe(0);

    // Check that the expected "entry action" renderPage is not defined in the global scope
    // This confirms the runtime would not be able to call renderPage (as suggested by FSM notes).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Ensure the page still contains the static evidence for the Idle state
    await expect(page.locator('h1')).toHaveText('Hash Table');
    await expect(page.locator('table th')).toHaveCount(3);
  });

  // Edge-case test: reloading the page should still produce the same error and not crash the test harness.
  test('Reloading page reproduces the same runtime error (consistent behavior)', async ({ page }) => {
    // First load - expect pageerror
    const firstError = await Promise.all([
      page.waitForEvent('pageerror'),
      page.goto(APP_URL)
    ]).then(([err]) => err);

    expect(firstError).toBeTruthy();

    // Reload and ensure we get another pageerror on reload
    const secondErrorPromise = page.waitForEvent('pageerror');
    await page.reload();
    const secondError = await secondErrorPromise;
    expect(secondError).toBeTruthy();

    // Both errors should refer to the same underlying issue (mention innerHTML or null)
    expect(/innerHTML|Cannot read property|Cannot read properties|null/i.test(firstError.message)).toBeTruthy();
    expect(/innerHTML|Cannot read property|Cannot read properties|null/i.test(secondError.message)).toBeTruthy();
  });

});