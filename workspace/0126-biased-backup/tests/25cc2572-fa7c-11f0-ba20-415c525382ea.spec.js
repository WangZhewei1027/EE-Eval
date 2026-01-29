import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cc2572-fa7c-11f0-ba20-415c525382ea.html';

test.describe('Understanding Relational Databases - FSM (Application ID: 25cc2572-fa7c-11f0-ba20-415c525382ea)', () => {
  // Arrays to collect console errors and page errors for each test run.
  let consoleErrors = [];
  let pageErrors = [];

  // Setup before each test: reset error collectors, attach listeners, and navigate to the page.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // Defensive: if message inspection fails, record a generic note
        consoleErrors.push(`(failed to read console message)`);
      }
    });

    // Collect page runtime errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the served HTML page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly; listeners are bound to page which is closed by Playwright.
  });

  test('Initial Idle State (S0_Idle): button visible and table hidden, no runtime errors', async ({ page }) => {
    // This test validates the Idle state described in the FSM:
    // - Button with id #demoBtn is present and enabled
    // - Table #joinResult is hidden (display:none)
    // - No console errors or page errors were produced during page load

    const demoBtn = page.locator('#demoBtn');
    const joinTable = page.locator('#joinResult');
    const tbody = page.locator('#joinResult tbody');

    // Button is visible and has expected text
    await expect(demoBtn).toBeVisible();
    await expect(demoBtn).toBeEnabled();
    await expect(demoBtn).toHaveText('Show Joined Data');

    // Table should be present in DOM but hidden initially
    await expect(joinTable).toBeVisible(); // visible() ensures element exists; we further check computed style
    const displayStyle = await joinTable.evaluate((node) => getComputedStyle(node).display);
    expect(displayStyle).toBe('none');

    // Table body should be empty initially
    const initialRowCount = await tbody.locator('tr').count();
    expect(initialRowCount).toBe(0);

    // Verify accessibility attribute and caption text exists as described by FSM/components
    const ariaLive = await joinTable.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');
    const captionText = await page.locator('#joinResult caption').innerText();
    expect(captionText).toContain('Books and Their Authors');

    // Assert that no console errors or page errors occurred during initial load
    expect(consoleErrors, 'No console.error messages should be emitted during initial load').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur during initial load').toEqual([]);
  });

  test('Click "Show Joined Data" triggers performJoin and transitions to Result Displayed (S1_ResultDisplayed)', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_ResultDisplayed:
    // - Clicking the button populates the table with joined data
    // - Table becomes visible (display:'table')
    // - Button becomes disabled after click (exit action / disableButton())
    // - The performJoin() function returns expected joined rows
    // - No runtime errors are emitted as a result of the interaction

    const demoBtn = page.locator('#demoBtn');
    const joinTable = page.locator('#joinResult');
    const tbody = page.locator('#joinResult tbody');

    // Click the button to trigger join rendering
    await demoBtn.click();

    // After click, the table should be visible (style.display === 'table')
    const displayAfter = await joinTable.evaluate((node) => getComputedStyle(node).display);
    expect(displayAfter).toBe('table');

    // Button should be disabled to reflect exit action disableButton()
    await expect(demoBtn).toBeDisabled();

    // Table should contain the joined rows (2 rows as per provided data)
    const rows = tbody.locator('tr');
    await expect(rows).toHaveCount(2);

    // Validate row contents: Titles and corresponding Authors (order as implemented)
    const firstRowCells = rows.nth(0).locator('td');
    const secondRowCells = rows.nth(1).locator('td');

    await expect(firstRowCells.nth(0)).toHaveText('Clean Code');
    await expect(firstRowCells.nth(1)).toHaveText('Robert C. Martin');

    await expect(secondRowCells.nth(0)).toHaveText('The Pragmatic Programmer');
    await expect(secondRowCells.nth(1)).toHaveText('Andrew Hunt');

    // Call performJoin() directly in page context to validate the join algorithm result
    const joinedFromFunction = await page.evaluate(() => {
      // Access the performJoin defined in the page script; do not modify it.
      // If performJoin is not defined, this will throw and be captured by the test.
      return typeof performJoin === 'function' ? performJoin() : null;
    });

    expect(joinedFromFunction).not.toBeNull();
    expect(Array.isArray(joinedFromFunction)).toBe(true);
    // Expect two joined result objects with Title and AuthorName fields
    expect(joinedFromFunction).toEqual([
      { Title: 'Clean Code', AuthorName: 'Robert C. Martin' },
      { Title: 'The Pragmatic Programmer', AuthorName: 'Andrew Hunt' }
    ]);

    // Ensure no console errors or uncaught exceptions happened as a result of the click
    expect(consoleErrors, 'No console.error messages should be emitted when showing joined data').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur when showing joined data').toEqual([]);
  });

  test('Edge case: attempting to click the disabled button does not duplicate rows and produces no runtime errors', async ({ page }) => {
    // This test covers an edge case described in the requirements:
    // - After the button is disabled, attempting another click should not add duplicate rows
    // - Playwright's normal click on a disabled button should fail; assert that behaviour
    // - Ensure there are still exactly 2 rows and no runtime errors recorded

    const demoBtn = page.locator('#demoBtn');
    const tbody = page.locator('#joinResult tbody');

    // Trigger initial click to reach S1
    await demoBtn.click();

    // Confirm button is disabled
    await expect(demoBtn).toBeDisabled();

    // Record row count prior to the attempted second click
    const beforeAttemptCount = await tbody.locator('tr').count();
    expect(beforeAttemptCount).toBe(2);

    // Attempt to click using Playwright's page.click; this should fail because the element is disabled.
    // We assert that an actionable click is not possible.
    let clickFailed = false;
    try {
      await page.click('#demoBtn', { timeout: 2000 });
      // If click unexpectedly succeeds, flag it (but that would be surprising).
    } catch (err) {
      // We expect an error indicating the element is not enabled / not actionable.
      clickFailed = true;
      expect(err).toBeTruthy();
    }
    expect(clickFailed, 'Clicking a disabled button should fail via the Playwright API').toBe(true);

    // Confirm no duplicate rows were added after the attempted click
    const afterAttemptCount = await tbody.locator('tr').count();
    expect(afterAttemptCount).toBe(beforeAttemptCount);

    // Also confirm that no console errors or page errors appeared as a result of the attempted click
    expect(consoleErrors, 'No console.error messages should be emitted by failed click attempts').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur from attempting to click disabled button').toEqual([]);
  });

  test('Robustness: direct invocation of performJoin when table already rendered (idempotence check)', async ({ page }) => {
    // This test ensures calling performJoin directly after rendering does not change DOM unexpectedly.
    // It validates idempotence: repeated calls should return same data and not mutate the displayed rows.

    const demoBtn = page.locator('#demoBtn');
    const tbody = page.locator('#joinResult tbody');

    // Render the table first
    await demoBtn.click();

    // Call performJoin directly multiple times and verify consistent output
    const firstCall = await page.evaluate(() => performJoin());
    const secondCall = await page.evaluate(() => performJoin());
    expect(firstCall).toEqual(secondCall);
    expect(firstCall.length).toBe(2);

    // Confirm the DOM rows remain as expected (still 2 rows)
    const rowCount = await tbody.locator('tr').count();
    expect(rowCount).toBe(2);

    // Confirm still no runtime errors logged
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});