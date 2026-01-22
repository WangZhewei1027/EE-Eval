import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c7991-d361-11f0-8438-11a56595a476.html';

// Page Object for the Priority Queue demo
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.elementInput = page.locator('#elementInput');
    this.priorityInput = page.locator('#priorityInput');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure initial rendering completed
    await expect(this.output).toBeVisible();
  }

  // perform enqueue action using UI
  async enqueue(element, priority) {
    await this.elementInput.fill(element);
    await this.priorityInput.fill(String(priority));
    await this.enqueueBtn.click();
  }

  async dequeue() {
    await this.dequeueBtn.click();
  }

  async peek() {
    await this.peekBtn.click();
  }

  // clear with handling of confirm dialogs must be done by test side
  async clear() {
    await this.clearBtn.click();
  }

  async getOutputText() {
    const text = await this.output.textContent();
    return (text ?? '').trim();
  }

  async activeElementId() {
    return await this.page.evaluate(() => document.activeElement?.id ?? '');
  }
}

// Collect console errors and page errors for assertion
test.describe('Priority Queue Demo - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // capture page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // capture console messages and filter errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // Assert that no unexpected page/runtime errors occurred during tests
    // (The application is expected to run without ReferenceError/SyntaxError/TypeError)
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join('; ')}`).toBe(0);
  });

  // Validate initial state S0_Empty and updateDisplay on enter
  test('Initial state should display "Priority Queue is empty."', async ({ page }) => {
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // FSM State S0_Empty evidence: output shows empty message
    const output = await pq.getOutputText();
    expect(output).toContain('Priority Queue is empty.');
  });

  test.describe('Enqueue operations (transitions S0 -> S1 and S1 -> S1)', () => {
    test('Enqueue single element moves S0 -> S1 and updates display', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Enqueue one item and verify display updates to non-empty
      await pq.enqueue('Task A', 5);

      const output = await pq.getOutputText();
      expect(output).toContain('Elements in Priority Queue (from highest to lowest priority):');
      expect(output).toContain('[Priority: 5] Task A');

      // inputs should be cleared and focus should return to element input
      expect(await pq.elementInput.inputValue()).toBe('');
      expect(await pq.priorityInput.inputValue()).toBe('');
      expect(await pq.activeElementId()).toBe('elementInput');
    });

    test('Enqueue multiple elements preserves priority order (lower number = higher priority)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Add multiple items with varying priorities
      await pq.enqueue('Task A', 5); // priority 5
      await pq.enqueue('Task B', 2); // priority 2 -> should come first
      await pq.enqueue('Task C', 3); // priority 3 -> after B, before A

      const output = await pq.getOutputText();
      // verify ordering: B (2) then C (3) then A (5)
      const indexB = output.indexOf('Task B');
      const indexC = output.indexOf('Task C');
      const indexA = output.indexOf('Task A');

      expect(indexB).toBeGreaterThan(-1);
      expect(indexC).toBeGreaterThan(-1);
      expect(indexA).toBeGreaterThan(-1);

      expect(indexB).toBeLessThan(indexC);
      expect(indexC).toBeLessThan(indexA);
      expect(output).toContain('[Priority: 2]');
      expect(output).toContain('[Priority: 3]');
      expect(output).toContain('[Priority: 5]');
    });

    test('Enqueue with empty element input shows alert and does not change state', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Ensure queue empty to start
      const before = await pq.getOutputText();
      expect(before).toContain('Priority Queue is empty.');

      // Attempt to enqueue with empty element but valid priority
      await pq.priorityInput.fill('1');

      // handle alert expected
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        pq.enqueueBtn.click()
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please enter an element value.');
      await dialog.accept();

      // Output should remain in empty state
      const after = await pq.getOutputText();
      expect(after).toContain('Priority Queue is empty.');
    });

    test('Enqueue with invalid priority shows alert and does not change state', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // fill element, leave priority empty
      await pq.elementInput.fill('Task X');

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        pq.enqueueBtn.click()
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please enter a valid number for priority.');
      await dialog.accept();

      // Still empty
      const out = await pq.getOutputText();
      expect(out).toContain('Priority Queue is empty.');
    });
  });

  test.describe('Dequeue operations (S1 -> S1 or S1 -> S0)', () => {
    test('Dequeue removes highest priority item and updates display', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Prepare queue
      await pq.enqueue('A', 10);
      await pq.enqueue('B', 1); // highest priority
      await pq.enqueue('C', 5);

      // Dequeue should alert the removed item (B)
      const dialogPromise = page.waitForEvent('dialog');
      await pq.dequeue();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Dequeued element: "B"');
      expect(dialog.message()).toContain('priority 1');
      await dialog.accept();

      // Output should still be non-empty and not contain B
      const out = await pq.getOutputText();
      expect(out).toContain('Elements in Priority Queue');
      expect(out).not.toContain('B');
      // Ensure remaining items are C then A by priority 5 then 10
      const indexC = out.indexOf('C');
      const indexA = out.indexOf('A');
      expect(indexC).toBeGreaterThan(-1);
      expect(indexA).toBeGreaterThan(-1);
      expect(indexC).toBeLessThan(indexA);
    });

    test('Dequeue until empty transitions to S0_Empty and shows empty message', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Enqueue single item
      await pq.enqueue('Solo', 7);

      // Dequeue that single item
      const dialogPromise = page.waitForEvent('dialog');
      await pq.dequeue();
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Dequeued element: "Solo"');
      await dialog.accept();

      // Now should be empty
      const out = await pq.getOutputText();
      expect(out).toContain('Priority Queue is empty.');
    });

    test('Dequeue on empty queue shows appropriate alert and state remains S0_Empty', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Ensure empty
      const before = await pq.getOutputText();
      expect(before).toContain('Priority Queue is empty.');

      // Click dequeue -> should alert and keep empty
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        pq.dequeueBtn.click()
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Queue is empty, cannot dequeue.');
      await dialog.accept();

      const after = await pq.getOutputText();
      expect(after).toContain('Priority Queue is empty.');
    });
  });

  test.describe('Peek and Clear operations', () => {
    test('Peek on non-empty queue shows next element without modifying queue (S1 -> S1)', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Setup queue
      await pq.enqueue('First', 2);
      await pq.enqueue('Second', 4);

      // Peek should alert Next element = First with priority 2
      const dialogPromise = page.waitForEvent('dialog');
      await pq.peek();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Next element to dequeue: "First"');
      expect(dialog.message()).toContain('priority 2');
      await dialog.accept();

      // Ensure queue still contains both items and order unchanged
      const out = await pq.getOutputText();
      expect(out).toContain('First');
      expect(out).toContain('Second');
      expect(out.indexOf('First')).toBeLessThan(out.indexOf('Second'));
    });

    test('Peek on empty queue shows appropriate alert', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        pq.peekBtn.click()
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Queue is empty.');
      await dialog.accept();
    });

    test('Clear confirmed empties the queue (S1 -> S0) and updates display', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Setup queue
      await pq.enqueue('One', 1);
      await pq.enqueue('Two', 2);
      const before = await pq.getOutputText();
      expect(before).toContain('Elements in Priority Queue');

      // Intercept confirm and accept it
      const dialogPromise = page.waitForEvent('dialog');
      await pq.clear();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toBe('Are you sure you want to clear the queue?');
      await dialog.accept();

      // After confirmation, queue should be empty
      const out = await pq.getOutputText();
      expect(out).toContain('Priority Queue is empty.');
    });

    test('Clear cancelled leaves the queue unchanged', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Setup queue
      await pq.enqueue('KeepMe', 9);
      const before = await pq.getOutputText();
      expect(before).toContain('KeepMe');

      // Click clear and dismiss the confirm
      const dialogPromise = page.waitForEvent('dialog');
      await pq.clear();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('confirm');
      await dialog.dismiss(); // cancel

      // Output should be unchanged and still contain the item
      const after = await pq.getOutputText();
      expect(after).toContain('KeepMe');
      expect(after).toContain('Elements in Priority Queue');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Enqueue with non-numeric priority (NaN) shows invalid priority alert', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      await pq.elementInput.fill('BadPriority');
      await pq.priorityInput.fill('abc'); // non-numeric

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        pq.enqueueBtn.click()
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please enter a valid number for priority.');
      await dialog.accept();

      // Ensure nothing enqueued
      const out = await pq.getOutputText();
      expect(out).toContain('Priority Queue is empty.');
    });

    test('Multiple sequential operations maintain consistent state', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // enqueue a few
      await pq.enqueue('X', 4);
      await pq.enqueue('Y', 1);
      await pq.enqueue('Z', 3);

      // peek should show Y
      {
        const d = await page.waitForEvent('dialog');
        await pq.peek();
        const dialog = await d;
        expect(dialog.message()).toContain('"Y"');
        await dialog.accept();
      }

      // dequeue -> removes Y
      {
        const d = await page.waitForEvent('dialog');
        await pq.dequeue();
        const dialog = await d;
        expect(dialog.message()).toContain('"Y"');
        await dialog.accept();
      }

      // clear -> accept -> empty
      {
        const d = await page.waitForEvent('dialog');
        await pq.clear();
        const dialog = await d;
        await dialog.accept();
      }
      const out = await pq.getOutputText();
      expect(out).toContain('Priority Queue is empty.');
    });
  });
});