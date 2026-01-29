import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0aa91-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Quick Sort Interactive Application (f5b0aa91-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Basic smoke test to ensure the page loads and basic DOM from the Idle state is present.
  test('S0_Idle: Page loads and renders expected UI (renderPage entry action)', async ({ page }) => {
    // Capture any console messages for additional assertions
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the page and wait until load event
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify page title and main heading exist
    await expect(page).toHaveTitle(/Quick Sort/);
    const heading = await page.locator('h2', { hasText: 'Quick Sort' });
    await expect(heading).toBeVisible();

    // Verify the explanatory paragraph exists
    const expl = page.locator('.container > p').first();
    await expect(expl).toContainText('Quick Sort is a divide-and-conquer algorithm');

    // Verify the button from the Idle state is present and has correct text
    const sortButton = page.locator('#quick-sort-button');
    await expect(sortButton).toBeVisible();
    await expect(sortButton).toHaveText('Sort the Array');

    // Verify supporting UI elements (table and example pre) are present as part of render
    const table = page.locator('table');
    await expect(table).toBeVisible();
    const pre = page.locator('pre');
    await expect(pre).toContainText('let arr = [5, 2, 9, 1, 7, 3];');

    // Ensure no console.log of sortedArr has happened just by loading the page (S0 entry action is renderPage)
    const hasSortedArrLog = consoleMessages.some(m => /sortedArr/.test(m.text));
    expect(hasSortedArrLog).toBe(false);
  });

  test.describe('Transitions and Events', () => {
    // Test the click event that triggers the SortArray_Click transition
    test('SortArray_Click: clicking the Sort the Array button triggers a transition that attempts to call quickSort and produces a ReferenceError', async ({ page }) => {
      // Collect console messages for assertion
      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // Navigate to the page
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Ensure the button exists before clicking
      const sortButton = page.locator('#quick-sort-button');
      await expect(sortButton).toBeVisible();

      // The page's click handler calls quickSort(...) which is not defined in the provided HTML.
      // We expect a pageerror (ReferenceError) to be emitted when the button is clicked.
      const [pageError] = await Promise.all([
        page.waitForEvent('pageerror'),
        // Trigger the user event defined in the FSM
        sortButton.click(),
      ]);

      // Assert that an error occurred and that it mentions quickSort (or ReferenceError)
      expect(pageError).toBeTruthy();
      // message may vary by browser, so use a flexible regex
      expect(pageError.message).toMatch(/quickSort is not defined|ReferenceError|quickSort/);

      // Because quickSort was not executed successfully, we should not have a console.log of a sorted array
      const logMessages = consoleMessages.filter(m => m.type === 'log').map(m => m.text);
      const hasSortedLog = logMessages.some(text => /\b5\b.*\b9\b|\[5,/.test(text) || /sortedArr/.test(text));
      expect(hasSortedLog).toBe(false);

      // Ensure the button remains in the DOM and is still interactable after the error
      await expect(sortButton).toBeVisible();
    });

    test('SortArray_Click: multiple clicks produce multiple errors (edge case)', async ({ page }) => {
      // Navigate and attach a pageerror counter
      await page.goto(APP_URL, { waitUntil: 'load' });

      let errorCount = 0;
      page.on('pageerror', () => {
        errorCount += 1;
      });

      const sortButton = page.locator('#quick-sort-button');
      await expect(sortButton).toBeVisible();

      // Click twice and wait briefly for two errors to be emitted
      // Wait for the first error
      const firstErrorPromise = page.waitForEvent('pageerror');
      await sortButton.click();
      const firstError = await firstErrorPromise;
      expect(firstError).toBeTruthy();
      expect(firstError.message).toMatch(/quickSort is not defined|ReferenceError|quickSort/);

      // Click again and wait for the second error
      const secondErrorPromise = page.waitForEvent('pageerror');
      await sortButton.click();
      const secondError = await secondErrorPromise;
      expect(secondError).toBeTruthy();
      expect(secondError.message).toMatch(/quickSort is not defined|ReferenceError|quickSort/);

      // The event listener should have incremented errorCount twice (may be slightly delayed)
      // Allow a small delay to ensure the event handler has run
      await page.waitForTimeout(100);
      expect(errorCount).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('FSM State Observability and Error Scenarios', () => {
    test('S1_Sorted: attempted entry action (console.log(sortedArr)) should not complete due to missing quickSort; assert expected observables do not appear', async ({ page }) => {
      // Collect console messages and errors
      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      const pageErrors = [];
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      await page.goto(APP_URL, { waitUntil: 'load' });
      const sortButton = page.locator('#quick-sort-button');
      await expect(sortButton).toBeVisible();

      // Trigger the transition
      await sortButton.click();

      // Give a small time window for events to be emitted
      await page.waitForTimeout(200);

      // We expect at least one page error due to quickSort missing
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      expect(pageErrors[0].message).toMatch(/quickSort is not defined|ReferenceError|quickSort/);

      // The FSM's S1 entry action mentions console.log(sortedArr).
      // Because quickSort throws, there should be no console.log entry with the sorted array.
      const loggedSortedArr = consoleMessages.find(m => m.type === 'log' && /sortedArr|5.*9.*1|1, 2, 3, 5, 7, 9/.test(m.text));
      expect(loggedSortedArr).toBeUndefined();

      // Validate that no UI element showing the sorted result was added (there is no such UI in the HTML)
      // This asserts that the S1 observable expected (sortedArr logged) did not materialize in the DOM
      const sortedOutput = page.locator('[data-sorted-arr], #sorted-array, .sorted-array');
      await expect(sortedOutput.count()).resolves.toBe(0);
    });

    test('DOM integrity after error: the rest of the page content remains intact (no global mutation from error)', async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'load' });

      // Click to cause the ReferenceError
      const sortButton = page.locator('#quick-sort-button');
      await expect(sortButton).toBeVisible();
      // swallow the pageerror via waitForEvent so test doesn't fail unhandled
      const errorPromise = page.waitForEvent('pageerror').catch(() => null);
      await sortButton.click();
      await errorPromise;

      // Check that major sections still exist and have expected content
      await expect(page.locator('h3', { hasText: 'How it Works' })).toBeVisible();
      await expect(page.locator('h3', { hasText: 'Algorithm Steps' })).toBeVisible();
      await expect(page.locator('ol')).toBeVisible();
      await expect(page.locator('table')).toBeVisible();
    });
  });
});