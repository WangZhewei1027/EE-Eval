import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce0d10-fa79-11f0-8075-e54a10595dde.html';

// Page Object for interacting with the Queue demonstration UI
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      itemInput: '#itemInput',
      capacityInput: '#capacityInput',
      enqueueBtn: "button[onclick='enqueue()']",
      dequeueBtn: "button[onclick='dequeue()']",
      peekBtn: "button[onclick='peek()']",
      clearBtn: "button[onclick='clearQueue()']",
      printBtn: "button[onclick='printQueue()']",
      queueContainer: '#queueContainer',
      queueItems: '#queueContainer .item'
    };
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setItemInput(value) {
    await this.page.fill(this.selectors.itemInput, value);
  }

  async getItemInputValue() {
    return this.page.$eval(this.selectors.itemInput, el => el.value);
  }

  async setCapacityInput(value) {
    // setting the input value and dispatching a change by focusing/blurring
    await this.page.fill(this.selectors.capacityInput, String(value));
    // The page's input has onchange="setCapacity()", but Playwright fill may not trigger 'change' event automatically
    // So explicitly blur to trigger change or dispatch change via evaluate.
    await this.page.$eval(this.selectors.capacityInput, el => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async clickEnqueue() {
    await this.page.click(this.selectors.enqueueBtn);
  }

  async clickDequeue() {
    await this.page.click(this.selectors.dequeueBtn);
  }

  async clickPeek() {
    await this.page.click(this.selectors.peekBtn);
  }

  async clickClear() {
    await this.page.click(this.selectors.clearBtn);
  }

  async clickPrint() {
    await this.page.click(this.selectors.printBtn);
  }

  async getRenderedItems() {
    return this.page.$$eval(this.selectors.queueItems, nodes => nodes.map(n => n.textContent));
  }

  async getQueueLengthFromWindow() {
    return this.page.evaluate(() => window.queue ? window.queue.length : null);
  }

  async getMaxCapacityFromWindow() {
    return this.page.evaluate(() => typeof window.maxCapacity !== 'undefined' ? window.maxCapacity : null);
  }
}

test.describe('Queue Demonstration - FSM Validation (Application ID: 99ce0d10-fa79-11f0-8075-e54a10595dde)', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;
  let dialogMessages;
  let queuePage;

  test.beforeEach(async ({ page }) => {
    // Initialize capture arrays for each test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console messages and errors
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Capture dialogs (alerts used heavily in the app)
    page.on('dialog', async dialog => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      // Dismiss or accept to allow continued automation
      // The app uses alerts, so we just accept them
      await dialog.accept();
    });

    queuePage = new QueuePage(page);
    await queuePage.navigate();
  });

  test.afterEach(async () => {
    // Ensure collected arrays are not inadvertently reused between tests
  });

  test('Initial state S0_Empty: queue should render empty on load', async ({ page }) => {
    // Validate initial FSM Idle state: queue length === 0 and renderQueue() must have run
    const rendered = await queuePage.getRenderedItems();
    expect(rendered).toEqual([]); // No DOM items rendered

    const windowQueueLength = await queuePage.getQueueLengthFromWindow();
    expect(windowQueueLength).toBe(0);

    // No alerts/dialogs should have appeared on initial load
    expect(dialogMessages).toEqual([]);

    // No console errors or uncaught page errors should have happened during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('EnqueueEvent: from empty (S0_Empty) to non-empty (S1_NonEmpty)', async ({ page }) => {
    // Enqueue a single item and validate DOM and window state transitions
    await queuePage.setItemInput('Item1');
    await queuePage.clickEnqueue();

    const items = await queuePage.getRenderedItems();
    expect(items).toEqual(['Item1']); // renderQueue should show the new item

    const queueLen = await queuePage.getQueueLengthFromWindow();
    expect(queueLen).toBe(1);

    // The input should be cleared after enqueue
    const inputVal = await queuePage.getItemInputValue();
    expect(inputVal).toBe('');

    // No alert should have been triggered for successful enqueue
    expect(dialogMessages).toEqual([]);

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('EnqueueEvent: enqueuing empty string should not modify the queue', async () => {
    // Start empty, try to enqueue empty string; the queue must remain empty
    await queuePage.setItemInput('');
    await queuePage.clickEnqueue();

    const items = await queuePage.getRenderedItems();
    expect(items).toEqual([]);

    const queueLen = await queuePage.getQueueLengthFromWindow();
    expect(queueLen).toBe(0);

    // No alert expected and no errors
    expect(dialogMessages).toEqual([]);
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('EnqueueEvent: filling to capacity and attempting an extra enqueue triggers "Queue is full" alert', async ({ page }) => {
    // Default capacity is 5. Enqueue up to capacity.
    for (let i = 1; i <= 5; i++) {
      await queuePage.setItemInput(`X${i}`);
      await queuePage.clickEnqueue();
    }

    let items = await queuePage.getRenderedItems();
    expect(items.length).toBe(5);

    // Now attempt one more enqueue; expect an alert 'Queue is full! Cannot enqueue.'
    await queuePage.setItemInput('Overflow');
    await queuePage.clickEnqueue();

    // Dialog should have captured the full queue alert
    const lastDialog = dialogMessages[dialogMessages.length - 1];
    expect(lastDialog).toBeDefined();
    expect(lastDialog.message).toContain('Queue is full! Cannot enqueue.');

    // Queue should remain at capacity
    const queueLen = await queuePage.getQueueLengthFromWindow();
    expect(queueLen).toBe(5);

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('DequeueEvent: from non-empty to fewer items and to empty, and error when dequeueing empty', async ({ page }) => {
    // Enqueue two items
    await queuePage.setItemInput('A');
    await queuePage.clickEnqueue();
    await queuePage.setItemInput('B');
    await queuePage.clickEnqueue();

    // Dequeue once -> still non-empty
    await queuePage.clickDequeue();
    let itemsAfterOneDeq = await queuePage.getRenderedItems();
    expect(itemsAfterOneDeq).toEqual(['B']);

    let queueLen = await queuePage.getQueueLengthFromWindow();
    expect(queueLen).toBe(1);

    // Dequeue again -> becomes empty
    await queuePage.clickDequeue();
    let itemsAfterTwoDeq = await queuePage.getRenderedItems();
    expect(itemsAfterTwoDeq).toEqual([]);
    queueLen = await queuePage.getQueueLengthFromWindow();
    expect(queueLen).toBe(0);

    // Dequeue on empty -> should trigger alert 'Queue is empty! Cannot dequeue.'
    await queuePage.clickDequeue();
    const lastDialog = dialogMessages[dialogMessages.length - 1];
    expect(lastDialog).toBeDefined();
    expect(lastDialog.message).toContain('Queue is empty! Cannot dequeue.');

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('PeekEvent: should alert front item when non-empty and "Queue is empty!" when empty', async () => {
    // Ensure empty peek shows 'Queue is empty!'
    await queuePage.clickPeek();
    let lastDialog = dialogMessages[dialogMessages.length - 1];
    expect(lastDialog).toBeDefined();
    expect(lastDialog.message).toContain('Queue is empty!');

    // Enqueue some items and peek
    await queuePage.setItemInput('FrontItem');
    await queuePage.clickEnqueue();
    await queuePage.setItemInput('Second');
    await queuePage.clickEnqueue();

    // Now peek; should show front item 'FrontItem'
    await queuePage.clickPeek();
    lastDialog = dialogMessages[dialogMessages.length - 1];
    expect(lastDialog).toBeDefined();
    expect(lastDialog.message).toContain('Front item: FrontItem');

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('ClearQueueEvent: clearing should empty the queue and re-render', async () => {
    // Enqueue a few items
    await queuePage.setItemInput('C1');
    await queuePage.clickEnqueue();
    await queuePage.setItemInput('C2');
    await queuePage.clickEnqueue();

    let items = await queuePage.getRenderedItems();
    expect(items.length).toBe(2);

    // Clear
    await queuePage.clickClear();

    // After clearing, no items should be rendered and window.queue length should be 0
    let itemsAfterClear = await queuePage.getRenderedItems();
    expect(itemsAfterClear).toEqual([]);
    const queueLen = await queuePage.getQueueLengthFromWindow();
    expect(queueLen).toBe(0);

    // No dialog should be produced for clear
    // (dialogMessages may contain earlier messages but the last one should not be from clear)
    // Confirm last dialog message is not 'Current queue exceeds...' or similar triggered by clear
    // Just ensure no additional alert was created by clear alone
    // (We cannot assert none ever occurred because earlier tests/regimen might have added; but in per-test environment we started fresh.)
    expect(dialogMessages).toEqual([]);

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('SetCapacityEvent: reducing capacity below current queue length triggers warning alert', async () => {
    // Enqueue 3 items
    await queuePage.setItemInput('P1');
    await queuePage.clickEnqueue();
    await queuePage.setItemInput('P2');
    await queuePage.clickEnqueue();
    await queuePage.setItemInput('P3');
    await queuePage.clickEnqueue();

    const lenBefore = await queuePage.getQueueLengthFromWindow();
    expect(lenBefore).toBe(3);

    // Set capacity to 2 (less than current queue length) and trigger onchange
    await queuePage.setCapacityInput(2);

    // Expect an alert that current queue exceeds new capacity
    const lastDialog = dialogMessages[dialogMessages.length - 1];
    expect(lastDialog).toBeDefined();
    expect(lastDialog.message).toContain('Current queue exceeds new capacity! Please dequeue items.');

    // Also ensure maxCapacity (window.maxCapacity) updated to 2
    const maxCap = await queuePage.getMaxCapacityFromWindow();
    expect(maxCap).toBe(2);

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('PrintQueueEvent: prints queue to console and shows alert to check console', async ({ page }) => {
    // Enqueue two items
    await queuePage.setItemInput('L1');
    await queuePage.clickEnqueue();
    await queuePage.setItemInput('L2');
    await queuePage.clickEnqueue();

    // Clear any previous console messages we captured in this test
    // (consoleMessages is per-test; already empty at start of beforeEach)
    // Click printQueue -> should console.log the queue (an array) and alert to check the console
    await queuePage.clickPrint();

    // Check that an alert was shown indicating to check console
    const lastDialog = dialogMessages[dialogMessages.length - 1];
    expect(lastDialog).toBeDefined();
    expect(lastDialog.message).toContain('Check the console for the current queue.');

    // The console should have recorded a message with the queue contents. Look for a log type with text including one of our items.
    const logEntries = consoleMessages.filter(m => m.type === 'log' || m.type === 'info');
    // At least one log entry should contain one of our items. The log may show an array like ["L1","L2"] or similar.
    const found = logEntries.some(e => e.text.includes('L1') || e.text.includes('L2') || e.text.includes('L1,L2'));
    expect(found).toBeTruthy();

    // No console errors or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: set capacity to a non-numeric value, and verify behavior (robustness check)', async () => {
    // Attempt to set capacity to a non-numeric string; the page's setCapacity uses parseInt, which will produce NaN.
    // We expect maxCapacity to become NaN in that case; no exceptions should be thrown (no pageerror).
    await queuePage.setCapacityInput('abc');

    const maxCap = await queuePage.getMaxCapacityFromWindow();
    // parseInt('abc') -> NaN, so either maxCapacity is NaN or some fallback exists. We assert it becomes NaN.
    // Use isNaN check via evaluate to avoid direct JS NaN comparison oddities
    const isNaNFlag = await queuePage.page.evaluate(() => isNaN(window.maxCapacity));
    expect(isNaNFlag).toBe(true);

    // Since the app does not explicitly alert for this, ensure no dialogs were produced for this action.
    expect(dialogMessages.length).toBe(0);

    // Ensure no uncaught runtime errors occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});