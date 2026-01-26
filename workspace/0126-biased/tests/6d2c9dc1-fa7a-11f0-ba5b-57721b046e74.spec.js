import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2c9dc1-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Queue Demo
class QueuePage {
  constructor(page) {
    this.page = page;
    this.enqueueInput = page.locator('input#enqueueValue');
    this.enqueueButton = page.locator('button[onclick="enqueue()"]');
    this.dequeueButton = page.locator('button[onclick="dequeue()"]');
    this.peekButton = page.locator('button[onclick="peek()"]');
    this.clearButton = page.locator('button[onclick="clearQueue()"]');
    this.queueLimitInput = page.locator('input#queueLimit');
    this.applyLimitButton = page.locator('button[onclick="setQueueLimit()"]');
    this.autoEnqueueIntervalInput = page.locator('input#autoInterval');
    this.toggleAutoEnqueueButton = page.locator('button[onclick="toggleAutoEnqueue()"]');
    this.autoDequeueIntervalInput = page.locator('input#autoDequeueInterval');
    this.toggleAutoDequeueButton = page.locator('button[onclick="toggleAutoDequeue()"]');
    this.reverseButton = page.locator('button[onclick="reverseQueue()"]');
    this.findMaxButton = page.locator('button[onclick="findMax()"]');
    this.findMinButton = page.locator('button[onclick="findMin()"]');
    this.searchInput = page.locator('input#searchValue');
    this.searchButton = page.locator('button[onclick="searchQueue()"]').first(); // There are two search buttons but the first in advanced operations is primary
    this.displayModeSelect = page.locator('select#displayMode');
    this.highlightEvenOddButton = page.locator('button[onclick="highlightEvenOdd()"]');
    this.highlightPrimesButton = page.locator('button[onclick="highlightPrimes()"]');
    this.queueDisplay = page.locator('#queueDisplay');
    this.statusMessage = page.locator('#statusMessage');
    this.queueSize = page.locator('#queueSize');
    this.frontValue = page.locator('#frontValue');
    this.rearValue = page.locator('#rearValue');
    this.opsCount = page.locator('#opsCount');
  }

  async enqueue(value) {
    await this.enqueueInput.fill(value);
    await this.enqueueButton.click();
  }

  async dequeue() {
    await this.dequeueButton.click();
  }

  async peek() {
    await this.peekButton.click();
  }

  async clearQueue() {
    await this.clearButton.click();
  }

  async setQueueLimit(value) {
    await this.queueLimitInput.fill(String(value));
    await this.applyLimitButton.click();
  }

  async toggleAutoEnqueue() {
    await this.toggleAutoEnqueueButton.click();
  }

  async toggleAutoDequeue() {
    await this.toggleAutoDequeueButton.click();
  }

  async setAutoEnqueueInterval(ms) {
    await this.autoEnqueueIntervalInput.fill(String(ms));
  }

  async setAutoDequeueInterval(ms) {
    await this.autoDequeueIntervalInput.fill(String(ms));
  }

  async reverseQueue() {
    await this.reverseButton.click();
  }

  async findMax() {
    await this.findMaxButton.click();
  }

  async findMin() {
    await this.findMinButton.click();
  }

  async searchQueue(value) {
    await this.searchInput.fill(value);
    // Use the second search button in the nested div if first doesn't correspond to input; click the one nearest the search input
    const nestedSearchButton = this.page.locator('div.control-group >> input#searchValue + button, div.control-group >> button:has-text("Search")').last();
    // Try the nested button if visible, else fallback to main
    if (await nestedSearchButton.count() > 0) {
      await nestedSearchButton.click();
    } else {
      await this.searchButton.click();
    }
  }

  async changeDisplayMode(modeValue) {
    await this.displayModeSelect.selectOption(modeValue);
  }

  async highlightEvenOdd() {
    await this.highlightEvenOddButton.click();
  }

  async highlightPrimes() {
    await this.highlightPrimesButton.click();
  }

  async getQueueItems() {
    // Returns array of texts of .queue-item elements in DOM order
    const items = await this.page.locator('.queue-item').allTextContents();
    return items;
  }

  async itemHasHighlight(index) {
    const el = this.page.locator(`#queue-item-${index}`);
    return await el.evaluate((node) => node ? node.classList.contains('highlight') : false);
  }
}

test.describe('Queue Interactive Demonstration - FSM tests', () => {
  // Track console errors and page errors
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages and page errors for assertions
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page as-is, do not inject/patch anything
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Basic sanity: initial state should show "Queue is empty" and status "Ready"
    await expect(page.locator('.empty-message')).toHaveText('Queue is empty');
    await expect(page.locator('#statusMessage')).toHaveText('Ready');
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught console errors or page errors during the test
    // Many tests depend on the page running without runtime script errors.
    expect(consoleErrors, `Expected no console.error logs; found: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    expect(pageErrors, `Expected no page errors; found: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
  });

  test.describe('Basic queue operations', () => {
    test('Enqueue and Dequeue update display and status', async ({ page }) => {
      const q = new QueuePage(page);

      // Enqueue a value and verify queue display, stats, and status
      await q.enqueue('10');
      await expect(q.statusMessage).toHaveText('Enqueued: 10');
      await expect(q.queueSize).toHaveText('1');
      await expect(q.frontValue).toHaveText('10');
      await expect(q.rearValue).toHaveText('10');

      // Enqueue another
      await q.enqueue('20');
      await expect(q.statusMessage).toHaveText('Enqueued: 20');
      await expect(q.queueSize).toHaveText('2');
      await expect(q.frontValue).toHaveText('10');
      await expect(q.rearValue).toHaveText('20');

      // Verify DOM items exist with expected ids and texts
      const items = await q.getQueueItems();
      expect(items).toEqual(['10', '20']);

      // Dequeue and validate value removed and status updated
      await q.dequeue();
      await expect(q.statusMessage).toHaveText('Dequeued: 10');
      await expect(q.queueSize).toHaveText('1');
      await expect(q.frontValue).toHaveText('20');
      await expect(q.rearValue).toHaveText('20');

      // Clear queue and verify empty UI
      await q.clearQueue();
      await expect(q.statusMessage).toHaveText('Queue cleared');
      await expect(page.locator('.empty-message')).toHaveText('Queue is empty');
      await expect(q.queueSize).toHaveText('0');
      await expect(q.frontValue).toHaveText('None');
      await expect(q.rearValue).toHaveText('None');
    });

    test('Edge cases: enqueue empty and dequeue empty', async ({ page }) => {
      const q = new QueuePage(page);

      // Attempt to enqueue empty value -> should set status prompting user
      await q.enqueue('   '); // whitespace only
      await expect(q.statusMessage).toHaveText('Please enter a value to enqueue');

      // Dequeue on empty queue -> status indicates cannot dequeue
      await q.dequeue();
      await expect(q.statusMessage).toHaveText('Queue is empty - cannot dequeue');
    });

    test('Peek highlights front and sets status', async ({ page }) => {
      const q = new QueuePage(page);

      // Setup: enqueue two items
      await q.enqueue('7');
      await q.enqueue('11');

      // Peek should set status and highlight front (index 0)
      await q.peek();
      await expect(q.statusMessage).toHaveText('Front of queue: 7');

      // Front item should have highlight class temporarily - check presence quickly
      const hasHighlight = await q.itemHasHighlight(0);
      expect(hasHighlight).toBe(true);

      // Ensure other items not highlighted by peek
      const secondHighlight = await q.itemHasHighlight(1);
      expect(secondHighlight).toBe(false);
    });
  });

  test.describe('Configuration and auto operations', () => {
    test('Set queue limit and truncation behavior', async ({ page }) => {
      const q = new QueuePage(page);

      // Enqueue multiple items
      await q.enqueue('1');
      await q.enqueue('2');
      await q.enqueue('3');
      await q.enqueue('4');
      await expect(q.queueSize).toHaveText('4');

      // Set a smaller limit to truncate existing queue
      await q.setQueueLimit(2);
      await expect(q.statusMessage).toHaveText('Queue limit set to 2');

      // After truncation, queue should contain only first two items
      const items = await q.getQueueItems();
      expect(items).toEqual(['1', '2']);
      await expect(q.queueSize).toHaveText('2');

      // Set invalid limit (0) and expect error status
      await q.setQueueLimit(0);
      await expect(q.statusMessage).toHaveText('Invalid queue limit');
    });

    test('Toggle auto-enqueue starts and stops and updates status', async ({ page }) => {
      const q = new QueuePage(page);

      // Ensure auto interval is short to speed up test
      await q.setAutoEnqueueInterval(100);

      // Start auto-enqueue
      await q.toggleAutoEnqueue();
      // Wait a little longer than the interval to allow at least one auto-enqueue
      await page.waitForTimeout(200);

      // There should be at least one item enqueued by auto process (unless queue limit 0)
      const sizeText = await q.queueSize.textContent();
      const size = parseInt(sizeText, 10);
      expect(size).toBeGreaterThanOrEqual(1);

      // Stop auto-enqueue
      await q.toggleAutoEnqueue();
      await expect(q.statusMessage).toContainText('Auto-enqueue stopped');
    });

    test('Toggle auto-dequeue starts and stops and updates status', async ({ page }) => {
      const q = new QueuePage(page);

      // Pre-fill queue with a few values
      await q.enqueue('5');
      await q.enqueue('6');
      await q.enqueue('7');

      // Shorten auto-dequeue interval
      await q.setAutoDequeueInterval(100);

      // Start auto-dequeue
      await q.toggleAutoDequeue();
      await page.waitForTimeout(250);

      // After some time, ops should have dequeued at least once (size decreased)
      const sizeText = await q.queueSize.textContent();
      const size = parseInt(sizeText, 10);
      expect(size).toBeLessThan(3);

      // Stop auto-dequeue
      await q.toggleAutoDequeue();
      await expect(q.statusMessage).toContainText('Auto-dequeue stopped');
    });
  });

  test.describe('Transformations and analysis', () => {
    test('Reverse queue reverses order and updates status', async ({ page }) => {
      const q = new QueuePage(page);

      // Enqueue several items
      await q.enqueue('A');
      await q.enqueue('B');
      await q.enqueue('C');
      await expect(q.queueSize).toHaveText('3');

      const before = await q.getQueueItems();
      expect(before).toEqual(['A', 'B', 'C']);

      // Reverse
      await q.reverseQueue();
      await expect(q.statusMessage).toHaveText('Queue reversed');

      const after = await q.getQueueItems();
      expect(after).toEqual(['C', 'B', 'A']);
    });

    test('Find maximum and minimum numeric values and highlight them', async ({ page }) => {
      const q = new QueuePage(page);

      // Clear then add numeric values including duplicates
      await q.clearQueue();
      await q.enqueue('3');
      await q.enqueue('15');
      await q.enqueue('7');
      await q.enqueue('15'); // duplicate max
      await expect(q.queueSize).toHaveText('4');

      // Find max: should set status and highlight both 15 values
      await q.findMax();
      await expect(q.statusMessage).toHaveText('Maximum numeric value: 15');

      // Highlighted items should include indices 1 and 3 (positions of 15)
      const highlight1 = await q.itemHasHighlight(1);
      const highlight3 = await q.itemHasHighlight(3);
      expect(highlight1).toBe(true);
      expect(highlight3).toBe(true);

      // Find min
      await q.findMin();
      await expect(q.statusMessage).toHaveText('Minimum numeric value: 3');

      // Index 0 should be highlighted as min
      const highlight0 = await q.itemHasHighlight(0);
      expect(highlight0).toBe(true);
    });

    test('Search queue for present and absent values', async ({ page }) => {
      const q = new QueuePage(page);

      // Clear and prepare queue
      await q.clearQueue();
      await q.enqueue('x');
      await q.enqueue('y');
      await q.enqueue('x');
      await expect(q.queueSize).toHaveText('3');

      // Search for value that exists ('x')
      await q.searchQueue('x');
      await expect(q.statusMessage).toHaveText('Found "x" at positions: 0, 2');

      // Both indices 0 and 2 should have highlight class
      expect(await q.itemHasHighlight(0)).toBe(true);
      expect(await q.itemHasHighlight(2)).toBe(true);

      // Search for a value that does not exist
      await q.searchQueue('z');
      await expect(q.statusMessage).toHaveText('Value "z" not found in queue');
    });
  });

  test.describe('Display and highlighting features', () => {
    test('Change display mode adjusts layout and keeps items updated', async ({ page }) => {
      const q = new QueuePage(page);

      // Ensure non-empty
      await q.clearQueue();
      await q.enqueue('100');
      await q.enqueue('200');

      // Change to vertical
      await q.changeDisplayMode('vertical');
      // queueDisplay keeps class name queue-container
      await expect(q.queueDisplay).toHaveClass(/queue-container/);
      // In vertical mode, style.flexDirection should be column
      const flexDirection = await q.page.locator('#queueDisplay').evaluate((el) => getComputedStyle(el).flexDirection);
      expect(flexDirection === 'column' || flexDirection === 'column').toBe(true);

      // Change to circular mode
      await q.changeDisplayMode('circular');
      await expect(q.queueDisplay).toHaveClass(/queue-container/);
      // circular sets flexWrap to wrap - check computed style
      const flexWrap = await q.page.locator('#queueDisplay').evaluate((el) => getComputedStyle(el).flexWrap);
      expect(['wrap', 'wrap']).toContain(flexWrap);
    });

    test('Highlight even/odd and prime numbers apply highlight classes appropriately', async ({ page }) => {
      const q = new QueuePage(page);

      // Clear and set numeric values including primes and evens/odds
      await q.clearQueue();
      await q.enqueue('2');  // prime, even
      await q.enqueue('4');  // even, not prime
      await q.enqueue('3');  // prime, odd
      await q.enqueue('9');  // odd, not prime

      // Highlight evens
      await q.highlightEvenOdd();
      await expect(q.statusMessage).toHaveText('Highlighted even numbers');

      // Index 0 (2) and 1 (4) should be highlighted
      expect(await q.itemHasHighlight(0)).toBe(true);
      expect(await q.itemHasHighlight(1)).toBe(true);
      // Index 2 and 3 should not necessarily be highlighted by this action (toggle may have toggled)
      // For reliability, ensure at least those expected even indices are highlighted
      // Now highlight primes
      await q.highlightPrimes();
      await expect(q.statusMessage).toHaveText('Highlighted prime numbers');

      // Prime indices 0 and 2 should now have highlight class (toggle may set)
      const prime0 = await q.itemHasHighlight(0);
      const prime2 = await q.itemHasHighlight(2);

      expect(prime0).toBe(true);
      expect(prime2).toBe(true);
    });
  });

  test.describe('Edge cases and empty-state behaviors', () => {
    test('Find max/min on empty queue return appropriate messages', async ({ page }) => {
      const q = new QueuePage(page);

      // Ensure empty
      await q.clearQueue();
      await expect(q.queueSize).toHaveText('0');

      // Find max on empty
      await q.findMax();
      await expect(q.statusMessage).toHaveText('Queue is empty - no maximum');

      // Find min on empty
      await q.findMin();
      await expect(q.statusMessage).toHaveText('Queue is empty - no minimum');
    });

    test('Reverse on empty queue should provide informative status', async ({ page }) => {
      const q = new QueuePage(page);

      await q.clearQueue();
      await q.reverseQueue();
      await expect(q.statusMessage).toHaveText('Queue is empty - nothing to reverse');
    });

    test('Search with empty input shows prompt', async ({ page }) => {
      const q = new QueuePage(page);

      await q.clearQueue();
      // Attempt to search with empty input
      await q.searchQueue('');
      await expect(q.statusMessage).toHaveText('Please enter a search value');
    });
  });
});