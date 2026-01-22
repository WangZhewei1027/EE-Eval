import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3afd33-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page Object for the Priority Queue Demo page
 */
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.itemInput = page.locator('#item');
    this.priorityInput = page.locator('#priority');
    this.addButton = page.locator("button[onclick='addToQueue()']");
    this.removeButton = page.locator("button[onclick='removeFromQueue()']");
    this.queueList = page.locator('#queue');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main controls to be visible
    await expect(this.itemInput).toBeVisible();
    await expect(this.priorityInput).toBeVisible();
    await expect(this.addButton).toBeVisible();
    await expect(this.removeButton).toBeVisible();
  }

  async fillInputs(item, priority) {
    await this.itemInput.fill(item);
    // priority is number or string
    await this.priorityInput.fill(String(priority));
  }

  async clickAdd() {
    await this.addButton.click();
  }

  async clickRemove() {
    await this.removeButton.click();
  }

  async getQueueItemsText() {
    const lis = await this.queueList.locator('li').allTextContents();
    return lis; // array of strings like "Task1 (Priority: 1)"
  }

  async getItemInputValue() {
    return await this.itemInput.inputValue();
  }

  async getPriorityInputValue() {
    return await this.priorityInput.inputValue();
  }
}

test.describe('Priority Queue Demo - FSM and UI tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen to console and page errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', err => {
      // Uncaught exceptions on page
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown needed; navigation is per test
  });

  test.describe('Initial state: S0_Idle', () => {
    test('renders controls and empty queue on load (Idle state)', async ({ page }) => {
      // This test validates S0_Idle entry actions and initial DOM state
      const pqPage = new PriorityQueuePage(page);
      // Ensure controls exist and queue is empty
      await expect(pqPage.itemInput).toBeVisible();
      await expect(pqPage.priorityInput).toBeVisible();
      await expect(pqPage.addButton).toBeVisible();
      await expect(pqPage.removeButton).toBeVisible();

      const items = await pqPage.getQueueItemsText();
      expect(items.length).toBe(0);

      // Assert no uncaught page errors occurred during load
      expect(pageErrors.length).toBe(0);
      // Ensure there are no console.error messages
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Add item interactions and S1_ItemAdded state', () => {
    test('adding a valid item updates queue display and clears inputs (transition S0 -> S1 then S1 -> S0)', async ({ page }) => {
      // This test validates:
      // - AddToQueue event triggers enqueue and updateQueueDisplay (S1_ItemAdded entry action)
      // - Inputs are cleared after add (evidence of S1 -> S0 transition)
      const pqPage = new PriorityQueuePage(page);

      // Prepare dialog capture (should not be triggered for valid add)
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });

      // Fill inputs and click Add
      await pqPage.fillInputs('TaskA', 3);
      await pqPage.clickAdd();

      // No alert should have been shown for valid add
      expect(dialogs.length).toBe(0);

      // Queue should have one entry and display correct text
      const itemsAfter = await pqPage.getQueueItemsText();
      expect(itemsAfter.length).toBe(1);
      expect(itemsAfter[0]).toBe('TaskA (Priority: 3)');

      // Inputs should be cleared after add (evidence: itemInput.value = '', priorityInput.value = '')
      const itemVal = await pqPage.getItemInputValue();
      const priorityVal = await pqPage.getPriorityInputValue();
      expect(itemVal).toBe('');
      expect(priorityVal).toBe('');

      // No runtime errors expected
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('adding multiple items respects priority order (lower priority number = higher priority)', async ({ page }) => {
      // This test validates queue ordering behavior after multiple adds (S1_ItemAdded evidence: priorityQueue.enqueue)
      const pqPage = new PriorityQueuePage(page);

      // Add TaskLowPriority (priority 5), TaskHighPriority (priority 1), TaskMid (priority 3)
      await pqPage.fillInputs('TaskLow', 5);
      await pqPage.clickAdd();

      await pqPage.fillInputs('TaskHigh', 1);
      await pqPage.clickAdd();

      await pqPage.fillInputs('TaskMid', 3);
      await pqPage.clickAdd();

      // Verify order: TaskHigh (1), TaskMid (3), TaskLow (5)
      const items = await pqPage.getQueueItemsText();
      expect(items.length).toBe(3);
      expect(items[0]).toBe('TaskHigh (Priority: 1)');
      expect(items[1]).toBe('TaskMid (Priority: 3)');
      expect(items[2]).toBe('TaskLow (Priority: 5)');

      // Confirm no page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('adding with missing fields shows alert and does not modify queue (edge case)', async ({ page }) => {
      // This test validates the error path: alert('Both fields must be filled out.') (S1_ItemAdded evidence)
      const pqPage = new PriorityQueuePage(page);

      // Ensure queue empty at start of this test
      // Clear any existing entries by reloading to isolate state
      await page.reload();
      await pqPage.goto();

      // Capture dialogs
      const dialogMessages = [];
      page.on('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      // Case 1: missing both fields
      await pqPage.clickAdd();
      expect(dialogMessages.pop()).toBe('Both fields must be filled out.');

      // Case 2: missing priority only
      await pqPage.fillInputs('OnlyItem', '');
      await pqPage.clickAdd();
      expect(dialogMessages.pop()).toBe('Both fields must be filled out.');

      // Case 3: missing item only
      await pqPage.fillInputs('', 2);
      await pqPage.clickAdd();
      expect(dialogMessages.pop()).toBe('Both fields must be filled out.');

      // Ensure queue remains empty
      const items = await pqPage.getQueueItemsText();
      expect(items.length).toBe(0);

      // Ensure no unexpected runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Remove item interactions and S2_ItemRemoved / S3_QueueEmpty states', () => {
    test('removing when queue has items removes highest priority and shows alert (transition S0 -> S2 -> S0)', async ({ page }) => {
      // Validates: removeFromQueue() -> dequeues highest priority, alert shows removed item, updateQueueDisplay called
      const pqPage = new PriorityQueuePage(page);

      // Ensure isolated state
      await page.reload();
      await pqPage.goto();

      // Add a few items
      await pqPage.fillInputs('A', 4);
      await pqPage.clickAdd();

      await pqPage.fillInputs('B', 2);
      await pqPage.clickAdd();

      await pqPage.fillInputs('C', 5);
      await pqPage.clickAdd();

      // Confirm order: B (2), A (4), C (5)
      let items = await pqPage.getQueueItemsText();
      expect(items[0]).toBe('B (Priority: 2)');
      expect(items.length).toBe(3);

      // Capture dialog for removal
      const dialogMessages = [];
      page.on('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      // Click remove - should remove B (priority 2)
      await pqPage.clickRemove();

      // Expect alert content to match removed item
      expect(dialogMessages.length).toBeGreaterThan(0);
      const lastDialog = dialogMessages.pop();
      expect(lastDialog).toBe('Removed: B (Priority: 2)');

      // Queue should be updated: A (4), C (5)
      items = await pqPage.getQueueItemsText();
      expect(items.length).toBe(2);
      expect(items[0]).toBe('A (Priority: 4)');
      expect(items[1]).toBe('C (Priority: 5)');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('removing when queue is empty shows "The queue is empty!" alert (S3_QueueEmpty)', async ({ page }) => {
      // This validates the empty-queue path and S3 evidence: alert('The queue is empty!')
      const pqPage = new PriorityQueuePage(page);

      // Ensure isolated empty queue
      await page.reload();
      await pqPage.goto();

      // Ensure queue is empty
      let items = await pqPage.getQueueItemsText();
      expect(items.length).toBe(0);

      // Capture dialog
      let dialogMessage = null;
      page.on('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click remove when empty
      await pqPage.clickRemove();

      // Expect the specific alert for empty queue
      expect(dialogMessage).toBe('The queue is empty!');

      // Queue remains empty
      items = await pqPage.getQueueItemsText();
      expect(items.length).toBe(0);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Robustness: console and runtime error observation', () => {
    test('no unexpected console.error or page exceptions during typical usage', async ({ page }) => {
      // This test exercises several interactions while capturing console and page errors,
      // then asserts that no unexpected errors occurred.
      const pqPage = new PriorityQueuePage(page);

      // Reset page state
      await page.reload();
      await pqPage.goto();

      // Collect console and page errors arrays already set up in beforeEach
      // Perform a sequence of valid and invalid interactions
      // 1. Invalid add (should produce alert but not console error)
      const dialogCapture = [];
      page.on('dialog', async dialog => {
        dialogCapture.push(dialog.message());
        await dialog.accept();
      });

      await pqPage.clickAdd(); // invalid
      await pqPage.fillInputs('X', 2);
      await pqPage.clickAdd(); // valid
      await pqPage.fillInputs('Y', 1);
      await pqPage.clickAdd(); // valid

      // Remove twice
      await pqPage.clickRemove();
      await pqPage.clickRemove();

      // Now remove from empty triggering empty alert
      await pqPage.clickRemove();

      // Allow a tiny delay for any async page errors to surface
      await page.waitForTimeout(100);

      // There should be no uncaught page errors (ReferenceError, TypeError, etc.)
      expect(pageErrors.length).toBe(0);

      // There should be no console.error messages
      expect(consoleErrors.length).toBe(0);

      // Confirm expected dialog messages were observed in the sequence
      // We expect at least three dialogs: first invalid add alert, and final empty alert.
      // The removal of two items also produced alerts for removed items (2), so total >= 4.
      expect(dialogCapture.length).toBeGreaterThanOrEqual(4);

      // Verify one of the dialog messages is the empty-queue one
      expect(dialogCapture).toContain('The queue is empty!');
      // Verify one of the dialog messages is the missing-fields one
      expect(dialogCapture).toContain('Both fields must be filled out.');
    });
  });
});