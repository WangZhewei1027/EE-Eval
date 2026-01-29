import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12136361-fa7a-11f0-acf9-69409043402d.html';

// Helper to wait until the log textarea contains a substring
async function waitForLogContains(page, substring, opts = {}) {
  const timeout = opts.timeout ?? 2000;
  await page.waitForFunction(
    (sub) => {
      const el = document.getElementById('log');
      return !!el && el.value.includes(sub);
    },
    substring,
    { timeout }
  );
}

test.describe('Priority Queue Interactive Demo - FSM states & transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset capture arrays
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors BEFORE navigation to observe load-time logs/errors
    page.on('console', (msg) => {
      // normalize text
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(BASE_URL, { waitUntil: 'load' });

    // Wait for initial reset log message from resetPQ() called during initialization
    await waitForLogContains(page, 'Queue reset using implementation:', { timeout: 2000 });
  });

  test.afterEach(async () => {
    // After each test we assert that there were no unexpected uncaught exceptions (pageerror)
    // These would correspond to ReferenceError/SyntaxError/TypeError etc thrown and not handled.
    // We expect zero page errors (uncaught exceptions) during normal operation.
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle: on load the queue is reset and reset button triggers resetPQ (Idle state entry)', async ({ page }) => {
    // Verify the initial log contains the reset message from resetPQ() (onEnter S0_Idle)
    const log = await page.locator('#log').inputValue();
    expect(log).toContain('Queue reset using implementation:');

    // Verify the implementation radio default is binaryHeap
    const checkedImpl = await page.locator('input[name="impl"]:checked').getAttribute('value');
    expect(checkedImpl).toBe('binaryHeap');

    // Clicking the reset button should append another reset message
    await page.click('#resetQueueBtn');
    await waitForLogContains(page, 'Queue reset using implementation:', { timeout: 2000 });

    // Ensure the console captured the reset logs but there are no page errors
    const hasResetConsole = consoleMessages.some(m => m.text.includes('Queue reset using implementation:'));
    expect(hasResetConsole).toBe(false); // resetPQ logs to textarea, not console.error - ensure no console.error for reset
  });

  test('INSERT_ELEMENTS transition to S1_ElementsInserted: insert multiple elements and verify ordering, peek, extract', async ({ page }) => {
    // Put two elements into the insert area (one higher priority than the other)
    await page.fill('#insertArea', 'task1,5\ntask2,10');
    await page.fill('#defaultPriority', '0'); // ensure default priority defined

    // Click Insert (INSERT_ELEMENTS event)
    await page.click('#insertBtn');

    // The app logs inserted count
    await waitForLogContains(page, 'Inserted 2 element(s). Queue size: 2');

    // After insertion, the insert area should be cleared
    const insertAreaValue = await page.locator('#insertArea').inputValue();
    expect(insertAreaValue).toBe('');

    // Print queue to verify ordering (task2 should come before task1 due to higher priority)
    await page.click('#printQueueBtn');
    await waitForLogContains(page, 'task2 | 10 |', { timeout: 2000 });
    const logText = await page.locator('#log').inputValue();
    expect(logText).toContain('task2 | 10 |');
    expect(logText).toContain('task1 | 5 |');

    // PEEK_MAX (PEEK_MAX transition to S4_MaxPeeked)
    await page.click('#peekMaxBtn');
    await waitForLogContains(page, 'Peek max: Value="task2", Priority=10', { timeout: 2000 });

    // EXTRACT_MAX (EXTRACT_MAX transition to S3_MaxExtracted)
    await page.click('#extractMaxBtn');
    await waitForLogContains(page, 'Extracted max: Value="task2", Priority=10', { timeout: 2000 });

    // After extraction, printing queue should show only task1
    await page.click('#printQueueBtn');
    await waitForLogContains(page, 'task1 | 5 |', { timeout: 2000 });
    const afterExtract = await page.locator('#log').inputValue();
    expect(afterExtract).toContain('task1 | 5 |');
    expect(afterExtract).not.toContain('task2 | 10 |');
  });

  test('CHANGE_PRIORITY (S5) and REMOVE_BY_VALUE (S6) workflows including error scenarios', async ({ page }) => {
    // Prepare queue with a single element to change/remove
    await page.fill('#insertArea', 'alpha,3');
    await page.click('#insertBtn');
    await waitForLogContains(page, 'Inserted 1 element(s). Queue size: 1');

    // Attempt change priority with empty value -> should error and console.error invoked
    await page.fill('#changePriorityValue', '');
    await page.fill('#newPriority', '10');
    await page.click('#changePriorityBtn');
    await waitForLogContains(page, 'Change priority failed: no value entered.', { timeout: 2000 });

    // Confirm a console.error was emitted for this error
    const hadChangePriorityError = consoleMessages.some(m => m.type === 'error' && m.text.includes('Change priority failed: no value entered.'));
    expect(hadChangePriorityError).toBe(true);

    // Attempt change priority with invalid new priority (non-number)
    await page.fill('#changePriorityValue', 'alpha');
    await page.fill('#newPriority', 'not-a-number');
    await page.click('#changePriorityBtn');
    await waitForLogContains(page, 'Change priority failed: invalid new priority.', { timeout: 2000 });
    const hadInvalidPriorityError = consoleMessages.some(m => m.type === 'error' && m.text.includes('Change priority failed: invalid new priority.'));
    expect(hadInvalidPriorityError).toBe(true);

    // Now perform a valid change: alpha -> new priority 20
    await page.fill('#newPriority', '20');
    await page.click('#changePriorityBtn');
    await waitForLogContains(page, 'Changed priority of first matching value "alpha" to 20.', { timeout: 2000 });

    // Validate ordering via printQueue (alpha should appear with priority 20)
    await page.click('#printQueueBtn');
    await waitForLogContains(page, 'alpha | 20 |', { timeout: 2000 });

    // REMOVE_BY_VALUE: empty input -> error logged
    await page.fill('#removeByValueInput', '');
    await page.click('#removeByValueBtn');
    await waitForLogContains(page, 'Remove failed: no value entered.', { timeout: 2000 });
    const hadRemoveEmptyError = consoleMessages.some(m => m.type === 'error' && m.text.includes('Remove failed: no value entered.'));
    expect(hadRemoveEmptyError).toBe(true);

    // Try removing a non-existent value -> error logged
    await page.fill('#removeByValueInput', 'doesnotexist');
    await page.click('#removeByValueBtn');
    await waitForLogContains(page, 'No element with value "doesnotexist" found to remove.', { timeout: 2000 });
    const hadRemoveNotFoundError = consoleMessages.some(m => m.type === 'error' && m.text.includes('No element with value "doesnotexist" found to remove.'));
    expect(hadRemoveNotFoundError).toBe(true);

    // Remove existing value 'alpha' -> success
    await page.fill('#removeByValueInput', 'alpha');
    await page.click('#removeByValueBtn');
    await waitForLogContains(page, 'Removed first matching element with value "alpha".', { timeout: 2000 });

    // Confirm queue is empty by printing
    await page.click('#printQueueBtn');
    await waitForLogContains(page, 'Queue is empty.', { timeout: 2000 });
  });

  test('S2_QueueCleared and S7_BulkInserted: Clear and bulk insert operations', async ({ page }) => {
    // Insert a few elements
    await page.fill('#insertArea', 'one,1\ntwo,2\nthree,3');
    await page.click('#insertBtn');
    await waitForLogContains(page, 'Inserted 3 element(s). Queue size: 3');

    // Clear All (CLEAR_QUEUE transition)
    await page.click('#clearQueueBtn');
    await waitForLogContains(page, 'Queue cleared.', { timeout: 2000 });

    // Confirm printing shows empty
    await page.click('#printQueueBtn');
    await waitForLogContains(page, 'Queue is empty.', { timeout: 2000 });

    // Bulk Insert (BULK_INSERT transition) with count 5
    await page.fill('#bulkInsertCount', '5');
    await page.click('#bulkInsertStartBtn');
    // log will contain Inserted X element(s) - count should be 5
    await waitForLogContains(page, 'Inserted 5 element(s).', { timeout: 3000 });
    const logAfterBulk = await page.locator('#log').inputValue();
    expect(logAfterBulk).toMatch(/Inserted 5 element\(s\). Queue size: \d+/);
  });

  test('S8_Validated: validate queue properties across implementations and S9_Search elements', async ({ page }) => {
    // Ensure some known items exist for search & validate
    await page.fill('#insertArea', 'findme,7\nfindme2,9\nother,1');
    await page.click('#insertBtn');
    await waitForLogContains(page, 'Inserted 3 element(s). Queue size: 3');

    // Validate queue properties (VALIDATE_QUEUE)
    await page.click('#validateBtn');
    // Validation success logs a message starting with 'Validation successful:' or 'Validation failed:'
    await waitForLogContains(page, 'Validation', { timeout: 2000 });
    const validationLog = await page.locator('#log').inputValue();
    expect(validationLog).toMatch(/Validation (successful|failed):/);

    // SEARCH_ELEMENTS FSM transition: empty search -> error
    await page.fill('#searchValueInput', '');
    await page.click('#searchBtn');
    await waitForLogContains(page, 'Search failed: no value entered.', { timeout: 2000 });
    const hadSearchEmptyError = consoleMessages.some(m => m.type === 'error' && m.text.includes('Search failed: no value entered.'));
    expect(hadSearchEmptyError).toBe(true);

    // Valid search for 'findme' should find two matches
    await page.fill('#searchValueInput', 'findme');
    await page.click('#searchBtn');
    await waitForLogContains(page, 'Found 2 element(s) containing "findme":', { timeout: 2000 });
    const searchLog = await page.locator('#log').inputValue();
    expect(searchLog).toContain('findme | 7 |');
    expect(searchLog).toContain('findme2 | 9 |');

    // Highlight matches should log a prefixed list with markers
    await page.click('#searchHighlightBtn');
    await waitForLogContains(page, 'Queue elements with matches marked with', { timeout: 2000 });
    const highlightLog = await page.locator('#log').inputValue();
    expect(highlightLog).toMatch(/Queue elements with matches marked with/);
  });

  test('Export/Import JSON, printInternal, bulkRandom and benchmark (non-crashing)', async ({ page }) => {
    // Insert some deterministic items for export
    await page.fill('#insertArea', 'expA,2\nexpB,4');
    await page.click('#insertBtn');
    await waitForLogContains(page, 'Inserted 2 element(s). Queue size: 2');

    // Export to JSON
    await page.click('#exportJsonBtn');
    await waitForLogContains(page, 'Exported queue state to JSON.', { timeout: 2000 });
    // jsonArea should now contain a JSON array
    const jsonAreaValue = await page.locator('#jsonArea').inputValue();
    let parsed;
    try {
      parsed = JSON.parse(jsonAreaValue);
    } catch (e) {
      parsed = null;
    }
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(2);

    // Reset queue then import the JSON
    await page.click('#resetQueueBtn');
    await waitForLogContains(page, 'Queue reset using implementation:', { timeout: 2000 });

    // Paste the exported JSON and import
    await page.fill('#jsonArea', jsonAreaValue);
    await page.click('#importJsonBtn');
    await waitForLogContains(page, 'Imported queue from JSON with', { timeout: 2000 });
    const importLog = await page.locator('#log').inputValue();
    expect(importLog).toMatch(/Imported queue from JSON with \d+ elements\./);

    // printInternal should show internal structure text
    await page.click('#printInternalBtn');
    await waitForLogContains(page, 'Internal Data Structure:', { timeout: 2000 });

    // Bulk random insertion button should work and not crash
    await page.click('#bulkRandomBtn');
    await waitForLogContains(page, 'Inserted 10 element(s). Queue size:', { timeout: 3000 });

    // Benchmark button triggers logs but we assert no crashes and benchmark message appears
    await page.click('#bulkBenchmarkBtn');
    await waitForLogContains(page, 'Benchmark results:', { timeout: 5000 });
    const benchLog = await page.locator('#log').inputValue();
    expect(benchLog).toContain('Benchmark results:');
  });

  test('Edge case validations: invalid bulk insert count, invalid import JSON, and parse errors produce console.error entries', async ({ page }) => {
    // Invalid bulk insert count (0 -> invalid)
    await page.fill('#bulkInsertCount', '0');
    await page.click('#bulkInsertStartBtn');
    await waitForLogContains(page, 'Invalid bulk insert count; must be 1 to 10000.', { timeout: 2000 });
    const hadBulkCountError = consoleMessages.some(m => m.type === 'error' && m.text.includes('Invalid bulk insert count; must be 1 to 10000.'));
    expect(hadBulkCountError).toBe(true);

    // Invalid import JSON (malformed)
    await page.fill('#jsonArea', '{ this is not valid json ');
    await page.click('#importJsonBtn');
    await waitForLogContains(page, 'Import failed:', { timeout: 2000 });
    const hadImportError = consoleMessages.some(m => m.type === 'error' && m.text.includes('Import failed:'));
    expect(hadImportError).toBe(true);

    // Import with wrong structure (not array)
    await page.fill('#jsonArea', '{"value":"x"}');
    await page.click('#importJsonBtn');
    await waitForLogContains(page, 'Import failed: JSON is not an array.', { timeout: 2000 });
    const hadImportNotArrayError = consoleMessages.some(m => m.type === 'error' && m.text.includes('Import failed: JSON is not an array.'));
    expect(hadImportNotArrayError).toBe(true);

    // Import with array but invalid element props
    await page.fill('#jsonArea', JSON.stringify([{ value: 1, priority: 'bad', insertCount: 'bad' }]));
    await page.click('#importJsonBtn');
    await waitForLogContains(page, 'Import failed: one or more elements have invalid properties.', { timeout: 2000 });
    const hadImportInvalidProps = consoleMessages.some(m => m.type === 'error' && m.text.includes('Import failed: one or more elements have invalid properties.'));
    expect(hadImportInvalidProps).toBe(true);
  });
});