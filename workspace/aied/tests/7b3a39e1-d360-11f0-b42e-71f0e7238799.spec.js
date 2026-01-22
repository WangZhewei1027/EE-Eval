import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3a39e1-d360-11f0-b42e-71f0e7238799.html';

// Test suite for the Hash Table Demonstration interactive application.
// These tests validate the FSM states/transitions described in the specification:
// - S0_Idle (initial render)
// - S1_KeyValueAdded (after adding a key-value pair)
// The tests also observe console messages and page errors and assert expected behavior.

test.describe('Hash Table Demonstration - FSM validation', () => {
  // Arrays to collect console messages and page errors for each test.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Attach listeners to capture console messages and uncaught page errors.
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page exactly as provided.
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown modifications to the page; we simply ensure references are cleared.
    // The tests below will assert expectations about captured console/page errors.
  });

  test('Initial Idle state renders inputs, button, and empty table', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - inputs with correct placeholders exist
    // - the "Add Key-Value Pair" button exists with correct text
    // - the hash table headers exist and table body is empty initially
    // - no uncaught page errors occurred during initial render

    // Verify key and value inputs are present with placeholders
    const keyInput = page.locator('#keyInput');
    const valueInput = page.locator('#valueInput');
    await expect(keyInput).toHaveCount(1);
    await expect(valueInput).toHaveCount(1);
    await expect(keyInput).toHaveAttribute('placeholder', 'Enter key');
    await expect(valueInput).toHaveAttribute('placeholder', 'Enter value');

    // Verify the Add button exists and contains correct visible text
    const addButton = page.locator('button[onclick="addKeyValuePair()"]');
    await expect(addButton).toHaveCount(1);
    await expect(addButton).toContainText('Add Key-Value Pair');

    // Verify table headers exist
    const headers = page.locator('#hashTable thead tr th');
    await expect(headers).toHaveCount(3);
    await expect(headers.nth(0)).toHaveText('Index');
    await expect(headers.nth(1)).toHaveText('Key');
    await expect(headers.nth(2)).toHaveText('Value');

    // Verify table body initially empty (Idle state expectation)
    const tableRows = page.locator('#tableBody tr');
    await expect(tableRows).toHaveCount(0);

    // Assert there were no uncaught page errors during initial render
    expect(pageErrors.length, `Expected no page errors on initial render, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Also assert there are no console errors emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Add Key-Value Pair transitions to KeyValueAdded: table updates and inputs are cleared', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_KeyValueAdded triggered by AddKeyValuePair:
    // - enter a key and value
    // - click the Add button
    // - table updates with a new row containing the provided key/value
    // - input fields are cleared (transition back toward Idle input-clearing action)
    // - no uncaught errors occur during the interaction

    const key = 'testKey';
    const value = 'testValue';

    await page.fill('#keyInput', key);
    await page.fill('#valueInput', value);

    // Click the add button. No alert expected because both inputs are provided.
    await page.click('button[onclick="addKeyValuePair()"]');

    // Wait for a table row to appear
    const row = page.locator('#tableBody tr').first();
    await expect(row).toBeVisible();

    // Assert the row contains the index, the key, and the value
    const cells = row.locator('td');
    await expect(cells).toHaveCount(3);
    // Index will be a digit 0-9 due to hash size 10
    const indexText = await cells.nth(0).innerText();
    expect(Number.isFinite(Number(indexText)) && Number(indexText) >= 0 && Number(indexText) < 10).toBe(true);

    await expect(cells.nth(1)).toHaveText(key);
    await expect(cells.nth(2)).toHaveText(value);

    // After adding, inputs should be cleared (the transition/back-to-idle behavior)
    await expect(page.locator('#keyInput')).toHaveValue('');
    await expect(page.locator('#valueInput')).toHaveValue('');

    // Assert no uncaught page errors and no console.error messages during the add flow
    expect(pageErrors.length, `Expected no page errors after adding key-value, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages after add, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Adding two keys that collide appends both entries at the same index', async ({ page }) => {
    // This test demonstrates collision handling (both entries should appear under the same index).
    // We choose two single-letter keys whose char codes modulo 10 are equal:
    // 'a' (97 % 10 = 7) and 'k' (107 % 10 = 7) -> both should map to index 7.

    const key1 = 'a';
    const value1 = 'valueA';
    const key2 = 'k';
    const value2 = 'valueK';

    // Ensure table is empty initially
    await expect(page.locator('#tableBody tr')).toHaveCount(0);

    // Add first pair
    await page.fill('#keyInput', key1);
    await page.fill('#valueInput', value1);
    await page.click('button[onclick="addKeyValuePair()"]');

    // Add second pair
    await page.fill('#keyInput', key2);
    await page.fill('#valueInput', value2);
    await page.click('button[onclick="addKeyValuePair()"]');

    // Now there should be at least two rows in the table
    const rows = page.locator('#tableBody tr');
    await expect(rows).toHaveCount(2);

    // Extract indices and keys from the rows and assert both share the same index
    const indices = [];
    const keys = [];
    for (let i = 0; i < 2; i++) {
      const cells = rows.nth(i).locator('td');
      const idx = await cells.nth(0).innerText();
      const k = await cells.nth(1).innerText();
      indices.push(idx);
      keys.push(k);
    }

    expect(indices[0]).toBe(indices[1]);
    expect(keys).toContain(key1);
    expect(keys).toContain(key2);

    // Also double-check that the index number is within 0-9
    const numericIndex = Number(indices[0]);
    expect(Number.isFinite(numericIndex) && numericIndex >= 0 && numericIndex < 10).toBe(true);

    // Assert again no uncaught runtime errors happened
    expect(pageErrors.length, `Expected no page errors after collision test, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Input validation prevents adding when either key or value is missing and shows alert', async ({ page }) => {
    // This test validates the InputValidation event and expected behavior when inputs are missing:
    // - clicking Add with empty inputs should trigger an alert with the expected message
    // - the table should remain unchanged
    // - no uncaught page errors should be observed

    // Ensure inputs are empty
    await page.fill('#keyInput', '');
    await page.fill('#valueInput', '');

    // Listen for dialog and assert the expected alert message
    const dialogPromise = page.waitForEvent('dialog');

    // Click the add button which should produce an alert because inputs are empty
    await page.click('button[onclick="addKeyValuePair()"]');

    const dialog = await dialogPromise;
    try {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please enter both key and value.');
    } finally {
      // Dismiss the alert so page can continue
      await dialog.dismiss();
    }

    // Table should still be empty
    await expect(page.locator('#tableBody tr')).toHaveCount(0);

    // Assert no uncaught page errors occurred as a result of this interaction
    expect(pageErrors.length, `Expected no page errors after invalid input attempt, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Adding duplicate key results in multiple entries (duplicates preserved)', async ({ page }) => {
    // Edge case: adding the same key twice should append another entry (implementation uses an array per bucket)
    const key = 'duplicate';
    const value1 = 'v1';
    const value2 = 'v2';

    // Add first occurrence
    await page.fill('#keyInput', key);
    await page.fill('#valueInput', value1);
    await page.click('button[onclick="addKeyValuePair()"]');

    // Add second occurrence
    await page.fill('#keyInput', key);
    await page.fill('#valueInput', value2);
    await page.click('button[onclick="addKeyValuePair()"]');

    // There should be two rows whose key column equals 'duplicate'
    const rows = page.locator('#tableBody tr');
    // Wait until at least two rows exist
    await expect(rows).toHaveCount(2);

    const keys = [];
    const values = [];
    for (let i = 0; i < 2; i++) {
      const cells = rows.nth(i).locator('td');
      keys.push(await cells.nth(1).innerText());
      values.push(await cells.nth(2).innerText());
    }

    // Both rows should have the same key but different values in this test
    expect(keys[0]).toBe(key);
    expect(keys[1]).toBe(key);
    expect(values).toContain(value1);
    expect(values).toContain(value2);

    // Ensure inputs cleared after last add
    await expect(page.locator('#keyInput')).toHaveValue('');
    await expect(page.locator('#valueInput')).toHaveValue('');

    // Ensure no uncaught errors occurred
    expect(pageErrors.length, `Expected no page errors after adding duplicates, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });
});