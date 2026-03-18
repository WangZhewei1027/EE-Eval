import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a324711-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object Model for the Queue page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.peekBtn = page.locator('#peekBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.info = page.locator('#info');
    this.queueContainer = page.locator('#queueContainer');
    this.queueItems = page.locator('#queueContainer .queue-item');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  // Enter value into input (does not press Enter)
  async enterValue(value) {
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

  async pressEnterInInput() {
    await this.input.press('Enter');
  }

  async getInfoText() {
    return (await this.info.textContent())?.trim() ?? '';
  }

  async getInfoColor() {
    // returns computed color string like 'rgb(40, 167, 69)'
    return await this.info.evaluate((el) => getComputedStyle(el).color);
  }

  async getQueueContainerText() {
    return (await this.queueContainer.textContent())?.trim() ?? '';
  }

  async getQueueItemsTexts() {
    const count = await this.queueItems.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.queueItems.nth(i).innerText()).trim());
    }
    return texts;
  }

  async getQueueItemsCount() {
    return await this.queueItems.count();
  }

  async getFirstItemAriaLabel() {
    return await this.queueItems.first().getAttribute('aria-label');
  }

  async isFirstItemFrontClass() {
    return await this.queueItems.first().evaluate((el) => el.classList.contains('front'));
  }
}

test.describe('Queue Demonstration (FSM Validation) - Application ID 5a324711-ffc5-11f0-8b43-1ffa87931c43', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages (console.error)
    page.on('console', (msg) => {
      // Playwright's ConsoleMessage.type() returns 'error' for console.error
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    // Basic sanity: there should be no unexpected runtime exceptions or console errors
    // Tests below will also assert specific expectations; here we assert global absence
    expect(pageErrors.length, 'No uncaught page errors are expected').toBe(0);
    expect(consoleErrors.length, 'No console.error messages are expected').toBe(0);
  });

  test('Initial state S0_Empty: renders empty queue and required components exist', async ({ page }) => {
    // Validate initial state S0_Empty: renderQueue() should have set "Queue is empty."
    const q = new QueuePage(page);

    // Queue container shows empty message
    await expect(q.queueContainer).toHaveText('Queue is empty.');

    // Info region should be empty initially
    await expect(q.info).toHaveText('');

    // Buttons and input should be visible and enabled
    await expect(q.input).toBeVisible();
    await expect(q.enqueueBtn).toBeVisible();
    await expect(q.dequeueBtn).toBeVisible();
    await expect(q.peekBtn).toBeVisible();
    await expect(q.clearBtn).toBeVisible();

    // No queue items present
    const count = await q.getQueueItemsCount();
    expect(count).toBe(0);
  });

  test('Transition S0_Empty -> S1_NonEmpty: Enqueue single item via Enqueue button', async ({ page }) => {
    // Validate enqueue action moves from empty to non-empty and triggers UI updates
    const q = new QueuePage(page);

    // Enter a value and click Enqueue
    await q.enterValue('A');
    await q.clickEnqueue();

    // After enqueue, input should be cleared and focused
    await expect(q.input).toHaveValue('');
    // Queue should now contain one item 'A'
    await expect(q.queueItems).toHaveCount(1);
    const texts = await q.getQueueItemsTexts();
    expect(texts[0]).toBe('A');

    // First item should have 'front' class and aria-label indicating front
    const hasFrontClass = await q.isFirstItemFrontClass();
    expect(hasFrontClass).toBe(true);
    const aria = await q.getFirstItemAriaLabel();
    expect(aria).toContain('Front of the queue');

    // Info should display enqueued message (green)
    await expect(q.info).toHaveText('Enqueued "A".');
    const infoColor = await q.getInfoColor();
    // computed color will be rgb(...) corresponding to #28a745
    expect(infoColor).toMatch(/rgb\(\s*40,\s*167,\s*69\)/);
  });

  test('Multiple enqueues and peek: S1_NonEmpty -> S1_NonEmpty (enqueue, peek)', async ({ page }) => {
    // Enqueue multiple values and then peek to verify front item is shown
    const q = new QueuePage(page);

    // Enqueue values A, B, C
    await q.enterValue('A');
    await q.clickEnqueue();
    await q.enterValue('B');
    await q.clickEnqueue();
    await q.enterValue('C');
    await q.clickEnqueue();

    // Verify three items in the queue in order
    await expect(q.queueItems).toHaveCount(3);
    const texts = await q.getQueueItemsTexts();
    expect(texts).toEqual(['A', 'B', 'C']);

    // Click Peek Front and verify info shows front element
    await q.clickPeek();
    await expect(q.info).toHaveText('Front of the queue: "A".');
    const infoColor = await q.getInfoColor();
    expect(infoColor).toMatch(/rgb\(\s*40,\s*167,\s*69\)/);
  });

  test('Dequeue transitions: removing items and edge-case dequeue on empty queue', async ({ page }) => {
    // Test repeated dequeues, final empty state, and error when dequeuing empty queue from S0_Empty
    const q = new QueuePage(page);

    // Prepare queue: enqueue two items X and Y
    await q.enterValue('X');
    await q.clickEnqueue();
    await q.enterValue('Y');
    await q.clickEnqueue();

    // Dequeue once: removes X
    await q.clickDequeue();
    await expect(q.info).toHaveText('Dequeued "X".');
    await expect(q.queueItems).toHaveCount(1);
    let texts = await q.getQueueItemsTexts();
    expect(texts).toEqual(['Y']);

    // Dequeue second time: removes Y, queue becomes empty
    await q.clickDequeue();
    await expect(q.info).toHaveText('Dequeued "Y".');
    await expect(q.queueContainer).toHaveText('Queue is empty.');
    const countAfter = await q.getQueueItemsCount();
    expect(countAfter).toBe(0);

    // Attempt to dequeue when queue empty -> should show error message
    await q.clickDequeue();
    await expect(q.info).toHaveText('Queue is empty, cannot dequeue.');
    const infoColor = await q.getInfoColor();
    // Error color corresponds to #d9534f
    expect(infoColor).toMatch(/rgb\(\s*217,\s*83,\s*79\)/);
  });

  test('Clear transition: S1_NonEmpty -> S0_Empty and Clear on already empty', async ({ page }) => {
    // Test clearing a non-empty queue and clearing when already empty
    const q = new QueuePage(page);

    // Enqueue an item D
    await q.enterValue('D');
    await q.clickEnqueue();
    await expect(q.queueItems).toHaveCount(1);

    // Click Clear: should clear queue and show 'Queue cleared.'
    await q.clickClear();
    await expect(q.queueContainer).toHaveText('Queue is empty.');
    await expect(q.info).toHaveText('Queue cleared.');
    let infoColor = await q.getInfoColor();
    expect(infoColor).toMatch(/rgb\(\s*40,\s*167,\s*69\)/);

    // Click Clear again on empty queue: should show error 'Queue already empty.'
    await q.clickClear();
    await expect(q.info).toHaveText('Queue already empty.');
    infoColor = await q.getInfoColor();
    expect(infoColor).toMatch(/rgb\(\s*217,\s*83,\s*79\)/);
  });

  test('EnterKey event: pressing Enter enqueues the item (S1_NonEmpty behavior)', async ({ page }) => {
    // Validate that pressing Enter in input triggers enqueueBtn.click()
    const q = new QueuePage(page);

    // Ensure starting empty
    await expect(q.queueContainer).toHaveText('Queue is empty.');

    // Type and press Enter
    await q.enterValue('EnterItem');
    await q.pressEnterInInput();

    // Confirm item enqueued
    await expect(q.queueItems).toHaveCount(1);
    const texts = await q.getQueueItemsTexts();
    expect(texts[0]).toBe('EnterItem');

    // Info shows enqueued message
    await expect(q.info).toHaveText('Enqueued "EnterItem".');
  });

  test('Edge case: enqueue empty input shows validation error', async ({ page }) => {
    // Clicking Enqueue with an empty input should show an error message
    const q = new QueuePage(page);

    // Ensure input is empty
    await q.enterValue('');
    await q.clickEnqueue();

    // Error message expected
    await expect(q.info).toHaveText('Please enter a value to enqueue.');
    const infoColor = await q.getInfoColor();
    expect(infoColor).toMatch(/rgb\(\s*217,\s*83,\s*79\)/);

    // Queue should remain empty
    await expect(q.queueContainer).toHaveText('Queue is empty.');
    const count = await q.getQueueItemsCount();
    expect(count).toBe(0);
  });

  test('Visual and accessibility checks: aria-labels and front indicator are correct', async ({ page }) => {
    // Verify that the front item has appropriate aria-label and the last item does not have 'Front' pseudo-content
    const q = new QueuePage(page);

    // Enqueue items 1 and 2
    await q.enterValue('1');
    await q.clickEnqueue();
    await q.enterValue('2');
    await q.clickEnqueue();

    // First item's aria-label should include 'Front of the queue'
    const firstAria = await q.getFirstItemAriaLabel();
    expect(firstAria).toContain('Front of the queue');

    // The second item should have aria-label 'Queue element: 2'
    const secondAria = await q.queueItems.nth(1).getAttribute('aria-label');
    expect(secondAria).toContain('Queue element');
    expect(secondAria).toContain('2');

    // Ensure front class present only on first item
    const firstHasFront = await q.queueItems.first().evaluate((el) => el.classList.contains('front'));
    const secondHasFront = await q.queueItems.nth(1).evaluate((el) => el.classList.contains('front'));
    expect(firstHasFront).toBe(true);
    expect(secondHasFront).toBe(false);
  });

  test('Observability: monitor console and page errors while performing operations', async ({ page }) => {
    // This test performs operations while ensuring no ReferenceError, SyntaxError, TypeError or console.error occurs.
    // We explicitly exercise many interactions to surface runtime issues if present.

    const q = new QueuePage(page);

    // Perform a sequence of operations
    await q.enterValue('Alpha');
    await q.clickEnqueue();

    await q.enterValue('Beta');
    await q.pressEnterInInput();

    await q.clickPeek();

    await q.clickDequeue();
    await q.clickDequeue();

    // At this point queue is empty; attempt invalid ops to see error handling
    await q.clickDequeue(); // should produce a user-visible message, not a runtime error
    await q.clickClear(); // should produce "Queue already empty." message, not runtime error

    // Wait briefly to allow any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Assert no uncaught exceptions were emitted
    // (Note: global afterEach will also assert this, but we include it here explicitly)
    expect(pageErrors.length, 'No uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.) should have occurred during operations').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should have been logged during operations').toBe(0);

    // Also assert that the final info message is the expected error about already empty or dequeue
    const finalInfo = await q.getInfoText();
    // Accept either of the known final messages depending on order: 'Queue is empty, cannot dequeue.' or 'Queue already empty.'
    expect(['Queue is empty, cannot dequeue.', 'Queue already empty.']).toContain(finalInfo);
  });
});