import { test, expect } from '@playwright/test';

// Page Object for the Queue demo page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.queueVisual = page.locator('#queueVisual');
    this.queueItems = page.locator('#queueVisual .queue-item');
    this.demoStatus = page.locator('#demoStatus');
  }

  async goto(url) {
    await this.page.goto(url);
    // Wait for initial visualization update (script runs on load)
    await expect(this.queueVisual).toBeVisible();
  }

  async enqueue(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.enqueueBtn.click();
    }
  }

  async dequeue(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.dequeueBtn.click();
    }
  }

  async getQueueText() {
    return (await this.queueVisual.textContent())?.trim();
  }

  async getDemoStatusText() {
    return (await this.demoStatus.textContent())?.trim();
  }

  async getQueueItemsCount() {
    return await this.queueItems.count();
  }

  async getQueueItemsTexts() {
    const count = await this.getQueueItemsCount();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.queueItems.nth(i).textContent())?.trim());
    }
    return texts;
  }

  async getItemTitleAt(index) {
    return await this.queueItems.nth(index).getAttribute('title');
  }

  async getItemStyleAt(index) {
    return await this.queueItems.nth(index).getAttribute('style');
  }

  async isDequeueDisabled() {
    return await this.dequeueBtn.isDisabled();
  }
}

// Base URL for the tested HTML
const BASE_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3701571-ffc4-11f0-821c-7d25bc609266.html';

test.describe('Queue FSM and UI validations - a3701571-ffc4-11f0-821c-7d25bc609266', () => {
  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Nothing global here; each test sets up its own listeners to gather messages
  });

  // Test initial state S0_Empty: visual should show (empty) and Dequeue button disabled
  test('Initial state (S0_Empty) shows empty visualization and disabled Dequeue', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const q = new QueuePage(page);
    await q.goto(BASE_URL);

    // Validate queue visual shows "(empty)"
    await expect(q.queueVisual).toHaveText(/\(empty\)/);

    // Validate there are no .queue-item elements
    await expect(q.queueItems).toHaveCount(0);

    // Dequeue button must be disabled in S0_Empty
    expect(await q.isDequeueDisabled()).toBeTruthy();

    // demoStatus should be empty initially
    const status = await q.getDemoStatusText();
    expect(status === '' || status === null).toBeTruthy();

    // No JS console errors or page errors should have occurred during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test enqueue from empty transitions to non-empty (S0 -> S1)
  test('Enqueue from empty transitions to Non-Empty (S0_Empty -> S1_NonEmpty) and updates UI', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const q = new QueuePage(page);
    await q.goto(BASE_URL);

    // Click Enqueue once
    await q.enqueue(1);

    // After enqueue, queue should have one item with text "1"
    await expect(q.queueItems).toHaveCount(1);
    const texts = await q.getQueueItemsTexts();
    expect(texts).toEqual(['1']);

    // Dequeue button should now be enabled (S1_NonEmpty)
    expect(await q.isDequeueDisabled()).toBeFalsy();

    // Demo status should reflect the enqueued value
    await expect(q.demoStatus).toHaveText(/Enqueued element at rear:\s*1/);

    // The single item should have both front and rear titles set (code appends both)
    const title = await q.getItemTitleAt(0);
    expect(title).toContain('Front of queue');
    expect(title).toContain('Rear of queue');

    // The inline style should include the rear or front border color (both may be present)
    const style = await q.getItemStyleAt(0);
    expect(typeof style).toBe('string');
    expect(style.length).toBeGreaterThan(0);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test multiple enqueues in S1_NonEmpty (S1 -> S1 transitions)
  test('Multiple Enqueue operations (S1_NonEmpty -> S1_NonEmpty) preserve order and update visual', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const q = new QueuePage(page);
    await q.goto(BASE_URL);

    // Enqueue three times
    await q.enqueue(3);

    // Expect three items with texts "1", "2", "3"
    await expect(q.queueItems).toHaveCount(3);
    const texts = await q.getQueueItemsTexts();
    expect(texts).toEqual(['1', '2', '3']);

    // Validate front item (index 0) has the front border color in style
    const frontStyle = await q.getItemStyleAt(0);
    expect(frontStyle).toContain('#ffc107');

    // Validate rear item (last index) has the rear border color in style
    const lastIdx = (await q.getQueueItemsCount()) - 1;
    const rearStyle = await q.getItemStyleAt(lastIdx);
    expect(rearStyle).toContain('#28a745');

    // demoStatus should reflect last enqueued element
    await expect(q.demoStatus).toHaveText(/Enqueued element at rear:\s*3/);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test dequeue behavior: both S1 -> S1 (removing one but still non-empty) and S1 -> S0 (last removal)
  test('Dequeue operations remove front element and update UI; last dequeue returns to Empty state', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const q = new QueuePage(page);
    await q.goto(BASE_URL);

    // Create a queue with two items: 1 and 2
    await q.enqueue(2);
    await expect(q.queueItems).toHaveCount(2);
    let texts = await q.getQueueItemsTexts();
    expect(texts).toEqual(['1', '2']);

    // First dequeue: should remove '1' and leave '2' (S1 -> S1)
    await q.dequeue(1);
    await expect(q.queueItems).toHaveCount(1);
    texts = await q.getQueueItemsTexts();
    expect(texts).toEqual(['2']);
    await expect(q.demoStatus).toHaveText(/Dequeued element from front:\s*1/);

    // Dequeue again: should remove '2' and return to empty state (S1 -> S0)
    await q.dequeue(1);
    // When queue becomes empty, queueVisual textContent should be "(empty)"
    await expect(q.queueVisual).toHaveText(/\(empty\)/);
    await expect(q.queueItems).toHaveCount(0);

    // Dequeue button should now be disabled
    expect(await q.isDequeueDisabled()).toBeTruthy();

    // Demo status should reflect last dequeued value
    await expect(q.demoStatus).toHaveText(/Dequeued element from front:\s*2/);

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: Attempting to click the disabled Dequeue button should fail at the DOM level (Playwright throws)
  test('Clicking disabled Dequeue button when empty should be blocked and throw an error at click time', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const q = new QueuePage(page);
    await q.goto(BASE_URL);

    // Ensure dequeue is disabled
    await expect(q.dequeueBtn).toBeDisabled();

    // Attempting to click should be rejected by Playwright because element is disabled
    await expect(page.click('#dequeueBtn')).rejects.toThrow();

    // No console/page errors (the failed click is a test-level exception, not a runtime JS error in the page)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Accessibility and attributes checks for components described in the FSM
  test('UI components have expected roles and accessibility attributes', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    const q = new QueuePage(page);
    await q.goto(BASE_URL);

    // queueVisual element should have role="list" and aria-live attributes as specified
    const role = await page.locator('#queueVisual').getAttribute('role');
    expect(role).toBe('list');

    const ariaLive = await page.locator('#queueVisual').getAttribute('aria-live');
    expect(ariaLive).toBe('polite');

    const ariaRelevant = await page.locator('#queueVisual').getAttribute('aria-relevant');
    expect(ariaRelevant).toBe('additions removals');

    // demoStatus should have aria-live="assertive"
    const statusAria = await page.locator('#demoStatus').getAttribute('aria-live');
    expect(statusAria).toBe('assertive');

    // Buttons exist and Enqueue is enabled initially, Dequeue disabled initially
    await expect(page.locator('#enqueueBtn')).toBeEnabled();
    await expect(page.locator('#dequeueBtn')).toBeDisabled();

    // No console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});