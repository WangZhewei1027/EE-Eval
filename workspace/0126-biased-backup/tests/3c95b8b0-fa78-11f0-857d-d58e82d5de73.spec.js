import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c95b8b0-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Queue Visualization — FSM State & Transition Tests (3c95b8b0-fa78-11f0-857d-d58e82d5de73)', () => {
  // Capture console error-level messages and page errors for each test run
  let consoleErrors;
  let pageErrors;

  // Page Object for the queue UI
  class QueuePage {
    /**
     * @param {import('@playwright/test').Page} page
     */
    constructor(page) {
      this.page = page;
      this.enqueueBtn = page.locator('#enqueueBtn');
      this.dequeueBtn = page.locator('#dequeueBtn');
      this.queueItems = page.locator('#queue .queue-item');
      this.queueContainer = page.locator('#queue');
    }

    async goto() {
      await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    }

    async getCount() {
      return await this.queueItems.count();
    }

    async isEnqueueDisabled() {
      return await this.enqueueBtn.evaluate((el) => el.disabled);
    }

    async isDequeueDisabled() {
      return await this.dequeueBtn.evaluate((el) => el.disabled);
    }

    // Click enqueue and wait until an increase in queue item count is observed
    async clickEnqueueAndWaitForIncrease(previousCount, timeout = 2000) {
      await this.enqueueBtn.click();
      // Wait for count to be greater than previousCount
      await this.page.waitForFunction(
        ({ selector, prev }) => document.querySelectorAll(selector).length > prev,
        { timeout },
        { selector: '#queue .queue-item', prev: previousCount }
      );
      return await this.getCount();
    }

    // Click dequeue and wait until a decrease in queue item count is observed
    async clickDequeueAndWaitForDecrease(previousCount, timeout = 2000) {
      await this.dequeueBtn.click();
      // Wait for count to be less than previousCount (or zero)
      await this.page.waitForFunction(
        ({ selector, prev }) => document.querySelectorAll(selector).length < prev,
        { timeout },
        { selector: '#queue .queue-item', prev: previousCount }
      );
      return await this.getCount();
    }

    // Wait until enqueue button is enabled
    async waitForEnqueueEnabled(timeout = 2000) {
      await this.page.waitForFunction(
        (sel) => !document.querySelector(sel).disabled,
        { timeout },
        '#enqueueBtn'
      );
    }

    // Wait until dequeue button is enabled
    async waitForDequeueEnabled(timeout = 2000) {
      await this.page.waitForFunction(
        (sel) => !document.querySelector(sel).disabled,
        { timeout },
        '#dequeueBtn'
      );
    }

    // Wait until dequeue button is disabled
    async waitForDequeueDisabled(timeout = 2000) {
      await this.page.waitForFunction(
        (sel) => document.querySelector(sel).disabled,
        { timeout },
        '#dequeueBtn'
      );
    }

    // Read the textual content inside the queue container (useful for "Queue is empty" message)
    async queueInnerText() {
      return await this.queueContainer.innerText();
    }
  }

  // Setup capturing of console errors and page errors before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Test initial conditions and Non-Empty state
  test('Initial render should show Non-Empty Queue (S1_NonEmpty) and UI elements', async ({ page }) => {
    // This test validates the initial FSM state and onEnter actions (renderQueue)
    const q = new QueuePage(page);
    await q.goto();

    // The implementation initializes queue with 5 items; FSM expected Non-Empty state
    const initialCount = await q.getCount();
    // Assert initial count is greater than 0 (Non-Empty state)
    expect(initialCount).toBeGreaterThan(0);

    // Dequeue should be enabled when there are items
    expect(await q.isDequeueDisabled()).toBe(false);

    // There should be no "Queue is empty" message present in the initial render
    const inner = await q.queueInnerText();
    expect(inner).not.toContain('Queue is empty');

    // Ensure enqueue button exists and is interactive (may be enabled depending on size)
    const enqueueDisabled = await q.isEnqueueDisabled();
    expect(typeof enqueueDisabled).toBe('boolean');

    // Assert no JS runtime errors were recorded during initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Dequeue transitions: S1_NonEmpty -> S1_NonEmpty (decreasing) and eventually S0_Empty', async ({ page }) => {
    // This test will dequeue items until the queue becomes empty and validate transitions & DOM changes.
    const q = new QueuePage(page);
    await q.goto();

    // Start with the currently rendered count
    let count = await q.getCount();
    expect(count).toBeGreaterThan(0);

    // Repeatedly dequeue until count is 0
    while (count > 0) {
      // Ensure dequeue button is enabled before attempting to click
      await q.waitForDequeueEnabled();

      const prev = count;
      // Click dequeue and wait for the count to decrease
      count = await q.clickDequeueAndWaitForDecrease(prev);

      // After each successful dequeue (unless it was the last), dequeue button should remain enabled or be re-enabled
      if (count > 0) {
        // Still non-empty
        expect(count).toBeLessThan(prev);
        // Dequeue button should be enabled for further operations (may have a short debounce)
        await q.waitForDequeueEnabled();
        expect(await q.isDequeueDisabled()).toBe(false);
      } else {
        // Reached empty state; validate S0_Empty expectations
        // The container should display 'Queue is empty' message
        const txt = await q.queueInnerText();
        expect(txt).toContain('Queue is empty');

        // Dequeue button should become disabled when empty
        // The implementation sets this with renderQueue and also uses a timeout; wait briefly
        await q.waitForDequeueDisabled();
        expect(await q.isDequeueDisabled()).toBe(true);
      }
    }

    // No page errors or console errors should have occurred during the sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Enqueue transitions: S0_Empty -> S1_NonEmpty and S1_NonEmpty -> S1_NonEmpty (increasing length)', async ({ page }) => {
    // This test validates enqueuing from empty to non-empty and additional enqueues increasing length.
    const q = new QueuePage(page);
    await q.goto();

    // First, ensure we are in empty state by dequeueing everything (robust: reuse logic)
    let count = await q.getCount();
    if (count > 0) {
      while (count > 0) {
        await q.waitForDequeueEnabled();
        count = await q.clickDequeueAndWaitForDecrease(count);
      }
    }

    // Confirm empty state
    const emptyTxt = await q.queueInnerText();
    expect(emptyTxt).toContain('Queue is empty');
    expect(await q.isDequeueDisabled()).toBe(true);

    // Enqueue once: should transition Empty -> NonEmpty (S0 -> S1)
    // Enqueue button should be enabled in empty state
    expect(await q.isEnqueueDisabled()).toBe(false);
    const prevCount = await q.getCount(); // should be 0
    const newCount = await q.clickEnqueueAndWaitForIncrease(prevCount);
    expect(newCount).toBeGreaterThan(prevCount);
    // After enqueue, dequeue should be enabled
    await q.waitForDequeueEnabled();
    expect(await q.isDequeueDisabled()).toBe(false);

    // Now test multiple enqueues up to MAX_SIZE (10) to validate NonEmpty -> NonEmpty transitions and enqueueBtn disabling
    // Read current count and keep enqueuing until enqueueBtn gets disabled or we reach MAX_SIZE
    let current = newCount;
    const MAX_SIZE = 10;
    while (current < MAX_SIZE) {
      // Ensure enqueue is enabled before clicking
      await q.waitForEnqueueEnabled();
      const prev = current;
      current = await q.clickEnqueueAndWaitForIncrease(prev);
      // After each enqueue (not yet at capacity), queue increases by 1
      expect(current).toBe(prev + 1);
    }

    // At or above MAX_SIZE, enqueueBtn should be disabled
    // The implementation disables enqueueBtn when queue.length >= MAX_SIZE
    // Wait briefly for any debounce to settle
    await q.page.waitForTimeout(250);
    const enqueueDisabled = await q.isEnqueueDisabled();
    expect(enqueueDisabled).toBe(true);

    // Final sanity: dequeue still enabled when non-empty
    expect(await q.isDequeueDisabled()).toBe(false);

    // Ensure no page errors or console errors throughout enqueues
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: clicking Dequeue when disabled (empty) should not throw errors or mutate state', async ({ page }) => {
    // This test intentionally tries to operate on disabled controls to ensure safety and no runtime errors.
    const q = new QueuePage(page);
    await q.goto();

    // Ensure we are empty by dequeuing everything
    let count = await q.getCount();
    if (count > 0) {
      while (count > 0) {
        await q.waitForDequeueEnabled();
        count = await q.clickDequeueAndWaitForDecrease(count);
      }
    }

    // Confirm empty
    expect(await q.getCount()).toBe(0);
    expect(await q.isDequeueDisabled()).toBe(true);

    // Attempt to click the disabled Dequeue button.
    // Playwright still performs a click on the element; the application should handle disabled state gracefully.
    // We wrap in try/catch to assert no page errors are thrown beyond Playwright's action.
    try {
      // Use the element handle to perform click (if the element is disabled, browser will allow the click event, but script logic should return early)
      await q.dequeueBtn.click({ timeout: 500 }).catch(() => {}); // ignore Playwright click exceptions if any
    } catch (e) {
      // The test should not crash; record but allow test to continue - final assertions check for runtime errors
    }

    // State should remain empty
    expect(await q.getCount()).toBe(0);
    const txt = await q.queueInnerText();
    expect(txt).toContain('Queue is empty');

    // There should be no uncaught page errors or console errors due to clicking a disabled control
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Smoke: validate visual labels for Front and Rear appear correctly after enqueues/dequeues', async ({ page }) => {
    // This test checks that the visual "Front" and "Rear" labels are applied as class names on queue items,
    // indicating renderQueue() entry action produced expected DOM structure.
    const q = new QueuePage(page);
    await q.goto();

    // Ensure at least two items exist by enqueuing or preserving current items
    let count = await q.getCount();
    if (count < 2) {
      // If needed, enqueue until there are at least 2 items
      while (count < 2) {
        await q.waitForEnqueueEnabled();
        count = await q.clickEnqueueAndWaitForIncrease(count);
      }
    }

    // Now inspect DOM for first and last items having .front and .rear classes
    // Evaluate in page context to avoid stale locators
    const classes = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#queue .queue-item')).map((el) => el.className);
      return items;
    });

    expect(classes.length).toBeGreaterThanOrEqual(2);
    // First item should have 'front' in its class list
    expect(classes[0].split(' ').includes('front')).toBe(true);
    // Last item should have 'rear' in its class list
    expect(classes[classes.length - 1].split(' ').includes('rear')).toBe(true);

    // Ensure no runtime errors were logged
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Final catch-all test to ensure no unexpected runtime exceptions occurred during load and interactions
  test('No uncaught console errors or page errors were emitted during the test run', async ({ page }) => {
    const q = new QueuePage(page);
    await q.goto();

    // Perform a typical sequence: enqueue then dequeue to exercise handlers
    const startCount = await q.getCount();

    if (!(await q.isEnqueueDisabled())) {
      const afterEnqueue = await q.clickEnqueueAndWaitForIncrease(startCount);
      // after this, attempt to dequeue to return to previous count (if possible)
      if (!(await q.isDequeueDisabled())) {
        await q.clickDequeueAndWaitForDecrease(afterEnqueue);
      }
    }

    // Assert no page errors or console errors were recorded
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});