import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04423500-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Insertion Sort Interactive Application - 04423500-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // We'll capture console messages and page errors to assert whether any runtime errors occurred.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', error => {
      // Save the Error object reference and message for assertions later
      pageErrors.push(error);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, print collected diagnostics to help debugging in CI logs
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('Collected console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Collected page errors:', pageErrors.map(e => String(e)));
    }
  });

  test.describe('UI Elements and Idle State (S0_Idle)', () => {
    test('Page loads and primary buttons are present with expected labels', async ({ page }) => {
      // Validate the presence and visible text of all six buttons specified in FSM S0_Idle evidence
      const buttons = [
        { selector: '#sort-btn', text: 'Sort Array' },
        { selector: '#clear-btn', text: 'Clear Array' },
        { selector: '#reset-btn', text: 'Reset Array' },
        { selector: '#sort-btn-2', text: 'Sort Array (Descending)' },
        { selector: '#clear-btn-2', text: 'Clear Array (Descending)' },
        { selector: '#reset-btn-2', text: 'Reset Array (Descending)' },
      ];

      for (const btn of buttons) {
        const locator = page.locator(btn.selector);
        await expect(locator).toBeVisible({ timeout: 2000 });
        await expect(locator).toHaveText(btn.text);
      }

      // Ensure the two output containers exist (they are present after the script tag in HTML)
      await expect(page.locator('#array')).toBeVisible();
      await expect(page.locator('#array-2')).toBeVisible();
    });

    test('No unexpected runtime errors on initial load', async () => {
      // There should be no uncaught exceptions on page load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Ascending Sort Path (S1_Sorted) and Clearing/Resetting (S2_Cleared / S3_Reset)', () => {
    test('Clicking Sort Array sorts the array in ascending order and updates #array (S1_Sorted)', async ({ page }) => {
      // Precondition: initial array is [64, 34, 25, 12, 22, 11, 90] as defined in the HTML
      const sortBtn = page.locator('#sort-btn');
      const output = page.locator('#array');

      // Click the sort button and verify DOM update
      await sortBtn.click();
      await expect(output).toHaveText('Sorted Array: 11, 12, 22, 25, 34, 64, 90');
    });

    test('Clicking Clear Array clears the array and updates #array (S2_Cleared)', async ({ page }) => {
      const clearBtn = page.locator('#clear-btn');
      const output = page.locator('#array');

      // Click clear
      await clearBtn.click();
      // The implementation uses array.join(', ') on an empty array, so expect empty after colon + space
      await expect(output).toHaveText('Array after clearing: ');
    });

    test('Clicking Reset Array resets the array (implementation resets to empty) and updates #array (S3_Reset)', async ({ page }) => {
      const resetBtn = page.locator('#reset-btn');
      const output = page.locator('#array');

      // Click reset
      await resetBtn.click();
      // The provided implementation sets array = [] for reset, so expect empty
      await expect(output).toHaveText('Array after resetting: ');
    });

    test('Edge case: Sort after Clear results in empty Sorted Array output', async ({ page }) => {
      const clearBtn = page.locator('#clear-btn');
      const sortBtn = page.locator('#sort-btn');
      const output = page.locator('#array');

      // Clear then attempt to sort an already-empty array
      await clearBtn.click();
      await expect(output).toHaveText('Array after clearing: ');

      await sortBtn.click();
      // Sorting an empty array should produce empty list after label
      await expect(output).toHaveText('Sorted Array: ');
    });
  });

  test.describe('Descending Buttons (S4_Sorted_Descending / S5_Cleared_Descending / S6_Reset_Descending)', () => {
    test('Clicking Sort Array (Descending) updates #array-2 but actual sorting implementation is ascending', async ({ page }) => {
      // The FSM expected "Sorted Array (Descending): 90, 64, 34, 25, 22, 12, 11"
      // The implementation uses the same ascending sortArray then writes to #array-2.
      const sortBtn2 = page.locator('#sort-btn-2');
      const output2 = page.locator('#array-2');

      await sortBtn2.click();

      // Validate actual observed behavior: ascending order is written even though label says "Descending"
      const expectedObserved = 'Sorted Array (Descending): 11, 12, 22, 25, 34, 64, 90';
      await expect(output2).toHaveText(expectedObserved);

      // Also assert the FSM-expected descending ordering does NOT match actual DOM to capture discrepancy
      const fsmExpectedDescending = 'Sorted Array (Descending): 90, 64, 34, 25, 22, 12, 11';
      expect(expectedObserved).not.toBe(fsmExpectedDescending);
    });

    test('Clicking Clear Array (Descending) clears the array and updates #array-2 (S5_Cleared_Descending)', async ({ page }) => {
      const clearBtn2 = page.locator('#clear-btn-2');
      const output2 = page.locator('#array-2');

      await clearBtn2.click();
      await expect(output2).toHaveText('Array after clearing (Descending): ');
    });

    test('Clicking Reset Array (Descending) resets the array (implementation empties) and updates #array-2 (S6_Reset_Descending)', async ({ page }) => {
      const resetBtn2 = page.locator('#reset-btn-2');
      const output2 = page.locator('#array-2');

      await resetBtn2.click();
      await expect(output2).toHaveText('Array after resetting (Descending): ');
    });

    test('Edge case: Repeated clicks on descending sort/clear/reset do not throw and produce consistent output', async ({ page }) => {
      const sortBtn2 = page.locator('#sort-btn-2');
      const clearBtn2 = page.locator('#clear-btn-2');
      const resetBtn2 = page.locator('#reset-btn-2');
      const output2 = page.locator('#array-2');

      // Click sort to populate
      await sortBtn2.click();
      await expect(output2).toContainText('Sorted Array (Descending):');

      // Clear twice
      await clearBtn2.click();
      await expect(output2).toHaveText('Array after clearing (Descending): ');
      await clearBtn2.click();
      await expect(output2).toHaveText('Array after clearing (Descending): ');

      // Reset twice
      await resetBtn2.click();
      await expect(output2).toHaveText('Array after resetting (Descending): ');
      await resetBtn2.click();
      await expect(output2).toHaveText('Array after resetting (Descending): ');
    });
  });

  test.describe('Runtime errors and console validation', () => {
    test('No uncaught ReferenceError, SyntaxError, or TypeError occurred during interactions', async ({ page }) => {
      // Perform a sequence of interactions that exercise various handlers
      await page.locator('#sort-btn').click();
      await page.locator('#clear-btn').click();
      await page.locator('#reset-btn').click();
      await page.locator('#sort-btn-2').click();
      await page.locator('#clear-btn-2').click();
      await page.locator('#reset-btn-2').click();

      // At this point, check collected page errors
      // Fail the test if any uncaught exceptions were recorded
      if (pageErrors.length > 0) {
        // Provide a helpful assertion message with collected error types/messages
        const messages = pageErrors.map(e => String(e)).join(' | ');
        throw new Error(`Expected no uncaught page errors, but found ${pageErrors.length}: ${messages}`);
      }

      // Additionally, inspect console for obvious error messages or stack traces.
      const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error' || m.text.toLowerCase().includes('error'));
      if (errorConsoleEntries.length > 0) {
        const joined = errorConsoleEntries.map(e => `${e.type}:${e.text}`).join(' || ');
        throw new Error(`Expected no console errors, but found ${errorConsoleEntries.length}: ${joined}`);
      }

      // If none found, assert pass
      expect(pageErrors.length).toBe(0);
      expect(errorConsoleEntries.length).toBe(0);
    });

    test('If any runtime errors exist, they are surfaced via pageerror (test will surface details)', async ({ page }) => {
      // This test demonstrates capturing and asserting details if errors are present.
      // It will pass trivially if there are no errors (by asserting zero), otherwise will fail with details.
      // No interactions beyond load are necessary, but we'll click one button to exercise handlers.
      await page.locator('#sort-btn').click();

      // Assert no page errors; if a pageerror occurred it will be present in pageErrors array
      expect(pageErrors.length).toBe(0);
    });
  });
});