import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba8eb43-d5b2-11f0-b169-abe023d0d932.html';

class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async attachListeners() {
    this.page.on('console', (msg) => {
      // Capture console messages (info, log, warn, error)
      try {
        const text = msg.text();
        this.consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        // ignore extraction errors from console message
      }
    });

    this.page.on('pageerror', (err) => {
      // Capture unhandled exceptions from the page.
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a tick for any synchronous logs from scripts to be emitted and caught.
    await this.page.waitForTimeout(50);
  }

  // Accessors that call into the page context to invoke the existing queue
  async enqueue(item, priority) {
    return this.page.evaluate(
      (it, p) => {
        // Use the page's existing queue object (do not create globals)
        return window.queue.enqueue(it, p);
      },
      item,
      priority
    );
  }

  async dequeue() {
    return this.page.evaluate(() => {
      return window.queue.dequeue();
    });
  }

  async peek() {
    return this.page.evaluate(() => {
      return window.queue.peek();
    });
  }

  async isEmpty() {
    return this.page.evaluate(() => {
      return window.queue.isEmpty();
    });
  }

  async length() {
    return this.page.evaluate(() => {
      return window.queue.items.length;
    });
  }

  getConsoleMessages() {
    return this.consoleMessages.map((m) => m.text);
  }

  getConsoleEntries() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Priority Queue - FSM states and transitions', () => {
  // Attach listeners and create page object for each test
  test.beforeEach(async ({ page }) => {
    // Nothing here; listeners are attached in each test to ensure they are bound before navigation.
  });

  // Test: Page loads, initial script runs -> dequeues all items, ends in Empty state
  test('Initial script execution: dequeued logs appear and queue ends in Empty state (S1_EmptyQueue)', async ({ page }) => {
    const pqPage = new PriorityQueuePage(page);
    await pqPage.attachListeners();

    // Load the application - the script enqueues 3 items then dequeues them in a loop
    await pqPage.goto();

    // Collect console messages produced during initial script execution.
    const consoleTexts = pqPage.getConsoleMessages();

    // Expect three "Dequeued item: ..." logs produced by the initial dequeue loop.
    // Confirm the correct order due to priority sorting (descending priority: 3,2,1).
    // The enqueue sequence was Low(1), High(2), Medium(3) -> sorted: Medium, High, Low.
    const dequeuedMessages = consoleTexts.filter((t) => t.startsWith('Dequeued item:'));
    expect(dequeuedMessages.length).toBe(3);
    expect(dequeuedMessages[0]).toContain('Medium priority item');
    expect(dequeuedMessages[1]).toContain('High priority item');
    expect(dequeuedMessages[2]).toContain('Low priority item');

    // Final state after the initial script run should be Empty Queue (S1).
    const empty = await pqPage.isEmpty();
    expect(empty).toBe(true);

    // Assert there were no uncaught page errors during load.
    const pageErrors = pqPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  // Test ENQUEUE transition: from Empty (S1) to Non-Empty (S2)
  test('ENQUEUE causes transition from Empty Queue to Non-Empty Queue (S1 -> S2)', async ({ page }) => {
    const pqPage = new PriorityQueuePage(page);
    await pqPage.attachListeners();

    await pqPage.goto();

    // Ensure starting from empty state (S1) due to initial script
    expect(await pqPage.isEmpty()).toBe(true);

    // Enqueue an item and verify the transition to Non-Empty (S2)
    await pqPage.enqueue('Test item', 5);
    // After enqueue, queue should no longer be empty
    expect(await pqPage.isEmpty()).toBe(false);
    // The peek should show the newly enqueued high-priority item at the front
    const front = await pqPage.peek();
    expect(front).toBe('Test item');

    // No page errors
    expect(pqPage.getPageErrors().length).toBe(0);
  });

  // Test DEQUEUE transition: from Non-Empty (S2) to Empty (S1) when last item removed
  test('DEQUEUE transitions from Non-Empty to Empty when last item removed (S2 -> S1)', async ({ page }) => {
    const pqPage = new PriorityQueuePage(page);
    await pqPage.attachListeners();

    await pqPage.goto();

    // Enqueue a single sentinel item
    await pqPage.enqueue('Single item', 10);
    expect(await pqPage.isEmpty()).toBe(false);

    // Dequeue should return the item and leave the queue empty
    const popped = await pqPage.dequeue();
    expect(popped).toBe('Single item');
    expect(await pqPage.isEmpty()).toBe(true);

    // No page errors
    expect(pqPage.getPageErrors().length).toBe(0);
  });

  // Test PEEK event: PEEK should not change state (S2 -> S2) and should return front without removing
  test('PEEK returns front item without removing it (S2 -> S2)', async ({ page }) => {
    const pqPage = new PriorityQueuePage(page);
    await pqPage.attachListeners();

    await pqPage.goto();

    // Make sure queue is empty, then add two items with different priorities
    if (!(await pqPage.isEmpty())) {
      // Drain existing items to ensure deterministic state for this test
      while (!(await pqPage.isEmpty())) {
        await pqPage.dequeue();
      }
    }
    expect(await pqPage.isEmpty()).toBe(true);

    // Enqueue two items: lower priority first, then higher priority
    await pqPage.enqueue('low', 1);
    await pqPage.enqueue('high', 10);

    // Now the queue is non-empty and the front should be 'high'
    expect(await pqPage.isEmpty()).toBe(false);

    const beforeLength = await pqPage.length();
    const front = await pqPage.peek(); // PEEK should not remove
    expect(front).toBe('high');

    // Length should remain unchanged after peek (S2 -> S2)
    const afterLength = await pqPage.length();
    expect(afterLength).toBe(beforeLength);

    // Dequeue should return the same front item that peek returned
    const dequeued = await pqPage.dequeue();
    expect(dequeued).toBe('high');

    // No page errors
    expect(pqPage.getPageErrors().length).toBe(0);
  });

  // Test ISEMPTY check in both conditions and edge cases for dequeue/peek on empty queue
  test('ISEMPTY returns correct boolean in both empty and non-empty states; peek/dequeue on empty return null', async ({ page }) => {
    const pqPage = new PriorityQueuePage(page);
    await pqPage.attachListeners();

    await pqPage.goto();

    // Ensure queue is empty after initial script
    expect(await pqPage.isEmpty()).toBe(true);

    // Dequeue on empty should return null (edge case)
    const poppedEmpty = await pqPage.dequeue();
    expect(poppedEmpty).toBeNull();

    // Peek on empty should return null
    const peekEmpty = await pqPage.peek();
    expect(peekEmpty).toBeNull();

    // Enqueue one item -> isEmpty should be false
    await pqPage.enqueue('edge', 2);
    expect(await pqPage.isEmpty()).toBe(false);

    // Clean up by dequeuing
    const popped = await pqPage.dequeue();
    expect(popped).toBe('edge');
    expect(await pqPage.isEmpty()).toBe(true);

    // No page errors
    expect(pqPage.getPageErrors().length).toBe(0);
  });

  // Edge case: Enqueue without priority (undefined) - verify it does not throw and the item is present
  test('Edge case: enqueue without priority (undefined) should store item and not crash the page', async ({ page }) => {
    const pqPage = new PriorityQueuePage(page);
    await pqPage.attachListeners();

    await pqPage.goto();

    // Ensure empty start
    if (!(await pqPage.isEmpty())) {
      while (!(await pqPage.isEmpty())) {
        await pqPage.dequeue();
      }
    }
    expect(await pqPage.isEmpty()).toBe(true);

    // Enqueue with missing priority (undefined)
    // The implementation sorts using priority property; this could lead to NaN but should not throw TypeError.
    await pqPage.enqueue('no-priority', undefined);

    // The queue should now be non-empty and peek should return the item
    expect(await pqPage.isEmpty()).toBe(false);
    const front = await pqPage.peek();
    expect(front).toBe('no-priority');

    // Dequeue should return the same
    const popped = await pqPage.dequeue();
    expect(popped).toBe('no-priority');

    // Final state empty again
    expect(await pqPage.isEmpty()).toBe(true);

    // Assert no uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    expect(pqPage.getPageErrors().length).toBe(0);
  });

  // Test to ensure console errors/warnings are observed and reported (if any)
  test('Capture and assert console errors/warnings are absent for normal operation', async ({ page }) => {
    const pqPage = new PriorityQueuePage(page);
    await pqPage.attachListeners();

    await pqPage.goto();

    // Gather console messages and ensure that there are no entries of type 'error'
    const entries = pqPage.getConsoleEntries();
    const consoleErrors = entries.filter((e) => e.type === 'error');
    // For this application we expect no console errors during normal operation
    expect(consoleErrors.length).toBe(0);

    // Ensure no page errors either
    expect(pqPage.getPageErrors().length).toBe(0);
  });
});