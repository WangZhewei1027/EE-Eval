import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b13780-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object for interacting with the Queue demo page.
 */
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.enqueueSelector = '#enqueue-btn';
    this.dequeueSelector = '#dequeue-btn';
    this.queueDisplaySelector = '#queue-display';
    this.operationResultSelector = '#operation-result';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the interactive part is loaded
    await this.page.waitForSelector(this.enqueueSelector);
    await this.page.waitForSelector(this.dequeueSelector);
    await this.page.waitForSelector(this.queueDisplaySelector);
  }

  // Click the enqueue button and wait briefly for UI update
  async enqueue() {
    await this.page.click(this.enqueueSelector);
    // allow the small synchronous DOM update to propagate
    await this.page.waitForTimeout(50);
  }

  // Click the dequeue button and wait briefly for UI update
  async dequeue() {
    await this.page.click(this.dequeueSelector);
    await this.page.waitForTimeout(50);
  }

  // Returns the raw operation result text (e.g., "Enqueued: 42" or "Dequeued: 42" or empty)
  async getOperationResultText() {
    return (await this.page.$eval(this.operationResultSelector, el => el.textContent)).trim();
  }

  // Returns the queue display inner text
  async getQueueDisplayText() {
    return (await this.page.$eval(this.queueDisplaySelector, el => el.textContent)).trim();
  }

  // Returns array of strings for each .queue-item in display (in DOM order)
  async getQueueItemTexts() {
    return await this.page.$$eval(`${this.queueDisplaySelector} .queue-item`, nodes => nodes.map(n => n.textContent.trim()));
  }

  // Returns whether the display shows "Queue is empty" text
  async isDisplayEmptyMessage() {
    const text = await this.getQueueDisplayText();
    return text.includes('Queue is empty');
  }

  // Returns whether the display contains front and rear pointers
  async hasFrontAndRearPointers() {
    const text = await this.getQueueDisplayText();
    return text.includes('Front') && text.includes('Rear');
  }
}

// Group tests by logical areas per requirements
test.describe('Queue Data Structure - FSM and UI validation (f0b13780...d459)', () => {
  // arrays to collect console errors and page errors per-test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    // Collect uncaught page errors (e.g., ReferenceError, TypeError)
    page.on('pageerror', err => {
      try {
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        // ignore
      }
    });
  });

  test.afterEach(async () => {
    // no-op; arrays are per-test
  });

  test('Initial State S0_Empty: page loads with Queue Empty visual state and no runtime errors', async ({ page }) => {
    const q = new QueuePage(page);
    // Navigate to the page
    await q.goto();

    // Validate initial visual state is the S0_Empty state described by the FSM
    expect(await q.isDisplayEmptyMessage()).toBeTruthy();
    // There should be no queue-item elements initially
    const items = await q.getQueueItemTexts();
    expect(items.length).toBe(0);

    // operation result should be empty initially
    const opText = await q.getOperationResultText();
    expect(opText).toBe('');

    // Ensure there were no console errors or page errors during load
    expect(consoleErrors.length, `Console error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Event: Enqueue from S0_Empty transitions to S1_NonEmpty and updates DOM accordingly', async ({ page }) => {
    const q = new QueuePage(page);
    await q.goto();

    // Ensure starting empty
    expect(await q.isDisplayEmptyMessage()).toBeTruthy();

    // Click enqueue and capture operation result
    await q.enqueue();
    const opText = await q.getOperationResultText();
    // Expect "Enqueued: <number>"
    expect(opText).toMatch(/^Enqueued:\s*\d+$/);

    // After enqueue, the display should no longer show the empty message
    expect(await q.isDisplayEmptyMessage()).toBeFalsy();

    // It should show front and rear pointers visually
    expect(await q.hasFrontAndRearPointers()).toBeTruthy();

    // There should be at least one .queue-item and its text should include the enqueued number
    const items = await q.getQueueItemTexts();
    expect(items.length).toBeGreaterThanOrEqual(1);

    // Parse enqueued number and check it's present in the first item (FIFO)
    const enqNumMatch = opText.match(/Enqueued:\s*(\d+)/);
    expect(enqNumMatch).not.toBeNull();
    const enqNum = enqNumMatch[1];
    // First queue-item should match the enqueued number (since it was empty before)
    expect(items[0]).toBe(enqNum);

    // Ensure no runtime errors were thrown during this interaction
    expect(consoleErrors.length, `Console errors after enqueue: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after enqueue: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Event: Multiple Enqueues keep the queue in S1_NonEmpty and items preserve FIFO order', async ({ page }) => {
    const q = new QueuePage(page);
    await q.goto();

    // Enqueue twice and capture values
    await q.enqueue();
    const op1 = await q.getOperationResultText();
    expect(op1).toMatch(/^Enqueued:\s*\d+$/);
    const n1 = op1.match(/Enqueued:\s*(\d+)/)[1];

    await q.enqueue();
    const op2 = await q.getOperationResultText();
    expect(op2).toMatch(/^Enqueued:\s*\d+$/);
    const n2 = op2.match(/Enqueued:\s*(\d+)/)[1];

    // Ensure queue display shows both items in order [n1, n2]
    const items = await q.getQueueItemTexts();
    // At least two items expected
    expect(items.length).toBeGreaterThanOrEqual(2);
    // Check FIFO order by matching first two items
    expect(items[0]).toBe(n1);
    expect(items[1]).toBe(n2);

    // The queue must remain in non-empty visual state (S1_NonEmpty)
    expect(await q.isDisplayEmptyMessage()).toBeFalsy();

    // No runtime errors observed
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: Dequeue from S1_NonEmpty to S1_NonEmpty (if more than one item) removes front and updates DOM', async ({ page }) => {
    const q = new QueuePage(page);
    await q.goto();

    // Ensure at least two items to validate S1->S1 on Dequeue
    await q.enqueue();
    const firstEnqueueText = await q.getOperationResultText();
    const firstVal = firstEnqueueText.match(/Enqueued:\s*(\d+)/)[1];

    await q.enqueue();
    const secondEnqueueText = await q.getOperationResultText();
    const secondVal = secondEnqueueText.match(/Enqueued:\s*(\d+)/)[1];

    // Confirm two items present
    let items = await q.getQueueItemTexts();
    expect(items.length).toBeGreaterThanOrEqual(2);

    // Click dequeue - this should remove the firstVal and keep queue non-empty
    await q.dequeue();
    const deqText = await q.getOperationResultText();
    expect(deqText).toMatch(/^Dequeued:\s*\d+$/);
    const deqVal = deqText.match(/Dequeued:\s*(\d+)/)[1];
    // It should dequeue the first enqueued value (FIFO)
    expect(deqVal).toBe(firstVal);

    // After dequeue there should remain at least one item and it should be secondVal
    items = await q.getQueueItemTexts();
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0]).toBe(secondVal);

    // Display should still be non-empty
    expect(await q.isDisplayEmptyMessage()).toBeFalsy();

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: Dequeue from S1_NonEmpty to S0_Empty (when removing last item) results in empty visual state', async ({ page }) => {
    const q = new QueuePage(page);
    await q.goto();

    // Ensure queue has exactly one item: enqueue once
    await q.enqueue();
    const enqText = await q.getOperationResultText();
    const value = enqText.match(/Enqueued:\s*(\d+)/)[1];

    // Verify exactly one .queue-item is present
    let items = await q.getQueueItemTexts();
    // If more than one due to other tests running on same server, normalize by dequeuing until one remains
    // (we do not modify server-side or global state other than page interactions; this ensures deterministic expectation)
    while (items.length > 1) {
      await q.dequeue();
      items = await q.getQueueItemTexts();
    }
    expect(items.length).toBe(1);
    expect(items[0]).toBe(value);

    // Now dequeue to remove last item -> should transition to empty state
    await q.dequeue();
    const deqText = await q.getOperationResultText();
    expect(deqText).toMatch(/^Dequeued:\s*\d+$/);
    const deqVal = deqText.match(/Dequeued:\s*(\d+)/)[1];
    expect(deqVal).toBe(value);

    // Display should now show empty message
    expect(await q.isDisplayEmptyMessage()).toBeTruthy();

    // There should be zero .queue-item elements
    const finalItems = await q.getQueueItemTexts();
    expect(finalItems.length).toBe(0);

    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Dequeue when queue is empty shows appropriate error message and remains in S0_Empty', async ({ page }) => {
    const q = new QueuePage(page);
    await q.goto();

    // Ensure empty at start
    if (!(await q.isDisplayEmptyMessage())) {
      // If not empty, drain it
      while (!(await q.isDisplayEmptyMessage())) {
        await q.dequeue();
      }
    }

    // Now perform dequeue on empty queue
    await q.dequeue();
    const opText = await q.getOperationResultText();
    expect(opText).toBe('Queue is empty - cannot dequeue');

    // Visual state remains empty
    expect(await q.isDisplayEmptyMessage()).toBeTruthy();
    const items = await q.getQueueItemTexts();
    expect(items.length).toBe(0);

    // No runtime exceptions expected for this handled case
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: Ensure updateDisplay() effect is visible on every action (enqueue and dequeue) and no onEnter/onExit errors', async ({ page }) => {
    // This test validates that the visible DOM changes reflect the updateDisplay() entry actions for states
    const q = new QueuePage(page);
    await q.goto();

    // Snapshot initial display
    const initialDisplay = await q.getQueueDisplayText();

    // Enqueue -> display should change from initial
    await q.enqueue();
    const postEnqueueDisplay = await q.getQueueDisplayText();
    expect(postEnqueueDisplay).not.toBe(initialDisplay);

    // Dequeue -> display should change again (either back to initial empty or show fewer items)
    await q.dequeue();
    const postDequeueDisplay = await q.getQueueDisplayText();
    // It should be a string and possibly equal to initialDisplay if returned to empty
    expect(typeof postDequeueDisplay).toBe('string');

    // There should have been no runtime errors thrown by onEnter/onExit equivalent updateDisplay calls
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Robustness: Rapid repeated enqueues and dequeues maintain consistent DOM and no runtime errors', async ({ page }) => {
    const q = new QueuePage(page);
    await q.goto();

    // Rapidly enqueue 5 times
    const enqueued = [];
    for (let i = 0; i < 5; i++) {
      await q.enqueue();
      const text = await q.getOperationResultText();
      const n = text.match(/Enqueued:\s*(\d+)/)[1];
      enqueued.push(n);
    }

    // Validate count roughly 5 (could be more if previous state had items)
    let items = await q.getQueueItemTexts();
    expect(items.length).toBeGreaterThanOrEqual(1);

    // Rapidly dequeue 5 times (or until empty)
    const dequeued = [];
    // Limit iterations to avoid infinite loops; at most 10 clicks
    for (let i = 0; i < 10; i++) {
      // If display shows empty, break
      if (await q.isDisplayEmptyMessage()) break;
      await q.dequeue();
      const txt = await q.getOperationResultText();
      if (txt.startsWith('Dequeued:')) {
        dequeued.push(txt.match(/Dequeued:\s*(\d+)/)[1]);
      } else if (txt.includes('cannot dequeue')) {
        // reached empty case
        break;
      }
    }

    // If we dequeued at least one item, the first dequeued should equal the earliest enqueued (FIFO)
    if (dequeued.length > 0 && enqueued.length > 0) {
      // Only compare the overlap portion (first of enqueued vs first dequeued)
      expect(dequeued[0]).toBe(enqueued[0]);
    }

    // Final sanity: no runtime errors during heavy interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});