import { test, expect } from '@playwright/test';

// Test file for application: 52080e72-fa76-11f0-a09b-87751f540fd8
// URL: http://127.0.0.1:5500/workspace/0126-balanced/html/52080e72-fa76-11f0-a09b-87751f540fd8.html
//
// These tests validate the Queue interactive application's observable behavior,
// exercising the FSM states and transitions described in the provided FSM.
// They also observe console and page errors (pageerror / console.error) that
// may occur during natural execution and assert the observed behavior.
//
// NOTE: Tests load the page exactly as-is and do NOT modify or patch any code
// in the page.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52080e72-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Queue page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.enqueueBtn = page.locator('#enqueue');
    this.dequeueBtn = page.locator('#dequeue');
    this.peekBtn = page.locator('#peek');
    this.clearBtn = page.locator('#clear');
    this.message = page.locator('#message');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Clicks the Enqueue button
  async clickEnqueue() {
    await this.enqueueBtn.click();
  }

  // Clicks the Dequeue button
  async clickDequeue() {
    await this.dequeueBtn.click();
  }

  // Clicks the Peek button
  async clickPeek() {
    await this.peekBtn.click();
  }

  // Clicks the Clear button
  async clickClear() {
    await this.clearBtn.click();
  }

  // Returns the trimmed text content of the message element
  async getMessageText() {
    const txt = await this.message.textContent();
    return (txt ?? '').trim();
  }

  // Returns the queue array (serialized) from the page context
  // We only read minimal details to avoid injecting or changing page state.
  async getQueueLength() {
    return await this.page.evaluate(() => {
      try {
        return Array.isArray(window.queue) ? window.queue.length : null;
      } catch (e) {
        return null;
      }
    });
  }

  // Returns a textual description of queue[0] to assert type/representation
  async peekQueue0Type() {
    return await this.page.evaluate(() => {
      try {
        if (!Array.isArray(window.queue) || window.queue.length === 0) return null;
        const item = window.queue[0];
        // Return typeof and toString fallback
        return {
          typeOf: typeof item,
          toString: Object.prototype.toString.call(item),
          maybeString: item && item.toString ? String(item.toString()) : null
        };
      } catch (e) {
        return { error: String(e) };
      }
    });
  }
}

test.describe('Queue FSM - states and transitions', () => {
  // Validate no unexpected runtime errors are emitted during normal page load and interactions.
  test('Initial state: S0_Empty - page loads and queue is empty (entry action not invoked by implementation)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const q = new QueuePage(page);
    await q.goto();

    // The FSM's S0_Empty has an entry action updateMessage('Queue is empty.')
    // but the implementation does not call this on load. We assert observed behavior.
    const message = await q.getMessageText();
    // Expect the message element to be empty on initial load (implementation detail)
    expect(message).toBe('', 'Initial message should be empty string because updateMessage is not called on load');

    const length = await q.getQueueLength();
    expect(length).toBe(0);

    // No runtime page errors or console.error messages should have occurred during load
    expect(pageErrors.length, 'No page errors should be emitted on load').toBe(0);
    expect(consoleErrors.length, 'No console.error should be emitted on load').toBe(0);
  });

  test('EnqueueEvent: from S0_Empty to S1_NonEmpty - enqueue increases queue length and updates message (implementation specifics)', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const q = new QueuePage(page);
    await q.goto();

    // Click enqueue from empty state
    await q.clickEnqueue();

    // Implementation detail: enqueue is registered as enqueue(event) via event listener,
    // updateMessage() is called with no arg, so the message becomes "undefined" text.
    const msg = await q.getMessageText();
    expect(msg, 'After clicking Enqueue, message should reflect updateMessage(undefined) from implementation')
      .toBe('undefined');

    const len = await q.getQueueLength();
    expect(len, 'Queue length after enqueue should be 1').toBe(1);

    // Inspect queue[0] type to ensure an event object was pushed (implementation pushes the event)
    const itemDesc = await q.peekQueue0Type();
    expect(itemDesc).not.toBeNull();
    expect(itemDesc.typeOf).toBe('object');

    // No runtime JS errors
    expect(pageErrors.length, 'No page errors during enqueue').toBe(0);
    expect(consoleErrors.length, 'No console.error messages during enqueue').toBe(0);
  });

  test('PeekEvent: on S1_NonEmpty remains in S1_NonEmpty and shows front item representation', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const q = new QueuePage(page);
    await q.goto();

    // Ensure we have an item: enqueue once
    await q.clickEnqueue();

    // Clear prior message (not necessary) then peek
    await q.clickPeek();

    // After peek, updateMessage(item) where item is the event object.
    // The string representation will typically contain "object" or "MouseEvent".
    const msg = await q.getMessageText();
    // We assert that it is neither empty nor the literal "undefined"
    expect(msg.length > 0, 'Peek should set a non-empty message').toBe(true);
    expect(msg, 'Peek result should not be the literal "undefined"').not.toBe('undefined');

    // The toString for event objects commonly yields "[object MouseEvent]" or similar.
    expect(
      /object|MouseEvent/i.test(msg),
      `Peek message should contain "object" or "MouseEvent" representation; got: "${msg}"`
    ).toBe(true);

    // Queue should still be non-empty after peek
    const len = await q.getQueueLength();
    expect(len, 'Queue should remain non-empty after peek').toBeGreaterThan(0);

    expect(pageErrors.length, 'No page errors during peek').toBe(0);
    expect(consoleErrors.length, 'No console.error during peek').toBe(0);
  });

  test('DequeueEvent: on S1_NonEmpty returns item and may transition to S0_Empty when last element removed', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const q = new QueuePage(page);
    await q.goto();

    // Enqueue one item to ensure single-element queue
    await q.clickEnqueue();

    // Dequeue should return that item (event object) and update message accordingly
    await q.clickDequeue();
    const afterDequeueMsg = await q.getMessageText();

    // Expect message to represent the dequeued event object (not "undefined")
    expect(afterDequeueMsg.length > 0).toBe(true);
    expect(afterDequeueMsg).not.toBe('undefined');

    // After removing the only element, queue length should be 0
    const lenAfter = await q.getQueueLength();
    expect(lenAfter, 'Queue should be empty after dequeuing the only element').toBe(0);

    // Now, dequeuing again from empty should yield "Queue is empty."
    await q.clickDequeue();
    const emptyDequeueMsg = await q.getMessageText();
    expect(emptyDequeueMsg).toBe('Queue is empty.');

    expect(pageErrors.length, 'No page errors during dequeue interactions').toBe(0);
    expect(consoleErrors.length, 'No console.error during dequeue interactions').toBe(0);
  });

  test('ClearEvent: clears queue from non-empty and from empty, updating message to "Queue cleared."', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const q = new QueuePage(page);
    await q.goto();

    // Enqueue two items to make queue non-empty
    await q.clickEnqueue();
    await q.clickEnqueue();
    let len = await q.getQueueLength();
    expect(len).toBeGreaterThanOrEqual(1);

    // Clear should empty the queue and set message to "Queue cleared."
    await q.clickClear();
    const clearedMsg = await q.getMessageText();
    expect(clearedMsg).toBe('Queue cleared.');

    len = await q.getQueueLength();
    expect(len, 'Queue should be empty after clear').toBe(0);

    // Clearing again when already empty should still show "Queue cleared."
    await q.clickClear();
    const clearedMsg2 = await q.getMessageText();
    expect(clearedMsg2).toBe('Queue cleared.');

    expect(pageErrors.length, 'No page errors during clear interactions').toBe(0);
    expect(consoleErrors.length, 'No console.error during clear interactions').toBe(0);
  });

  test('Edge cases: Peek and Dequeue on empty both show "Queue is empty."', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const q = new QueuePage(page);
    await q.goto();

    // Ensure queue is empty
    const startLen = await q.getQueueLength();
    if (startLen > 0) {
      // If not empty, clear it
      await q.clickClear();
    }

    // Peek on empty should show "Queue is empty."
    await q.clickPeek();
    const peekMsg = await q.getMessageText();
    expect(peekMsg).toBe('Queue is empty.');

    // Dequeue on empty should show "Queue is empty."
    await q.clickDequeue();
    const dequeueMsg = await q.getMessageText();
    expect(dequeueMsg).toBe('Queue is empty.');

    expect(pageErrors.length, 'No page errors during edge-case interactions').toBe(0);
    expect(consoleErrors.length, 'No console.error during edge-case interactions').toBe(0);
  });

  test('Observes console and page errors during a sequence of interactions (should be none)', async ({ page }) => {
    // This test explicitly watches for runtime errors across many interactions
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const q = new QueuePage(page);
    await q.goto();

    // Perform a sequence that exercises the app thoroughly
    await q.clickEnqueue();
    await q.clickPeek();
    await q.clickEnqueue();
    await q.clickDequeue();
    await q.clickPeek();
    await q.clickClear();
    await q.clickDequeue(); // on empty
    await q.clickPeek();    // on empty
    await q.clickClear();   // on empty

    // Validate that no runtime errors were captured by pageerror or console.error
    expect(pageErrors.length, `pageerror events (should be zero): ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `console.error messages (should be zero): ${consoleErrors.join('; ')}`).toBe(0);
  });
});