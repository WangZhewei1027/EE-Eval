import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f17fe0e0-d366-11f0-9b19-a558354ece3e.html';

// Page Object for the Queue application
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#elementInput');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.queueElements = page.locator('#queueElements');
    this.queueSize = page.locator('#queueSize');
    this.frontElement = page.locator('#frontElement');
    this.rearElement = page.locator('#rearElement');
  }

  async navigate() {
    await this.page.goto(APP_URL);
  }

  // Convenience actions
  async fillInput(value) {
    await this.input.fill(value);
  }

  async clickEnqueue() {
    await this.enqueueBtn.click();
  }

  async clickDequeue() {
    await this.dequeueBtn.click();
  }

  async clickPeek() {
    await this.peekBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async enqueueValue(value) {
    await this.fillInput(value);
    await this.clickEnqueue();
  }

  async enqueueByEnter(value) {
    await this.fillInput(value);
    // Use press to simulate Enter key -> triggers keypress handler
    await this.input.press('Enter');
  }

  // Read state values
  async getQueueSizeText() {
    return (await this.queueSize.textContent()).trim();
  }

  async getFrontElementText() {
    return (await this.frontElement.textContent()).trim();
  }

  async getRearElementText() {
    return (await this.rearElement.textContent()).trim();
  }

  async getQueueItemsCount() {
    return await this.queueElements.locator('.queue-item').count();
  }

  async getQueueItemTextAt(index) {
    const item = this.queueElements.locator('.queue-item').nth(index);
    return (await item.textContent()).trim();
  }

  // Helper to wait for animations/timeouts used in the implementation
  async waitForAnimation() {
    // Implementation uses 500ms timeouts for animations; wait a bit more
    await this.page.waitForTimeout(650);
  }
}

test.describe('Queue Data Structure - FSM based end-to-end tests', () => {
  // Capture console messages and page errors for observation
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
    });

    // Listen for unhandled page errors (ReferenceError, TypeError, SyntaxError etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert we didn't encounter runtime page errors and no console error entries.
    // This observes the runtime and console for unexpected failures.
    expect(pageErrors.length, `Expected no page errors but found: ${pageErrors.map(e => String(e)).join(', ')}`).toBe(0);

    const consoleErrorMessages = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrorMessages.length, `Expected no console.error messages but found: ${consoleErrorMessages.map(m => m.text()).join(', ')}`).toBe(0);
  });

  // Test initial Idle state (S0_Idle)
  test('Initial state (Idle) shows empty queue and stats', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Validate initial display updated by queue.updateDisplay() on load
    await expect(q.queueSize).toHaveText('0');
    await expect(q.frontElement).toHaveText('-');
    await expect(q.rearElement).toHaveText('-');

    // No visible queue items in the DOM
    const count = await q.getQueueItemsCount();
    expect(count).toBe(0);
  });

  // Test Enqueue via button (EnqueueClick) -> S1_Enqueued
  test('Enqueue via button updates DOM, stats and animations (S0_Idle -> S1_Enqueued)', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Enqueue a value 'A'
    await q.enqueueValue('A');

    // After enqueue() the display should update synchronously
    await expect(q.queueSize).toHaveText('1');
    await expect(q.frontElement).toHaveText('A');
    await expect(q.rearElement).toHaveText('A');

    // A queue-item should be present with the enqueued value
    expect(await q.getQueueItemsCount()).toBe(1);
    expect(await q.getQueueItemTextAt(0)).toBe('A');

    // Input should be cleared after successful enqueue
    expect((await q.input.inputValue())).toBe('');

    // The new-item class is removed after 500ms; wait and assert it's removed (visual feedback)
    await q.waitForAnimation();
    const itemLocator = q.queueElements.locator('.queue-item').first();
    // className check via evaluate
    const className = await itemLocator.evaluate((el) => el.className);
    expect(className.includes('new-item')).toBe(false);
  });

  // Test Enqueue via Enter key (EnterKeyPress)
  test('Enqueue via Enter key appends value and updates stats (S1_Enqueued -> S0_Idle)', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Precondition: enqueue 'A' first to make sure front isn't the same as next enqueue
    await q.enqueueValue('A');
    await q.waitForAnimation();

    // Now enqueue 'B' using Enter key
    await q.enqueueByEnter('B');

    // After enqueue: size 2, front 'A', rear 'B'
    await expect(q.queueSize).toHaveText('2');
    await expect(q.frontElement).toHaveText('A');
    await expect(q.rearElement).toHaveText('B');

    // There should be two queue items with correct order (front at index 0)
    expect(await q.getQueueItemsCount()).toBe(2);
    expect(await q.getQueueItemTextAt(0)).toBe('A');
    expect(await q.getQueueItemTextAt(1)).toBe('B');
  });

  // Test Peek (PeekClick) -> S3_Peeked (alert expected)
  test('Peek shows alert with front element (S0_Idle -> S3_Peeked)', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Enqueue two items so peek has a meaningful value
    await q.enqueueValue('X');
    await q.waitForAnimation();
    await q.enqueueValue('Y');

    // Wait a tiny bit to ensure display settled
    await q.waitForAnimation();

    // Intercept the dialog raised by peek()
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      q.clickPeek()
    ]);

    // The dialog message should show the current front element (X)
    expect(dialog.message()).toContain('Front element is: X');
    await dialog.accept();

    // Ensure queue state wasn't mutated by peek (it should be non-destructive)
    await expect(q.queueSize).toHaveText('2');
    await expect(q.frontElement).toHaveText('X');
    await expect(q.rearElement).toHaveText('Y');
  });

  // Test Dequeue (DequeueClick) -> S2_Dequeued
  test('Dequeue removes front element, updates DOM and stats (S0_Idle -> S2_Dequeued)', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Enqueue '1' and '2'
    await q.enqueueValue('1');
    await q.waitForAnimation();
    await q.enqueueValue('2');

    // Confirm preconditions
    await expect(q.queueSize).toHaveText('2');
    await expect(q.frontElement).toHaveText('1');
    await expect(q.rearElement).toHaveText('2');
    expect(await q.getQueueItemsCount()).toBe(2);

    // Click Dequeue and wait for the animation/removal timeouts used in implementation
    await q.clickDequeue();

    // The implementation uses a 500ms timeout to remove and update stats; wait slightly longer
    await q.waitForAnimation();

    // After dequeue, size should be 1, front should be '2', rear '2'
    await expect(q.queueSize).toHaveText('1');
    await expect(q.frontElement).toHaveText('2');
    await expect(q.rearElement).toHaveText('2');

    // DOM should reflect a single queue item now
    expect(await q.getQueueItemsCount()).toBe(1);
    expect(await q.getQueueItemTextAt(0)).toBe('2');
  });

  // Edge case: Dequeue when empty should show alert
  test('Dequeue when empty shows an alert and does not throw runtime errors', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Ensure queue is empty
    await expect(q.queueSize).toHaveText('0');
    await expect(q.frontElement).toHaveText('-');

    // When clicking Dequeue, an alert should appear explaining the queue is empty
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      q.clickDequeue()
    ]);

    expect(dialog.message()).toContain('Queue is empty! Nothing to dequeue.');
    await dialog.accept();

    // State should remain unchanged and no runtime page errors should be emitted (checked in afterEach)
    await expect(q.queueSize).toHaveText('0');
    await expect(q.frontElement).toHaveText('-');
    await expect(q.rearElement).toHaveText('-');
  });

  // Test Clear (ClearClick) -> S4_Cleared
  test('Clear empties the queue and updates stats (S0_Idle -> S4_Cleared)', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Enqueue a couple of items
    await q.enqueueValue('P');
    await q.waitForAnimation();
    await q.enqueueValue('Q');
    await q.waitForAnimation();

    // Confirm queue has items
    await expect(q.queueSize).toHaveText('2');
    expect(await q.getQueueItemsCount()).toBe(2);

    // Click Clear
    await q.clickClear();

    // Clear triggers updateDisplay which is synchronous in implementation
    await expect(q.queueSize).toHaveText('0');
    await expect(q.frontElement).toHaveText('-');
    await expect(q.rearElement).toHaveText('-');

    // Ensure DOM has no queue-items
    expect(await q.getQueueItemsCount()).toBe(0);
  });

  // Edge case: Enqueue with empty input should trigger an alert
  test('Attempting to enqueue with an empty input shows an alert', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Ensure input is empty
    await q.fillInput('');

    // Intercept alert triggered by clicking Enqueue with empty input
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      q.clickEnqueue()
    ]);

    expect(dialog.message()).toContain('Please enter a value to enqueue.');
    await dialog.accept();

    // No new items should be added
    await expect(q.queueSize).toHaveText('0');
    expect(await q.getQueueItemsCount()).toBe(0);
  });

  // Additional edge-case: multiple enqueues/dequeues to verify front/rear update correctly
  test('Multiple enqueues and dequeues maintain FIFO order and update stats', async ({ page }) => {
    const q = new QueuePage(page);
    await q.navigate();

    // Enqueue sequence A, B, C
    await q.enqueueValue('A');
    await q.waitForAnimation();
    await q.enqueueValue('B');
    await q.waitForAnimation();
    await q.enqueueValue('C');
    await q.waitForAnimation();

    await expect(q.queueSize).toHaveText('3');
    await expect(q.frontElement).toHaveText('A');
    await expect(q.rearElement).toHaveText('C');
    expect(await q.getQueueItemsCount()).toBe(3);

    // Dequeue once -> removes A
    await q.clickDequeue();
    await q.waitForAnimation();
    await expect(q.queueSize).toHaveText('2');
    await expect(q.frontElement).toHaveText('B');
    await expect(q.rearElement).toHaveText('C');

    // Dequeue again -> removes B
    await q.clickDequeue();
    await q.waitForAnimation();
    await expect(q.queueSize).toHaveText('1');
    await expect(q.frontElement).toHaveText('C');
    await expect(q.rearElement).toHaveText('C');

    // Dequeue last -> removes C, queue becomes empty and stats reset
    await q.clickDequeue();
    await q.waitForAnimation();
    await expect(q.queueSize).toHaveText('0');
    await expect(q.frontElement).toHaveText('-');
    await expect(q.rearElement).toHaveText('-');
    expect(await q.getQueueItemsCount()).toBe(0);
  });
});