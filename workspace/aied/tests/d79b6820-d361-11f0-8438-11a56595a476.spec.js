import { test, expect } from '@playwright/test';

// Test suite for Queue Demo application (Application ID: d79b6820-d361-11f0-8438-11a56595a476)
// The HTML is served at:
// http://127.0.0.1:5500/workspace/batch-1207/html/d79b6820-d361-11f0-8438-11a56595a476.html
//
// This test file validates the FSM states and transitions described in the specification:
// - S0_Idle: initial empty queue
// - S1_Enqueued: after enqueue operations
// - S2_Dequeued: after dequeue operations
//
// The tests also observe console messages and page errors, assert DOM updates, and verify edge cases.

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79b6820-d361-11f0-8438-11a56595a476.html';

// Page Object Model for the Queue page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.enqueueInput = page.locator('#enqueueInput');
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.queueDisplay = page.locator('#queueDisplay');
    this.frontBackInfo = page.locator('#frontBackInfo');
    this.errorMsg = page.locator('#errorMsg');
    this.queueItems = () => page.locator('.queue-item');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial render has settled
    await this.page.waitForLoadState('domcontentloaded');
  }

  async enqueue(value) {
    // Fill input and click enqueue button
    await this.enqueueInput.fill(value);
    await this.enqueueBtn.click();
  }

  async enqueueViaEnter(value) {
    await this.enqueueInput.fill(value);
    // Press Enter to trigger keyup listener
    await this.enqueueInput.press('Enter');
  }

  async dequeue() {
    await this.dequeueBtn.click();
  }

  async getQueueDisplayText() {
    return (await this.queueDisplay.textContent())?.trim() ?? '';
  }

  async getErrorText() {
    return (await this.errorMsg.textContent())?.trim() ?? '';
  }

  async getFrontBackInfoText() {
    return (await this.frontBackInfo.textContent())?.trim() ?? '';
  }

  async getQueueItemsTexts() {
    const count = await this.queueItems().count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.queueItems().nth(i).textContent())?.trim() ?? '');
    }
    return texts;
  }

  async getQueueItemDataPos(index = 0) {
    return await this.queueItems().nth(index).getAttribute('data-pos');
  }

  async isDequeueDisabled() {
    return await this.dequeueBtn.isDisabled();
  }
}

// Group tests logically
test.describe('Queue Demo - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  // Each test gets a fresh page and monitors console & page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture console messages; include type and text for easier assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Capture unhandled exceptions on the page
      pageErrors.push(err);
    });
  });

  test.describe('Initial Idle state (S0_Idle)', () => {
    test('should render empty queue, disable Dequeue, and show no front/back info', async ({ page }) => {
      // Validate initial renderQueue() was executed and UI reflects empty queue
      const q = new QueuePage(page);
      await q.goto();

      // Queue display shows "(empty)"
      await expect(await q.getQueueDisplayText()).toBe('(empty)');

      // Dequeue button must be disabled in the Idle state
      await expect(await q.isDequeueDisabled()).toBe(true);

      // front/back info should be empty
      await expect(await q.getFrontBackInfoText()).toBe('');

      // error message should be empty
      await expect(await q.getErrorText()).toBe('');

      // No console errors or page errors occurred during initial render
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Enqueue operations (S0_Idle -> S1_Enqueued)', () => {
    test('click Enqueue button transitions to Enqueued state and updates DOM', async ({ page }) => {
      // This test validates the transition triggered by EnqueueClick from Idle -> Enqueued
      const q = new QueuePage(page);
      await q.goto();

      // Enqueue an item "A" using the button
      await q.enqueue('A');

      // There should be one queue item with text "A"
      const items = await q.getQueueItemsTexts();
      expect(items).toEqual(['A']);

      // For a single item, data-pos should be "Front" (per implementation)
      const pos = await q.getQueueItemDataPos(0);
      expect(pos).toBe('Front');

      // front/back info should include Front: A and Back: A and Size: 1
      const info = await q.getFrontBackInfoText();
      expect(info).toContain('Front: A');
      expect(info).toContain('Back: A');
      expect(info).toContain('Size: 1');

      // Dequeue button should now be enabled
      await expect(await q.isDequeueDisabled()).toBe(false);

      // No console errors or page errors during the enqueue transition
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('press Enter in input triggers enqueue (EnterKey event) and appends item', async ({ page }) => {
      // Validate the EnterKey event triggers same enqueue behavior as clicking the button
      const q = new QueuePage(page);
      await q.goto();

      // Enqueue "B" via Enter key
      await q.enqueueViaEnter('B');

      // Verify the queue shows the one item "B"
      const items = await q.getQueueItemsTexts();
      expect(items).toEqual(['B']);

      // Verify front/back info for single item
      const info = await q.getFrontBackInfoText();
      expect(info).toContain('Front: B');
      expect(info).toContain('Back: B');
      expect(info).toContain('Size: 1');

      // No console errors or page errors
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('enqueue multiple items preserves FIFO ordering and Back label on last', async ({ page }) => {
      // Enqueue A then B and verify position labels and ordering
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('A');
      await q.enqueue('B');
      await q.enqueue('C');

      const items = await q.getQueueItemsTexts();
      expect(items).toEqual(['A', 'B', 'C']);

      // First item should be 'Front'
      const pos0 = await q.getQueueItemDataPos(0);
      expect(pos0).toBe('Front');

      // Last item should have no 'Front' but implementation sets data-pos only to 'Back'
      const lastIndex = (await q.queueItems().count()) - 1;
      const posLast = await q.getQueueItemDataPos(lastIndex);
      // For last item, pos should be 'Back' unless it's also the first (single item)
      expect(posLast).toBe('Back');

      // Front/back info should reflect front/back as A and C
      const info = await q.getFrontBackInfoText();
      expect(info).toContain('Front: A');
      expect(info).toContain('Back: C');
      expect(info).toContain('Size: 3');

      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Dequeue operations (S1_Enqueued -> S2_Dequeued and S1_Enqueued -> S0_Idle)', () => {
    test('dequeue removes front item and transitions correctly (multi-item case)', async ({ page }) => {
      // Enqueue two items, then dequeue once => should remove the first (FIFO)
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('X');
      await q.enqueue('Y');

      // Sanity before dequeue
      expect(await q.getQueueItemsTexts()).toEqual(['X', 'Y']);

      // Dequeue should remove 'X'
      await q.dequeue();

      // After dequeue, queue should contain only 'Y'
      expect(await q.getQueueItemsTexts()).toEqual(['Y']);

      // Error message should show the removed item
      expect(await q.getErrorText()).toBe('Dequeued: X');

      // front/back info should show Y as both front and back and size 1
      const info = await q.getFrontBackInfoText();
      expect(info).toContain('Front: Y');
      expect(info).toContain('Back: Y');
      expect(info).toContain('Size: 1');

      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('dequeue last item transitions back to Idle state and disables Dequeue', async ({ page }) => {
      // Enqueue a single item then dequeue it -> back to idle
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('Z');

      // Dequeue the only item
      await q.dequeue();

      // Queue display should revert to "(empty)"
      expect(await q.getQueueDisplayText()).toBe('(empty)');

      // Dequeue button should be disabled again
      await expect(await q.isDequeueDisabled()).toBe(true);

      // front/back info should be empty
      expect(await q.getFrontBackInfoText()).toBe('');

      // Error message should show the dequeued item
      expect(await q.getErrorText()).toBe('Dequeued: Z');

      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('enqueue with empty input displays validation error and does not change queue', async ({ page }) => {
      // This validates the error path when the user attempts to enqueue empty input
      const q = new QueuePage(page);
      await q.goto();

      // Ensure input is empty
      await q.enqueueInput.fill('');
      // Click enqueue with empty value
      await q.enqueueBtn.click();

      // Error message should explain the need for non-empty value
      expect(await q.getErrorText()).toBe('Please enter a non-empty value to enqueue.');

      // Queue should remain empty
      expect(await q.getQueueDisplayText()).toBe('(empty)');

      // Dequeue button still disabled
      await expect(await q.isDequeueDisabled()).toBe(true);

      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('attempting to click disabled Dequeue button is not permitted by the browser (Playwright should reject the action)', async ({ page }) => {
      // Validate that clicking a disabled button results in an action error from Playwright
      const q = new QueuePage(page);
      await q.goto();

      // Dequeue is disabled initially, so clicking should reject
      // We assert that the promise rejects (Playwright will throw because the element is disabled)
      await expect(page.click('#dequeueBtn')).rejects.toThrow();

      // No additional console errors expected
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('dequeue when queue programmatically empty (defensive) would show error text (unreachable via UI since button disabled)', async ({ page }) => {
      // This test demonstrates the code path that would show "Queue is empty, cannot dequeue."
      // In normal UI it's unreachable because the button is disabled when empty.
      // We attempt to simulate the user scenario by enqueuing then dequeuing twice:
      // 1) Enqueue 'P', 2) Dequeue -> removes P, 3) Attempt second Dequeue -> button is disabled, so Playwright cannot click it.
      // We instead verify after the first dequeue the queue is empty and the error message for empty is not shown (since removal shows Dequeued: P).
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('P');
      await q.dequeue();

      // After removing last item, queue is empty
      expect(await q.getQueueDisplayText()).toBe('(empty)');

      // The code path that displays "Queue is empty, cannot dequeue." is gated behind a click which is disabled in UI.
      // Ensure that the last error message is the dequeued confirmation, not the empty-queue error
      expect(await q.getErrorText()).toBe('Dequeued: P');

      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('no console error messages or page errors occur during typical usage', async ({ page }) => {
      // Perform a set of typical operations and assert there are no console errors or page errors
      const q = new QueuePage(page);
      await q.goto();

      await q.enqueue('Alpha');
      await q.enqueue('Beta');
      await q.dequeue();
      await q.enqueueViaEnter('Gamma');
      await q.dequeue();
      await q.dequeue();

      // After interacting, ensure no unhandled runtime exceptions and no console.error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});