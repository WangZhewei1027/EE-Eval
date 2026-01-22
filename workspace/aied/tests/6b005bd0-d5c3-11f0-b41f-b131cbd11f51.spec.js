import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b005bd0-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Priority Queue page
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      itemValue: '#itemValue',
      itemPriority: '#itemPriority',
      enqueueBtn: 'button[onclick="enqueue()"]',
      dequeueBtn: 'button[onclick="dequeue()"]',
      peekBtn: 'button[onclick="peek()"]',
      clearBtn: 'button[onclick="clearQueue()"]',
      queueDisplay: '#queueDisplay',
      itemElements: '#queueDisplay .item',
      peekItem: '#queueDisplay .item.peek-item',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setValue(value) {
    await this.page.fill(this.selectors.itemValue, value);
  }

  async setPriority(priority) {
    // Use fill to set even number inputs
    await this.page.fill(this.selectors.itemPriority, String(priority));
  }

  async clickEnqueue() {
    return this.page.click(this.selectors.enqueueBtn);
  }

  async clickDequeue() {
    return this.page.click(this.selectors.dequeueBtn);
  }

  async clickPeek() {
    return this.page.click(this.selectors.peekBtn);
  }

  async clickClear() {
    return this.page.click(this.selectors.clearBtn);
  }

  async getDisplayHTML() {
    return this.page.$eval(this.selectors.queueDisplay, el => el.innerHTML);
  }

  async getDisplayText() {
    return this.page.$eval(this.selectors.queueDisplay, el => el.innerText);
  }

  async getItemCount() {
    return this.page.$$eval(this.selectors.itemElements, els => els.length);
  }

  async getItemsTextArray() {
    return this.page.$$eval(this.selectors.itemElements, els =>
      els.map(e => e.innerText.trim())
    );
  }

  async firstItemIsPeek() {
    const el = await this.page.$(this.selectors.peekItem);
    return !!el;
  }
}

test.describe('Priority Queue Implementation - FSM and UI tests', () => {
  // Collect console messages and page errors for each test to assert later
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture runtime page errors (ReferenceError, TypeError, SyntaxError will show here)
    page.on('pageerror', error => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    });
  });

  test.afterEach(async () => {
    // After each test we will assert there were no fatal JS errors (ReferenceError, SyntaxError, TypeError).
    // The application should run without these errors; if there are, they will be visible in pageErrors.
    const fatalErrors = pageErrors.filter(e =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
    );

    // Assert that no fatal JS errors occurred during the test interactions.
    expect(fatalErrors, `No ReferenceError/TypeError/SyntaxError expected. Found: ${JSON.stringify(fatalErrors)}`).toEqual([]);
  });

  test.describe('Initial state (S0_Empty) validations', () => {
    test('Initial UI shows empty queue message and updateDisplay was applied', async ({ page }) => {
      // Validate initial state: "Queue is empty..." message is shown.
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Check display text contains expected empty message.
      const displayText = await pq.getDisplayText();
      expect(displayText).toContain('Queue is empty. Add some items to get started!');

      // There should be no items rendered
      const count = await pq.getItemCount();
      expect(count).toBe(0);

      // Ensure there are no runtime errors logged during initial load (additional safety)
      // pageErrors will be asserted in afterEach hook.
    });
  });

  test.describe('Enqueue (Transition S0->S1 and S1->S1)', () => {
    test('Enqueue a single item transitions to NonEmpty and displays it with priority and peek style', async ({ page }) => {
      // This test validates enqueue operation moves from empty to non-empty, updateDisplay invoked,
      // item shown with correct priority and first item marked as peek-item.
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      await pq.setValue('Task A');
      await pq.setPriority(7);

      // Click and wait for UI update
      await pq.clickEnqueue();

      // After enqueue, header should be present
      const displayHTML = await pq.getDisplayHTML();
      expect(displayHTML).toContain('Queue Items (Highest Priority First):');

      // Item should be present with value and priority
      const items = await pq.getItemsTextArray();
      expect(items.length).toBe(1);
      expect(items[0]).toContain('Task A');
      expect(items[0]).toContain('Priority: 7');

      // First item should have peek-item class
      const isPeek = await pq.firstItemIsPeek();
      expect(isPeek).toBe(true);
    });

    test('Multiple enqueues maintain correct descending priority order', async ({ page }) => {
      // Enqueue items with different priorities and validate order (highest priority first)
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Add lower priority first
      await pq.setValue('Low');
      await pq.setPriority(2);
      await pq.clickEnqueue();

      // Add higher priority next
      await pq.setValue('High');
      await pq.setPriority(9);
      await pq.clickEnqueue();

      // Add middle priority
      await pq.setValue('Med');
      await pq.setPriority(5);
      await pq.clickEnqueue();

      const texts = await pq.getItemsTextArray();
      // Expected order: High (9), Med (5), Low (2)
      expect(texts[0]).toContain('High');
      expect(texts[0]).toContain('Priority: 9');

      expect(texts[1]).toContain('Med');
      expect(texts[1]).toContain('Priority: 5');

      expect(texts[2]).toContain('Low');
      expect(texts[2]).toContain('Priority: 2');
    });

    test('Enqueue with out-of-range priority shows validation alert and does not add item', async ({ page }) => {
      // Edge case: priority outside 1-10 should trigger alert and not change the queue
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Ensure queue is empty initially
      let count = await pq.getItemCount();
      expect(count).toBe(0);

      // Set invalid priority and expect an alert dialog
      await pq.setValue('BadPriority');
      await pq.setPriority(20);

      const dialogPromise = page.waitForEvent('dialog');
      await pq.clickEnqueue();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Please enter a priority between 1 and 10');
      await dialog.accept();

      // Queue remains empty
      count = await pq.getItemCount();
      expect(count).toBe(0);
    });

    test('Enqueue uses default fallbacks if inputs are empty', async ({ page }) => {
      // If inputs are empty, enqueue() uses default value 'Item' and priority fallback 1
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      await pq.setValue(''); // blank
      await pq.setPriority(''); // blank

      await pq.clickEnqueue();

      const items = await pq.getItemsTextArray();
      expect(items.length).toBe(1);
      // Default value "Item" and default priority "1"
      expect(items[0]).toContain('Item');
      expect(items[0]).toContain('Priority: 1');
    });
  });

  test.describe('Dequeue (Transition S1->S1 and edge when empty)', () => {
    test('Dequeue removes highest priority item and shows alert with dequeued item', async ({ page }) => {
      // Validate dequeue removes top-priority item and updateDisplay is called
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Setup: enqueue two items
      await pq.setValue('First');
      await pq.setPriority(3);
      await pq.clickEnqueue();

      await pq.setValue('Top');
      await pq.setPriority(8);
      await pq.clickEnqueue();

      // Confirm order Top (8) then First (3)
      let items = await pq.getItemsTextArray();
      expect(items[0]).toContain('Top');
      expect(items[0]).toContain('Priority: 8');

      // Click Dequeue and capture dialog
      const dialogPromise = page.waitForEvent('dialog');
      await pq.clickDequeue();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Dequeued: Top (Priority: 8)');
      await dialog.accept();

      // Now only 'First' should remain
      items = await pq.getItemsTextArray();
      expect(items.length).toBe(1);
      expect(items[0]).toContain('First');
      expect(items[0]).toContain('Priority: 3');
    });

    test('Dequeue on empty queue shows appropriate alert and does not throw', async ({ page }) => {
      // Edge case: when queue empty, calling dequeue should alert 'Queue is empty!'
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Ensure empty
      let count = await pq.getItemCount();
      expect(count).toBe(0);

      const dialogPromise = page.waitForEvent('dialog');
      await pq.clickDequeue();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Queue is empty!');
      await dialog.accept();

      // No items - still zero
      count = await pq.getItemCount();
      expect(count).toBe(0);
    });
  });

  test.describe('Peek (S1_NonEmpty behavior)', () => {
    test('Peek shows next item in alert and does not remove it', async ({ page }) => {
      // Peek should show the highest priority item without removing it
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Enqueue two items
      await pq.setValue('Alpha');
      await pq.setPriority(4);
      await pq.clickEnqueue();

      await pq.setValue('Beta');
      await pq.setPriority(6);
      await pq.clickEnqueue();

      // Before peek: two items
      let countBefore = await pq.getItemCount();
      expect(countBefore).toBe(2);

      // Peek and capture dialog
      const dialogPromise = page.waitForEvent('dialog');
      await pq.clickPeek();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Next item: Beta (Priority: 6)');
      await dialog.accept();

      // After peek: still two items (no removal)
      let countAfter = await pq.getItemCount();
      expect(countAfter).toBe(2);

      // Ensure first item still Beta
      const items = await pq.getItemsTextArray();
      expect(items[0]).toContain('Beta');
      expect(items[0]).toContain('Priority: 6');
    });

    test('Peek on empty queue shows appropriate alert', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Ensure empty
      let count = await pq.getItemCount();
      expect(count).toBe(0);

      const dialogPromise = page.waitForEvent('dialog');
      await pq.clickPeek();
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Queue is empty!');
      await dialog.accept();
    });
  });

  test.describe('ClearQueue (S1_NonEmpty -> S0_Empty)', () => {
    test('ClearQueue empties the queue and shows the empty message', async ({ page }) => {
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Setup items
      await pq.setValue('One');
      await pq.setPriority(2);
      await pq.clickEnqueue();

      await pq.setValue('Two');
      await pq.setPriority(3);
      await pq.clickEnqueue();

      // Ensure items present
      const countBefore = await pq.getItemCount();
      expect(countBefore).toBeGreaterThanOrEqual(1);

      // Click Clear Queue
      await pq.clickClear();

      // After clearing, empty message should be shown
      const displayText = await pq.getDisplayText();
      expect(displayText).toContain('Queue is empty. Add some items to get started!');

      // No items present
      const countAfter = await pq.getItemCount();
      expect(countAfter).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No ReferenceError, TypeError, or SyntaxError occurs during typical interactions', async ({ page }) => {
      // This test performs a set of typical interactions and asserts the runtime had no fatal errors.
      const pq = new PriorityQueuePage(page);
      await pq.goto();

      // Perform interactions: enqueue, peek, dequeue, clear
      await pq.setValue('X');
      await pq.setPriority(5);
      await pq.clickEnqueue();

      let dialog = await page.waitForEvent('dialog');
      // There should be no dialog for a normal enqueue; the app doesn't show alert on successful enqueue.
      // However in case the page triggers a dialog unexpectedly, consume it.
      await dialog.accept().catch(() => { /* ignore */ });

      // Peek
      const peekPromise = page.waitForEvent('dialog');
      await pq.clickPeek();
      const peekDialog = await peekPromise;
      // Peek should show Next item
      expect(peekDialog.message()).toMatch(/Next item: X \(Priority: 5\)/);
      await peekDialog.accept();

      // Dequeue
      const dequeuePromise = page.waitForEvent('dialog');
      await pq.clickDequeue();
      const dqDialog = await dequeuePromise;
      expect(dqDialog.message()).toMatch(/Dequeued: X \(Priority: 5\)/);
      await dqDialog.accept();

      // Clear (idempotent)
      await pq.clickClear();

      // After interactions, confirm there are no ReferenceError/TypeError/SyntaxError in pageErrors
      // The afterEach hook will assert that; here we also check console messages for mentions of those names.
      const errorLikeConsole = consoleMessages.filter(c =>
        /ReferenceError|TypeError|SyntaxError/i.test(c.text)
      );

      expect(errorLikeConsole.length).toBe(0);
    });
  });
});