import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b0b202-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object for the Priority Queue demo
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.elementInput = page.locator('#element');
    this.priorityInput = page.locator('#priority');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.queueDisplay = page.locator('#queueDisplay');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async enqueue(element, priority) {
    await this.elementInput.fill(element);
    await this.priorityInput.fill(String(priority));
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

  async getQueueText() {
    return (await this.queueDisplay.textContent()) ?? '';
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getInputValues() {
    const elementVal = await this.elementInput.inputValue();
    const priorityVal = await this.priorityInput.inputValue();
    return { elementVal, priorityVal };
  }
}

test.describe('Priority Queue Demo - FSM states and transitions', () => {
  // Collect console messages and page errors for each test and assert none are present.
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no page errors and no console errors.
    // Note: informational console logs are allowed; only 'error' type messages are considered failures.
  });

  test('Initial state (S0_Idle): queue display initialized and output empty', async ({ page }) => {
    // Validate S0_Idle: updateDisplay() should have run on load and set queueDisplay
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // Check initial queue display content
    await expect(pqPage.queueDisplay).toHaveText('Queue is empty');

    // Output should be empty initially
    await expect(pqPage.output).toHaveText('');

    // Ensure no runtime page errors occurred
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);

    // Ensure no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length, `Expected no console errors, got: ${consoleErrors.map(m=>m.text()).join('; ')}`).toBe(0);
  });

  test('Enqueue transition (S0 -> S1) and input clearing (S1 -> S0) - single element', async ({ page }) => {
    // This test validates:
    // - Enqueue button works
    // - Output text shows the enqueued element and priority (S1_Enqueued evidence)
    // - Queue display updates to include the item
    // - After enqueue, inputs are cleared per exit action
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // Enqueue element "A" priority 2
    await pqPage.enqueue('A', 2);

    // Output should reflect the enqueue action
    await expect(pqPage.output).toHaveText('Enqueued: "A" with priority 2');

    // Queue display should list the element at index 0
    const queueText = await pqPage.getQueueText();
    expect(queueText).toContain('[0] A (priority: 2)');

    // Inputs should be cleared after enqueue
    const inputs = await pqPage.getInputValues();
    expect(inputs.elementVal).toBe('');
    expect(inputs.priorityVal).toBe('');

    // Ensure no runtime page errors occurred
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);

    // Ensure no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length, `Expected no console errors, got: ${consoleErrors.map(m=>m.text()).join('; ')}`).toBe(0);
  });

  test('Enqueue multiple elements preserves priority ordering (min-priority)', async ({ page }) => {
    // Validate ordering: lower numeric priority comes out first / is shown first on display
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // Enqueue several elements with different priorities
    await pqPage.enqueue('X', 5);
    await pqPage.enqueue('Y', 1); // should be placed before X
    await pqPage.enqueue('Z', 3); // between Y and X

    // Output should reflect last enqueue
    await expect(pqPage.output).toHaveText('Enqueued: "Z" with priority 3');

    // Queue display ordering expected: Y (1), Z (3), X (5)
    const queueText = await pqPage.getQueueText();
    const lines = queueText.split('\n').map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toContain('Y (priority: 1)');
    expect(lines[1]).toContain('Z (priority: 3)');
    expect(lines[2]).toContain('X (priority: 5)');

    // Ensure no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Dequeue transition (S0 -> S2): removes and returns highest priority element', async ({ page }) => {
    // Validate dequeue behavior and S2_Dequeued evidence
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // Set up queue: enqueue two items
    await pqPage.enqueue('First', 10);
    await pqPage.enqueue('Urgent', 0); // highest priority (lowest number)

    // Dequeue should remove 'Urgent'
    await pqPage.dequeue();

    await expect(pqPage.output).toHaveText('Dequeued: "Urgent" with priority 0');

    // Queue display should no longer include 'Urgent' and should include 'First'
    const queueText = await pqPage.getQueueText();
    expect(queueText).toContain('First (priority: 10)');
    expect(queueText).not.toContain('Urgent (priority: 0)');

    // Ensure no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Dequeue when empty - edge case and error message handling', async ({ page }) => {
    // Validate behavior when attempting to dequeue an empty queue (edge case)
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // Ensure queue is empty initially
    await expect(pqPage.queueDisplay).toHaveText('Queue is empty');

    // Click Dequeue on empty queue
    await pqPage.dequeue();

    // Should display a helpful message and not crash
    await expect(pqPage.output).toHaveText('Cannot dequeue. Queue is empty.');

    // Ensure no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Peek transition (S0 -> S3): shows front element without removing it', async ({ page }) => {
    // Validate peek behavior: returns front element and does not modify the queue
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // Enqueue some items
    await pqPage.enqueue('Alpha', 4);
    await pqPage.enqueue('Beta', 2); // should be front

    // Peek should indicate Beta as front
    await pqPage.peek();
    await expect(pqPage.output).toHaveText('Front element: "Beta" with priority 2');

    // Ensure that the queue still contains both items in same order
    const queueText = await pqPage.getQueueText();
    expect(queueText).toContain('Beta (priority: 2)');
    expect(queueText).toContain('Alpha (priority: 4)');

    // Ensure no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Peek when empty - edge case', async ({ page }) => {
    // Validate peek on an empty queue returns appropriate message
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // Ensure queue is empty
    await expect(pqPage.queueDisplay).toHaveText('Queue is empty');

    // Click Peek
    await pqPage.peek();

    // Should inform that queue is empty
    await expect(pqPage.output).toHaveText('Queue is empty.');

    // Ensure no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear transition (S0 -> S4): clears the queue and updates display and output', async ({ page }) => {
    // Validate clear behavior per FSM: pq.clear(), updateDisplay(), output "Queue cleared."
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // Enqueue items then clear
    await pqPage.enqueue('One', 1);
    await pqPage.enqueue('Two', 2);

    // Clear the queue
    await pqPage.clear();

    // Output should reflect clearing
    await expect(pqPage.output).toHaveText('Queue cleared.');

    // Queue display should say "Queue is empty"
    await expect(pqPage.queueDisplay).toHaveText('Queue is empty');

    // Ensure no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Validation: enqueue input validation and alerts (edge cases)', async ({ page }) => {
    // This test verifies the input validation branches in the enqueue handler:
    // - empty element should trigger alert and focus
    // - invalid priority should trigger alert and focus
    // - negative priority should trigger alert
    // Note: We cannot easily intercept native alert dialog text without handling dialogs,
    // so we will listen for dialog events and assert their messages.
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    // 1) Empty element: expect alert "Please enter an element value."
    const dialogMessages = [];
    page.on('dialog', async (dialog) => {
      dialogMessages.push(dialog.message());
      await dialog.dismiss();
    });

    // Ensure element is empty and priority is valid
    await pqPage.elementInput.fill('');
    await pqPage.priorityInput.fill('1');
    await pqPage.enqueueBtn.click();

    expect(dialogMessages.shift()).toBe('Please enter an element value.');

    // 2) Invalid priority (empty)
    await pqPage.elementInput.fill('Item');
    await pqPage.priorityInput.fill('');
    await pqPage.enqueueBtn.click();
    expect(dialogMessages.shift()).toBe('Please enter a valid priority number.');

    // 3) Negative priority
    await pqPage.elementInput.fill('Item');
    await pqPage.priorityInput.fill('-5');
    await pqPage.enqueueBtn.click();
    expect(dialogMessages.shift()).toBe('Priority must be zero or positive.');

    // Ensure no unexpected page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity: all buttons exist and are enabled', async ({ page }) => {
    // Basic DOM checks to ensure all interactive components required by FSM are present
    const pqPage = new PriorityQueuePage(page);
    await pqPage.goto();

    await expect(pqPage.elementInput).toBeVisible();
    await expect(pqPage.priorityInput).toBeVisible();
    await expect(pqPage.enqueueBtn).toBeVisible();
    await expect(pqPage.dequeueBtn).toBeVisible();
    await expect(pqPage.peekBtn).toBeVisible();
    await expect(pqPage.clearBtn).toBeVisible();

    // Buttons should be enabled and clickable
    await expect(pqPage.enqueueBtn).toBeEnabled();
    await expect(pqPage.dequeueBtn).toBeEnabled();
    await expect(pqPage.peekBtn).toBeEnabled();
    await expect(pqPage.clearBtn).toBeEnabled();

    // Ensure no runtime errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});