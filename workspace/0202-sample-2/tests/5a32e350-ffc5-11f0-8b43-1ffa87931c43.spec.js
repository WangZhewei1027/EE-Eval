import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32e350-ffc5-11f0-8b43-1ffa87931c43.html';

// Page object encapsulating interactions with the Priority Queue demo page
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.queueList = page.locator('#queue-list');
    this.dequeuedDiv = page.locator('#dequeued');
    this.valueInput = page.locator('#value');
    this.priorityInput = page.locator('#priority');
    this.enqueueForm = page.locator('#enqueue-form');
    this.dequeueBtn = page.locator('#dequeue-btn');
    this.submitButton = page.locator('#enqueue-form button[type="submit"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial renderQueue to complete and DOM to be stable
    await expect(this.queueList).toBeVisible();
  }

  // Read the textual content of the queue-list container
  async getQueueText() {
    return (await this.queueList.textContent()) || '';
  }

  // Returns array of { index, value, priority } in the order displayed
  async getQueueItems() {
    return await this.page.$$eval('#queue-list .item', (nodes) =>
      nodes.map((n) => {
        const idxText = n.textContent || '';
        const strong = n.querySelector('strong');
        const span = n.querySelector('.priority');
        const value = strong ? strong.textContent : idxText.trim();
        let priority = null;
        if (span) {
          // span text: (priority: X)
          const m = span.textContent.match(/priority:\s*([-\d.]+)/i);
          priority = m ? Number(m[1]) : null;
        }
        // Attempt to extract leading index
        const indexMatch = idxText.match(/^\s*([0-9]+)\./);
        const index = indexMatch ? Number(indexMatch[1]) : null;
        return { index, value, priority };
      })
    );
  }

  async getDequeuedText() {
    return (await this.dequeuedDiv.textContent()) || '';
  }

  // Enqueue via form submit. This will trigger the page's submit handler.
  async enqueue(value, priority) {
    await this.valueInput.fill(String(value));
    await this.priorityInput.fill(String(priority));
    // Submit the form. Use click on submit button to simulate real user action.
    await this.submitButton.click();
    // Wait for queue list to update after renderQueue()
    await this.page.waitForTimeout(50); // short pause to let DOM update
  }

  async clickDequeue() {
    await this.dequeueBtn.click();
    await this.page.waitForTimeout(50); // allow rendering
  }

  // For tests that need to submit invalid/empty inputs and capture the alert dialog
  async submitExpectingDialog(onDialog) {
    const handler = async (dialog) => {
      try {
        await onDialog(dialog);
      } finally {
        await dialog.accept();
      }
    };
    this.page.once('dialog', handler);
    await this.submitButton.click();
    // give a moment for dialog handling to complete
    await this.page.waitForTimeout(20);
  }

  // Helper to assert there are no console errors or page errors collected
  static assertNoErrors(consoleErrors, pageErrors) {
    expect(consoleErrors.length, 'console error messages').toBe(0);
    expect(pageErrors.length, 'page errors').toBe(0);
  }
}

test.describe('Priority Queue Demo (FSM Validation)', () => {
  // Collect console errors and page errors per test for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages; record only error-level messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  test('S0_Empty: initial state shows "Queue is empty."' , async ({ page }) => {
    // Validate the initial empty state: queue-list text says "Queue is empty."
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Check initial DOM state corresponds to S0_Empty
    const qText = await pq.getQueueText();
    expect(qText.trim()).toBe('Queue is empty.');

    // dequeued area should be empty initially
    const dText = await pq.getDequeuedText();
    expect(dText.trim()).toBe('');

    // No console errors or page errors should have occurred during load/render
    PriorityQueuePage.assertNoErrors(consoleErrors, pageErrors);
  });

  test('EnqueueSubmit from S0_Empty transitions to S1_NonEmpty and updates DOM', async ({ page }) => {
    // This test validates the transition S0_Empty -> S1_NonEmpty on form submit
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Enqueue one item
    await pq.enqueue('alpha', 10);

    // Expect queue-list to contain the newly enqueued item
    const items = await pq.getQueueItems();
    expect(items.length).toBe(1);
    expect(items[0].value).toBe('alpha');
    expect(items[0].priority).toBe(10);

    // dequeued div should be cleared by enqueue handler
    const dText = await pq.getDequeuedText();
    expect(dText.trim()).toBe('');

    // Inputs should be cleared after enqueue and focus should be on value input
    const valueContent = await pq.valueInput.inputValue();
    const priorityContent = await pq.priorityInput.inputValue();
    expect(valueContent).toBe('');
    expect(priorityContent).toBe('');

    // Active element is the value input (focus was set)
    const activeId = await page.evaluate(() => document.activeElement?.id || '');
    expect(activeId).toBe('value');

    PriorityQueuePage.assertNoErrors(consoleErrors, pageErrors);
  });

  test('Multiple Enqueues maintain descending priority order (S1_NonEmpty)', async ({ page }) => {
    // Validate internal ordering: higher priority first
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Enqueue three items with varying priorities
    await pq.enqueue('low', 1);
    await pq.enqueue('high', 5);
    await pq.enqueue('mid', 3);

    // Expect order: high (5), mid (3), low (1)
    const items = await pq.getQueueItems();
    expect(items.length).toBe(3);
    expect(items[0].value).toBe('high');
    expect(items[0].priority).toBe(5);
    expect(items[1].value).toBe('mid');
    expect(items[1].priority).toBe(3);
    expect(items[2].value).toBe('low');
    expect(items[2].priority).toBe(1);

    PriorityQueuePage.assertNoErrors(consoleErrors, pageErrors);
  });

  test('DequeueClick removes highest priority and updates state; eventually returns to S0_Empty', async ({ page }) => {
    // Validate transitions when dequeuing from non-empty queue:
    // - S1_NonEmpty -> S1_NonEmpty (still items left)
    // - eventually S1_NonEmpty -> S0_Empty (when last item dequeued)
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Seed queue with three items
    await pq.enqueue('one', 1);
    await pq.enqueue('three', 3);
    await pq.enqueue('two', 2);

    // Confirm initial order: three (3), two (2), one (1)
    let items = await pq.getQueueItems();
    expect(items.map((i) => i.value)).toEqual(['three', 'two', 'one']);

    // Dequeue once: should remove 'three'
    await pq.clickDequeue();
    let dequeuedText = await pq.getDequeuedText();
    expect(dequeuedText).toContain('Dequeued:');
    expect(dequeuedText).toContain('"three"');
    expect(dequeuedText).toContain('priority 3');

    // Expect queue now has two items, order two, one
    items = await pq.getQueueItems();
    expect(items.map((i) => i.value)).toEqual(['two', 'one']);

    // Dequeue second time: removes 'two'
    await pq.clickDequeue();
    dequeuedText = await pq.getDequeuedText();
    expect(dequeuedText).toContain('"two"');
    items = await pq.getQueueItems();
    expect(items.map((i) => i.value)).toEqual(['one']);

    // Dequeue third time: removes 'one' and queue becomes empty (S0_Empty)
    await pq.clickDequeue();
    dequeuedText = await pq.getDequeuedText();
    expect(dequeuedText).toContain('"one"');

    // After last dequeue, queue-list should display "Queue is empty."
    const qText = await pq.getQueueText();
    expect(qText.trim()).toBe('Queue is empty.');

    PriorityQueuePage.assertNoErrors(consoleErrors, pageErrors);
  });

  test('Submitting invalid input (empty value or missing priority) triggers alert and does not modify queue', async ({ page }) => {
    // Validate edge-case behavior: alert on invalid inputs and queue remains unchanged
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Ensure queue is empty initially
    let qText = await pq.getQueueText();
    expect(qText.trim()).toBe('Queue is empty.');

    // Case A: empty value, valid priority -> should alert
    await pq.valueInput.fill('   ');
    await pq.priorityInput.fill('5');

    let dialogSeen = false;
    await pq.submitExpectingDialog(async (dialog) => {
      dialogSeen = true;
      // The message should mention entering valid value and priority
      expect(dialog.message()).toMatch(/Please enter valid value and priority/i);
    });
    expect(dialogSeen).toBe(true);

    // Queue should remain empty after invalid submit
    qText = await pq.getQueueText();
    expect(qText.trim()).toBe('Queue is empty.');

    // Case B: non-empty value but missing priority -> should alert
    await pq.valueInput.fill('someval');
    await pq.priorityInput.fill(''); // missing
    dialogSeen = false;
    await pq.submitExpectingDialog(async (dialog) => {
      dialogSeen = true;
      expect(dialog.message()).toMatch(/Please enter valid value and priority/i);
    });
    expect(dialogSeen).toBe(true);

    // Queue still empty
    qText = await pq.getQueueText();
    expect(qText.trim()).toBe('Queue is empty.');

    PriorityQueuePage.assertNoErrors(consoleErrors, pageErrors);
  });

  test('DequeueClick when queue is empty shows proper message in #dequeued (edge case)', async ({ page }) => {
    // Validate clicking dequeue on empty queue shows the expected message
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Ensure empty
    const qText = await pq.getQueueText();
    expect(qText.trim()).toBe('Queue is empty.');

    // Click dequeue button while empty
    await pq.clickDequeue();

    // Expect the dequeued div to show the empty-queue message
    const dText = (await pq.getDequeuedText()).trim();
    expect(dText).toBe('Queue is empty. Nothing to dequeue.');

    PriorityQueuePage.assertNoErrors(consoleErrors, pageErrors);
  });
});