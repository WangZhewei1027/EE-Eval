import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c9c71-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Hash Table Demo (FSM) - 324c9c71-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Arrays to capture runtime console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  // Reusable selectors as a small page object
  const selectors = {
    keyInput: '#key',
    valueInput: '#value',
    insertButton: '#insert',
    retrieveButton: '#retrieve',
    deleteButton: '#delete',
    output: '#output'
  };

  // Before each test: reset collectors, navigate to the page and wire listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      // collect both text and type for richer diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the application page as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Basic sanity: ensure the main elements are present before continuing
    await expect(page.locator(selectors.keyInput)).toBeVisible();
    await expect(page.locator(selectors.valueInput)).toBeVisible();
    await expect(page.locator(selectors.insertButton)).toBeVisible();
    await expect(page.locator(selectors.retrieveButton)).toBeVisible();
    await expect(page.locator(selectors.deleteButton)).toBeVisible();
    await expect(page.locator(selectors.output)).toBeVisible();
  });

  test.afterEach(async () => {
    // Tear-down: if there are any captured console messages or errors, keep them in test output
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => ({ name: e.name, message: e.message })));
    }
  });

  test('Initial Load - Idle state (S0_Idle) should render UI and have no unexpected JS errors', async ({ page }) => {
    // Validate Idle state: page elements exist and output is initially empty or indicates empty table
    const outputText = await page.locator(selectors.output).innerHTML();
    // The implementation sets nothing on load, so it may be empty. If it returns "Hash Table is empty." that's acceptable.
    const acceptableInitialOutputs = ['', 'Hash Table is empty.'];
    expect(acceptableInitialOutputs).toContain(outputText);

    // Verify there were no critical runtime errors (ReferenceError, TypeError, SyntaxError)
    const jsErrorTypes = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundCriticalError = pageErrors.some(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );
    // We assert that the page did not fail with critical JS errors on initial load.
    expect(foundCriticalError).toBeFalsy();
  });

  test('Insert Event transitions to Inserted state (S1_Inserted) and displays inserted pair and table contents', async ({ page }) => {
    // Comment: This test validates the InsertEvent and transition to S1_Inserted.
    const key = 'foo';
    const value = 'bar';

    await page.fill(selectors.keyInput, key);
    await page.fill(selectors.valueInput, value);
    await page.click(selectors.insertButton);

    // Expect the output to contain the Inserted message and the key/value JSON
    const output = await page.locator(selectors.output).innerText();
    expect(output).toContain('Inserted:');
    expect(output).toContain(JSON.stringify({ key, value }));

    // Expect the display() output to include at least one "Index X" entry or the bucket representation containing the key-value
    expect(output).toMatch(new RegExp(`Index \\d+: .*${key}.*${value}`));

    // Ensure no critical JS errors happened during the insert
    const jsErrorTypes1 = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundCriticalError1 = pageErrors.some(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );
    expect(foundCriticalError).toBeFalsy();
  });

  test('Retrieve Event transitions to Retrieved state (S2_Retrieved) for existing key', async ({ page }) => {
    // Comment: Insert a key first, then retrieve it to validate S2_Retrieved path for existing key
    const key1 = 'alpha';
    const value1 = 'omega';
    await page.fill(selectors.keyInput, key);
    await page.fill(selectors.valueInput, value);
    await page.click(selectors.insertButton);

    // Clear value input and simulate retrieving by key only
    await page.fill(selectors.valueInput, '');
    await page.fill(selectors.keyInput, key);
    await page.click(selectors.retrieveButton);

    const output1 = await page.locator(selectors.output1).innerText();
    expect(output).toContain('Retrieved value:');
    expect(output).toContain(value);

    // No critical errors expected
    const jsErrorTypes2 = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundCriticalError2 = pageErrors.some(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );
    expect(foundCriticalError).toBeFalsy();
  });

  test('Retrieve Event returns "Key not found." for non-existent key', async ({ page }) => {
    // Comment: Ensure retrieving a key that was never inserted produces the "Key not found." message
    const missingKey = 'does-not-exist-' + Date.now();
    await page.fill(selectors.keyInput, missingKey);
    await page.click(selectors.retrieveButton);

    const output2 = await page.locator(selectors.output2).innerText();
    expect(output).toBe('Key not found.');

    // Confirm there are no critical JS errors
    const jsErrorTypes3 = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundCriticalError3 = pageErrors.some(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );
    expect(foundCriticalError).toBeFalsy();
  });

  test('Inserting duplicate key updates the value (update behavior)', async ({ page }) => {
    // Comment: Insert a key, then insert again with a new value to validate update semantics
    const key2 = 'dupKey';
    const firstValue = 'first';
    const secondValue = 'second';

    await page.fill(selectors.keyInput, key);
    await page.fill(selectors.valueInput, firstValue);
    await page.click(selectors.insertButton);

    // Insert same key with different value
    await page.fill(selectors.valueInput, secondValue);
    await page.click(selectors.insertButton);

    // Retrieve to ensure the value was updated
    await page.fill(selectors.valueInput, '');
    await page.fill(selectors.keyInput, key);
    await page.click(selectors.retrieveButton);

    const output3 = await page.locator(selectors.output3).innerText();
    expect(output).toContain('Retrieved value:');
    expect(output).toContain(secondValue);

    // Also validate that the display shows the updated value somewhere
    await page.fill(selectors.keyInput, key);
    await page.fill(selectors.valueInput, '');
    await page.click(selectors.insertButton); // re-insert without changing to get display in output
    const insertOutput = await page.locator(selectors.output).innerText();
    expect(insertOutput).toContain(JSON.stringify({ key, value: secondValue }).replace(/"value":/,'"value":')); // sanity check

    // No critical JS errors expected during updates
    const jsErrorTypes4 = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundCriticalError4 = pageErrors.some(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );
    expect(foundCriticalError).toBeFalsy();
  });

  test('Delete Event transitions to Deleted state (S3_Deleted) and removes key', async ({ page }) => {
    // Comment: Insert then delete the key, then verify it's removed from the table and retrieve yields "Key not found."
    const key3 = 'toDelete';
    const value2 = 'bye';

    // Insert
    await page.fill(selectors.keyInput, key);
    await page.fill(selectors.valueInput, value);
    await page.click(selectors.insertButton);

    // Delete
    await page.fill(selectors.valueInput, '');
    await page.fill(selectors.keyInput, key);
    await page.click(selectors.deleteButton);

    // Output should indicate deletion
    const delOutput = await page.locator(selectors.output).innerText();
    expect(delOutput).toContain('Deleted key:');
    expect(delOutput).toContain(key);

    // The display portion should no longer contain the key or its value
    expect(delOutput).not.toContain(value);

    // Retrieving after deletion should indicate key not found
    await page.click(selectors.retrieveButton);
    const retrieveAfterDelete = await page.locator(selectors.output).innerText();
    expect(retrieveAfterDelete).toBe('Key not found.');

    // No critical JS errors expected during delete
    const jsErrorTypes5 = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundCriticalError5 = pageErrors.some(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );
    expect(foundCriticalError).toBeFalsy();
  });

  test('Edge case: Insert and retrieve empty key and empty value', async ({ page }) => {
    // Comment: The implementation allows empty string keys (hash becomes index 0). Validate behavior.
    const emptyKey = '';
    const emptyValue = '';

    await page.fill(selectors.keyInput, emptyKey);
    await page.fill(selectors.valueInput, emptyValue);
    await page.click(selectors.insertButton);

    // The output should contain the inserted representation for empty key/value
    const output4 = await page.locator(selectors.output4).innerHTML();
    expect(output).toContain('Inserted:');
    // JSON.stringify({ key: '', value: '' }) yields {"key":"","value":""}
    expect(output).toContain('{"key":"","value":""}');

    // Retrieve using empty key should return empty string as value (and display "Retrieved value: " + value)
    await page.fill(selectors.valueInput, '');
    await page.fill(selectors.keyInput, emptyKey);
    await page.click(selectors.retrieveButton);

    const retrieveOutput = await page.locator(selectors.output).innerText();
    // Because retrieved value is an empty string, the UI concatenates it; we expect "Retrieved value: " followed by nothing
    expect(retrieveOutput).toContain('Retrieved value:');
    // Confirm that it did not return "Key not found."
    expect(retrieveOutput).not.toBe('Key not found.');

    // No critical JS errors for this edge case
    const jsErrorTypes6 = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundCriticalError6 = pageErrors.some(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );
    expect(foundCriticalError).toBeFalsy();
  });

  test('Edge case: Delete non-existent key should still show Deleted key message and not crash', async ({ page }) => {
    // Comment: Deleting a key that doesn't exist should not throw and should show Deleted key message and present an appropriate display
    const missingKey1 = 'never-inserted-' + Date.now();
    await page.fill(selectors.keyInput, missingKey);
    await page.click(selectors.deleteButton);

    const output5 = await page.locator(selectors.output5).innerText();
    expect(output).toContain('Deleted key:');
    expect(output).toContain(missingKey);

    // The display can either be "Hash Table is empty." or show other keys, but not crash
    const displayText = await page.locator(selectors.output).innerHTML();
    expect(displayText.length).toBeGreaterThan(0);

    // Ensure no critical JS errors occurred
    const jsErrorTypes7 = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const foundCriticalError7 = pageErrors.some(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );
    expect(foundCriticalError).toBeFalsy();
  });

  test('Observe console and page errors - assert absence of uncaught ReferenceError/TypeError/SyntaxError', async ({ page }) => {
    // Comment: As part of monitoring runtime stability, assert that no critical JS errors were emitted during interactions.
    // We'll perform a few interactions to ensure we capture runtime behavior, then assert on collected pageErrors.

    // Perform a few interactions
    await page.fill(selectors.keyInput, 'monitor1');
    await page.fill(selectors.valueInput, 'v1');
    await page.click(selectors.insertButton);
    await page.fill(selectors.keyInput, 'monitor1');
    await page.click(selectors.retrieveButton);
    await page.click(selectors.deleteButton);

    // Now inspect collected page errors
    const jsErrorTypes8 = ['ReferenceError', 'TypeError', 'SyntaxError'];
    const criticalErrors = pageErrors.filter(err =>
      jsErrorTypes.some(type => (err.name === type) || (err.message && err.message.includes(type)))
    );

    // The test asserts that no critical runtime JS errors occurred during typical flows.
    expect(criticalErrors.length).toBe(0);

    // Additionally assert that console did not report "Uncaught" errors (defensive check)
    const uncaughtConsoleErrors = consoleMessages.filter(m => m.type === 'error' && /uncaught/i.test(m.text()));
    expect(uncaughtConsoleErrors.length).toBe(0);
  });
});