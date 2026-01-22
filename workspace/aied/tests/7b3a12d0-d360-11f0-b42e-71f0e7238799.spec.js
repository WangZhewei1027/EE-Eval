import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3a12d0-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page Object Model for the Queue Simulation app.
 * Encapsulates interactions and inspectors to keep tests readable.
 */
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputItem');
    this.enqueueButton = page.locator('button[onclick="enqueue()"]');
    this.dequeueButton = page.locator('button[onclick="dequeue()"]');
    this.queueDisplay = page.locator('#queueDisplay');
    this.queueItems = () => this.queueDisplay.locator('.queue-item');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    return await this.page.$eval('#inputItem', el => el.value);
  }

  async fillInput(text) {
    await this.input.fill(text);
  }

  async clickEnqueue() {
    await this.enqueueButton.click();
  }

  async clickDequeue() {
    await this.dequeueButton.click();
  }

  async enqueueItem(text) {
    await this.fillInput(text);
    await this.clickEnqueue();
  }

  async dequeueOnce() {
    await this.clickDequeue();
  }

  async getQueueItemCount() {
    return await this.queueItems().count();
  }

  async getQueueItemsText() {
    return await this.queueItems().allTextContents();
  }

  async getQueueHTML() {
    return await this.page.$eval('#queueDisplay', el => el.innerHTML);
  }
}

test.describe('Queue Simulation (FSM) - Comprehensive E2E Tests', () => {
  // Collect console messages and page errors for each test to assert no unexpected runtime errors occur.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  // Helper assertion to ensure no runtime errors were emitted during a test
  async function assertNoRuntimeErrors() {
    // Fail if any page error occurred
    expect(pageErrors.length, `Expected no page errors, but got: ${pageErrors.map(String).join('\n')}`).toBe(0);

    // Fail if any console error messages were logged
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, but got: ${JSON.stringify(consoleErrors)}`).toBe(0);
  }

  test('Initial state S0_Idle: controls present and queue is empty', async ({ page }) => {
    // This test validates the initial Idle state: input and buttons are present and queue display is empty.
    const qp = new QueuePage(page);

    // Verify input and buttons are visible
    await expect(qp.input).toBeVisible();
    await expect(qp.enqueueButton).toBeVisible();
    await expect(qp.dequeueButton).toBeVisible();

    // Initial queue should be empty (renderQueue called by entry action should have rendered nothing)
    const count = await qp.getQueueItemCount();
    expect(count).toBe(0);

    const html = await qp.getQueueHTML();
    expect(html.trim()).toBe('');

    // Ensure there were no runtime errors on page load
    await assertNoRuntimeErrors();
  });

  test('Enqueue an item transitions to S1_ItemEnqueued: item added and input cleared', async ({ page }) => {
    // Validates the EnqueueItem event from Idle: the item appears in the queue display
    // and the input is cleared (evidence of the S1_ItemEnqueued state entry/exit actions).
    const qp = new QueuePage(page);

    // Add an item "First"
    await qp.fillInput('First');
    await qp.clickEnqueue();

    // After enqueue, queue display should show one item with the enqueued text
    const items = await qp.getQueueItemsText();
    expect(items.length).toBe(1);
    expect(items[0]).toBe('First');

    // Input should be cleared after enqueue
    const inputVal = await qp.getInputValue();
    expect(inputVal).toBe('');

    // Ensure renderQueue produced the expected DOM updates and no runtime errors occurred
    await assertNoRuntimeErrors();
  });

  test('Enqueue with empty input triggers alert (edge case) and does not add item', async ({ page }) => {
    // Validates the behavior when the user clicks Enqueue with an empty input:
    // the app should alert and not add an empty item to the queue.
    const qp = new QueuePage(page);

    // Ensure the input is empty
    await qp.fillInput('');

    // Setup dialog wait BEFORE click; Playwright will capture the alert
    const dialogPromise = page.waitForEvent('dialog');

    // Click enqueue with empty input - should open an alert
    await qp.clickEnqueue();

    const dialog = await dialogPromise;
    // Confirm expected alert message from implementation
    expect(dialog.message()).toBe('Please enter an item to enqueue.');

    // Accept the alert so it doesn't block the page
    await dialog.accept();

    // Confirm no items were added
    const count = await qp.getQueueItemCount();
    expect(count).toBe(0);

    // Ensure no page errors and no console.error
    await assertNoRuntimeErrors();
  });

  test('Dequeue on non-empty queue transitions to S2_ItemDequeued: removes the first item (FIFO)', async ({ page }) => {
    // Validates dequeue removes the front element and the queue display updates accordingly (FIFO behavior).
    const qp = new QueuePage(page);

    // Enqueue two items: A then B
    await qp.enqueueItem('A');
    await qp.enqueueItem('B');

    let items = await qp.getQueueItemsText();
    expect(items).toEqual(['A', 'B']); // confirm order

    // Dequeue once: should remove 'A'
    await qp.clickDequeue();

    items = await qp.getQueueItemsText();
    expect(items).toEqual(['B']); // 'A' should be removed

    // Ensure no runtime errors
    await assertNoRuntimeErrors();
  });

  test('Dequeue when queue is empty is a no-op and does not throw', async ({ page }) => {
    // Validates DequeueItem event from Idle when the queue is empty results in no exception
    // and the queue display remains empty.
    const qp = new QueuePage(page);

    // Ensure queue is empty initially
    let count = await qp.getQueueItemCount();
    expect(count).toBe(0);

    // Click dequeue on empty queue
    await qp.clickDequeue();

    // After dequeue, queue should still be empty
    count = await qp.getQueueItemCount();
    expect(count).toBe(0);

    // Ensure no runtime errors (no exceptions thrown in page)
    await assertNoRuntimeErrors();
  });

  test('Multiple enqueue/dequeue operations maintain FIFO order across transitions', async ({ page }) => {
    // This test exercises repeated transitions: S0 -> S1 (enqueue), S1 -> S0 (input cleared),
    // S0 -> S2 (dequeue), S2 -> S0 (renderQueue). It verifies overall FIFO correctness.
    const qp = new QueuePage(page);

    // Enqueue 1, 2, 3
    await qp.enqueueItem('1');
    await qp.enqueueItem('2');
    await qp.enqueueItem('3');

    let items = await qp.getQueueItemsText();
    expect(items).toEqual(['1', '2', '3']);

    // Dequeue three times and verify order
    await qp.clickDequeue();
    items = await qp.getQueueItemsText();
    expect(items).toEqual(['2', '3']);

    await qp.clickDequeue();
    items = await qp.getQueueItemsText();
    expect(items).toEqual(['3']);

    await qp.clickDequeue();
    items = await qp.getQueueItemsText();
    expect(items).toEqual([]); // empty

    // Ensure no runtime errors occurred during sequence
    await assertNoRuntimeErrors();
  });

  test('Input clearing evidence after enqueue (transition S1_ItemEnqueued -> S0_Idle)', async ({ page }) => {
    // Explicitly validates the "inputItem.value = ''" evidence: after enqueue input must be empty.
    const qp = new QueuePage(page);

    await qp.fillInput('to-be-cleared');
    await qp.clickEnqueue();

    const val = await qp.getInputValue();
    expect(val).toBe('', 'Expected input to be cleared after enqueue (evidence of S1 -> S0)');

    // Also ensure the queue contains the item added
    const items = await qp.getQueueItemsText();
    expect(items).toContain('to-be-cleared');

    await assertNoRuntimeErrors();
  });

  test('renderQueue() entry evidence: DOM updates after operations reflect internal queue state', async ({ page }) => {
    // Validates that renderQueue() is executed by ensuring the DOM representation matches
    // the logical sequence of enqueue/dequeue operations.
    const qp = new QueuePage(page);

    // Start with empty queue
    expect(await qp.getQueueItemCount()).toBe(0);

    // Enqueue X and Y
    await qp.enqueueItem('X');
    await qp.enqueueItem('Y');
    expect(await qp.getQueueItemsText()).toEqual(['X', 'Y']);

    // Dequeue removes X
    await qp.clickDequeue();
    expect(await qp.getQueueItemsText()).toEqual(['Y']);

    // Enqueue Z
    await qp.enqueueItem('Z');
    expect(await qp.getQueueItemsText()).toEqual(['Y', 'Z']);

    // Final assertion: the DOM accurately reflects the expected FIFO queue contents
    expect(await qp.getQueueItemsText()).toEqual(['Y', 'Z']);

    await assertNoRuntimeErrors();
  });
});