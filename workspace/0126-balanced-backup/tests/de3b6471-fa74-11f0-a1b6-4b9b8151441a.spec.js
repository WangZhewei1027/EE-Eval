import { test, expect } from '@playwright/test';

// File: de3b6471-fa74-11f0-a1b6-4b9b8151441a.spec.js
// Tests for Priority Queue Demonstration (Application ID: de3b6471-fa74-11f0-a1b6-4b9b8151441a)
// The tests load the page as-is, observe console messages and page errors, and validate FSM states/transitions.

// Page Object for the Priority Queue page
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b6471-fa74-11f0-a1b6-4b9b8151441a.html';
    this.inputValue = page.locator('#itemValue');
    this.inputPriority = page.locator('#itemPriority');
    this.enqueueButton = page.locator("button[onclick='enqueueItem()']");
    this.dequeueButton = page.locator("button[onclick='dequeueItem()']");
    this.peekButton = page.locator("button[onclick='peekItem()']");
    this.clearButton = page.locator("button[onclick='clearQueue()']");
    this.queueDisplay = page.locator('#queueDisplay');
    this.operationResult = page.locator('#operationResult');
    this.itemLocator = (text) => page.locator('.item', { hasText: text });
    this.items = page.locator('.queue-display .item');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async enqueue(value, priority) {
    await this.inputValue.fill(value);
    await this.inputPriority.fill(String(priority));
    await this.enqueueButton.click();
  }

  async dequeue() {
    await this.dequeueButton.click();
  }

  async peek() {
    await this.peekButton.click();
  }

  async clear() {
    await this.clearButton.click();
  }

  async getQueueDisplayText() {
    return (await this.queueDisplay.textContent())?.trim() ?? '';
  }

  async getOperationResultText() {
    return (await this.operationResult.textContent())?.trim() ?? '';
  }

  async getItemsCount() {
    return await this.items.count();
  }

  async getFirstItemText() {
    const first = this.items.first();
    return (await first.textContent())?.trim() ?? '';
  }

  async getPriorityBadgeTexts() {
    const badges = this.page.locator('.queue-display .item .priority');
    const count = await badges.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await badges.nth(i).textContent())?.trim() ?? '');
    }
    return texts;
  }
}

test.describe('Priority Queue Demonstration - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  // Setup listeners for console and page errors before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions on the page
      pageErrors.push(String(err));
    });

    page.on('console', (msg) => {
      const type = msg.type(); // 'error', 'warning', 'log', etc.
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });
  });

  // Ensure the page loads and initial state (S0_Empty) is established
  test('Initial state: Queue is Empty (S0_Empty) and displayQueue() ran on load', async ({ page }) => {
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Validate queue display shows empty message (evidence of displayQueue entry action)
    const displayText = await pq.getQueueDisplayText();
    expect(displayText).toContain('Queue is empty');

    // Operation result should be empty initially
    const opText = await pq.getOperationResultText();
    expect(opText).toBe('');

    // Ensure no uncaught exceptions or console errors occurred during load
    expect(pageErrors, 'No page errors should occur on load').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should appear on load').toHaveLength(0);
  });

  test.describe('Enqueue interactions and transitions (S0 -> S1 and S1 -> S1)', () => {
    test('Enqueue from empty transitions to non-empty and updates display and result', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // From S0_Empty, enqueue an item -> should transition to S1_NonEmpty
      await pq.enqueue('Task A', 3);

      // Operation result should reflect enqueue
      const result = await pq.getOperationResultText();
      expect(result).toContain('Enqueued: Task A with priority 3');

      // Queue display should contain the item and priority badge
      const displayText = await pq.getQueueDisplayText();
      expect(displayText).toContain('Task A');
      expect(displayText).toContain('3');

      // Items count should be 1
      const count = await pq.getItemsCount();
      expect(count).toBe(1);

      // No runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Multiple enqueues maintain priority ordering (lower number = higher priority)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Enqueue items with different priorities
      await pq.enqueue('LowPriority', 5);
      await pq.enqueue('HighPriority', 1);
      await pq.enqueue('MediumPriority', 3);

      // After enqueues, the first item displayed should be the one with priority 1
      const firstItemText = await pq.getFirstItemText();
      expect(firstItemText).toContain('HighPriority');
      expect(firstItemText).toContain('1');

      // The sequence of priority badges should be [1,3,5]
      const badges = await pq.getPriorityBadgeTexts();
      expect(badges).toEqual(['1', '3', '5']);

      // Ensure operation result reflects the last enqueue action
      const opText = await pq.getOperationResultText();
      expect(opText).toContain('Enqueued: MediumPriority with priority 3');

      // No runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Dequeue interactions and transitions (S1 -> S1 and S1 -> S0)', () => {
    test('Dequeue removes highest priority item and updates display (S1 -> S1)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Prepare queue with two items
      await pq.enqueue('Alpha', 2);
      await pq.enqueue('Beta', 4);

      // Dequeue should remove Alpha (priority 2 is higher than 4)
      await pq.dequeue();

      // Operation result should reflect the dequeued item
      const op = await pq.getOperationResultText();
      expect(op).toContain('Dequeued: Alpha (priority 2)');

      // Queue should still be non-empty (Beta remains)
      const displayText = await pq.getQueueDisplayText();
      expect(displayText).toContain('Beta');
      expect(displayText).toContain('4');

      // No runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Dequeue until empty transitions back to S0_Empty and shows empty message', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Enqueue a single item then dequeue to make it empty
      await pq.enqueue('Solo', 1);
      // Confirm non-empty
      expect(await pq.getItemsCount()).toBe(1);

      // Dequeue the only item
      await pq.dequeue();

      // Operation result should reflect dequeued item
      const op = await pq.getOperationResultText();
      expect(op).toContain('Dequeued: Solo (priority 1)');

      // Queue display should now indicate empty
      const displayText = await pq.getQueueDisplayText();
      expect(displayText).toContain('Queue is empty');

      // No runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Dequeue on empty queue yields user-facing message and does not throw', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Ensure queue is empty initially
      expect(await pq.getQueueDisplayText()).toContain('Queue is empty');

      // Click Dequeue when empty
      await pq.dequeue();

      // Should show a friendly message in operationResult
      const op = await pq.getOperationResultText();
      expect(op).toContain('Queue is empty, nothing to dequeue');

      // No runtime errors (we let any actual JS errors surface; we assert none occurred)
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Peek and Clear operations (S1 -> S1 and S1 -> S0)', () => {
    test('Peek shows highest priority without removing it', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Prepare queue
      await pq.enqueue('First', 2);
      await pq.enqueue('Second', 3);

      // Peek should report First (priority 2) and not remove it
      await pq.peek();

      const op = await pq.getOperationResultText();
      expect(op).toContain('Highest priority item: First (priority 2)');

      // Ensure the queue still contains both items in the same order
      expect(await pq.getItemsCount()).toBe(2);
      const firstItemText = await pq.getFirstItemText();
      expect(firstItemText).toContain('First');
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Clear removes all items and transitions to S0_Empty', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Populate queue
      await pq.enqueue('One', 1);
      await pq.enqueue('Two', 2);

      // Clear queue
      await pq.clear();

      // Operation result should indicate cleared
      const op = await pq.getOperationResultText();
      expect(op).toContain('Queue has been cleared');

      // Queue display should indicate empty
      const display = await pq.getQueueDisplayText();
      expect(display).toContain('Queue is empty');

      // Items count should be zero
      expect(await pq.getItemsCount()).toBe(0);

      // No runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Form validation and edge cases', () => {
    test('Enqueue with missing inputs shows validation message and does not crash', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Intentionally click Enqueue with empty inputs
      await pq.enqueueButton.click();

      // Should show a red validation message in operationResult
      const op = await pq.getOperationResultText();
      expect(op).toContain('Please enter both value and priority');

      // Queue should remain empty
      expect(await pq.getQueueDisplayText()).toContain('Queue is empty');
      expect(await pq.getItemsCount()).toBe(0);

      // No runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });

    test('Event handler elements are present for all expected actions', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Validate presence of trigger elements as described in FSM
      await expect(page.locator("button[onclick='enqueueItem()']")).toBeVisible();
      await expect(page.locator("button[onclick='dequeueItem()']")).toBeVisible();
      await expect(page.locator("button[onclick='peekItem()']")).toBeVisible();
      await expect(page.locator("button[onclick='clearQueue()']")).toBeVisible();

      // Ensure no runtime errors
      expect(pageErrors).toHaveLength(0);
      expect(consoleErrors).toHaveLength(0);
    });
  });

  // Final test: summarize console and page error observation
  test('No unexpected runtime console errors or page errors occurred during interaction flows', async ({ page }) => {
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Perform a variety of interactions to exercise the code paths
    await pq.enqueue('A', 2);
    await pq.enqueue('B', 1);
    await pq.peek();
    await pq.dequeue();
    await pq.clear();
    await pq.dequeue(); // on empty
    await pq.enqueueButton.click(); // invalid enqueue

    // Collect captured messages (these arrays were populated by beforeEach listeners)
    // We assert that there were no uncaught page errors or console.error messages.
    // This verifies that the page JavaScript executed without throwing unhandled exceptions.
    expect(pageErrors, 'Expected no uncaught page errors during interactions').toHaveLength(0);
    expect(consoleErrors, 'Expected no console.error messages during interactions').toHaveLength(0);

    // Additionally, assert that we observed some console.log or informational messages may be present (optional)
    // We won't fail the test on logs/warnings; only errors are treated strictly.
    // Provide at least that the listener captured messages array exists
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});