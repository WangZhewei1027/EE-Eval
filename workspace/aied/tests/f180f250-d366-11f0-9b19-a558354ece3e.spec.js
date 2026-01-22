import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f180f250-d366-11f0-9b19-a558354ece3e.html';

class PriorityQueuePage {
  /**
   * Page object encapsulating interactions with the Priority Queue UI
   */
  constructor(page) {
    this.page = page;
    this.itemInput = page.locator('#itemValue');
    this.prioritySelect = page.locator('#prioritySelect');
    this.addButton = page.locator('button[onclick="addItem()"]');
    this.removeButton = page.locator('button[onclick="removeHighestPriority()"]');
    this.peekButton = page.locator('button[onclick="peekHighestPriority()"]');
    this.clearButton = page.locator('button[onclick="clearQueue()"]');
    this.queueDisplay = page.locator('#queueDisplay');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async addItem(value, priority = 'medium') {
    // fill input, select priority, click add
    await this.itemInput.fill(value);
    await this.prioritySelect.selectOption(priority);
    await this.addButton.click();
  }

  async addItemByEnter(value, priority = 'medium') {
    await this.itemInput.fill(value);
    await this.prioritySelect.selectOption(priority);
    // Press Enter key to trigger the keypress listener
    await this.itemInput.press('Enter');
  }

  async removeHighest() {
    await this.removeButton.click();
  }

  async peekHighest() {
    await this.peekButton.click();
  }

  async clearQueue() {
    await this.clearButton.click();
  }

  async getQueueInnerText() {
    return this.queueDisplay.innerText();
  }

  async getQueueItemElements() {
    return this.queueDisplay.locator('.queue-item');
  }

  async getQueueItemCount() {
    return this.getQueueItemElements().count();
  }

  async getFirstQueueItemText() {
    const items = this.getQueueItemElements();
    const count = await items.count();
    if (count === 0) return null;
    return items.nth(0).innerText();
  }

  async getLogText() {
    return this.log.innerText();
  }
}

test.describe('Priority Queue Visualization - FSM validation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors and console messages for assertions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app
    const pq = new PriorityQueuePage(page);
    await pq.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure there were no uncaught page errors during the test
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);

    // Ensure there are no console.error messages (treating them as failures)
    const consoleErrors = consoleMessages.filter(c => c.type === 'error' || c.type === 'warning');
    expect(consoleErrors.length, `Console errors/warnings were emitted: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('S0 Idle: initial state shows "Queue is empty" and empty log', async ({ page }) => {
    // Validate Idle state rendering and evidence
    const pq = new PriorityQueuePage(page);

    // Queue display should indicate empty queue
    await expect(pq.queueDisplay).toContainText('Queue is empty');

    // Log should be empty initially
    const logText = await pq.getLogText();
    expect(logText.trim()).toBe('');

    // No queue items present
    const count = await pq.getQueueItemCount();
    expect(count).toBe(0);
  });

  test('S0 -> S1: AddItem (Add to Queue) adds item, renders it, and logs "Added"', async ({ page }) => {
    // This test validates adding an item via the Add button
    const pq = new PriorityQueuePage(page);

    // Add a medium-priority item
    await pq.addItem('task1', 'medium');

    // After adding, queue should not show "Queue is empty"
    await expect(pq.queueDisplay).not.toContainText('Queue is empty');

    // A queue-item element should exist with the correct content and priority label
    const firstText = await pq.getFirstQueueItemText();
    expect(firstText).toContain('task1');
    expect(firstText.toLowerCase()).toContain('medium');

    // Log should contain an 'Added' entry with the item and priority
    const log = await pq.getLogText();
    expect(log).toMatch(/Added: "task1" with medium priority/);
  });

  test('S1 -> S2: RemoveHighestPriority removes the highest priority item and logs "Removed"', async ({ page }) => {
    // Add multiple items with different priorities, then remove highest and verify order and logs
    const pq = new PriorityQueuePage(page);

    // Add items in order: low, medium, high (to ensure sorting happens)
    await pq.addItem('lowItem', 'low');
    await pq.addItem('medItem', 'medium');
    await pq.addItem('highItem', 'high');

    // Wait for render
    await page.waitForTimeout(100);

    // Confirm ordering: highest priority (high) should be first visually
    const firstTextBefore = await pq.getFirstQueueItemText();
    expect(firstTextBefore).toContain('highItem');
    // Also confirm class name of first item includes priority-high
    const firstItem = pq.getQueueItemElements().nth(0);
    await expect(firstItem).toHaveClass(/priority-high/);

    // Remove the highest priority
    await pq.removeHighest();

    // Log should have a Removed entry for highItem
    const logAfterRemove = await pq.getLogText();
    expect(logAfterRemove).toMatch(/Removed: "highItem" with high priority/);

    // Now the first item should be medItem
    const firstTextAfter = await pq.getFirstQueueItemText();
    expect(firstTextAfter).toContain('medItem');
  });

  test('S1 -> S3: PeekHighestPriority logs "Peeked" and does not modify queue', async ({ page }) => {
    // Ensure peek logs correct message and queue remains unchanged
    const pq = new PriorityQueuePage(page);

    await pq.addItem('onlyItem', 'medium');

    // Snapshot of queue before peek
    const beforeText = await pq.getFirstQueueItemText();
    expect(beforeText).toContain('onlyItem');

    // Call peek
    await pq.peekHighest();

    // Peek should log but not remove the item
    const log = await pq.getLogText();
    expect(log).toMatch(/Peeked: "onlyItem" with medium priority is at front/);

    // Queue should remain unchanged
    const afterText = await pq.getFirstQueueItemText();
    expect(afterText).toContain('onlyItem');
  });

  test('S0 -> S4: ClearQueue clears items from a non-empty queue and logs "Queue cleared"', async ({ page }) => {
    // Add items and then clear
    const pq = new PriorityQueuePage(page);

    await pq.addItem('a', 'low');
    await pq.addItem('b', 'high');

    // Clear queue
    await pq.clearQueue();

    // Queue display should show "Queue is empty"
    await expect(pq.queueDisplay).toContainText('Queue is empty');

    // Log should contain 'Queue cleared'
    const log = await pq.getLogText();
    expect(log).toMatch(/Queue cleared/);

    // No queue items should be present
    const count = await pq.getQueueItemCount();
    expect(count).toBe(0);
  });

  test('S0 -> S4: ClearQueue on already empty queue still logs "Queue cleared" and remains empty', async ({ page }) => {
    const pq = new PriorityQueuePage(page);

    // Ensure starting empty
    await expect(pq.queueDisplay).toContainText('Queue is empty');

    // Clear when empty
    await pq.clearQueue();

    // Should still show empty and log cleared
    await expect(pq.queueDisplay).toContainText('Queue is empty');
    const log = await pq.getLogText();
    expect(log).toMatch(/Queue cleared/);
  });

  test('S1 EnterKeyPressed: pressing Enter in input adds an item (stays in ItemAdded)', async ({ page }) => {
    // Validate Enter key triggers addItem()
    const pq = new PriorityQueuePage(page);

    // Use Enter to add a high priority item
    await pq.addItemByEnter('enterItem', 'high');

    // Item should be added and present
    await expect(pq.queueDisplay).not.toContainText('Queue is empty');
    const firstText = await pq.getFirstQueueItemText();
    expect(firstText).toContain('enterItem');

    // Log should include Added entry
    const log = await pq.getLogText();
    expect(log).toMatch(/Added: "enterItem" with high priority/);
  });

  test('Edge case: adding empty value triggers alert and does not add an item', async ({ page }) => {
    // Verify alert is shown when adding empty value and queue remains unchanged
    const pq = new PriorityQueuePage(page);

    // Ensure queue starts empty
    await expect(pq.queueDisplay).toContainText('Queue is empty');

    // Listen for dialog once and assert its text
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      // Click add without filling input
      pq.addButton.click()
    ]);

    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Please enter a value for the queue item');
    await dialog.accept();

    // Ensure queue is still empty and no new log entry for Added was made
    await expect(pq.queueDisplay).toContainText('Queue is empty');
    const log = await pq.getLogText();
    expect(log.trim()).toBe('');
  });

  test('Comprehensive sequence: add multiple, peek, remove repeatedly until empty', async ({ page }) => {
    // This test simulates a full usage flow ensuring FSM transitions across states
    const pq = new PriorityQueuePage(page);

    // Add several items with mixed priorities
    await pq.addItem('taskA', 'medium');
    await pq.addItem('taskB', 'high');
    await pq.addItem('taskC', 'low');

    // After adding, order should be: taskB (high), taskA (medium), taskC (low)
    let first = await pq.getFirstQueueItemText();
    expect(first).toContain('taskB');

    // Peek (should not alter)
    await pq.peekHighest();
    let logAfterPeek = await pq.getLogText();
    expect(logAfterPeek).toMatch(/Peeked: "taskB" with high priority is at front/);

    // Remove first -> removes taskB
    await pq.removeHighest();
    let logAfterRemove1 = await pq.getLogText();
    expect(logAfterRemove1).toMatch(/Removed: "taskB" with high priority/);

    // Remove next -> removes taskA
    await pq.removeHighest();
    let logAfterRemove2 = await pq.getLogText();
    expect(logAfterRemove2).toMatch(/Removed: "taskA" with medium priority/);

    // Remove last -> removes taskC and queue becomes empty
    await pq.removeHighest();
    let logAfterRemove3 = await pq.getLogText();
    expect(logAfterRemove3).toMatch(/Removed: "taskC" with low priority/);

    // Queue should now display empty message
    await expect(pq.queueDisplay).toContainText('Queue is empty');
  });
});