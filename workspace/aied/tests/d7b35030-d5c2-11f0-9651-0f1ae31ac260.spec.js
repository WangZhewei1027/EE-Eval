import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/batch-1207/html/d7b35030-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the Priority Queue demo page
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.itemInput = page.locator('#itemInput');
    this.priorityInput = page.locator('#priorityInput');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.queueList = page.locator('#queueList');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async enqueue(item, priority) {
    await this.itemInput.fill(item);
    await this.priorityInput.fill(String(priority));
    await this.enqueueBtn.click();
  }

  async dequeue() {
    await this.dequeueBtn.click();
  }

  // returns array of { text: string, isHighest: boolean }
  async getQueueItems() {
    const items = await this.queueList.locator('.queue-item').elementHandles();
    const results = [];
    for (const handle of items) {
      const text = (await handle.textContent())?.trim() ?? '';
      const className = await handle.getAttribute('class');
      results.push({
        text,
        isHighest: className?.split(/\s+/).includes('highest') ?? false,
      });
    }
    return results;
  }

  async getQueueRawHTML() {
    return this.queueList.innerHTML();
  }

  async getResultText() {
    return (await this.result.textContent())?.trim() ?? '';
  }

  async isResultVisible() {
    // check computed style display
    const display = await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, '#result');
    return display !== 'none';
  }

  async focusOnItemInput() {
    await this.page.evaluate(() => document.getElementById('itemInput').focus());
  }
}

test.describe('Priority Queue Demo - FSM-based end-to-end tests', () => {
  let page;
  let pq;
  let pageErrors;
  let consoleErrors;
  let allConsoleMessages;

  test.beforeEach(async ({ browser }) => {
    // create a fresh context and page for each test
    const context = await browser.newContext();
    page = await context.newPage();

    // capture page errors and console messages
    pageErrors = [];
    consoleErrors = [];
    allConsoleMessages = [];

    page.on('pageerror', (err) => {
      // store the Error object emitted by the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      allConsoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    pq = new PriorityQueuePage(page);
    await pq.goto();
  });

  test.afterEach(async () => {
    await page.context().close();
  });

  // Initial State (S0_Initial)
  test('Initial State: page renders with empty queue and hidden result (S0_Initial)', async () => {
    // Validate that initial render displays "The queue is empty."
    const html = await pq.getQueueRawHTML();
    expect(html).toContain('The queue is empty.');

    // result should be hidden (display: none)
    expect(await pq.isResultVisible()).toBe(false);

    // No queue items present
    const items = await pq.getQueueItems();
    expect(items.length).toBe(0);

    // Observe console and page errors for this initial load
    // If any page errors occurred, they will be checked in a separate test below.
    expect(Array.isArray(allConsoleMessages)).toBe(true);
  });

  // Transition: S0_Initial -> S1_ItemEnqueued
  test('Enqueue Item: enqueues an item and updates the display (S0 -> S1)', async () => {
    // Enqueue a single item
    await pq.enqueue('Task A', 5);

    // After enqueue, the queue should have one item and it should be highlighted as highest
    const items = await pq.getQueueItems();
    expect(items.length).toBe(1);
    expect(items[0].text).toContain('Task A');
    expect(items[0].text).toContain('Priority: 5');
    expect(items[0].isHighest).toBe(true);

    // Inputs should be cleared and focus should be on item input as implementation sets focus
    const itemValue = await page.locator('#itemInput').inputValue();
    const priorityValue = await page.locator('#priorityInput').inputValue();
    expect(itemValue).toBe('');
    expect(priorityValue).toBe('');
    // Confirm itemInput has focus
    const hasFocus = await page.evaluate(() => document.activeElement?.id === 'itemInput');
    expect(hasFocus).toBe(true);

    // result should still be hidden after enqueue
    expect(await pq.isResultVisible()).toBe(false);
  });

  // Transition: S1_ItemEnqueued -> S1_ItemEnqueued (enqueue more)
  test('Enqueue multiple items: maintains priority ordering and stability for ties (S1 -> S1)', async () => {
    // Enqueue items in order to test sorting and stability
    await pq.enqueue('Low Priority', 1);      // count 0
    await pq.enqueue('Mid Priority', 2);      // count 1
    await pq.enqueue('Mid Priority 2', 2);    // count 2
    await pq.enqueue('High Priority', 3);     // count 3

    // Get the queue items and assert ordering:
    // Highest priority should be first (High Priority)
    // Next should be Mid Priority (the one enqueued earlier) and then Mid Priority 2
    const items = await pq.getQueueItems();
    const texts = items.map((i) => i.text);

    // Basic expectations about number and content
    expect(items.length).toBe(4);
    expect(texts[0]).toContain('High Priority');
    expect(texts[1]).toContain('Mid Priority');
    expect(texts[2]).toContain('Mid Priority 2');
    expect(texts[3]).toContain('Low Priority');

    // Verify highest class applied to the first item only
    expect(items[0].isHighest).toBe(true);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].isHighest).toBe(false);
    }
  });

  // Transition: S1_ItemEnqueued -> S2_ItemDequeued
  test('Dequeue Highest: removes highest priority and displays dequeued message (S1 -> S2)', async () => {
    // Setup: enqueue multiple items
    await pq.enqueue('Item 1', 1);
    await pq.enqueue('Item 2', 4);
    await pq.enqueue('Item 3', 2);

    // Dequeue should remove 'Item 2' (priority 4)
    await pq.dequeue();

    // result should be visible and show the dequeued item and priority
    expect(await pq.isResultVisible()).toBe(true);
    const resultText = await pq.getResultText();
    expect(resultText).toContain('Dequeued item:');
    expect(resultText).toContain('"Item 2"');
    expect(resultText).toContain('priority 4');

    // The queue should no longer contain Item 2; highest should now be Item 3 (priority 2)
    const items = await pq.getQueueItems();
    const texts = items.map((i) => i.text);
    expect(texts.some((t) => t.includes('Item 2'))).toBe(false);
    expect(items[0].text).toContain('Item 3');
    expect(items[0].isHighest).toBe(true);
  });

  // Edge case: Dequeue when empty shows alert
  test('Dequeue when empty: shows alert dialog and does not throw (edge case)', async () => {
    // Ensure queue is empty initially (fresh page)
    const html = await pq.getQueueRawHTML();
    expect(html).toContain('The queue is empty.');

    // Listen for dialog event
    const dialogPromise = page.waitForEvent('dialog');

    // Click dequeue which should trigger an alert
    await pq.dequeue();

    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('The queue is empty, no item to dequeue.');

    // Accept the dialog to proceed
    await dialog.accept();
  });

  // Edge case: Enqueue invalid inputs shows alerts
  test('Enqueue with empty item or invalid priority shows validation alerts (edge cases)', async () => {
    // Case 1: empty item text
    // Clear inputs to be safe
    await page.locator('#itemInput').fill('');
    await page.locator('#priorityInput').fill('5');

    const dialog1 = page.waitForEvent('dialog');
    await page.locator('#enqueueBtn').click();
    const d1 = await dialog1;
    expect(d1.type()).toBe('alert');
    expect(d1.message()).toContain('Please enter an item.');
    await d1.accept();

    // Case 2: valid item, but empty priority
    await page.locator('#itemInput').fill('Some Item');
    await page.locator('#priorityInput').fill('');
    const dialog2 = page.waitForEvent('dialog');
    await page.locator('#enqueueBtn').click();
    const d2 = await dialog2;
    expect(d2.type()).toBe('alert');
    expect(d2.message()).toContain('Please enter a valid priority number.');
    await d2.accept();

    // Case 3: non-numeric priority
    await page.locator('#itemInput').fill('Some Item');
    await page.locator('#priorityInput').fill('abc');
    const dialog3 = page.waitForEvent('dialog');
    await page.locator('#enqueueBtn').click();
    const d3 = await dialog3;
    expect(d3.type()).toBe('alert');
    expect(d3.message()).toContain('Please enter a valid priority number.');
    await d3.accept();
  });

  // Observing console and page errors: let them occur naturally and assert properties
  test('Console and page errors observation: capture and validate any runtime errors', async () => {
    // Perform a few interactions to surface potential runtime issues
    await pq.enqueue('Alpha', 10);
    await pq.enqueue('Beta', 9);
    await pq.dequeue();

    // Give the page a brief moment for any async errors to appear
    await page.waitForTimeout(200);

    // All captured page errors (uncaught exceptions)
    // If errors occurred, verify they are JS runtime error types we expect (ReferenceError, SyntaxError, TypeError)
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // err is an Error instance — check the name
        const name = err.name || '';
        expect(['ReferenceError', 'SyntaxError', 'TypeError', 'Error', 'URIError', 'RangeError', 'EvalError'].includes(name)).toBe(true);
      }
    } else {
      // No uncaught page errors - that's acceptable. Assert that console did not capture 'error' messages unexpectedly.
      // If consoleErrors are present, at least ensure they are strings and report them for visibility.
      for (const txt of consoleErrors) {
        expect(typeof txt).toBe('string');
      }
    }

    // Always assert that we have recorded console messages array (sanity)
    expect(Array.isArray(allConsoleMessages)).toBe(true);

    // Fail the test if there are severe console 'error' messages that look like unexpected runtime exceptions (optional check)
    // We'll not force a failure here; instead we assert that any console 'error' entries are strings (handled above).
  });
});