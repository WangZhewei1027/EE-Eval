import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2c9dc2-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object Model for the Deque app to encapsulate interactions and state queries
class DequePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputValue = page.locator('#inputValue');
    this.batchCount = page.locator('#batchCount');
    this.batchPrefix = page.locator('#batchPrefix');
    this.searchValue = page.locator('#searchValue');

    this.btnPushFront = page.locator("button[onclick='pushFront()']");
    this.btnPushBack = page.locator("button[onclick='pushBack()']");
    this.btnPopFront = page.locator("button[onclick='popFront()']");
    this.btnPopBack = page.locator("button[onclick='popBack()']");
    this.btnPeekFront = page.locator("button[onclick='peekFront()']");
    this.btnPeekBack = page.locator("button[onclick='peekBack()']");
    this.btnClear = page.locator("button[onclick='clearDeque()']");
    this.btnBatchAddFront = page.locator("button[onclick='batchAddFront()']");
    this.btnBatchAddBack = page.locator("button[onclick='batchAddBack()']");
    this.btnFind = page.locator("button[onclick='findValue()']");
    this.btnCount = page.locator("button[onclick='countOccurrences()']");
    this.btnRemoveAll = page.locator("button[onclick='removeAllOccurrences()']");
    this.btnReverse = page.locator("button[onclick='reverseDeque()']");
    this.btnRotateLeft = page.locator("button[onclick='rotateLeft()']");
    this.btnRotateRight = page.locator("button[onclick='rotateRight()']");
    this.btnShuffle = page.locator("button[onclick='shuffleDeque()']");

    this.dequeItems = page.locator('#deque .deque-item');
    this.emptyMessage = page.locator('#deque .empty-message');

    this.size = page.locator('#size');
    this.front = page.locator('#front');
    this.back = page.locator('#back');
    this.lastOp = page.locator('#lastOp');
  }

  // Helpers to read state
  async getItems() {
    // returns array of strings of deque items in order
    // if empty, returns []
    const count = await this.dequeItems.count();
    if (count === 0) return [];
    return this.dequeItems.allTextContents();
  }

  async getStats() {
    return {
      size: parseInt((await this.size.textContent()) || '0', 10),
      front: (await this.front.textContent()) || '',
      back: (await this.back.textContent()) || '',
      lastOp: (await this.lastOp.textContent()) || '',
    };
  }

  // Actions
  async pushFront(value) {
    await this.inputValue.fill(value);
    await this.btnPushFront.click();
    await this.waitForLastOpChange();
  }

  async pushBack(value) {
    await this.inputValue.fill(value);
    await this.btnPushBack.click();
    await this.waitForLastOpChange();
  }

  async popFront() {
    await this.btnPopFront.click();
    await this.waitForLastOpChange();
  }

  async popBack() {
    await this.btnPopBack.click();
    await this.waitForLastOpChange();
  }

  async peekFront() {
    await this.btnPeekFront.click();
    await this.waitForLastOpChange();
  }

  async peekBack() {
    await this.btnPeekBack.click();
    await this.waitForLastOpChange();
  }

  async clear() {
    await this.btnClear.click();
    await this.waitForLastOpChange();
  }

  async batchAddFront(count, prefix) {
    if (count !== undefined) await this.batchCount.fill(String(count));
    if (prefix !== undefined) await this.batchPrefix.fill(prefix);
    await this.btnBatchAddFront.click();
    await this.waitForLastOpChange();
  }

  async batchAddBack(count, prefix) {
    if (count !== undefined) await this.batchCount.fill(String(count));
    if (prefix !== undefined) await this.batchPrefix.fill(prefix);
    await this.btnBatchAddBack.click();
    await this.waitForLastOpChange();
  }

  async findValue(value) {
    await this.searchValue.fill(value);
    await this.btnFind.click();
    await this.waitForLastOpChange();
  }

  async countOccurrences(value) {
    await this.searchValue.fill(value);
    await this.btnCount.click();
    await this.waitForLastOpChange();
  }

  async removeAll(value) {
    await this.searchValue.fill(value);
    await this.btnRemoveAll.click();
    await this.waitForLastOpChange();
  }

  async reverseDeque() {
    await this.btnReverse.click();
    await this.waitForLastOpChange();
  }

  async rotateLeft() {
    await this.btnRotateLeft.click();
    await this.waitForLastOpChange();
  }

  async rotateRight() {
    await this.btnRotateRight.click();
    await this.waitForLastOpChange();
  }

  async shuffleDeque() {
    await this.btnShuffle.click();
    await this.waitForLastOpChange();
  }

  // Utility: wait until lastOp changes (simple strategy: wait for any visible text content to appear)
  async waitForLastOpChange() {
    // Wait briefly for DOM update - rely on Playwright's locator waiting
    await expect(this.lastOp).toBeVisible();
    // small delay to allow updateDisplay to have processed
    await this.page.waitForTimeout(50);
  }
}

test.describe('Interactive Deque Visualization - Full FSM Coverage', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the provided page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test, assert there were no runtime page errors or console errors.
    // This validates that interacting with the page did not produce unexpected exceptions.
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console errors, got: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial State', () => {
    test('Initial display shows empty deque and default stats', async ({ page }) => {
      const dp = new DequePage(page);

      // Validate that initial UI shows empty deque and default stats per entry action updateDisplay()
      await expect(dp.emptyMessage).toBeVisible();
      const stats = await dp.getStats();
      expect(stats.size).toBe(0);
      expect(stats.front).toBe('None');
      expect(stats.back).toBe('None');
      expect(stats.lastOp).toBe('None');
    });
  });

  test.describe('Basic Operations', () => {
    test('Push Front and Push Back update deque, stats, and last operation', async ({ page }) => {
      const dp = new DequePage(page);

      // Push Front "A"
      await dp.pushFront('A');
      let items = await dp.getItems();
      expect(items).toEqual(['A']);
      let stats = await dp.getStats();
      expect(stats.size).toBe(1);
      expect(stats.front).toBe('A');
      expect(stats.back).toBe('A');
      expect(stats.lastOp).toContain('Pushed "A" to front');

      // Push Back "B"
      await dp.pushBack('B');
      items = await dp.getItems();
      expect(items).toEqual(['A', 'B']);
      stats = await dp.getStats();
      expect(stats.size).toBe(2);
      expect(stats.front).toBe('A');
      expect(stats.back).toBe('B');
      expect(stats.lastOp).toContain('Pushed "B" to back');
    });

    test('Pop Front and Pop Back remove correct elements and update last operation', async ({ page }) => {
      const dp = new DequePage(page);

      // Setup: add two items
      await dp.pushBack('X');
      await dp.pushBack('Y');

      // Pop Front -> should remove X
      await dp.popFront();
      let items = await dp.getItems();
      expect(items).toEqual(['Y']);
      let stats = await dp.getStats();
      expect(stats.size).toBe(1);
      expect(stats.lastOp).toContain('Popped "X" from front');

      // Pop Back -> should remove Y leaving empty
      await dp.popBack();
      items = await dp.getItems();
      expect(items).toEqual([]);
      stats = await dp.getStats();
      expect(stats.size).toBe(0);
      expect(stats.lastOp).toContain('Popped "Y" from back');
      await expect(dp.emptyMessage).toBeVisible();
    });

    test('Peek Front and Peek Back report values without modifying deque', async ({ page }) => {
      const dp = new DequePage(page);

      // Setup: add items 1,2,3
      await dp.pushBack('1');
      await dp.pushBack('2');
      await dp.pushBack('3');

      // Peek Front should report "1" and not remove it
      await dp.peekFront();
      let stats = await dp.getStats();
      expect(stats.front).toBe('1');
      expect(stats.lastOp).toContain('Front element is "1"');
      let items = await dp.getItems();
      expect(items).toEqual(['1', '2', '3']);

      // Peek Back should report "3" and not remove it
      await dp.peekBack();
      stats = await dp.getStats();
      expect(stats.back).toBe('3');
      expect(stats.lastOp).toContain('Back element is "3"');
      items = await dp.getItems();
      expect(items).toEqual(['1', '2', '3']);
    });

    test('Clear Deque empties the deque and updates stats', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.pushBack('A');
      await dp.pushBack('B');
      let stats = await dp.getStats();
      expect(stats.size).toBe(2);

      await dp.clear();
      stats = await dp.getStats();
      expect(stats.size).toBe(0);
      expect(stats.front).toBe('None');
      expect(stats.back).toBe('None');
      expect(stats.lastOp).toBe('Deque cleared');
      await expect(dp.emptyMessage).toBeVisible();
    });
  });

  test.describe('Batch Operations', () => {
    test('Batch add to front respects count and prefix, inserts in correct order', async ({ page }) => {
      const dp = new DequePage(page);

      // Use count=3 and prefix 'X-'
      await dp.batchAddFront(3, 'X-');
      const items = await dp.getItems();
      // Because batchAddFront uses unshift in increasing i, final order should be X-3, X-2, X-1
      expect(items).toEqual(['X-3', 'X-2', 'X-1']);
      const stats = await dp.getStats();
      expect(stats.size).toBe(3);
      expect(stats.lastOp).toContain('Added 3 items to front with prefix "X-"');
    });

    test('Batch add to back respects count and prefix, appends in correct order', async ({ page }) => {
      const dp = new DequePage(page);

      // Clear and then add to back
      await dp.clear();
      await dp.batchAddBack(4, 'B-');
      const items = await dp.getItems();
      // batchAddBack pushes in increasing i -> B-1, B-2, B-3, B-4
      expect(items).toEqual(['B-1', 'B-2', 'B-3', 'B-4']);
      const stats = await dp.getStats();
      expect(stats.size).toBe(4);
      expect(stats.lastOp).toContain('Added 4 items to back with prefix "B-"');
    });
  });

  test.describe('Search & Filter Operations', () => {
    test('Find Value reports correct position for front, middle, back and not found', async ({ page }) => {
      const dp = new DequePage(page);

      // Setup known deque
      await dp.clear();
      await dp.batchAddBack(5, 'S-'); // S-1 ... S-5

      // Find first (front)
      await dp.findValue('S-1');
      let stats = await dp.getStats();
      expect(stats.lastOp).toContain('"S-1" found at position 0');
      expect(stats.lastOp).toContain('front');

      // Find middle (index 2)
      await dp.findValue('S-3');
      stats = await dp.getStats();
      expect(stats.lastOp).toContain('"S-3" found at position 2');

      // Find back
      await dp.findValue('S-5');
      stats = await dp.getStats();
      expect(stats.lastOp).toContain('"S-5" found at position 4');
      expect(stats.lastOp).toContain('back');

      // Not found
      await dp.findValue('NOT-THERE');
      stats = await dp.getStats();
      expect(stats.lastOp).toContain('"NOT-THERE" not found in deque');
    });

    test('Count occurrences and Remove All occurrences behave correctly', async ({ page }) => {
      const dp = new DequePage(page);

      // Clear and create duplicate entries
      await dp.clear();
      await dp.pushBack('dup');
      await dp.pushBack('dup');
      await dp.pushBack('unique');
      await dp.pushBack('dup');

      // Count occurrences of 'dup' -> expect 3
      await dp.countOccurrences('dup');
      let stats = await dp.getStats();
      expect(stats.lastOp).toContain('"dup" appears 3 time(s) in deque');

      // Remove all 'dup'
      await dp.removeAll('dup');
      stats = await dp.getStats();
      expect(stats.lastOp).toContain('Removed 3 occurrence(s) of "dup"');
      const items = await dp.getItems();
      expect(items).toEqual(['unique']);
      expect(stats.size).toBe(1);
    });
  });

  test.describe('Advanced Operations', () => {
    test('Reverse deque reverses order and updates last operation', async ({ page }) => {
      const dp = new DequePage(page);

      // Setup [1,2,3]
      await dp.clear();
      await dp.pushBack('1');
      await dp.pushBack('2');
      await dp.pushBack('3');

      await dp.reverseDeque();
      let items = await dp.getItems();
      expect(items).toEqual(['3', '2', '1']);
      let stats = await dp.getStats();
      expect(stats.lastOp).toBe('Deque reversed');
    });

    test('Rotate left moves front to back', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.clear();
      await dp.pushBack('A');
      await dp.pushBack('B');
      await dp.pushBack('C'); // [A,B,C]

      await dp.rotateLeft(); // -> [B,C,A]
      let items = await dp.getItems();
      expect(items).toEqual(['B', 'C', 'A']);
      let stats = await dp.getStats();
      expect(stats.lastOp).toBe('Rotated deque left (front to back)');
    });

    test('Rotate right moves back to front', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.clear();
      await dp.pushBack('1');
      await dp.pushBack('2');
      await dp.pushBack('3'); // [1,2,3]

      await dp.rotateRight(); // -> [3,1,2]
      let items = await dp.getItems();
      expect(items).toEqual(['3', '1', '2']);
      let stats = await dp.getStats();
      expect(stats.lastOp).toBe('Rotated deque right (back to front)');
    });

    test('Shuffle changes order (non-deterministic) but preserves size and updates last operation', async ({ page }) => {
      const dp = new DequePage(page);

      // Setup deterministic set
      await dp.clear();
      await dp.batchAddBack(6, 'H-'); // H-1..H-6
      const before = await dp.getItems();
      expect(before.length).toBe(6);

      await dp.shuffleDeque();
      const after = await dp.getItems();
      // Since shuffle is random, we cannot rely on a different order always;
      // we verify last operation and that element set and size remain same.
      const stats = await dp.getStats();
      expect(stats.lastOp).toBe('Deque shuffled');
      expect(after.length).toBe(before.length);

      // Validate same multiset of elements (order may differ)
      const sortedBefore = [...before].sort();
      const sortedAfter = [...after].sort();
      expect(sortedAfter).toEqual(sortedBefore);
    });
  });

  test.describe('Edge Cases & Error Scenarios', () => {
    test('Pushing empty input does not change deque', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.clear();
      // Ensure input empty
      await dp.inputValue.fill('');
      await dp.btnPushFront.click();
      // No lastOp change to a push message; lastOp should remain "Deque cleared" from clear() or "None"
      // We can't assume exact previous value, so assert that size remains 0 and empty message visible
      await expect(dp.emptyMessage).toBeVisible();
      const stats = await dp.getStats();
      expect(stats.size).toBe(0);
    });

    test('Popping from empty deque updates last operation with cannot pop message', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.clear();
      // Pop front from empty
      await dp.popFront();
      let stats = await dp.getStats();
      expect(stats.lastOp).toBe('Cannot pop from empty deque');

      // Pop back from empty
      await dp.popBack();
      stats = await dp.getStats();
      expect(stats.lastOp).toBe('Cannot pop from empty deque');
    });

    test('Peek operations on empty deque report appropriate message', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.clear();
      await dp.peekFront();
      let stats = await dp.getStats();
      expect(stats.lastOp).toBe('Deque is empty - no front element');

      await dp.peekBack();
      stats = await dp.getStats();
      expect(stats.lastOp).toBe('Deque is empty - no back element');
    });

    test('Remove all occurrences when value absent results in 0 removed', async ({ page }) => {
      const dp = new DequePage(page);

      await dp.clear();
      await dp.pushBack('alpha');
      await dp.pushBack('beta');

      await dp.removeAll('gamma'); // not present
      const stats = await dp.getStats();
      expect(stats.lastOp).toBe('Removed 0 occurrence(s) of "gamma"');
      const items = await dp.getItems();
      expect(items).toEqual(['alpha', 'beta']);
    });
  });

  test.describe('Console and Runtime Error Observability', () => {
    test('No runtime errors or console.error messages are emitted during interactions', async ({ page }) => {
      const dp = new DequePage(page);

      // Perform a sequence of operations exercising many code paths
      await dp.clear();
      await dp.pushFront('z');
      await dp.pushBack('y');
      await dp.batchAddBack(2, 'T-');
      await dp.findValue('z');
      await dp.countOccurrences('T-1'); // likely 1 or 0 - just exercise
      await dp.reverseDeque();
      await dp.rotateLeft();
      await dp.rotateRight();
      await dp.shuffleDeque();

      // At the end of the test (afterEach) the listeners will assert no page errors or console errors.
      // Here, we also assert in-test that lastOp exists and size is non-negative
      const stats = await dp.getStats();
      expect(typeof stats.lastOp).toBe('string');
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });
  });
});