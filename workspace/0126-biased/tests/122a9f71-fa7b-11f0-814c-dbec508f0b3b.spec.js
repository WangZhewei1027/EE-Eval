import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122a9f71-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Doubly Linked List (FSM) - interactive app validation and runtime error observation', () => {
  // Per-test collectors for console and page errors
  let pageErrors;
  let consoleMessages;
  let initialPageErrorCount;

  // Attach listeners and load the page before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // store name and message for assertions
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Collect console messages for additional visibility
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Capture the number of initialization page errors so tests can assert increments
    initialPageErrorCount = pageErrors.length;
  });

  // TearDown logic is handled by Playwright fixtures; explicit teardown not required.
  // Tests below validate FSM states/transitions where possible and assert runtime errors
  // that occur naturally without altering the application's code or environment.

  test('Initialization: page should load and report script/runtime errors during startup', async ({ page }) => {
    // This test validates that the page initializes and that any script errors during load are observable.
    // The provided implementation is intentionally buggy; we expect at least one page error (e.g., TypeError from null.addEventListener).
    // Assert that an initialization error occurred and that it relates to event listener setup or missing elements.
    expect(initialPageErrorCount).toBeGreaterThanOrEqual(1);

    // Make the error messages available for debugging assertions - they should reference 'addEventListener' or element ids like 'prev'
    const messages = pageErrors.map((e) => `${e.name}: ${e.message}`).join(' | ');
    // At least one error should mention addEventListener or the nonexistent elements referenced by the script.
    const foundRelevant = pageErrors.some(e =>
      /addEventListener/i.test(e.message) ||
      /prev/i.test(e.message) ||
      /next/i.test(e.message) ||
      /cannot read/i.test(e.message) ||
      /reading/i.test(e.message) ||
      /null/i.test(e.message)
    );
    expect(foundRelevant).toBeTruthy();
  });

  test('Transition AddNode: clicking Add with non-empty input triggers runtime error and does not add a list item', async ({ page }) => {
    // This test attempts the FSM "AddNode" transition by interacting with #add and #add-btn.
    // The app contains logic that will throw when adding the first node (null.next.prev access).
    // We verify that:
    //  - clicking Add with a non-empty input results in an additional uncaught page error
    //  - no <li> entries appear in the #list as the operation fails
    const beforeErrors = pageErrors.length;

    // Fill in the add input with a valid node value and click Add
    await page.fill('#add', 'NodeA');
    await page.click('#add-btn');

    // Allow a short time for the click handler to execute and for any pageerror to be emitted
    await page.waitForTimeout(200);

    // Expect a new page error to have been recorded due to the bug in addNode (attempting to access .prev on null)
    expect(pageErrors.length).toBeGreaterThanOrEqual(beforeErrors + 1);

    // Verify the DOM did not receive a new list item (list should remain empty)
    const items = await page.$$eval('#list li', (els) => els.map(e => e.textContent));
    expect(items.length).toBe(0);
  });

  test('Transition AddNode (edge case): clicking Add with empty input should be a no-op and not introduce new errors', async ({ page }) => {
    // This test validates the guard in addNode() that prevents adding empty values.
    // Because the input is empty, addNode should early-exit and not trigger the problematic branch that causes the TypeError.
    const beforeErrors = pageErrors.length;

    // Ensure input is empty and click Add
    await page.fill('#add', '');
    await page.click('#add-btn');

    // Short wait for any potential error emissions
    await page.waitForTimeout(150);

    // No new error should have been introduced by clicking Add with an empty input (beyond initialization errors)
    expect(pageErrors.length).toBe(beforeErrors);

    // Confirm still no list items exist
    const items = await page.$$eval('#list li', (els) => els.map(e => e.textContent));
    expect(items.length).toBe(0);
  });

  test('Transition RemoveNode: clicking Remove triggers runtime error due to missing #remove input and does not modify the list', async ({ page }) => {
    // This test exercises the FSM "RemoveNode" transition by clicking #remove-btn.
    // The implementation references a non-existent element with id "remove", so removeNode() will throw when invoked.
    const beforeErrors = pageErrors.length;

    // Click the Remove button
    await page.click('#remove-btn');

    // Wait briefly for any errors
    await page.waitForTimeout(200);

    // Expect a new page error to have been added due to remove.value being accessed on null
    expect(pageErrors.length).toBeGreaterThanOrEqual(beforeErrors + 1);

    // Ensure the list remains empty (no successful removal occurred)
    const items = await page.$$eval('#list li', (els) => els.map(e => e.textContent));
    expect(items.length).toBe(0);
  });

  test('Transitions MovePrev and MoveNext: clicking Previous/Next does not change DOM (listeners not wired) and does not create unexpected errors', async ({ page }) => {
    // This test targets the FSM transitions MovePrev and MoveNext.
    // In the provided implementation, the event listeners were attempted to be attached to non-existent elements (prev/next),
    // thus the actual buttons #prev-btn and #next-btn are not wired. Clicking them should be a no-op.
    const beforeErrors = pageErrors.length;

    // Click Previous and Next buttons
    await page.click('#prev-btn');
    await page.click('#next-btn');

    // Wait briefly for any errors or side-effects
    await page.waitForTimeout(200);

    // Because listeners weren't registered on #prev-btn/#next-btn, we expect no new page errors from these clicks.
    // However, if some unexpected behavior occurs, this assertion will catch it.
    expect(pageErrors.length).toBe(beforeErrors);

    // Confirm DOM state unchanged: still no list items
    const items = await page.$$eval('#list li', (els) => els.map(e => e.textContent));
    expect(items.length).toBe(0);
  });

  test('Comprehensive observation: collect console logs and page errors to ensure we captured expected runtime failures', async ({ page }) => {
    // This meta-test asserts that console messages and pageErrors capture the notable problems in the page.
    // It does not attempt to fix or patch anything; it merely verifies visibility of the faults.

    // At least one page error should exist (from initialization).
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // There may be console messages logged as well; ensure we have collected whatever is present.
    // It's acceptable if consoleMessages is empty; but if present, they should be strings.
    for (const c of consoleMessages) {
      expect(typeof c.type).toBe('string');
      expect(typeof c.text).toBe('string');
    }

    // The union of errors should include TypeError or a related message about null/reading properties.
    const hasTypeOrNull = pageErrors.some(e =>
      /TypeError/i.test(e.name) ||
      /cannot read/i.test(e.message) ||
      /reading/i.test(e.message) ||
      /null/i.test(e.message) ||
      /addEventListener/i.test(e.message)
    );
    expect(hasTypeOrNull).toBeTruthy();
  });
});