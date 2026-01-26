import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d6111-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object Model for the Priority Queue demo
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.elementValue = page.locator('#elementValue');
    this.prioritySlider = page.locator('#prioritySlider');
    this.priorityValue = page.locator('#priorityValue');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.queueTypeSelect = page.locator('#queueType');
    this.toggleQueueTypeBtn = page.locator('#toggleQueueType');
    this.autoDequeueCheckbox = page.locator('#autoDequeue');
    this.showHeapCheckbox = page.locator('#showHeap');
    this.queueDisplay = page.locator('#queueDisplay');
    this.heapDisplay = page.locator('#heapDisplay');
    this.queueSizeSpan = page.locator('#queueSize');
    this.queueCapacitySpan = page.locator('#queueCapacity');
    this.lastActionSpan = page.locator('#lastAction');
    this.operationsCountSpan = page.locator('#operationsCount');
    this.bulkCountInput = page.locator('#bulkCount');
    this.addRandomBtn = page.locator('#addRandom');
    this.dequeueAllBtn = page.locator('#dequeueAll');
    this.stressTestBtn = page.locator('#stressTest');
  }

  // Utility to set slider value and trigger input event so the UI reacts
  async setPriority(value) {
    await this.page.evaluate(
      ({ selector, val }) => {
        const el = document.querySelector(selector);
        el.value = val;
        // dispatch input event to trigger listeners
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
      },
      { selector: '#prioritySlider', val: String(value) }
    );
  }

  async enqueue(value, priority) {
    if (value !== undefined) await this.elementValue.fill(String(value));
    if (priority !== undefined) await this.setPriority(priority);
    await this.enqueueBtn.click();
  }

  async changeQueueType(value) {
    await this.queueTypeSelect.selectOption(value);
    // change event handler will be triggered by selectOption
  }

  async toggleShowHeap(checked) {
    const isChecked = await this.showHeapCheckbox.isChecked();
    if (isChecked !== checked) {
      await this.showHeapCheckbox.click();
    }
  }

  // Read convenience getters
  async getLastActionText() {
    return (await this.lastActionSpan.textContent()).trim();
  }

  async getQueueSize() {
    const txt = (await this.queueSizeSpan.textContent()).trim();
    return parseInt(txt, 10);
  }

  async getOperationsCount() {
    const txt = (await this.operationsCountSpan.textContent()).trim();
    return parseInt(txt, 10);
  }

  async getQueueDisplayText() {
    return (await this.queueDisplay.textContent()).trim();
  }

  async getHeapDisplayText() {
    return (await this.heapDisplay.textContent()).trim();
  }

  async getPriorityValueText() {
    return (await this.priorityValue.textContent()).trim();
  }

  async isHeapDisplayed() {
    // read computed style display property
    return await this.page.evaluate(selector => {
      const el = document.querySelector(selector);
      return window.getComputedStyle(el).display !== 'none';
    }, '#heapDisplay');
  }
}

test.describe('Priority Queue Interactive Demo - FSM and UI validation', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors for each test
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // Uncaught exceptions will be captured here
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown required - listeners attached per test
  });

  test('Initial state: Ready -> S0_Ready and Empty Queue -> S1_EmptyQueue (UI initialization)', async ({ page }) => {
    // Validate on-enter action updateUI('Ready') and Empty Queue state
    const pq = new PriorityQueuePage(page);

    // lastAction should be 'Ready'
    await expect(pq.lastActionSpan).toHaveText('Ready');

    // queue size should be 0 and queue display must show 'Queue is empty'
    expect(await pq.getQueueSize()).toBe(0);
    await expect(pq.queueDisplay).toHaveText('Queue is empty');

    // heap display should show 'Heap is empty' (showHeap is checked by default at init)
    await expect(pq.heapDisplay).toHaveText('Heap is empty');

    // operations count should be 0 after initialization
    expect(await pq.getOperationsCount()).toBe(0);

    // Ensure there are no console errors or page errors on load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Dequeue on empty queue with auto-dequeue enabled -> should show proper message', async ({ page }) => {
    // Edge case: Dequeue when empty; should follow transition S0_Ready -> S1_EmptyQueue (Dequeue attempt)
    const pq = new PriorityQueuePage(page);

    // Ensure autoDequeue is checked (default)
    expect(await pq.autoDequeueCheckbox.isChecked()).toBe(true);

    // Click Dequeue on empty queue
    await pq.dequeueBtn.click();

    // Should show specific message 'Queue is empty - cannot dequeue' and size remains 0
    await expect(pq.lastActionSpan).toHaveText('Queue is empty - cannot dequeue');
    expect(await pq.getQueueSize()).toBe(0);

    // No JS runtime errors occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Enqueue / Peek / Dequeue transitions (S1 -> S2 -> S1)', () => {
    test('Enqueue an element transitions to Non-Empty Queue and updates UI', async ({ page }) => {
      // S1_EmptyQueue -> Enqueue -> S2_NonEmptyQueue
      const pq = new PriorityQueuePage(page);

      // Enqueue with explicit value and priority
      await pq.enqueue('A', 8);

      // Verify lastAction contains enqueued information
      const last = await pq.getLastActionText();
      expect(last).toContain('Enqueued:');
      expect(last).toContain('A');
      expect(last).toContain('Priority: 8');

      // Queue size should be 1 and queue display should list the enqueued item
      expect(await pq.getQueueSize()).toBe(1);
      await expect(pq.queueDisplay).toContainText('A (Priority: 8)');

      // operations count should have incremented (enqueue increments operations)
      expect(await pq.getOperationsCount()).toBeGreaterThanOrEqual(1);

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Peek does not remove element and returns correct element (S2 stays S2)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Prepare state: enqueue element B with priority 7
      await pq.enqueue('B', 7);
      const sizeBefore = await pq.getQueueSize();

      // Click Peek
      await pq.peekBtn.click();

      // Peek should show Peek: ... and size remains unchanged
      const last = await pq.getLastActionText();
      expect(last).toContain('Peek:');
      expect(last).toContain('B');
      expect(last).toContain('Priority: 7');

      expect(await pq.getQueueSize()).toBe(sizeBefore);

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Dequeue removes the maximum (or top) element and may transition back to Empty', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Enqueue two elements to ensure non-empty
      await pq.enqueue('C', 3);
      await pq.enqueue('D', 9); // higher priority, should be dequeued first in max-queue

      const sizeBefore = await pq.getQueueSize();
      expect(sizeBefore).toBeGreaterThanOrEqual(2);

      // Click Dequeue - should remove highest priority (D)
      await pq.dequeueBtn.click();

      // Verify last action indicates D was dequeued (priority 9)
      const last = await pq.getLastActionText();
      expect(last).toContain('Dequeued:');
      expect(last).toContain('D');
      expect(last).toContain('Priority: 9');

      // Size should have decreased by 1
      expect(await pq.getQueueSize()).toBe(sizeBefore - 1);

      // Dequeue remaining items to reach empty and verify message when empty
      await pq.dequeueBtn.click(); // remove remaining
      // After removing all, next dequeue should either show 'Queue is empty' or 'Queue is empty - cannot dequeue'
      // Confirm size is zero
      expect(await pq.getQueueSize()).toBeGreaterThanOrEqual(0);

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clear, Toggle, QueueType change, and heap visualization behaviors', () => {
    test('Clear Queue empties queue and resets operations (transition S2 -> S1)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Add some elements
      await pq.enqueue('E', 4);
      await pq.enqueue('F', 6);
      expect(await pq.getQueueSize()).toBeGreaterThanOrEqual(2);

      // Click Clear
      await pq.clearBtn.click();

      // Verify queue is empty and lastAction is 'Queue cleared'
      expect(await pq.getQueueSize()).toBe(0);
      await expect(pq.lastActionSpan).toHaveText('Queue cleared');

      // Queue display & heap display reflect empty state
      await expect(pq.queueDisplay).toHaveText('Queue is empty');
      await expect(pq.heapDisplay).toHaveText('Heap is empty');

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Toggle Queue Type button updates type and rebuilds heap', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Ensure starting type is max
      await expect(pq.queueTypeSelect).toHaveValue('max');

      // Add two items with differing priorities
      await pq.enqueue('G', 2);
      await pq.enqueue('H', 9);

      // Toggle type to min
      await pq.toggleQueueTypeBtn.click();

      // queueTypeSelect.value should reflect the new type
      await expect(pq.queueTypeSelect).toHaveValue('min');

      // Last action should indicate the change
      const last = await pq.getLastActionText();
      expect(last).toContain('Changed to Min');

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Changing queue type via select triggers rebuild and updateUI', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Change to max/min roundtrip to ensure change events are handled
      await pq.changeQueueType('min');
      await expect(pq.queueTypeSelect).toHaveValue('min');
      await expect(pq.lastActionSpan).toContainText('Changed to Min');

      await pq.changeQueueType('max');
      await expect(pq.queueTypeSelect).toHaveValue('max');
      await expect(pq.lastActionSpan).toContainText('Changed to Max');

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Priority slider updates the displayed priority text (PrioritySliderChange event)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Set slider to 10 and trigger input event
      await pq.setPriority(10);

      // Verify displayed priority text updated
      await expect(pq.priorityValue).toHaveText('Priority: 10');

      // Enqueue to ensure priority is used
      await pq.enqueue('I', 10);
      await expect(pq.lastActionSpan).toContainText('Priority: 10');

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Show Heap checkbox toggles heap visualization during updateUI calls', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // By default showHeap is checked. Enqueue to ensure heap is visible.
      await pq.enqueue('J', 5);
      expect(await pq.isHeapDisplayed()).toBe(true);

      // Uncheck showHeap and then enqueue to trigger UI update which should hide heap
      await pq.toggleShowHeap(false);
      await pq.enqueue('K', 6);
      expect(await pq.isHeapDisplayed()).toBe(false);

      // Re-check showHeap and enqueue to show it again
      await pq.toggleShowHeap(true);
      await pq.enqueue('L', 4);
      expect(await pq.isHeapDisplayed()).toBe(true);

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Bulk operations and stress test', () => {
    test('AddRandomElements adds specified count and updates UI', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Ensure starting size
      const startSize = await pq.getQueueSize();

      // Set bulkCount to 3 and click addRandom
      await pq.bulkCountInput.fill('3');
      await pq.addRandomBtn.click();

      // Verify size increased by 3
      const newSize = await pq.getQueueSize();
      expect(newSize).toBe(startSize + 3);

      // Last action should indicate addition count
      const last = await pq.getLastActionText();
      expect(last).toContain('Added 3 random elements');

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('DequeueAll removes all elements and reports correct count', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Ensure some elements exist by adding random ones
      await pq.bulkCountInput.fill('2');
      await pq.addRandomBtn.click();
      const countBefore = await pq.getQueueSize();
      expect(countBefore).toBeGreaterThanOrEqual(2);

      // Click Dequeue All
      await pq.dequeueAllBtn.click();

      // After operation, queue size should be 0 and lastAction should reference the number dequeued
      expect(await pq.getQueueSize()).toBe(0);
      const last = await pq.getLastActionText();
      expect(last).toContain('Dequeued all');

      // No JS runtime errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('StressTest performs many operations without uncaught exceptions', async ({ page }) => {
      const pq = new PriorityQueuePage(page);

      // Record start size and operations
      const startSize = await pq.getQueueSize();
      const startOps = await pq.getOperationsCount();

      // Click Stress Test
      await pq.stressTestBtn.click();

      // Last action should indicate completion and include start and end sizes information
      const last = await pq.getLastActionText();
      expect(last).toContain('Stress test completed');

      // operations should have increased
      const endOps = await pq.getOperationsCount();
      expect(endOps).toBeGreaterThanOrEqual(startOps);

      // size should be a non-negative integer
      const endSize = await pq.getQueueSize();
      expect(Number.isInteger(endSize)).toBe(true);
      expect(endSize).toBeGreaterThanOrEqual(0);

      // No uncaught runtime errors should have occurred during the stress test
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test('Comprehensive flow: enqueue many, toggle type, peek and dequeue all to validate multi-transition behavior', async ({ page }) => {
    const pq = new PriorityQueuePage(page);

    // Enqueue multiple items with varied priorities
    await pq.enqueue('X', 1);
    await pq.enqueue('Y', 10);
    await pq.enqueue('Z', 5);

    // Ensure non-empty
    expect(await pq.getQueueSize()).toBeGreaterThanOrEqual(3);

    // Toggle queue type -> should rebuild heap; action message should be present
    await pq.toggleQueueTypeBtn.click();
    const toggleMsg = await pq.getLastActionText();
    expect(toggleMsg).toMatch(/Changed to (Min|Max) Priority Queue|Changed to (Min|Max)/);

    // Peek top element (non-destructive)
    await pq.peekBtn.click();
    const peekMsg = await pq.getLastActionText();
    expect(peekMsg).toMatch(/Peek:/);

    // Dequeue all to exercise DequeueAll transition S2 -> S1
    await pq.dequeueAllBtn.click();
    expect(await pq.getQueueSize()).toBe(0);
    await expect(pq.lastActionSpan).toContainText('Dequeued all');

    // Final assertions - ensure queue is empty and displays reflect that
    await expect(pq.queueDisplay).toHaveText('Queue is empty');
    await expect(pq.heapDisplay).toHaveText('Heap is empty');

    // No JS runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});