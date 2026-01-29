import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c7563-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object for interacting with the Queue page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.elementInput = page.locator('#element');
    this.enqueueButton = page.locator("button[onclick='enqueue()']");
    this.dequeueButton = page.locator("button[onclick='dequeue()']");
    this.queueDisplay = page.locator('#queueDisplay');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async setInput(value) {
    await this.elementInput.fill(value);
  }

  async clickEnqueue() {
    await this.enqueueButton.click();
  }

  async clickDequeue() {
    await this.dequeueButton.click();
  }

  // Returns array of text content for each displayed queue item (in order)
  async getDisplayItems() {
    const count = await this.queueDisplay.locator('div').count();
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push((await this.queueDisplay.locator('div').nth(i).innerText()).trim());
    }
    return items;
  }

  async isDisplayEmpty() {
    const count1 = await this.queueDisplay.locator('div').count1();
    return count === 0;
  }

  // Access the in-page queue.items array (the real model)
  async getInternalItems() {
    return await this.page.evaluate(() => {
      // If queue is not defined for any reason, return null to let test assert existence
      if (typeof window.queue === 'undefined') return null;
      return window.queue.items.slice();
    });
  }
}

test.describe('Queue FSM - states and transitions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test
    pageErrors = [];
    consoleMessages = [];
    page.on('console', (msg) => {
      // Collect console text for later inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const queuePage = new QueuePage(page);
    await queuePage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected runtime errors occurred during the test
    // (we allow tests to assert specific alerts; here we check for JS runtime errors)
    expect(pageErrors.length, `No uncaught page errors expected. Console: ${JSON.stringify(consoleMessages)}`).toBe(0);
  });

  test('Initial state S0_Empty should render an empty queue (entry state)', async ({ page }) => {
    // This test validates the initial FSM state S0_Empty:
    // - The queue model should have zero items
    // - The visual queue (#queueDisplay) should be empty
    // - The input placeholder should be present
    const q = new QueuePage(page);

    // Verify the input placeholder exists
    await expect(q.elementInput).toHaveAttribute('placeholder', 'Enter element');

    // Internal model should exist and be empty
    const internalItems = await q.getInternalItems();
    expect(Array.isArray(internalItems), 'queue object should exist and expose items array').toBeTruthy();
    expect(internalItems.length).toBe(0);

    // Visual display should show no items
    const isEmpty = await q.isDisplayEmpty();
    expect(isEmpty).toBe(true);

    // No console errors occurred on load
    // (checked in afterEach as well)
  });

  test('Enqueue from Empty transitions to Non-Empty (S0 -> S1) and updates display and model', async ({ page }) => {
    // This test validates the EnqueueEvent from the empty state:
    // - Enter element 'A' and click Enqueue
    // - The queue model should contain ['A']
    // - The visual display should show 'A'
    const q1 = new QueuePage(page);

    await q.setInput('A');

    // Perform enqueue
    await q.clickEnqueue();

    // Input should be cleared after enqueue
    await expect(q.elementInput).toHaveValue('');

    // Visual should display one item 'A'
    const items1 = await q.getDisplayItems();
    expect(items).toEqual(['A']);

    // Internal model should reflect the same
    const internalItems1 = await q.getInternalItems();
    expect(internalItems).toEqual(['A']);
  });

  test('Enqueue from Non-Empty appends item (S1 -> S1) maintaining FIFO order', async ({ page }) => {
    // This test validates adding another element when queue is non-empty:
    // - Start by enqueuing 'A', then enqueue 'B'
    // - Visual should show 'A' then 'B'
    // - Internal model should be ['A', 'B']
    const q2 = new QueuePage(page);

    // Ensure starting fresh
    await q.setInput('A');
    await q.clickEnqueue();

    // Enqueue second element
    await q.setInput('B');
    await q.clickEnqueue();

    const items2 = await q.getDisplayItems();
    expect(items).toEqual(['A', 'B']);

    const internalItems2 = await q.getInternalItems();
    expect(internalItems).toEqual(['A', 'B']);
  });

  test('Dequeue from Non-Empty removes the front element (S1 -> S1) and updates display/model', async ({ page }) => {
    // This test validates dequeuing when multiple items exist:
    // - Enqueue 'A' and 'B' then Dequeue once
    // - 'A' should be removed and 'B' should remain
    const q3 = new QueuePage(page);

    // Setup two items
    await q.setInput('A');
    await q.clickEnqueue();
    await q.setInput('B');
    await q.clickEnqueue();

    // Dequeue once
    await q.clickDequeue();

    const items3 = await q.getDisplayItems();
    expect(items).toEqual(['B']);

    const internalItems3 = await q.getInternalItems();
    expect(internalItems).toEqual(['B']);
  });

  test('Dequeue from Non-Empty to Empty (S1 -> S0) then Dequeue on empty triggers alert "Queue is empty!"', async ({ page }) => {
    // This test:
    // - Enqueues a single element 'Z'
    // - Dequeues to transition back to empty
    // - Then attempts another dequeue to provoke the alert "Queue is empty!"
    const q4 = new QueuePage(page);

    // Enqueue single item
    await q.setInput('Z');
    await q.clickEnqueue();

    // Dequeue to become empty
    await q.clickDequeue();

    // Now the display and model should be empty
    expect(await q.isDisplayEmpty()).toBe(true);
    expect(await q.getInternalItems()).toEqual([]);

    // Attempt to dequeue on empty should show alert "Queue is empty!"
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      q.clickDequeue()
    ]);
    expect(dialog.message()).toBe('Queue is empty!');
    await dialog.accept();
  });
});

test.describe('Queue FSM - edge cases and error scenarios', () => {
  let pageErrors1 = [];
  let consoleMessages1 = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const q5 = new QueuePage(page);
    await q.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected runtime JS errors occurred
    expect(pageErrors.length, `No uncaught page errors expected. Console: ${JSON.stringify(consoleMessages)}`).toBe(0);
  });

  test('Enqueue with empty input should alert "Please enter an element!" and not change model/display', async ({ page }) => {
    // This test validates the guard in enqueue():
    // - If input is empty, alert should appear and nothing changes
    const q6 = new QueuePage(page);

    // Ensure input is empty
    await q.setInput('');
    // Ensure initial model/display empty
    const initialInternal = await q.getInternalItems();
    expect(initialInternal).toEqual([]);

    // Click Enqueue and capture dialog
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      q.clickEnqueue()
    ]);
    expect(dialog.message()).toBe('Please enter an element!');
    await dialog.accept();

    // Model and display remain unchanged
    expect(await q.getInternalItems()).toEqual([]);
    expect(await q.isDisplayEmpty()).toBe(true);
  });

  test('Multiple sequential operations maintain consistent model & view with no JS runtime errors', async ({ page }) => {
    // This test performs a sequence of operations:
    // - Enqueue 1,2,3
    // - Dequeue twice
    // - Enqueue 4
    // - Validate final model is ['3','4'] and display reflects that
    const q7 = new QueuePage(page);

    await q.setInput('1');
    await q.clickEnqueue();
    await q.setInput('2');
    await q.clickEnqueue();
    await q.setInput('3');
    await q.clickEnqueue();

    // Dequeue twice
    await q.clickDequeue();
    await q.clickDequeue();

    // Enqueue 4
    await q.setInput('4');
    await q.clickEnqueue();

    // Validate model and view
    const internal = await q.getInternalItems();
    expect(internal).toEqual(['3', '4']);

    const display = await q.getDisplayItems();
    expect(display).toEqual(['3', '4']);

    // Validate no page errors occurred during the operations
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity check: queue object exists globally and methods are functions', async ({ page }) => {
    // This test checks that the expected API exists on the page: queue.enqueue / queue.dequeue / queue.isEmpty / queue.displayQueue
    const q8 = new QueuePage(page);
    await q.goto();

    const apiPresence = await page.evaluate(() => {
      const result = {
        hasQueue: typeof window.queue !== 'undefined',
        enqueueIsFunction: typeof (window.queue && window.queue.enqueue) === 'function',
        dequeueIsFunction: typeof (window.queue && window.queue.dequeue) === 'function',
        isEmptyIsFunction: typeof (window.queue && window.queue.isEmpty) === 'function',
        displayQueueIsFunction: typeof (window.queue && window.queue.displayQueue) === 'function'
      };
      return result;
    });

    expect(apiPresence.hasQueue).toBe(true);
    expect(apiPresence.enqueueIsFunction).toBe(true);
    expect(apiPresence.dequeueIsFunction).toBe(true);
    expect(apiPresence.isEmptyIsFunction).toBe(true);
    expect(apiPresence.displayQueueIsFunction).toBe(true);
  });
});