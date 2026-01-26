import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce8242-fa79-11f0-8075-e54a10595dde.html';

// Page object to encapsulate interactions with the Priority Queue demo
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = '#value';
    this.priorityInput = '#priority';
    this.enqueueButton = "button[onclick='enqueue()']";
    this.dequeueButton = "button[onclick='dequeue()']";
    this.viewQueueButton = "button[onclick='viewQueue()']";
    this.queueTable = '#queueTable';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillValue(value) {
    await this.page.fill(this.valueInput, String(value));
  }

  async fillPriority(priority) {
    await this.page.fill(this.priorityInput, String(priority));
  }

  async clearInputs() {
    await this.page.fill(this.valueInput, '');
    await this.page.fill(this.priorityInput, '');
  }

  async clickEnqueue() {
    await this.page.click(this.enqueueButton);
  }

  async clickDequeue() {
    await this.page.click(this.dequeueButton);
  }

  async clickViewQueue() {
    await this.page.click(this.viewQueueButton);
  }

  // Returns array of objects { value: string, priority: string } in table order (excluding header)
  async getQueueData() {
    return await this.page.$$eval(`${this.queueTable} tr`, rows =>
      Array.from(rows)
        .slice(1) // skip header row
        .map(r => {
          const cells = r.querySelectorAll('td');
          return {
            value: cells[0]?.textContent ?? '',
            priority: cells[1]?.textContent ?? ''
          };
        })
    );
  }

  // Returns number of data rows (excludes header)
  async getQueueLength() {
    const rows = await this.page.$$eval(`${this.queueTable} tr`, rows => rows.length);
    return Math.max(0, rows - 1);
  }
}

test.describe('Priority Queue Demo - FSM states and transitions validation', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect runtime page errors and console messages for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture page uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', msg => {
      // Collect console output for debugging/verification
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Initial Idle state: controls render and table is empty (onEnter renderPage not present)', async ({ page }) => {
    // This test validates the Idle state's entry rendering and presence of UI controls.
    const app = new PriorityQueuePage(page);
    await app.goto();

    // Verify input fields exist and are empty
    await expect(page.locator('#value')).toBeVisible();
    await expect(page.locator('#priority')).toBeVisible();
    await expect(page.locator('#value')).toHaveValue('');
    await expect(page.locator('#priority')).toHaveValue('');

    // Verify buttons exist
    await expect(page.locator("button[onclick='enqueue()']")).toBeVisible();
    await expect(page.locator("button[onclick='dequeue()']")).toBeVisible();
    await expect(page.locator("button[onclick='viewQueue()']")).toBeVisible();

    // Table should have only header row -> length 0 data rows
    const length = await app.getQueueLength();
    expect(length).toBe(0);

    // The FSM entry action listed "renderPage()" is not implemented in the HTML.
    // Assert that no runtime errors occurred during page load.
    expect(pageErrors.length).toBe(0);

    // Confirm that renderPage is not defined on the window (verifies onEnter action is not present)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('Enqueue event: adding items updates queue table and respects priority ordering', async ({ page }) => {
    // This test validates the EnqueueEvent transition and resultant QueueUpdated state.
    const app = new PriorityQueuePage(page);
    await app.goto();

    // Enqueue first item (value 10, priority 5)
    await app.fillValue(10);
    await app.fillPriority(5);

    // No alert is expected for valid enqueue, but capture any unexpected dialog
    const dialogs = [];
    page.on('dialog', dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      dialog.accept().catch(() => {});
    });

    await app.clickEnqueue();

    // After enqueue, table should have one item: value 10, priority 5
    let data = await app.getQueueData();
    expect(data.length).toBe(1);
    expect(data[0]).toEqual({ value: '10', priority: '5' });

    // Enqueue another item with higher priority to verify ordering (value 20, priority 9)
    await app.fillValue(20);
    await app.fillPriority(9);
    await app.clickEnqueue();

    data = await app.getQueueData();
    expect(data.length).toBe(2);
    // Higher priority 9 should come before priority 5
    expect(data[0]).toEqual({ value: '20', priority: '9' });
    expect(data[1]).toEqual({ value: '10', priority: '5' });

    // Enqueue an item with lower priority to ensure it appends
    await app.fillValue(5);
    await app.fillPriority(1);
    await app.clickEnqueue();

    data = await app.getQueueData();
    expect(data.length).toBe(3);
    expect(data[2]).toEqual({ value: '5', priority: '1' });

    // Ensure no unexpected dialogs were shown during valid enqueues
    expect(dialogs.length).toBe(0);

    // Ensure still no runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Dequeue event: removing highest-priority item shows alert and updates table', async ({ page }) => {
    // This test validates the DequeueEvent transition and resultant QueueUpdated state (alert and table update).
    const app = new PriorityQueuePage(page);
    await app.goto();

    // Prepare queue: enqueue two items
    await app.fillValue(100);
    await app.fillPriority(2);
    await app.clickEnqueue();

    await app.fillValue(200);
    await app.fillPriority(8);
    await app.clickEnqueue();

    let data = await app.getQueueData();
    expect(data.length).toBe(2);
    // Highest priority (200, priority 8) should be first
    expect(data[0]).toEqual({ value: '200', priority: '8' });

    // Capture the alert dialog produced by dequeue()
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click Dequeue - should remove the 200/8 item
    await app.clickDequeue();

    // Verify the alert content
    expect(dialogMessage).toMatch(/Dequeued: Value 200, Priority 8/);

    // Verify the table has been updated (only remaining item should be 100/2)
    data = await app.getQueueData();
    expect(data.length).toBe(1);
    expect(data[0]).toEqual({ value: '100', priority: '2' });

    // Ensure no runtime errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('View Queue event: displays current queue without modifying it', async ({ page }) => {
    // This test validates the ViewQueueEvent transition which should show the current queue.
    const app = new PriorityQueuePage(page);
    await app.goto();

    // Start with fresh queue: ensure empty
    // Click view queue on empty queue (should do nothing, no alerts)
    const dialogs = [];
    page.on('dialog', dialog => {
      dialogs.push(dialog.message());
      dialog.accept().catch(() => {});
    });

    await app.clickViewQueue();

    // Table should still be empty
    let length = await app.getQueueLength();
    expect(length).toBe(0);

    // Enqueue some items
    await app.fillValue(7);
    await app.fillPriority(3);
    await app.clickEnqueue();

    await app.fillValue(9);
    await app.fillPriority(6);
    await app.clickEnqueue();

    // Capture table snapshot after clicking viewQueue
    await app.clickViewQueue();
    const data = await app.getQueueData();
    expect(data.length).toBe(2);
    // Ensure the order (priority 6 first)
    expect(data[0]).toEqual({ value: '9', priority: '6' });
    expect(data[1]).toEqual({ value: '7', priority: '3' });

    // No unexpected dialogs from viewQueue
    expect(dialogs.length).toBe(0);

    // Ensure still no runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Enqueue with missing fields triggers alert and does not modify queue', async ({ page }) => {
    // This test validates the error scenario when enqueue is attempted with missing input values.
    const app = new PriorityQueuePage(page);
    await app.goto();

    // Ensure inputs are empty
    await app.clearInputs();

    // Intercept dialog
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click Enqueue with empty inputs
    await app.clickEnqueue();

    // The application should alert the user to enter both fields
    expect(dialogMessage).toBe('Please enter both value and priority.');

    // Queue should remain empty
    const length = await app.getQueueLength();
    expect(length).toBe(0);

    // No runtime errors should have been thrown
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Dequeue on empty queue shows "Queue is empty." alert', async ({ page }) => {
    // This test validates the error scenario of dequeuing when the queue is empty.
    const app = new PriorityQueuePage(page);
    await app.goto();

    // Ensure queue is empty
    const initialLength = await app.getQueueLength();
    expect(initialLength).toBe(0);

    // Capture dialog message produced by dequeue()
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await app.clickDequeue();

    // Verify alert message for empty queue
    expect(dialogMessage).toBe('Queue is empty.');

    // Confirm queue still empty
    const lengthAfter = await app.getQueueLength();
    expect(lengthAfter).toBe(0);

    // Confirm no runtime errors during this flow
    expect(pageErrors.length).toBe(0);
  });

  test('Runtime observation: console logs and page errors are collected (no uncaught errors expected)', async ({ page }) => {
    // This test demonstrates observing console messages and page errors after typical usage flows.
    const app = new PriorityQueuePage(page);
    await app.goto();

    // Perform some interactions to generate console messages (if any) or errors
    await app.fillValue(1);
    await app.fillPriority(1);
    await app.clickEnqueue();

    // Click view and dequeue to exercise code paths
    await app.clickViewQueue();

    page.once('dialog', async dialog => dialog.accept().catch(() => {}));
    await app.clickDequeue();

    // At this point, we collected console messages and page errors via beforeEach handlers.
    // Assert that the pageErrors array exists and currently has no uncaught runtime exceptions.
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(pageErrors.length).toBe(0);

    // Console messages are implementation detail; we assert that we captured them into an array
    expect(Array.isArray(consoleMessages)).toBe(true);
    // It's acceptable for consoleMessages to be empty or contain messages depending on browser/environment.
  });
});