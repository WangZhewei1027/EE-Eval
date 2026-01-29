import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63afeeb2-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page Object for the Queue Demo page.
 * Encapsulates common interactions and queries.
 */
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.enqueueInput = '#enqueueValue';
    this.enqueueBtn = '#enqueueBtn';
    this.dequeueBtn = '#dequeueBtn';
    this.clearBtn = '#clearBtn';
    this.queueDisplay = '#queueDisplay';
    this.info = '#info';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return visible info text content
  async getInfoText() {
    return (await this.page.locator(this.info).textContent())?.trim();
  }

  // Return texts of queue items in order
  async getQueueItems() {
    return await this.page.$$eval(`${this.queueDisplay} .queue-item`, items => items.map(i => i.textContent?.trim()));
  }

  // Enqueue by clicking the Enqueue button. Optionally expect an alert and automatically accept it.
  async enqueueByClick(value, { expectDialog = null } = {}) {
    if (value !== null) {
      await this.page.fill(this.enqueueInput, value);
    } else {
      // ensure empty
      await this.page.fill(this.enqueueInput, '');
    }

    if (expectDialog) {
      const dialogPromise = this.page.waitForEvent('dialog');
      await this.page.click(this.enqueueBtn);
      const dialog = await dialogPromise;
      // Assert dialog message matches expected
      expect(dialog.message()).toBe(expectDialog);
      await dialog.accept();
    } else {
      await this.page.click(this.enqueueBtn);
    }
  }

  // Enqueue by pressing Enter key on the input. Optionally expect an alert and automatically accept it.
  async enqueueByEnter(value, { expectDialog = null } = {}) {
    if (value !== null) {
      await this.page.fill(this.enqueueInput, value);
    } else {
      await this.page.fill(this.enqueueInput, '');
    }

    if (expectDialog) {
      const dialogPromise1 = this.page.waitForEvent('dialog');
      await this.page.press(this.enqueueInput, 'Enter');
      const dialog1 = await dialogPromise;
      expect(dialog.message()).toBe(expectDialog);
      await dialog.accept();
    } else {
      await this.page.press(this.enqueueInput, 'Enter');
    }
  }

  // Click dequeue button. If an alert is expected, capture and accept it, returning the message.
  async dequeue({ expectDialog = null } = {}) {
    if (expectDialog) {
      const dialogPromise2 = this.page.waitForEvent('dialog');
      await this.page.click(this.dequeueBtn);
      const dialog2 = await dialogPromise;
      const msg = dialog.message();
      expect(msg).toBe(expectDialog);
      await dialog.accept();
      return msg;
    } else {
      await this.page.click(this.dequeueBtn);
      return null;
    }
  }

  // Click clear button. For confirm dialogs, you can choose to accept or dismiss.
  async clearQueue({ accept = true, expectDialog = null } = {}) {
    const dialogPromise3 = this.page.waitForEvent('dialog');
    await this.page.click(this.clearBtn);
    const dialog3 = await dialogPromise;
    // It's a confirm dialog in the app. Verify message if provided.
    if (expectDialog) {
      expect(dialog.message()).toBe(expectDialog);
    }
    if (accept) {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
  }
}

test.describe('Queue Demonstration - FSM and UI validation', () => {
  // Capture console error messages and page (uncaught) errors for each test.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages that are errors
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // swallow any unexpected inspection error
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the app
    const queuePage = new QueuePage(page);
    await queuePage.goto();
  });

  test.afterEach(async () => {
    // Assert that there were no console errors or uncaught page errors during the test.
    // This validates that ReferenceError, SyntaxError, TypeError or other runtime errors did not occur.
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Initial state (S0_Empty): info shows empty and no queue items', async ({ page }) => {
    // This test validates the initial "Empty Queue" state.
    const q = new QueuePage(page);

    // The info element should indicate the queue is empty.
    const info = await q.getInfoText();
    expect(info).toBe('The queue is empty.');

    // There should be no queue-item elements
    const items = await q.getQueueItems();
    expect(items).toEqual([]);

    // Visual queue area should be empty (no children)
    const count = await page.$$eval('#queueDisplay > *', nodes => nodes.length);
    expect(count).toBe(0);
  });

  test('Enqueue from empty (S0_Empty -> S1_NonEmpty) using Click', async ({ page }) => {
    // Validate enqueue transition from empty to non-empty via clicking Enqueue
    const q1 = new QueuePage(page);

    // Enqueue a single value via click
    await q.enqueueByClick('Apple');

    // After enqueue, input should be cleared
    const inputVal = await page.inputValue('#enqueueValue');
    expect(inputVal).toBe('');

    // Info should now indicate size 1 and front 'Apple'
    const info1 = await q.getInfoText();
    expect(info).toBe('Queue size: 1. Front: Apple');

    // Queue display should contain one item with text 'Apple' and have the title 'Front of the queue'
    const items1 = await q.getQueueItems();
    expect(items).toEqual(['Apple']);

    const frontTitle = await page.getAttribute('#queueDisplay .queue-item', 'title');
    expect(frontTitle).toBe('Front of the queue');
  });

  test('Enqueue via Enter key when input empty shows alert (S0_Empty EnterKey)', async ({ page }) => {
    // Validate pressing Enter on empty input triggers alert asking to enter a value
    const q2 = new QueuePage(page);

    // Ensure input is empty
    await page.fill('#enqueueValue', '');

    // Expect an alert dialog with specific message
    await q.enqueueByEnter(null, { expectDialog: 'Please enter a value to enqueue.' });

    // Still should be in empty state
    const info2 = await q.getInfoText();
    expect(info).toBe('The queue is empty.');

    const items2 = await q.getQueueItems();
    expect(items).toEqual([]);
  });

  test('Enqueue via Enter key when non-empty (S1_NonEmpty EnterKey)', async ({ page }) => {
    // Validate pressing Enter enqueues the value for non-empty/regular enqueue behavior
    const q3 = new QueuePage(page);

    // Add one item using click first to move to non-empty state
    await q.enqueueByClick('First');

    // Now press Enter to add another item
    await q.enqueueByEnter('Second');

    // Info should reflect size 2 and front still 'First'
    const info3 = await q.getInfoText();
    expect(info).toBe('Queue size: 2. Front: First');

    // Items should be in FIFO order
    const items3 = await q.getQueueItems();
    expect(items).toEqual(['First', 'Second']);

    // Rear item should have title 'Rear of the queue'
    const lastItemTitle = await page.getAttribute('#queueDisplay .queue-item:last-child', 'title');
    expect(lastItemTitle).toBe('Rear of the queue');
  });

  test('Dequeue on non-empty shows dequeued alert and updates queue (S1_NonEmpty Dequeue)', async ({ page }) => {
    // Validate dequeue behavior when queue has items
    const q4 = new QueuePage(page);

    // Enqueue two items
    await q.enqueueByClick('One');
    await q.enqueueByClick('Two');

    // Dequeue should alert the dequeued value "One" and update display to only "Two"
    const dequeuedMessage = await q.dequeue({ expectDialog: 'Dequeued: One' });
    expect(dequeuedMessage).toBe('Dequeued: One');

    // After dequeue, info should show size 1 and front 'Two'
    const info4 = await q.getInfoText();
    expect(info).toBe('Queue size: 1. Front: Two');

    const items4 = await q.getQueueItems();
    expect(items).toEqual(['Two']);
  });

  test('Dequeue on empty shows alert (attempting Dequeue in S0_Empty)', async ({ page }) => {
    // Validate attempting to dequeue when the queue is empty triggers an alert
    const q5 = new QueuePage(page);

    // Ensure empty
    const infoBefore = await q.getInfoText();
    expect(infoBefore).toBe('The queue is empty.');

    // Click Dequeue and expect alert
    const msg1 = await q.dequeue({ expectDialog: 'Queue is empty. Nothing to dequeue.' });
    expect(msg).toBe('Queue is empty. Nothing to dequeue.');

    // Still empty
    const infoAfter = await q.getInfoText();
    expect(infoAfter).toBe('The queue is empty.');
  });

  test('Clear queue confirm dismiss keeps items, accept clears (S1_NonEmpty -> S0_Empty)', async ({ page }) => {
    // Validate clear button behavior: user can cancel or confirm the clear operation
    const q6 = new QueuePage(page);

    // Enqueue two items
    await q.enqueueByClick('A');
    await q.enqueueByClick('B');

    // First attempt: dismiss the confirm dialog -> queue should remain unchanged
    // We intercept dialog and dismiss (i.e., cancel)
    // Provide expected confirm message for clarity
    await q.clearQueue({ accept: false, expectDialog: 'Are you sure you want to clear the queue?' });

    // Queue should still have items
    let items5 = await q.getQueueItems();
    expect(items).toEqual(['A', 'B']);
    let info5 = await q.getInfoText();
    expect(info).toBe('Queue size: 2. Front: A');

    // Second attempt: accept the confirm dialog -> queue should be cleared
    await q.clearQueue({ accept: true, expectDialog: 'Are you sure you want to clear the queue?' });

    items = await q.getQueueItems();
    expect(items).toEqual([]);
    info = await q.getInfoText();
    expect(info).toBe('The queue is empty.');
  });

  test('Edge cases: enqueue empty via click shows alert; rapid enqueues preserve order', async ({ page }) => {
    // Validate edge scenarios: empty enqueue alert and ordering when quickly adding items
    const q7 = new QueuePage(page);

    // Try to enqueue empty value via click -> alert expected
    await q.enqueueByClick(null, { expectDialog: 'Please enter a value to enqueue.' });

    // Queue remains empty
    let items6 = await q.getQueueItems();
    expect(items).toEqual([]);

    // Rapidly enqueue multiple distinct items and verify FIFO order
    // Use click method (which clears input after enqueue)
    await q.enqueueByClick('X');
    await q.enqueueByClick('Y');
    await q.enqueueByClick('Z');

    items = await q.getQueueItems();
    expect(items).toEqual(['X', 'Y', 'Z']);

    // Now dequeue twice to ensure order preserved
    await q.dequeue({ expectDialog: 'Dequeued: X' });
    await q.dequeue({ expectDialog: 'Dequeued: Y' });

    const remaining = await q.getQueueItems();
    expect(remaining).toEqual(['Z']);
  });
});