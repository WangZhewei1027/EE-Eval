import { test, expect } from '@playwright/test';

// Test file for Application ID: 1212a011-fa7a-11f0-acf9-69409043402d
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/1212a011-fa7a-11f0-acf9-69409043402d.html
//
// This suite validates the Interactive Queue Explorer implementation against the FSM.
// It covers all events/transitions described in the FSM, checks UI updates, log messages,
// edge cases, and undo/redo behavior. It also observes page errors and console messages
// (if any) and asserts expected outcomes. We intentionally do not modify the page code
// — we load it "as-is" and allow runtime/log errors to occur naturally.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1212a011-fa7a-11f0-acf9-69409043402d.html';

// Page Object Model for the Queue page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs and buttons
    this.elEnqueue = page.locator('#input-enqueue');
    this.btnEnqueue = page.locator('#btn-enqueue');
    this.btnDequeue = page.locator('#btn-dequeue');
    this.btnPeek = page.locator('#btn-peek');
    this.btnClear = page.locator('#btn-clear');

    this.elBulk = page.locator('#input-bulk-enqueue');
    this.btnBulk = page.locator('#btn-bulk-enqueue');

    this.elEnqPos = page.locator('#input-enqueue-position');
    this.elEnqPosVal = page.locator('#input-enqueue-pos-value');
    this.btnEnqAt = page.locator('#btn-enqueue-at');

    this.elRemPos = page.locator('#input-remove-position');
    this.btnRemAt = page.locator('#btn-remove-at');

    this.elFindVal = page.locator('#input-find-value');
    this.btnFind = page.locator('#btn-find');

    this.elRotateCount = page.locator('#input-rotate-count');
    this.btnRotate = page.locator('#btn-rotate');

    this.elReverseLen = page.locator('#input-reverse-length');
    this.btnReverse = page.locator('#btn-reverse');

    this.elQueueVisual = page.locator('#queue-visual');

    this.elSize = page.locator('#queue-size');
    this.elFront = page.locator('#queue-front');
    this.elBack = page.locator('#queue-back');
    this.elEmpty = page.locator('#queue-empty');

    this.elMaxSize = page.locator('#input-max-size');
    this.btnSetMax = page.locator('#btn-set-max-size');

    this.elCountEqualVal = page.locator('#input-compare-value');
    this.btnCountEqual = page.locator('#btn-count-equal');

    this.elFilterCond = page.locator('#input-filter-condition');
    this.btnFilter = page.locator('#btn-filter');
    this.btnResetFilter = page.locator('#btn-reset-filter');

    this.elMapFunc = page.locator('#input-map-function');
    this.btnMap = page.locator('#btn-map');
    this.btnResetMap = page.locator('#btn-reset-map');

    this.btnHistBack = page.locator('#btn-history-back');
    this.btnHistFwd = page.locator('#btn-history-forward');

    this.elLog = page.locator('#log');
  }

  async enqueue(value) {
    await this.elEnqueue.fill(value);
    await this.btnEnqueue.click();
  }

  async enqueueEmpty() {
    await this.elEnqueue.fill('');
    await this.btnEnqueue.click();
  }

  async dequeue() {
    await this.btnDequeue.click();
  }

  async peek() {
    await this.btnPeek.click();
  }

  // Accept or dismiss confirm depending on acceptArg (true accept, false dismiss)
  async clearQueue(accept = true) {
    // Wait for dialog and accept/dismiss accordingly
    this.page.once('dialog', async (dialog) => {
      if (accept) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
    await this.btnClear.click();
  }

  async bulkEnqueue(...values) {
    // values provided as array of strings; join with commas/newlines
    await this.elBulk.fill(values.join(','));
    await this.btnBulk.click();
  }

  async enqueueAt(position, value) {
    await this.elEnqPos.fill(String(position));
    await this.elEnqPosVal.fill(value);
    await this.btnEnqAt.click();
  }

  async removeAt(position) {
    await this.elRemPos.fill(String(position));
    await this.btnRemAt.click();
  }

  async find(value) {
    await this.elFindVal.fill(value);
    await this.btnFind.click();
  }

  async rotate(n) {
    await this.elRotateCount.fill(String(n));
    await this.btnRotate.click();
  }

  async reverse(n) {
    await this.elReverseLen.fill(String(n));
    await this.btnReverse.click();
  }

  async setMaxSize(n) {
    await this.elMaxSize.fill(String(n));
    await this.btnSetMax.click();
  }

  async countEqual(value) {
    await this.elCountEqualVal.fill(value);
    await this.btnCountEqual.click();
  }

  async filter(cond) {
    await this.elFilterCond.fill(cond);
    await this.btnFilter.click();
  }

  async resetFilter() {
    await this.btnResetFilter.click();
  }

  async map(expr) {
    await this.elMapFunc.fill(expr);
    await this.btnMap.click();
  }

  async resetMap() {
    await this.btnResetMap.click();
  }

  async undo() {
    await this.btnHistBack.click();
  }

  async redo() {
    await this.btnHistFwd.click();
  }

  // Helpers to read UI state
  async getSize() {
    return Number(await this.elSize.textContent());
  }

  async getFront() {
    return (await this.elFront.textContent()).trim();
  }

  async getBack() {
    return (await this.elBack.textContent()).trim();
  }

  async isEmptyText() {
    return (await this.elEmpty.textContent()).trim();
  }

  async getVisualItems() {
    const spans = this.elQueueVisual.locator('span');
    const count = await spans.count();
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push((await spans.nth(i).textContent()).trim());
    }
    if (count === 0) {
      // Could be "(empty)" text visible
      const txt = (await this.elQueueVisual.textContent()).trim();
      if (txt) items.push(txt);
    }
    return items;
  }

  async logContains(substring) {
    return (await this.elLog.textContent()).includes(substring);
  }

  async getLogText() {
    return (await this.elLog.textContent()).trim();
  }
}

// Capture page errors and console messages centrally for each test run
test.describe('Interactive Queue Explorer - FSM-based E2E tests', () => {
  test.beforeEach(async ({ page }) => {
    // Nothing global here; individual tests will navigate and set up listeners.
  });

  // Comprehensive happy-path and edge-case tests
  test('Initial state: UI should reflect empty queue and log "Queue Explorer loaded"', async ({ page }) => {
    // Setup listeners for console and errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    const q = new QueuePage(page);

    // Verify initial UI elements reflect empty queue (S0_Initial / S2_QueueEmpty)
    await expect(q.elSize).toHaveText('0');
    await expect(q.elEmpty).toHaveText('True');
    await expect(q.elFront).toHaveText('N/A');
    await expect(q.elBack).toHaveText('N/A');

    // Visual should show "(empty)"
    const visual = await q.getVisualItems();
    expect(visual.length).toBeGreaterThan(0);
    expect(visual[0]).toContain('(empty)');

    // Log should contain "Queue Explorer loaded"
    await expect(q.elLog).toContainText('Queue Explorer loaded');

    // There should be no unhandled page errors (pageerror). We capture and assert none occurred.
    expect(pageErrors.length).toBe(0);

    // Console messages may exist; ensure they don't include uncaught exceptions.
    const consoleText = consoleMessages.map(c => c.text).join('\n');
    expect(consoleText).not.toMatch(/Uncaught|ReferenceError|SyntaxError|TypeError/);
  });

  test('Enqueue -> transitions to non-empty state; Dequeue/Peek/Enqueue empty validations', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e));

    await page.goto(APP_URL);
    const q = new QueuePage(page);

    // Enqueue "alpha" and validate transition to S1_QueueNotEmpty
    await q.enqueue('alpha');
    await expect(q.elSize).toHaveText('1');
    expect(await q.getFront()).toBe('alpha');
    expect(await q.getBack()).toBe('alpha');
    await expect(q.elEmpty).toHaveText('False');

    // Visual contains "alpha"
    const items = await q.getVisualItems();
    expect(items[0]).toBe('alpha');

    // Enqueue empty string -> should log an error and not change size
    await q.enqueueEmpty();
    await expect(q.elSize).toHaveText('1'); // unchanged
    await expect(q.elLog).toContainText('Enqueue: Cannot enqueue empty value');

    // Peek should log front element and not change queue
    await q.peek();
    await expect(q.elSize).toHaveText('1');
    await expect(q.elLog).toContainText('Peek: Front element is "alpha"');

    // Dequeue should remove front element and update UI
    await q.dequeue();
    await expect(q.elSize).toHaveText('0');
    await expect(q.elEmpty).toHaveText('True');
    await expect(q.elLog).toContainText('Dequeue: Removed front element');

    // No unhandled page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Bulk enqueue, enqueue at position, remove at position, find operation and edge find-case', async ({ page }) => {
    await page.goto(APP_URL);
    const q = new QueuePage(page);

    // Bulk enqueue multiple items
    await q.bulkEnqueue('one', 'two', 'three');
    await expect(q.elSize).toHaveText('3');
    let items = await q.getVisualItems();
    // Order should be as enqueued: one, two, three
    expect(items[0]).toBe('one');
    expect(items[1]).toBe('two');
    expect(items[2]).toBe('three');
    await expect(q.elLog).toContainText('Bulk Enqueue: Added');

    // Enqueue at specific position: insert 'inserted' at index 1 -> one, inserted, two, three
    await q.enqueueAt(1, 'inserted');
    await expect(q.elSize).toHaveText('4');
    items = await q.getVisualItems();
    expect(items[0]).toBe('one');
    expect(items[1]).toBe('inserted');
    expect(items[2]).toBe('two');

    await expect(q.elLog).toContainText('Enqueue at Position: Added "inserted" at index 1');

    // Remove at invalid position -> log Invalid position and size unchanged
    await q.removeAt(99);
    await expect(q.elLog).toContainText('Remove at Position: Invalid position');
    await expect(q.elSize).toHaveText('4');

    // Remove at valid position 1 -> removes 'inserted'
    await q.removeAt(1);
    await expect(q.elLog).toContainText('Remove at Position: Removed element');
    await expect(q.elSize).toHaveText('3');
    items = await q.getVisualItems();
    expect(items).toEqual(['one', 'two', 'three']);

    // Find existing value
    await q.find('two');
    await expect(q.elLog).toContainText('Find: Value "two" found at index');

    // Find with empty input -> logs no value provided
    await q.find('');
    await expect(q.elLog).toContainText('Find: No value provided');
  });

  test('Rotate and Reverse behaviors including 0/invalid inputs', async ({ page }) => {
    await page.goto(APP_URL);
    const q = new QueuePage(page);

    // Prepare a known queue
    await q.bulkEnqueue('A', 'B', 'C', 'D'); // A B C D
    await expect(q.elSize).toHaveText('4');

    // Rotate by 1 => D A B C
    await q.rotate(1);
    let items = await q.getVisualItems();
    expect(items).toEqual(['D', 'A', 'B', 'C']);
    await expect(q.elLog).toContainText('Rotate: Queue rotated right by 1');

    // Rotate by 0 => should log rotation count is zero
    await q.rotate(0);
    await expect(q.elLog).toContainText('Rotate: Rotation count is zero');

    // Reverse first 2 elements: should reverse D,A -> A,D,B,C
    await q.reverse(2);
    items = await q.getVisualItems();
    expect(items).toEqual(['A', 'D', 'B', 'C']);
    await expect(q.elLog).toContainText('Reverse: First 2 elements reversed');

    // Reverse with negative N -> logs "N cannot be negative"
    await q.reverse(-3);
    await expect(q.elLog).toContainText('Reverse: N cannot be negative');
  });

  test('Set max size, enqueue respecting max size, and invalid max size handling', async ({ page }) => {
    await page.goto(APP_URL);
    const q = new QueuePage(page);

    // Set invalid max size (-1) -> logs invalid
    await q.setMaxSize(-1);
    await expect(q.elLog).toContainText('Max Size: Invalid max size');

    // Set max size to 2
    await q.setMaxSize(2);
    await expect(q.elLog).toContainText('Max Size: Queue max size set to 2');

    // Enqueue two elements -> allowed
    await q.enqueue('x1');
    await q.enqueue('x2');
    await expect(q.elSize).toHaveText('2');

    // Enqueue third -> should be blocked due to max size
    await q.enqueue('x3');
    await expect(q.elLog).toContainText('Enqueue: Max size 2 reached');
    // Size remains 2
    await expect(q.elSize).toHaveText('2');
  });

  test('Count Equal and advanced Filter/Map operations including invalid expressions', async ({ page }) => {
    await page.goto(APP_URL);
    const q = new QueuePage(page);

    // Prepare queue with duplicates and various strings
    await q.clearQueue(true); // ensure empty
    await q.bulkEnqueue('apple', 'banana', 'apple', 'apricot', 'Apple');
    await expect(q.elSize).toHaveText('5');

    // Count equal existing value (case-sensitive)
    await q.countEqual('apple');
    await expect(q.elLog).toContainText('Count Equal: Found 2 element(s) strictly equal to "apple"');

    // Count equal with empty input -> logs no value provided
    await q.countEqual('');
    await expect(q.elLog).toContainText('Count Equal: No value provided');

    // Filter with valid condition: start with 'a' lowercase
    await q.filter("x.startsWith('a')");
    // Visual should contain only apple, apple, apricot (in order)
    let items = await q.getVisualItems();
    // Only first letters that start with lowercase 'a' should remain
    expect(items).toEqual(['apple', 'apple', 'apricot']);
    await expect(q.elLog).toContainText('Filter: Condition applied');

    // Reset filter
    await q.resetFilter();
    await expect(q.elLog).toContainText('Filter: Filter reset to show all elements');
    items = await q.getVisualItems();
    expect(items).toContain('banana');
    expect(items.length).toBe(5);

    // Filter with invalid JS expression -> should log error (caught internally)
    await q.filter('x >'); // syntax error
    await expect(q.elLog).toContainText('Filter: Error'); // message varies by browser, just assert contains 'Filter: Error'

    // Map with valid expression: upper-case all strings (mapActive)
    await q.map('x.toUpperCase()');
    items = await q.getVisualItems();
    // Items should be uppercase versions
    expect(items).toContain('BANANA');
    expect(items).toContain('APPLE');
    await expect(q.elLog).toContainText('Map: Mapping function applied');

    // Reset map
    await q.resetMap();
    await expect(q.elLog).toContainText('Map: Mapping reset to identity');

    // Map with invalid expression -> logs error in map
    await q.map('x.toUpperCase('); // invalid syntax
    await expect(q.elLog).toContainText('Map: Error in map expression');
  });

  test('Undo and Redo operations revert and reapply queue state history', async ({ page }) => {
    await page.goto(APP_URL);
    const q = new QueuePage(page);

    // Ensure starting empty
    await q.clearQueue(true);
    await expect(q.elSize).toHaveText('0');

    // Enqueue sequence: A, B, C
    await q.enqueue('A');
    await q.enqueue('B');
    await q.enqueue('C');
    await expect(q.elSize).toHaveText('3');
    let items = await q.getVisualItems();
    expect(items).toEqual(['A', 'B', 'C']);

    // Undo should step back to size 2 (removing last operation which was enqueue C)
    await q.undo();
    await expect(q.elLog).toContainText('Undo: Reverted to previous queue state');
    await expect(q.elSize).toHaveText('2');
    items = await q.getVisualItems();
    expect(items).toEqual(['A', 'B']);

    // Undo again -> size 1
    await q.undo();
    await expect(q.elSize).toHaveText('1');
    items = await q.getVisualItems();
    expect(items).toEqual(['A']);

    // Redo -> reapply B
    await q.redo();
    await expect(q.elLog).toContainText('Redo: Reapplied next queue state');
    await expect(q.elSize).toHaveText('2');
    items = await q.getVisualItems();
    expect(items).toEqual(['A', 'B']);

    // Redo again -> reapply C
    await q.redo();
    await expect(q.elSize).toHaveText('3');
    items = await q.getVisualItems();
    expect(items).toEqual(['A', 'B', 'C']);
  });

  test('Clear queue confirmation: dismiss vs accept behaviors', async ({ page }) => {
    await page.goto(APP_URL);
    const q = new QueuePage(page);

    // Ensure queue has items
    await q.clearQueue(true); // ensure empty baseline
    await q.bulkEnqueue('p', 'q');
    await expect(q.elSize).toHaveText('2');

    // Click Clear and dismiss the confirm -> queue should remain unchanged
    // We'll explicitly listen for the dialog and dismiss
    page.once('dialog', async dialog => {
      await dialog.dismiss();
    });
    await q.btnClear.click();
    // Size should remain unchanged
    await expect(q.elSize).toHaveText('2');
    await expect(q.elLog).not.toContainText('Clear: Queue emptied');

    // Now accept the clear dialog
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await q.btnClear.click();
    // Now queue should be emptied
    await expect(q.elSize).toHaveText('0');
    await expect(q.elLog).toContainText('Clear: Queue emptied');
  });

  // Final test to ensure no uncaught page errors appeared during a full flow
  test('No unhandled page errors during typical interactions', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);
    const q = new QueuePage(page);

    // Perform several operations in sequence simulating a user session
    await q.bulkEnqueue('r1', 'r2', 'r3');
    await q.enqueueAt(1, 'r1.5');
    await q.filter("x.includes('r')");
    await q.map('x.toUpperCase()');
    await q.resetMap();
    await q.resetFilter();
    await q.rotate(2);
    await q.reverse(0);
    await q.countEqual('r2');
    await q.find('not-present');
    await q.dequeue();
    await q.clearQueue(true);

    // Assert no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});