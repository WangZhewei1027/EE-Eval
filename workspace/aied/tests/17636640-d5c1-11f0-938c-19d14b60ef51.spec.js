import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17636640-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Priority Queue demo
class PriorityQueuePage {
  constructor(page) {
    this.page = page;
    this.dialogs = [];
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture dialogs, console messages and page errors for assertions
    this.page.on('dialog', async (dialog) => {
      this.dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (err) => {
      // Store the Error object/string for later assertions
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure basic elements are present before proceeding
    await Promise.all([
      this.page.waitForSelector('#priority'),
      this.page.waitForSelector('#value'),
      this.page.waitForSelector('#enqueue'),
      this.page.waitForSelector('#dequeue'),
      this.page.waitForSelector('#queue')
    ]);
  }

  async enqueue(value, priority) {
    // Fill the inputs and click enqueue
    await this.page.fill('#value', value);
    await this.page.fill('#priority', String(priority));
    const [click] = await Promise.all([
      this.page.click('#enqueue'),
      // If an alert is triggered, the dialog handler will capture and accept it.
    ]);
    return click;
  }

  async enqueueRaw(value, priority) {
    // A helper to set raw text into priority field (useful for non-numeric tests)
    await this.page.fill('#value', value);
    await this.page.fill('#priority', priority);
    await this.page.click('#enqueue');
  }

  async dequeue() {
    await this.page.click('#dequeue');
    // dialog handling done by class listener
  }

  async getQueueItemsText() {
    return this.page.$$eval('#queue .queue-item', nodes => nodes.map(n => n.innerText.trim()));
  }

  async getQueueCount() {
    return this.page.$$eval('#queue .queue-item', nodes => nodes.length);
  }

  async getLastDialog() {
    if (this.dialogs.length === 0) return null;
    return this.dialogs[this.dialogs.length - 1];
  }

  clearCaptured() {
    this.dialogs.length = 0;
    this.consoleMessages.length = 0;
    this.pageErrors.length = 0;
  }
}

// Group tests related to Priority Queue FSM
test.describe('Priority Queue Demo (FSM) - Application ID: 17636640-d5c1-11f0-938c-19d14b60ef51', () => {
  let pqPage;

  test.beforeEach(async ({ page }) => {
    pqPage = new PriorityQueuePage(page);
    await pqPage.goto();
    // Ensure fresh capture arrays for each test
    pqPage.clearCaptured();
  });

  test.afterEach(async () => {
    // After each test assert that there were no uncaught page errors emitted during interaction.
    // The specification requires observing page errors and letting runtime errors happen naturally.
    // Here we assert that the page did not emit any pageerror events (i.e., no unhandled runtime exceptions).
    expect(pqPage.pageErrors, 'No uncaught page errors should be emitted').toHaveLength(0);
  });

  test('S0_Idle: Initial render shows inputs, buttons and empty queue', async () => {
    // Validate initial state S0_Idle: inputs and buttons exist and queue is empty
    const priorityVisible = await pqPage.page.isVisible('#priority');
    const valueVisible = await pqPage.page.isVisible('#value');
    const enqueueVisible = await pqPage.page.isVisible('#enqueue');
    const dequeueVisible = await pqPage.page.isVisible('#dequeue');

    expect(priorityVisible).toBeTruthy();
    expect(valueVisible).toBeTruthy();
    expect(enqueueVisible).toBeTruthy();
    expect(dequeueVisible).toBeTruthy();

    const count = await pqPage.getQueueCount();
    expect(count).toBe(0);

    // No dialogs should have appeared on initial load
    expect(pqPage.dialogs).toHaveLength(0);
  });

  test('S0 -> S1: Enqueue click with valid inputs adds item and prints queue (entry actions)', async () => {
    // This validates the EnqueueClick event and transition to S1_Enqueued.
    await pqPage.enqueue('Task A', 5);

    // After enqueue, the queue should have 1 item displayed with correct text
    const items = await pqPage.getQueueItemsText();
    expect(items.length).toBe(1);
    expect(items[0]).toContain('Value: Task A');
    expect(items[0]).toContain('Priority: 5');

    // Input fields should be cleared after successful enqueue (as per implementation)
    const valueField = await pqPage.page.$eval('#value', el => el.value);
    const priorityField = await pqPage.page.$eval('#priority', el => el.value);
    expect(valueField).toBe('');
    expect(priorityField).toBe('');
  });

  test('S1_Enqueued: Multiple enqueues keep highest priority first (repeat EnqueueClick)', async () => {
    // Enqueue several items with varying priorities
    await pqPage.enqueue('Low', 1);
    await pqPage.enqueue('Medium', 5);
    await pqPage.enqueue('High', 10);
    await pqPage.enqueue('MediumHigh', 7);

    // Validate that queue displays items sorted by priority (highest first)
    const items = await pqPage.getQueueItemsText();
    // Expected order: High(10), MediumHigh(7), Medium(5), Low(1)
    expect(items.length).toBe(4);
    expect(items[0]).toContain('Value: High');
    expect(items[0]).toContain('Priority: 10');
    expect(items[1]).toContain('Value: MediumHigh');
    expect(items[1]).toContain('Priority: 7');
    expect(items[2]).toContain('Value: Medium');
    expect(items[2]).toContain('Priority: 5');
    expect(items[3]).toContain('Value: Low');
    expect(items[3]).toContain('Priority: 1');
  });

  test('S1_Enqueued -> S2_Dequeued: DequeueClick removes highest priority and triggers alert', async () => {
    // Enqueue two items then dequeue and validate alert and queue update
    await pqPage.enqueue('First', 3);
    await pqPage.enqueue('Second', 8); // higher priority; should be dequeued first

    // Ensure two items present
    expect(await pqPage.getQueueCount()).toBe(2);

    // Perform dequeue - dialog should be captured by page object
    await pqPage.dequeue();

    // The dialog should indicate the dequeued item (Second, priority 8)
    const lastDialog = await pqPage.getLastDialog();
    expect(lastDialog).not.toBeNull();
    expect(lastDialog.message).toContain('Dequeued: Value: Second, Priority: 8');

    // Queue should now have only the remaining item
    const items = await pqPage.getQueueItemsText();
    expect(items.length).toBe(1);
    expect(items[0]).toContain('Value: First');
    expect(items[0]).toContain('Priority: 3');
  });

  test('S2_Dequeued -> S1_Enqueued: After dequeue, enqueue transitions back to enqueued state and updates queue', async () => {
    // Enqueue and dequeue to reach S2_Dequeued
    await pqPage.enqueue('Alpha', 2);
    await pqPage.enqueue('Beta', 9);
    await pqPage.dequeue(); // removes Beta

    // Now enqueue a new item; should re-enter S1_Enqueued and display the new item in correct order
    await pqPage.enqueue('Gamma', 5);

    const items = await pqPage.getQueueItemsText();
    // Current queue should contain Alpha(2) and Gamma(5) ordered by priority Gamma then Alpha
    expect(items.length).toBe(2);
    expect(items[0]).toContain('Value: Gamma');
    expect(items[0]).toContain('Priority: 5');
    expect(items[1]).toContain('Value: Alpha');
    expect(items[1]).toContain('Priority: 2');
  });

  test('S2_Dequeued self-transition: DequeueClick on empty queue triggers "Queue is empty!" alert', async () => {
    // Ensure queue is empty initially
    const initialCount = await pqPage.getQueueCount();
    if (initialCount > 0) {
      // If not empty (rare), remove all items by repeated dequeues
      while ((await pqPage.getQueueCount()) > 0) {
        await pqPage.dequeue();
      }
    }

    // Now click dequeue on empty queue
    await pqPage.dequeue();
    const lastDialog = await pqPage.getLastDialog();
    expect(lastDialog).not.toBeNull();
    expect(lastDialog.message).toBe('Queue is empty!');
  });

  test('Edge case: Enqueue with invalid or missing inputs shows validation alert', async () => {
    // Case 1: Both empty
    await pqPage.page.click('#enqueue'); // click without filling fields
    let lastDialog = await pqPage.getLastDialog();
    expect(lastDialog).not.toBeNull();
    expect(lastDialog.message).toBe('Please enter valid value and priority.');

    // Clear captured dialogs for next sub-case
    pqPage.clearCaptured();

    // Case 2: Non-numeric priority (raw fill)
    await pqPage.enqueueRaw('Some Task', 'not-a-number');
    lastDialog = await pqPage.getLastDialog();
    expect(lastDialog).not.toBeNull();
    expect(lastDialog.message).toBe('Please enter valid value and priority.');
  });

  test('Console and runtime observation: ensure no unexpected console errors during interactions', async () => {
    // Perform a set of interactions that exercise the code
    pqPage.clearCaptured();
    await pqPage.enqueue('X', 4);
    await pqPage.enqueue('Y', 6);
    await pqPage.dequeue();
    await pqPage.dequeue();
    await pqPage.dequeue(); // should trigger empty-queue alert

    // Verify that there were no page errors (unhandled exceptions)
    expect(pqPage.pageErrors.length).toBe(0);

    // Additionally assert that console did not capture any "error" type messages
    const errorConsoleMessages = pqPage.consoleMessages.filter(c => c.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });
});