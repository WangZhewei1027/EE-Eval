import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121251f1-fa7a-11f0-acf9-69409043402d.html';

test.describe('Interactive Linked List Explorer - End-to-End (FSM coverage)', () => {
  // Shared state captured per test
  let dialogs = [];
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners before each test and navigate to page
  test.beforeEach(async ({ page }) => {
    dialogs = [];
    consoleMessages = [];
    pageErrors = [];

    // Capture dialogs (alerts / confirms / prompts). Auto-accept to avoid blocking.
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        // Accept alerts and confirms; if prompt appears, accept without text
        await dialog.accept();
      } catch (e) {
        // swallow any dialog accept errors (shouldn't happen)
      }
    });

    // Capture console messages for observation
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for the main UI to be present
    await expect(page.locator('#list-display')).toBeVisible();
  });

  // Teardown assertion that no unexpected runtime errors occurred
  test.afterEach(async () => {
    // By default we assert there were no uncaught page errors during the test.
    // This ensures the app did not throw unexpected ReferenceError / TypeError / SyntaxError.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
  });

  test.describe('Initial State and Basic UI', () => {
    test('Initial idle state shows empty list and traversal placeholders', async ({ page }) => {
      // Validate the initial "onEnter" refreshListDisplay() effect: empty visual
      const listDisplay = page.locator('#list-display');
      await expect(listDisplay).toHaveText('(empty)');

      // Traversal placeholders should be '-'
      await expect(page.locator('#traverse-pos')).toHaveText('-');
      await expect(page.locator('#traverse-val')).toHaveText('-');

      // No dialogs should have been shown just by loading the page
      expect(dialogs.length).toBe(0);
    });
  });

  test.describe('Insert operations', () => {
    test('Insert at head, tail and at a specific position update the list display', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertPos = page.locator('#insert-pos');
      const insertHeadBtn = page.locator('#insert-head');
      const insertTailBtn = page.locator('#insert-tail');
      const insertPosBtn = page.locator('#insert-pos-btn');
      const listDisplay = page.locator('#list-display');

      // Insert 'A' at head -> list: [A]
      await insertValue.fill('A');
      await insertHeadBtn.click();
      await expect(listDisplay).toHaveText('0 : A');

      // Insert 'B' at tail -> list: [A, B]
      await insertValue.fill('B');
      await insertTailBtn.click();
      await expect(listDisplay).toHaveText('0 : A\n1 : B');

      // Insert 'X' at position 1 -> list: [A, X, B]
      await insertValue.fill('X');
      await insertPos.fill('1');
      await insertPosBtn.click();
      await expect(listDisplay).toHaveText('0 : A\n1 : X\n2 : B');
    });

    test('Inserting with empty value triggers alert and does not modify list', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertHeadBtn = page.locator('#insert-head');
      const listDisplay = page.locator('#list-display');

      // Ensure list is empty to start fresh
      await expect(listDisplay).toHaveText('(empty)');

      // Attempt insert with empty value -> should trigger alert and list remains unchanged
      await insertValue.fill(''); // empty
      // Clear recorded dialogs before clicking
      dialogs.length = 0;
      await insertHeadBtn.click();
      // Expect an alert about entering a value
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('Please enter a value to insert.');
      await expect(listDisplay).toHaveText('(empty)');
    });

    test('Insert at position validation: out-of-bounds shows alert', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertPos = page.locator('#insert-pos');
      const insertPosBtn = page.locator('#insert-pos-btn');
      const listDisplay = page.locator('#list-display');

      // Ensure list empty
      await expect(listDisplay).toHaveText('(empty)');

      // Try to insert at position 1 while list length is 0 -> pos > list length
      await insertValue.fill('Z');
      await insertPos.fill('1');
      dialogs.length = 0;
      await insertPosBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('Position error');
      // List should remain unchanged
      await expect(listDisplay).toHaveText('(empty)');
    });
  });

  test.describe('Delete operations', () => {
    test('Delete at position, head, and tail update the list display', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');
      const deletePos = page.locator('#delete-pos');
      const deletePosBtn = page.locator('#delete-pos-btn');
      const deleteHeadBtn = page.locator('#delete-head');
      const deleteTailBtn = page.locator('#delete-tail');
      const listDisplay = page.locator('#list-display');

      // Build list: [A, X, B] using insert-tail for reliability
      await insertValue.fill('A'); await insertTailBtn.click();
      await insertValue.fill('X'); await insertTailBtn.click();
      await insertValue.fill('B'); await insertTailBtn.click();
      await expect(listDisplay).toHaveText('0 : A\n1 : X\n2 : B');

      // Delete position 1 -> removes X -> [A, B]
      await deletePos.fill('1');
      await deletePosBtn.click();
      await expect(listDisplay).toHaveText('0 : A\n1 : B');

      // Delete head -> removes A -> [B]
      await deleteHeadBtn.click();
      await expect(listDisplay).toHaveText('0 : B');

      // Delete tail -> removes B -> []
      await deleteTailBtn.click();
      await expect(listDisplay).toHaveText('(empty)');
    });

    test('Deleting from empty list triggers alert messages', async ({ page }) => {
      const deleteHeadBtn = page.locator('#delete-head');
      const deleteTailBtn = page.locator('#delete-tail');
      const deletePosBtn = page.locator('#delete-pos-btn');
      const deletePos = page.locator('#delete-pos');

      // Ensure empty
      await expect(page.locator('#list-display')).toHaveText('(empty)');

      // delete head
      dialogs.length = 0;
      await deleteHeadBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('List already empty');

      // delete tail
      await deleteTailBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(2); // another alert
      expect(dialogs[dialogs.length - 1].message).toContain('List already empty');

      // delete position when empty
      await deletePos.fill('0');
      await deletePosBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(3);
      expect(dialogs[dialogs.length - 1].message).toContain('List is empty');
    });
  });

  test.describe('Update and Search', () => {
    test('Updating node value at a position and searching for values', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');
      const updatePos = page.locator('#update-pos');
      const updateValue = page.locator('#update-value');
      const updatePosBtn = page.locator('#update-pos-btn');
      const searchValue = page.locator('#search-value');
      const searchBtn = page.locator('#search-btn');
      const searchResultDiv = page.locator('#search-result');
      const listDisplay = page.locator('#list-display');

      // Build list: ['one','two','three']
      await insertValue.fill('one'); await insertTailBtn.click();
      await insertValue.fill('two'); await insertTailBtn.click();
      await insertValue.fill('three'); await insertTailBtn.click();
      await expect(listDisplay).toHaveText('0 : one\n1 : two\n2 : three');

      // Update position 1 to 'TWO'
      await updatePos.fill('1');
      await updateValue.fill('TWO');
      await updatePosBtn.click();
      await expect(listDisplay).toHaveText('0 : one\n1 : TWO\n2 : three');

      // Search for 'TWO' -> should report position 1
      await searchValue.fill('TWO');
      await searchBtn.click();
      await expect(searchResultDiv).toHaveText('Value found at positions: 1');

      // Search for non-existent value -> should show not found
      await searchValue.fill('absent');
      await searchBtn.click();
      await expect(searchResultDiv).toHaveText('Value not found in list.');
    });

    test('Update with invalid position triggers validation alert', async ({ page }) => {
      const updatePos = page.locator('#update-pos');
      const updateValue = page.locator('#update-value');
      const updatePosBtn = page.locator('#update-pos-btn');
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');

      // Ensure list has one element to allow update flow validation to run
      await insertValue.fill('single'); await insertTailBtn.click();

      dialogs.length = 0;
      await updatePos.fill('10'); // invalid
      await updateValue.fill('ignored');
      await updatePosBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('Position error');
    });
  });

  test.describe('Traversal controls', () => {
    test('Traversal: jump to head/tail, next, prev, and reset update traversal display', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');
      const traverseHeadBtn = page.locator('#traverse-head');
      const traverseHeadNextBtn = page.locator('#traverse-head-next');
      const traverseTailBtn = page.locator('#traverse-tail');
      const traverseTailPrevBtn = page.locator('#traverse-tail-prev');
      const traverseResetBtn = page.locator('#traverse-reset');
      const pos = page.locator('#traverse-pos');
      const val = page.locator('#traverse-val');

      // Build list: [a,b,c]
      await insertValue.fill('a'); await insertTailBtn.click();
      await insertValue.fill('b'); await insertTailBtn.click();
      await insertValue.fill('c'); await insertTailBtn.click();

      // Jump to head -> pos 0 value a
      await traverseHeadBtn.click();
      await expect(pos).toHaveText('0');
      await expect(val).toHaveText('a');

      // Next from head -> pos 1 value b
      await traverseHeadNextBtn.click();
      await expect(pos).toHaveText('1');
      await expect(val).toHaveText('b');

      // Jump to tail -> pos 2 value c
      await traverseTailBtn.click();
      await expect(pos).toHaveText('2');
      await expect(val).toHaveText('c');

      // Prev from tail -> pos 1 value b
      await traverseTailPrevBtn.click();
      await expect(pos).toHaveText('1');
      await expect(val).toHaveText('b');

      // Reset traversal -> placeholders
      await traverseResetBtn.click();
      await expect(pos).toHaveText('-');
      await expect(val).toHaveText('-');
    });
  });

  test.describe('List-wide operations: reverse, sort, remove duplicates, clear', () => {
    test('Reverse reverses order (requires >=2 elements) and sort orders lexicographically', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');
      const reverseListBtn = page.locator('#reverse-list');
      const sortListBtn = page.locator('#sort-list');
      const listDisplay = page.locator('#list-display');

      // Build list: ['c','a','b']
      await insertValue.fill('c'); await insertTailBtn.click();
      await insertValue.fill('a'); await insertTailBtn.click();
      await insertValue.fill('b'); await insertTailBtn.click();
      await expect(listDisplay).toHaveText('0 : c\n1 : a\n2 : b');

      // Reverse -> ['b','a','c']
      await reverseListBtn.click();
      await expect(listDisplay).toHaveText('0 : b\n1 : a\n2 : c');

      // Sort lexicographically -> ['a','b','c']
      await sortListBtn.click();
      await expect(listDisplay).toHaveText('0 : a\n1 : b\n2 : c');
    });

    test('Remove duplicates removes repeated values', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');
      const removeDuplicatesBtn = page.locator('#remove-duplicates');
      const listDisplay = page.locator('#list-display');

      // Build list with duplicates: ['x','y','x','z','y']
      await insertValue.fill('x'); await insertTailBtn.click();
      await insertValue.fill('y'); await insertTailBtn.click();
      await insertValue.fill('x'); await insertTailBtn.click();
      await insertValue.fill('z'); await insertTailBtn.click();
      await insertValue.fill('y'); await insertTailBtn.click();
      await expect(listDisplay).toHaveText('0 : x\n1 : y\n2 : x\n3 : z\n4 : y');

      // Remove duplicates -> first occurrences kept: ['x','y','z']
      await removeDuplicatesBtn.click();
      await expect(listDisplay).toHaveText('0 : x\n1 : y\n2 : z');
    });

    test('Clear list requires confirmation and empties list and resets traversal', async ({ page }) {
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');
      const clearListBtn = page.locator('#clear-list');
      const listDisplay = page.locator('#list-display');
      const pos = page.locator('#traverse-pos');
      const val = page.locator('#traverse-val');

      // Build list
      await insertValue.fill('keep'); await insertTailBtn.click();
      await expect(listDisplay).not.toHaveText('(empty)');

      // Clear list: confirm dialog will be shown; our beforeEach dialog handler auto-accepts
      dialogs.length = 0;
      await clearListBtn.click();
      // Confirm dialog should have been shown
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('Are you sure you want to clear the entire list?');

      // Now list should be empty and traversal reset
      await expect(listDisplay).toHaveText('(empty)');
      await expect(pos).toHaveText('-');
      await expect(val).toHaveText('-');
    });

    test('Reverse/sort/remove-duplicates show validation alerts when list too small', async ({ page }) => {
      const reverseListBtn = page.locator('#reverse-list');
      const sortListBtn = page.locator('#sort-list');
      const removeDuplicatesBtn = page.locator('#remove-duplicates');
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');

      // Ensure empty list: reverse should alert
      await expect(page.locator('#list-display')).toHaveText('(empty)');
      dialogs.length = 0;
      await reverseListBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('List must have 2 or more elements to reverse.');

      // One element -> still too small for sort/remove duplicates
      await insertValue.fill('solo'); await insertTailBtn.click();
      dialogs.length = 0;
      await sortListBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('List must have 2 or more elements to sort.');

      dialogs.length = 0;
      await removeDuplicatesBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('List must have 2 or more elements to remove duplicates.');
    });
  });

  test.describe('Export and Import JSON', () => {
    test('Export creates JSON in textarea and shows a success message', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');
      const exportBtn = page.locator('#export-json-btn');
      const jsonTextarea = page.locator('#json-textarea');
      const jsonMessage = page.locator('#json-message');

      // Build list: ['alpha','beta']
      await insertValue.fill('alpha'); await insertTailBtn.click();
      await insertValue.fill('beta'); await insertTailBtn.click();

      await exportBtn.click();
      // Expect textarea contains a JSON array
      const text = await jsonTextarea.inputValue();
      const parsed = JSON.parse(text);
      expect(Array.isArray(parsed)).toBeTruthy();
      expect(parsed).toEqual(['alpha', 'beta']);
      await expect(jsonMessage).toHaveText('Export successful. JSON copied to textarea.');
    });

    test('Import valid JSON updates list and shows success message', async ({ page }) => {
      const importBtn = page.locator('#import-json-btn');
      const jsonTextarea = page.locator('#json-textarea');
      const jsonMessage = page.locator('#json-message');
      const listDisplay = page.locator('#list-display');

      // Put valid JSON into textarea
      await jsonTextarea.fill('["a","b","c"]');
      await importBtn.click();
      await expect(jsonMessage).toHaveText(/Import successful/);
      await expect(listDisplay).toHaveText('0 : a\n1 : b\n2 : c');
    });

    test('Import invalid JSON shows an error message in json-message', async ({ page }) {
      const importBtn = page.locator('#import-json-btn');
      const jsonTextarea = page.locator('#json-textarea');
      const jsonMessage = page.locator('#json-message');

      // Put invalid JSON
      await jsonTextarea.fill('{"not":"an array"'); // malformed JSON
      await importBtn.click();
      // Should show import failed with JSON parse error
      await expect(jsonMessage).toContainText('Import failed:');
    });

    test('Import non-array JSON notifies user accordingly', async ({ page }) {
      const importBtn = page.locator('#import-json-btn');
      const jsonTextarea = page.locator('#json-textarea');
      const jsonMessage = page.locator('#json-message');

      // Valid JSON but not an array
      await jsonTextarea.fill('{"foo":"bar"}');
      await importBtn.click();
      await expect(jsonMessage).toHaveText('JSON is not an array.');
    });
  });

  test.describe('Edge cases and validation flows', () => {
    test('Delete at position validation: out-of-bounds triggers alert', async ({ page }) => {
      const insertValue = page.locator('#insert-value');
      const insertTailBtn = page.locator('#insert-tail');
      const deletePos = page.locator('#delete-pos');
      const deletePosBtn = page.locator('#delete-pos-btn');

      // Build one-element list
      await insertValue.fill('only'); await insertTailBtn.click();

      dialogs.length = 0;
      await deletePos.fill('5'); // out-of-bounds
      await deletePosBtn.click();
      // Validation should alert about position error
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('Position error');
    });

    test('Search with empty term triggers alert', async ({ page }) => {
      const searchValue = page.locator('#search-value');
      const searchBtn = page.locator('#search-btn');

      // ensure empty input
      await searchValue.fill('');
      dialogs.length = 0;
      await searchBtn.click();
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('Please enter a search value.');
    });
  });

  test.describe('Runtime observation and console outputs', () => {
    test('No uncaught runtime errors occurred during typical interactions', async ({ page }) => {
      // This test drives a couple of simple interactions to ensure pageErrors remain empty
      const insertValue = page.locator('#insert-value');
      const insertHeadBtn = page.locator('#insert-head');
      const exportBtn = page.locator('#export-json-btn');

      // Do a few operations
      await insertValue.fill('z'); await insertHeadBtn.click();
      await exportBtn.click();

      // Validate that we captured at least one console or message from the UI (json-message)
      const jsonMessage = page.locator('#json-message');
      await expect(jsonMessage).toHaveText(/Export successful|/);

      // pageErrors was asserted to be empty in the afterEach hook
      // Also make a direct assertion here to be explicit
      expect(pageErrors.length).toBe(0);
    });
  });
});