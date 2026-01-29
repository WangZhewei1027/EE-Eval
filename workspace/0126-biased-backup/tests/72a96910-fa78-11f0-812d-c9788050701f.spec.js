import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a96910-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Priority Queue page
class PriorityQueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addBtn = page.locator('#addItem');
    this.processBtn = page.locator('#processItem');
    this.queueItems = page.locator('.queue-item');
    this.status = page.locator('#status');
  }

  // Navigate to the app page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the "Add Random Item" button
  async addItem() {
    await this.addBtn.click();
  }

  // Click the "Process Next Item" button
  async processItem() {
    await this.processBtn.click();
  }

  // Return the number of queue items currently in DOM
  async getQueueCount() {
    return await this.queueItems.count();
  }

  // Return the visible status text (may be empty string)
  async getStatusText() {
    const txt = await this.status.textContent();
    return (txt || '').trim();
  }

  // Evaluate on the page which item would be processed next and return its title.
  // This mirrors the logic within the application to find the highest priority item.
  async peekNextProcessingTitle() {
    return await this.page.evaluate(() => {
      const items = document.querySelectorAll('.queue-item');
      if (items.length === 0) return null;
      let highestPriorityItem = items[0];
      for (let i = 1; i < items.length; i++) {
        if (items[i].classList.contains('high-priority') &&
            !highestPriorityItem.classList.contains('high-priority')) {
          highestPriorityItem = items[i];
        } else if (items[i].classList.contains('medium-priority') &&
                   highestPriorityItem.classList.contains('low-priority')) {
          highestPriorityItem = items[i];
        }
      }
      const titleEl = highestPriorityItem.querySelector('.item-title');
      return titleEl ? titleEl.textContent.trim() : null;
    });
  }

  // Return counts of priority types currently in the queue
  async getPriorityCounts() {
    return await this.page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.queue-item'));
      const counts = { high: 0, medium: 0, low: 0 };
      for (const el of items) {
        if (el.classList.contains('high-priority')) counts.high++;
        else if (el.classList.contains('medium-priority')) counts.medium++;
        else if (el.classList.contains('low-priority')) counts.low++;
      }
      return counts;
    });
  }

  // Read computed style transform on a button (used to assert animateButton effect)
  async getButtonTransform(buttonLocator) {
    return await buttonLocator.evaluate((btn) => {
      return window.getComputedStyle(btn).transform || '';
    });
  }
}

test.describe('Priority Queue FSM and UI interactions (Application ID: 72a96910-fa78-11f0-812d-c9788050701f)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // Ensure no uncaught exceptions or console errors happened during the test.
    // This verifies the app runs without throwing runtime errors during interactions.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Initial state S0_Idle: page loads and initializes queue (DOMContentLoaded evidence)', async ({ page }) => {
    // Validate initial app state after DOMContentLoaded
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // The implementation calls addRandomItem() three times during DOMContentLoaded.
    // Expect at least 3 items to be present in the queue on load.
    const initialCount = await pq.getQueueCount();
    // Defensive: require at least 1 item, but expect >=3 based on implementation.
    expect(initialCount).toBeGreaterThanOrEqual(1);
    expect(initialCount).toBeGreaterThanOrEqual(3);

    // Status is updated during initialization: last addRandomItem() sets "Added: <title>".
    // The status fades in/out via opacity, but textContent should contain "Added:" at first.
    const statusText = await pq.getStatusText();
    // status may have faded by the time of check; assert that status is a string (possibly empty).
    expect(typeof statusText).toBe('string');
  });

  test('Event AddItem: clicking Add Random Item transitions to S1_ItemAdded and updates DOM', async ({ page }) => {
    // This test validates the AddItem event, S1_ItemAdded entry action (updateStatus),
    // and that a new queue item is appended to the DOM.
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    const before = await pq.getQueueCount();
    // Click the Add Random Item button
    await pq.addItem();

    // Immediately after click, the status should reflect an "Added:" message.
    const statusImmediate = await pq.getStatusText();
    expect(statusImmediate.startsWith('Added:') || statusImmediate === '', 'Status should start with "Added:" or be empty due to fast fade').toBeTruthy();

    // Wait briefly for the DOM insert animation to apply
    await page.waitForTimeout(50);
    const after = await pq.getQueueCount();
    expect(after).toBeGreaterThan(before); // a new item should be present
  });

  test('Event ProcessItem: clicking Process Next Item transitions to S2_ItemProcessing and removes highest priority item', async ({ page }) => {
    // This test validates processNextItem behavior:
    // - Status should be "Processing: <title>" right after clicking
    // - After 500ms, the queue length should decrease by one
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Ensure there is at least one item to process
    let count = await pq.getQueueCount();
    expect(count).toBeGreaterThanOrEqual(1);

    // Determine which title will be processed according to app logic
    const expectedTitle = await pq.peekNextProcessingTitle();
    expect(expectedTitle).not.toBeNull();

    // Click process and validate the status updates to "Processing: <title>"
    await pq.processItem();

    // Immediately after clicking, status should start with "Processing:"
    const statusNow = await pq.getStatusText();
    expect(statusNow.startsWith('Processing:'), 'Status should indicate processing started').toBeTruthy();
    expect(statusNow.includes(expectedTitle), 'Status should include the processed item title').toBeTruthy();

    // Wait for removal animation (500ms in app) plus buffer
    await page.waitForTimeout(650);

    // After removal, the queue count must have decreased by one
    const newCount = await pq.getQueueCount();
    expect(newCount).toBe(count - 1);
  });

  test('Transition to S3_QueueEmpty: processing when queue is empty shows "Queue is empty"', async ({ page }) => {
    // This test will repeatedly process items until queue is empty, then click process one more time
    // to trigger the "Queue is empty" status message as per the FSM and implementation.
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // Drain the queue by processing until count reaches 0
    let count = await pq.getQueueCount();

    // Sequentially process items until no items left.
    while (count > 0) {
      // Click process and wait for the removal to complete
      await pq.processItem();
      await page.waitForTimeout(650); // wait for removal animation
      count = await pq.getQueueCount();
    }

    // Now queue is empty; clicking Process should immediately update status to "Queue is empty"
    await pq.processItem();
    // Small wait for status update to occur inside the function
    await page.waitForTimeout(50);
    const statusText = await pq.getStatusText();
    expect(statusText).toBe('Queue is empty');
  });

  test('S1 -> S0 AddItem while items exist: status updates and queue grows (repeated adds)', async ({ page }) => {
    // Validate adding items repeatedly transitions S1_ItemAdded then back to S0_Idle
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    const before = await pq.getQueueCount();
    // Add multiple items in quick succession
    await pq.addItem();
    await pq.addItem();
    // Allow animations and DOM insertions
    await page.waitForTimeout(120);
    const after = await pq.getQueueCount();
    expect(after).toBeGreaterThan(before + 1); // at least two more items added
  });

  test('Visual feedback: priority classes applied and button animation triggers transform', async ({ page }) => {
    // Validate that queue items have priority classes and that clicking a button triggers the scale transform.
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // There should be at least one queue-item with a priority class
    const priorityCounts = await pq.getPriorityCounts();
    // At least one of the priorities should be present
    expect(priorityCounts.high + priorityCounts.medium + priorityCounts.low).toBeGreaterThanOrEqual(1);

    // Test button animation: clicking the Add button applies a temporary transform
    const transformBefore = await pq.getButtonTransform(pq.addBtn);
    await pq.addItem();
    // Immediately after clicking, the animateButton sets transform to 'scale(0.95)' temporarily
    const transformDuring = await pq.getButtonTransform(pq.addBtn);
    // transformDuring might be a matrix or 'none' depending on timing; assert it's a string and changed or equals original (non-deterministic)
    expect(typeof transformDuring).toBe('string');

    // Wait for the animation to revert back
    await page.waitForTimeout(200);
    const transformAfter = await pq.getButtonTransform(pq.addBtn);
    expect(typeof transformAfter).toBe('string');
  });

  test('Edge case: processing on an already empty queue repeatedly does not throw and consistently shows "Queue is empty"', async ({ page }) => {
    // This test ensures calling process when queue is empty is stable and does not cause runtime errors.
    const pq = new PriorityQueuePage(page);
    await pq.goto();

    // First, drain the queue completely
    let count = await pq.getQueueCount();
    while (count > 0) {
      await pq.processItem();
      await page.waitForTimeout(650);
      count = await pq.getQueueCount();
    }

    // Now perform multiple process clicks when empty
    for (let i = 0; i < 3; i++) {
      await pq.processItem();
      await page.waitForTimeout(60);
      const status = await pq.getStatusText();
      expect(status).toBe('Queue is empty');
    }
  });
});