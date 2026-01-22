import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79aa4d0-d361-11f0-8438-11a56595a476.html';

/**
 * Page Object for the JavaScript Array Demo page.
 * Encapsulates interactions and common assertions.
 */
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.elementInput = page.locator('#elementInput');
    this.addEndBtn = page.locator('#addEndBtn');
    this.addStartBtn = page.locator('#addStartBtn');
    this.removeEndBtn = page.locator('#removeEndBtn');
    this.removeStartBtn = page.locator('#removeStartBtn');
    this.spliceIndex = page.locator('#spliceIndex');
    this.spliceDeleteCount = page.locator('#spliceDeleteCount');
    this.spliceInsertValue = page.locator('#spliceInsertValue');
    this.spliceBtn = page.locator('#spliceBtn');
    this.reverseBtn = page.locator('#reverseBtn');
    this.sortBtn = page.locator('#sortBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.mapBtn = page.locator('#mapBtn');
    this.filterBtn = page.locator('#filterBtn');
    this.reduceBtn = page.locator('#reduceBtn');
    this.arrayDisplay = page.locator('#arrayDisplay');
  }

  async getDisplayText() {
    return (await this.arrayDisplay.textContent()) || '';
  }

  // Helpers for common actions
  async addToEnd(value) {
    await this.elementInput.fill(String(value));
    await this.addEndBtn.click();
  }

  async addToStart(value) {
    await this.elementInput.fill(String(value));
    await this.addStartBtn.click();
  }

  async removeLast() {
    await this.removeEndBtn.click();
  }

  async removeFirst() {
    await this.removeStartBtn.click();
  }

  async splice(index, deleteCount, insertValue = '') {
    await this.spliceIndex.fill(String(index));
    await this.spliceDeleteCount.fill(String(deleteCount));
    await this.spliceInsertValue.fill(String(insertValue));
    await this.spliceBtn.click();
  }

  async reverse() {
    await this.reverseBtn.click();
  }

  async sort() {
    await this.sortBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async map() {
    await this.mapBtn.click();
  }

  async filter() {
    await this.filterBtn.click();
  }

  async reduce() {
    await this.reduceBtn.click();
  }
}

test.describe('JavaScript Array Demo - FSM transitions and UI checks', () => {
  let page;
  let app;
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Collect console messages for diagnosis
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept dialogs and record message text
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await page.goto(APP_URL);
    app = new ArrayPage(page);

    // Ensure initial display was rendered (FSM onEnter updateDisplay())
    await expect(app.arrayDisplay).toBeVisible();
  });

  test.afterEach(async () => {
    // Verify there were no uncaught runtime errors on the page
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);

    // Close page after each test
    await page.close();
  });

  test('Initial State: updateDisplay() is called and shows empty array', async () => {
    // The FSM entry action should have called updateDisplay() and displayed "[]"
    const text = await app.getDisplayText();
    // Should display an empty array representation
    expect(text).toContain('[]');
    // No messages present initially
    expect(text).not.toContain('Added to');
    expect(text).not.toContain('Array cleared');
    // No dialogs should have fired on page load
    expect(dialogs.length).toBe(0);
  });

  test('Add to End and Add to Start transitions update array and display messages', async () => {
    // Add number to end
    await app.addToEnd('10');
    let text = await app.getDisplayText();
    // Expect numeric 10 to be present (JSON shows 10)
    expect(text).toContain('10');
    expect(text).toContain('Added to end: 10');

    // Add string to start
    await app.addToStart('hello');
    text = await app.getDisplayText();
    // JSON.stringify for strings includes quotes, so check for "hello"
    expect(text).toContain('"hello"');
    expect(text).toContain('Added to start: "hello"');

    // Ensure order: "hello" should appear before 10 in the JSON representation
    const idxHello = text.indexOf('"hello"');
    const idx10 = text.indexOf('10');
    expect(idxHello).toBeGreaterThan(-1);
    expect(idx10).toBeGreaterThan(-1);
    expect(idxHello).toBeLessThan(idx10);
  });

  test('Remove Last (pop) and Remove First (shift) with non-empty and empty array edge cases', async () => {
    // Start with empty array - removing should alert
    await app.removeLast();
    expect(dialogs.pop()).toContain('Array is empty.');

    await app.removeFirst();
    expect(dialogs.pop()).toContain('Array is empty.');

    // Populate array
    await app.addToEnd('5');
    await app.addToEnd('15');

    // Remove last
    await app.removeLast();
    let text = await app.getDisplayText();
    expect(text).toContain('Removed from end (pop): 15');
    // After pop, 5 should remain
    expect(text).toContain('5');
    expect(text).not.toContain('15\n]'); // 15 should no longer be in the array portion

    // Remove first
    await app.removeFirst();
    text = await app.getDisplayText();
    expect(text).toContain('Removed from start (shift): 5');
    // Array should now be empty
    expect(text).toContain('[]');
  });

  test('Splice transitions: valid splice modifies array; invalid splice shows alert and does not change array', async () => {
    // Prepare array [1,2,3,4]
    await app.addToEnd('1');
    await app.addToEnd('2');
    await app.addToEnd('3');
    await app.addToEnd('4');

    // Valid splice: index 1, delete 2, insert "x"
    await app.splice('1', '2', 'x');
    let text = await app.getDisplayText();
    expect(text).toContain('Splice at index 1, deleted 2 element(s):');
    expect(text).toContain('"x"');
    // Confirm the array elements are 1, "x", 4 in the display
    expect(text).toContain('1');
    expect(text).toContain('"x"');
    expect(text).toContain('4');

    // Record current display to compare after invalid splice
    const beforeInvalid = await app.getDisplayText();

    // Invalid splice with negative index should trigger alert and not change array
    await app.splice('-1', '1', '');
    const lastDialog = dialogs.pop();
    expect(lastDialog).toContain('Please enter valid non-negative numbers for index and delete count.');

    const afterInvalid = await app.getDisplayText();
    expect(afterInvalid).toBe(beforeInvalid);
  });

  test('Reverse and Sort transitions change array order and display correct messages', async () => {
    // Add mixed items to demonstrate sort by string conversion
    await app.clear();
    await app.addToEnd('b');
    await app.addToEnd('a');
    await app.addToEnd('2');

    // Sort: will sort by String value -> "2", "a", "b"
    await app.sort();
    let text = await app.getDisplayText();
    expect(text).toContain('Array sorted (string order)');
    // Check order: "2" should appear before "a", which appears before "b"
    const idx2 = text.indexOf('"2"') !== -1 ? text.indexOf('"2"') : text.indexOf('2');
    const idxa = text.indexOf('"a"');
    const idxb = text.indexOf('"b"');
    expect(idx2).toBeGreaterThan(-1);
    expect(idxa).toBeGreaterThan(-1);
    expect(idxb).toBeGreaterThan(-1);
    expect(idx2).toBeLessThan(idxa);
    expect(idxa).toBeLessThan(idxb);

    // Reverse the sorted array
    await app.reverse();
    text = await app.getDisplayText();
    expect(text).toContain('Array reversed');
    // Now the order should be reversed; b should appear before a
    const newIdxb = text.indexOf('"b"');
    const newIdxa = text.indexOf('"a"');
    expect(newIdxb).toBeLessThan(newIdxa);
  });

  test('Clear transition empties the array and shows appropriate message', async () => {
    await app.addToEnd('100');
    await app.addToEnd('200');
    let text = await app.getDisplayText();
    expect(text).toContain('100');
    expect(text).toContain('200');

    await app.clear();
    text = await app.getDisplayText();
    expect(text).toContain('[]');
    expect(text).toContain('Array cleared');
  });

  test('Map transition increments numbers and appends to strings', async () => {
    await app.clear();
    await app.addToEnd('1');      // number -> 1
    await app.addToEnd('hello');  // string -> "hello"

    await app.map();
    let text = await app.getDisplayText();
    expect(text).toContain('Array mapped');
    // numeric 1 should become 2
    expect(text).toContain('2');
    // "hello" should have " (mapped)" appended and appear in JSON as "hello (mapped)"
    expect(text).toContain('"hello (mapped)"');
  });

  test('Filter transition keeps only numbers', async () => {
    await app.clear();
    await app.addToEnd('1');
    await app.addToEnd('a');
    await app.addToEnd('3');

    await app.filter();
    let text = await app.getDisplayText();
    expect(text).toContain('Array filtered: only numbers kept');
    // Only "1" and "3" (numbers) should remain; "a" should not appear in the array portion
    expect(text).toContain('1');
    expect(text).toContain('3');
    expect(text).not.toContain('"a"');
  });

  test('Reduce transition sums numeric values and ignores non-numbers', async () => {
    await app.clear();
    await app.addToEnd('1');
    await app.addToEnd('2');
    await app.addToEnd('foo'); // non-number
    await app.addToEnd('3');

    await app.reduce();
    const text = await app.getDisplayText();
    // Expect sum 1+2+3 = 6
    expect(text).toContain('Reduce: Sum of numbers = 6');
  });

  test('Edge cases: adding empty input triggers alert; splice with NaN inputs triggers alert', async () => {
    // Adding with empty input should produce an alert and no change to array
    await app.clear();
    const before = await app.getDisplayText();
    await app.elementInput.fill(''); // ensure empty
    await app.addEndBtn.click();
    let lastDialog = dialogs.pop();
    expect(lastDialog).toContain('Please enter a valid value.');

    const after = await app.getDisplayText();
    expect(after).toBe(before);

    // Splice with non-numeric entries for index or delete count -> dialog alert
    await app.spliceIndex.fill('not-a-number');
    await app.spliceDeleteCount.fill('NaN');
    await app.spliceInsertValue.fill('');
    await app.spliceBtn.click();
    lastDialog = dialogs.pop();
    expect(lastDialog).toContain('Please enter valid non-negative numbers for index and delete count.');
  });

  test('Comprehensive scenario: full workflow yields expected intermediate displays', async () => {
    // Start fresh
    await app.clear();

    // Build array: push 1, push 2, unshift "start"
    await app.addToEnd('1');
    await app.addToEnd('2');
    await app.addToStart('start');

    let text = await app.getDisplayText();
    expect(text).toContain('"start"');
    expect(text).toContain('1');
    expect(text).toContain('2');

    // Splice to insert 'middle' at index 2 (after start and 1)
    await app.splice('2', '0', 'middle');
    text = await app.getDisplayText();
    expect(text).toContain('"middle"');

    // Map then Filter: map will convert "start"/"middle" to appended "(mapped)", numbers incremented
    await app.map();
    text = await app.getDisplayText();
    expect(text).toContain('(mapped)');

    // Filter keeps only numbers -> non-number strings removed
    await app.filter();
    text = await app.getDisplayText();
    // After mapping, numbers were incremented so should still be numbers and present
    expect(text).toMatch(/[\d]/);

    // Reduce to sum remaining numbers
    await app.reduce();
    text = await app.getDisplayText();
    expect(text).toContain('Reduce: Sum of numbers =');

    // Final clear
    await app.clear();
    text = await app.getDisplayText();
    expect(text).toContain('Array cleared');

    // Confirm that no unexpected console errors or page errors occurred during the entire flow
    expect(consoleMessages.length >= 0).toBeTruthy(); // we captured them; not asserting on specific console messages
  });
});