import { test, expect } from '@playwright/test';

test.describe('Bubble Sort Application Tests', () => {
  const url = 'http://127.0.0.1:5500/workspace/0126-test/html/f91f6d80-fa66-11f0-9316-e908671f7fdf.html';

  test.beforeEach(async ({ page }) => {
    await page.goto(url);
  });

  test('Initial state - Idle', async ({ page }) => {
    // Verify the page renders correctly with the expected elements
    await expect(page.locator('h1')).toHaveText('Bubble Sort');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('table tr')).toHaveCount(10); // 1 header row + 9 data rows

    // Check the table headers
    const headers = await page.locator('table tr').first().locator('th').allTextContents();
    expect(headers).toEqual(['Number', 'Pass', 'Swap']);

    // Check initial table data
    const firstRowData = await page.locator('table tr').nth(1).locator('td').allTextContents();
    expect(firstRowData).toEqual(['5', '0', '0']);
  });

  test('Console logs during bubble sort', async ({ page }) => {
    // Listen for console messages
    const messages = [];
    page.on('console', msg => messages.push(msg.text()));

    // Reload the page to trigger the script execution
    await page.reload();

    // Assert that the console logs the original and sorted arrays
    expect(messages).toContain('Original array: [5,4,3,2,1,0]');
    expect(messages).toContain('Sorted array: [0,1,2,3,4,5]');
  });

  test('Error scenarios', async ({ page }) => {
    // Check for any JavaScript errors in the console
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    // Reload the page to capture any errors
    await page.reload();

    // Assert that no errors occurred during page load
    expect(errors).toHaveLength(0);
  });
});