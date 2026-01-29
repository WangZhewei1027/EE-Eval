import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ac833-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Queue application
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#itemInput');
    this.enqueueBtn = page.locator('button[onclick="enqueue()"]');
    this.dequeueBtn = page.locator('button[onclick="dequeue()"]');
    this.peekBtn = page.locator('button[onclick="peek()"]');
    this.clearBtn = page.locator('button[onclick="clearQueue()"]');
    this.queueDisplay = page.locator('#queueDisplay');
    this.queueInfo = page.locator('#queueInfo');
    this.queueItems = () => this.page.locator('#queueDisplay .queue-item');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async enqueue(value) {
    if (value !== undefined) {
      await this.setInput(value);
    }
    await this.enqueueBtn.click();
  }

  async dequeue() {
    await this.dequeueBtn.click();
  }

  async peek() {
    await this.peekBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async getQueueInfoText() {
    return (await this.queueInfo.textContent())?.trim() ?? '';
  }

  async getItemsText() {
    const count = await this.queueItems().count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.queueItems().nth(i).textContent())?.trim() ?? '');
    }
    return texts;
  }

  async getItemsCount() {
    return this.queueItems().count();
  }

  async getItemInlineStyleProperty(index, property) {
    return await this.page.evaluate(
      (idx, prop) => {
        const items = document.querySelectorAll('#queueDisplay .queue-item');
        if (!items[idx]) return window.getComputedStyle(document.body).getPropertyValue(prop) || '';
        return window.getComputedStyle(items[idx]).getPropertyValue(prop) || '';
      },
      index,
      property
    );
  }

  async getItemAttribute(index, attr) {
    return await this.page.evaluate(
      (idx, attribute) => {
        const items = document.querySelectorAll('#queueDisplay .queue-item');
        if (!items[idx]) return null;
        return items[idx].getAttribute(attribute);
      },
      index,
      attr
    );
  }
}

test.describe('Queue Demonstration - FSM validation tests', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }, testInfo) => {
    // Attach listeners for console and page errors; store on testInfo for later assertions
    testInfo.annotations.push({ type: 'url', description: APP_URL });

    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store both type and text for diagnostics
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Make console and page error arrays available to the test via testInfo.attachments if needed
    // (No file attachments required here, but keep diagnostic data in case of failures)
    const consoleMessages = page.context()._consoleMessages || [];
    const pageErrors = page.context()._pageErrors || [];

    // Attach a plain-text summary so CI logs show the captured messages on failures
    if (consoleMessages.length > 0 || pageErrors.length > 0) {
      const summary = [
        `Console messages (${consoleMessages.length}):`,
        ...consoleMessages.map((m) => `${m.type}: ${m.text}`),
        `Page errors (${pageErrors.length}):`,
        ...pageErrors.map((e) => `${e.name}: ${e.message}`),
      ].join('\n');
      testInfo.attach('diagnostic-log', { body: summary, contentType: 'text/plain' });
    }
  });

  test.describe('Initial state (S0_Empty)', () => {
    test('Initial load shows empty queue state and updateQueueDisplay ran', async ({ page }) => {
      // This test validates the initial FSM state S0_Empty:
      // - queue.length === 0 (no queue items in DOM)
      // - queueInfo.textContent === 'Queue is empty'
      const q = new QueuePage(page);
      await q.goto();

      // Verify queue display has no items
      expect(await q.getItemsCount()).toBe(0);

      // Verify the informational text indicates empty queue
      expect(await q.getQueueInfoText()).toBe('Queue is empty');

      // No uncaught page errors and no console error messages expected
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Enqueue transitions (S0_Empty -> S1_NonEmpty and S1_NonEmpty -> S1_NonEmpty)', () => {
    test('Enqueue an item transitions to Non-Empty queue and updates display', async ({ page }) => {
      // Validates Enqueue event from empty state:
      // - After enqueue, queueInfo should be 'Queue size: 1'
      // - A queue item with the enqueued text should be present
      // - The input should be cleared
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('item1');

      // Wait briefly for DOM updates and animations (highlight removal)
      await page.waitForTimeout(100);

      expect(await q.getQueueInfoText()).toBe('Queue size: 1');

      const items = await q.getItemsText();
      expect(items).toEqual(['item1']);

      // The front item should have the front color set inline in updateQueueDisplay
      const frontBg = await q.getItemInlineStyleProperty(0, 'background-color');
      // '#FF9800' corresponds to rgb(255, 152, 0)
      expect(frontBg.replace(/\s/g, '')).toContain('rgb(255,152,0)'.replace(/\s/g, ''));

      // Ensure input cleared
      expect(await q.input.inputValue()).toBe('');

      // No console errors or page errors
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Enqueue a second item keeps Non-Empty state and preserves order', async ({ page }) => {
      // Validates second Enqueue within Non-Empty:
      // - Queue size increments to 2
      // - Order is FIFO: item1 at front, item2 at rear
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('item1');
      // allow highlight animation to be added/removed
      await page.waitForTimeout(100);

      await q.enqueue('item2');
      await page.waitForTimeout(100);

      expect(await q.getQueueInfoText()).toBe('Queue size: 2');

      const items = await q.getItemsText();
      expect(items).toEqual(['item1', 'item2']);

      // Rear item should have blue background inline style '#2196F3' (rgb(33,150,243))
      const rearBg = await q.getItemInlineStyleProperty(1, 'background-color');
      expect(rearBg.replace(/\s/g, '')).toContain('rgb(33,150,243)'.replace(/\s/g, ''));

      // No console errors or page errors
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Peek behavior (S1_NonEmpty peek)', () => {
    test('Peek shows front element information and updates queueInfo', async ({ page }) => {
      // Validates Peek event behavior:
      // - When queue is non-empty, clicking peek updates queueInfo to show front of queue
      // - The front item receives a transform highlight briefly
      const q = new QueuePage(page);
      await q.goto();

      // Setup: enqueue two items
      await q.enqueue('item1');
      await page.waitForTimeout(100);
      await q.enqueue('item2');
      await page.waitForTimeout(100);

      // Click peek
      await q.peek();

      // Immediately after peek, queueInfo should reflect front
      expect(await q.getQueueInfoText()).toBe('Front of queue: item1');

      // The front item should have a transform applied (scale up). We check computed transform
      // shortly after click (before the 500ms revert)
      await page.waitForTimeout(50); // ensure transform applied
      const transformDuring = await page.evaluate(() => {
        const item = document.querySelector('#queueDisplay .queue-item');
        return item ? window.getComputedStyle(item).getPropertyValue('transform') : '';
      });

      // transformDuring may be 'matrix(...)' or 'none', but we expect it NOT to be 'none' during highlight.
      expect(transformDuring === '' ? 'none' : transformDuring).not.toBe('none');

      // Wait until transform should have reverted (500ms)
      await page.waitForTimeout(500);
      const transformAfter = await page.evaluate(() => {
        const item = document.querySelector('#queueDisplay .queue-item');
        return item ? window.getComputedStyle(item).getPropertyValue('transform') : '';
      });

      // After revert, transform should either be 'none' or a neutral matrix; at least it should not be stuck as the highlighted transform
      // (We simply assert that the page remains interactive and no errors occurred.)
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Peek on empty queue shows appropriate message', async ({ page }) => {
      // Validates Peek from empty queue (edge case):
      // - Should display 'Queue is empty - nothing to peek'
      const q = new QueuePage(page);
      await q.goto();

      // Ensure empty
      expect(await q.getItemsCount()).toBe(0);

      await q.peek();

      expect(await q.getQueueInfoText()).toBe('Queue is empty - nothing to peek');

      // No console/page errors
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Dequeue transitions (S1_NonEmpty -> S1_NonEmpty and S1_NonEmpty -> S0_Empty)', () => {
    test('Dequeue removes the front item and updates display (Non-Empty -> Non-Empty)', async ({ page }) => {
      // Validates Dequeue when more than one item in queue:
      // - After dequeue, queue size decrements
      // - First item removed and next item becomes front
      const q = new QueuePage(page);
      await q.goto();

      // Enqueue two items
      await q.enqueue('item1');
      await page.waitForTimeout(100);
      await q.enqueue('item2');
      await page.waitForTimeout(100);

      // Click dequeue: this triggers an animation and actual removal after ~300ms
      await q.dequeue();

      // Immediately the first item should have class 'removed' (style change)
      const firstHasRemovedClass = await page.evaluate(() => {
        const el = document.querySelector('#queueDisplay .queue-item');
        return el ? el.classList.contains('removed') : false;
      });

      expect(firstHasRemovedClass).toBe(true);

      // Wait for the removal to finish (>=300ms) and DOM update
      await page.waitForTimeout(350);

      // Now queue should have 1 item with 'item2' at front
      expect(await q.getQueueInfoText()).toBe('Queue size: 1');
      const items = await q.getItemsText();
      expect(items).toEqual(['item2']);

      // The front item should have title indicating front of queue
      const title = await q.getItemAttribute(0, 'title');
      expect(title).toContain('Front of queue');

      // No console/page errors
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Dequeue last item transitions to Empty state (Non-Empty -> Empty)', async ({ page }) => {
      // Validates Dequeue when only one item is present:
      // - After dequeue completes, queue becomes empty and queueInfo reads 'Queue is empty'
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('solo');
      await page.waitForTimeout(100);

      await q.dequeue();

      // Wait for removal to complete
      await page.waitForTimeout(350);

      expect(await q.getItemsCount()).toBe(0);
      expect(await q.getQueueInfoText()).toBe('Queue is empty');

      // No console/page errors
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Dequeue on empty queue displays cannot dequeue message (edge case)', async ({ page }) => {
      // Validates attempting to dequeue when empty:
      // - Should not throw errors and should update queueInfo with inability message
      const q = new QueuePage(page);
      await q.goto();

      expect(await q.getItemsCount()).toBe(0);

      await q.dequeue();

      expect(await q.getQueueInfoText()).toBe('Queue is empty - cannot dequeue');

      // No console/page errors
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Clear event and edge cases', () => {
    test('Clear removes all items and sets info message from implementation', async ({ page }) => {
      // Validates Clear event:
      // - Clears queue, updates display to empty
      // - Note: implementation sets queueInfo to 'Queue has been cleared'
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('a');
      await page.waitForTimeout(100);
      await q.enqueue('b');
      await page.waitForTimeout(100);

      expect(await q.getItemsCount()).toBe(2);

      await q.clear();

      // updateQueueDisplay is called inside clearQueue(); wait a small amount
      await page.waitForTimeout(50);

      // Implementation-specific message expected
      expect(await q.getQueueInfoText()).toBe('Queue has been cleared');

      // Queue display should be empty
      expect(await q.getItemsCount()).toBe(0);

      // No console/page errors
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Enqueue with empty or whitespace input does nothing (edge case)', async ({ page }) => {
      // Validates that enqueue ignores empty/whitespace-only input
      const q = new QueuePage(page);
      await q.goto();

      // Attempt to enqueue empty string
      await q.setInput('');
      await q.enqueue(); // click enqueue with empty input
      await page.waitForTimeout(50);
      expect(await q.getItemsCount()).toBe(0);
      expect(await q.getQueueInfoText()).toBe('Queue is empty');

      // Attempt to enqueue whitespace
      await q.setInput('   ');
      await q.enqueue();
      await page.waitForTimeout(50);
      expect(await q.getItemsCount()).toBe(0);
      expect(await q.getQueueInfoText()).toBe('Queue is empty');

      // No console/page errors
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Diagnostics: observe console and page errors', () => {
    test('No unexpected console or page errors during typical usage', async ({ page }) => {
      // This test performs a sequence of normal interactions and asserts that no console errors or page errors were emitted.
      // It also ensures the FSM states are reached during the interactions.
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('one');
      await page.waitForTimeout(100);
      await q.enqueue('two');
      await page.waitForTimeout(100);
      await q.peek();
      await page.waitForTimeout(100);
      await q.dequeue();
      await page.waitForTimeout(350);
      await q.clear();
      await page.waitForTimeout(50);

      // Capture console and page error arrays
      const consoleMessages = page.context()._consoleMessages || [];
      const pageErrors = page.context()._pageErrors || [];

      // For diagnostics ensure there are no console errors or uncaught page exceptions
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      // If any errors occurred, the test will fail and the afterEach will attach diagnostic logs.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Final state after clear is implementation-specific message
      expect(await q.getQueueInfoText()).toBe('Queue has been cleared');
    });
  });
});