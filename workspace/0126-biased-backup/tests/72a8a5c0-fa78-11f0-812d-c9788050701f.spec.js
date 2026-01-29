import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a8a5c0-fa78-11f0-812d-c9788050701f.html';

// Page object for the Queue visualization page
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.enqueueBtn = page.locator('#enqueueBtn');
    this.dequeueBtn = page.locator('#dequeueBtn');
    this.queueVisual = page.locator('#queueVisual');
    this.queueItemSelector = '#queueVisual .queue-item';
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return number of queue items currently in DOM
  async itemCount() {
    return await this.page.locator(this.queueItemSelector).count();
  }

  // Return array of text contents for items in order
  async itemTexts() {
    const handles = await this.page.$$(this.queueItemSelector);
    const texts = [];
    for (const h of handles) {
      texts.push(await h.evaluate(n => n.textContent));
    }
    return texts;
  }

  // Click enqueue n times (sequentially)
  async enqueue(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.enqueueBtn.click();
      // small pause to allow DOM update; underlying app uses timeouts (~100ms) to update positions
      await this.page.waitForTimeout(120);
    }
  }

  // Click dequeue n times (sequentially)
  async dequeue(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.dequeueBtn.click();
      // allow animation + removal (app uses 800ms for dequeue animation)
      await this.page.waitForTimeout(850);
    }
  }

  // Wait until queue has exactly expectedCount items or timeout
  async waitForItemCount(expectedCount, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelectorAll(sel);
        return el.length === expected;
      },
      this.queueItemSelector,
      expectedCount,
      { timeout }
    );
  }

  // Get inline transform style value of item at index
  async itemTransformAt(index) {
    const handle = (await this.page.$$(this.queueItemSelector))[index];
    if (!handle) return null;
    return await handle.evaluate(n => n.style.transform);
  }

  // Get first item's HTMLElement handle (for class assertions)
  async firstItemHandle() {
    const handles = await this.page.$$(this.queueItemSelector);
    return handles.length ? handles[0] : null;
  }
}

test.describe('Queue Visualization - FSM End-to-End Tests', () => {
  let page;
  let queuePage;
  let consoleMessages = [];
  let pageErrors = [];

  // Attach console and pageerror listeners for each test and navigate to the app
  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    queuePage = new QueuePage(page);
    await queuePage.goto();
  });

  test.afterEach(async () => {
    // Assert there are no uncaught page errors of severe JS types (ReferenceError, SyntaxError, TypeError).
    // The application should run without uncaught exceptions. If errors do occur, they will be visible here.
    const problematic = pageErrors.filter(err => {
      const name = err.name || '';
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    });

    expect(problematic.length, `Unexpected JS errors on page: ${pageErrors.map(e => `${e.name}: ${e.message}`).join(' | ')}`).toBe(0);

    // Also assert no console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `console.error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);

    await page.context().close();
  });

  test.describe('Initial State (S0_Idle) and entry actions', () => {
    test('S0_Idle: page initializes and enqueues 3 items automatically', async () => {
      // The app's entry action initializes queue with 3 items by clicking enqueue button 3 times with timeouts.
      // Wait for up to 2 seconds for these items to appear.
      await queuePage.waitForItemCount(3, 3000);
      const count = await queuePage.itemCount();
      expect(count).toBe(3);

      // Verify that the initial items have text "1", "2", "3" (counter starts at 1)
      const texts = await queuePage.itemTexts();
      expect(texts).toEqual(['1', '2', '3']);
    });
  });

  test.describe('Enqueue operations and S1_Enqueued state', () => {
    test('EnqueueClick adds items and updates positions (S0_Idle -> S1_Enqueued)', async () => {
      // Start from initial 3 items (ensured by entry action)
      await queuePage.waitForItemCount(3, 3000);

      // Enqueue two more items
      await queuePage.enqueue(2);

      // Expect count = 5
      await queuePage.waitForItemCount(5, 2000);
      expect(await queuePage.itemCount()).toBe(5);

      // Validate that newly added items have increasing numeric labels "4" and "5"
      const texts = await queuePage.itemTexts();
      expect(texts.slice(-2)).toEqual(['4', '5']);

      // Validate that transforms (inline style) were set for each item so they are spaced horizontally
      const transform0 = await queuePage.itemTransformAt(0);
      const transform4 = await queuePage.itemTransformAt(4);
      // transform may be like "translateX(0px)" or "translateX(100px)". We assert that transforms are set strings.
      expect(typeof transform0).toBe('string');
      expect(transform0.length).toBeGreaterThan(0);
      expect(typeof transform4).toBe('string');
      expect(transform4.includes('translateX')).toBeTruthy();
    });

    test('EnqueueClick does not add more than 8 items (capacity constraint)', async () => {
      // Ensure starting from initial 3
      await queuePage.waitForItemCount(3, 3000);

      // Enqueue until reaching 8 items
      const toAdd = 8 - (await queuePage.itemCount());
      await queuePage.enqueue(toAdd);

      await queuePage.waitForItemCount(8, 2000);
      expect(await queuePage.itemCount()).toBe(8);

      // Try to enqueue one more - should be ignored by the app (if queue.length >= 8) return;
      await queuePage.enqueue(1);
      // small wait to ensure no additional DOM changes
      await page.waitForTimeout(200);
      expect(await queuePage.itemCount()).toBe(8);
    });
  });

  test.describe('Dequeue operations and S2_Dequeued state', () => {
    test('DequeueClick removes first item with dequeue-animation and updates remaining items (S1_Enqueued -> S2_Dequeued)', async () => {
      // Ensure at least 4 items for clearer verification
      await queuePage.waitForItemCount(3, 3000);
      await queuePage.enqueue(1); // make it 4
      await queuePage.waitForItemCount(4, 2000);

      // Capture first item handle and its text
      const firstHandle = await queuePage.firstItemHandle();
      expect(firstHandle).not.toBeNull();
      const firstText = await firstHandle.evaluate(n => n.textContent);

      // Click dequeue; immediately the app adds 'dequeue-animation' class to the shifted element
      await queuePage.dequeue(1);

      // After dequeue, count should decrease by 1
      expect(await queuePage.itemCount()).toBe(3);

      // Confirm that the item with the previously captured text is no longer present (removed from DOM)
      const textsAfter = await queuePage.itemTexts();
      expect(textsAfter.includes(firstText)).toBe(false);

      // Also ensure remaining items have updated transforms set (inline style transform)
      for (let i = 0; i < await queuePage.itemCount(); i++) {
        const t = await queuePage.itemTransformAt(i);
        expect(t).toBeTruthy();
        expect(t.includes('translateX')).toBeTruthy();
      }
    });

    test('Repeated Dequeue until empty and dequeue on empty is a no-op', async () => {
      // Ensure at least 3 items exist initially
      await queuePage.waitForItemCount(3, 3000);

      // Dequeue all items one by one
      const starting = await queuePage.itemCount();
      await queuePage.dequeue(starting);

      // Now queue should be empty
      expect(await queuePage.itemCount()).toBe(0);

      // Attempt to dequeue when empty - should do nothing and not throw
      // We also assert there are no new page errors caused
      await queuePage.dequeue(1);
      await page.waitForTimeout(200);
      expect(await queuePage.itemCount()).toBe(0);
    });
  });

  test.describe('Component existence, event binding, and edge behaviors', () => {
    test('UI components present and buttons trigger events', async () => {
      // Buttons should exist and have the expected labels
      const enqueueText = await page.locator('#enqueueBtn').textContent();
      const dequeueText = await page.locator('#dequeueBtn').textContent();
      expect(enqueueText.trim()).toBe('Enqueue');
      expect(dequeueText.trim()).toBe('Dequeue');

      // Clicking enqueue should add an item (verify at least one click works)
      const before = await queuePage.itemCount();
      await queuePage.enqueue(1);
      await page.waitForTimeout(200);
      const after = await queuePage.itemCount();
      expect(after).toBeGreaterThanOrEqual(before + 1);
    });

    test('Edge case: ensure counter increments on enqueues to provide unique labels', async () => {
      // Reset assumption: app starts with 3 (1,2,3). We'll enqueue two more and verify labels 4,5 appear.
      await queuePage.waitForItemCount(3, 3000);
      await queuePage.enqueue(2);
      await queuePage.waitForItemCount(5, 2000);

      const texts = await queuePage.itemTexts();
      // Last two should be '4' and '5' given initialization
      expect(texts.slice(-2)).toEqual(['4', '5']);
    });
  });

  test.describe('Observability: console and page errors (do not patch runtime)', () => {
    test('No uncaught ReferenceError / SyntaxError / TypeError should be emitted during normal interactions', async () => {
      // Interact with the app: enqueue and dequeue a few times
      await queuePage.waitForItemCount(3, 3000);
      await queuePage.enqueue(2);
      await queuePage.dequeue(1);
      await queuePage.enqueue(1);
      await page.waitForTimeout(500);

      // After interactions, ensure there are no captured page errors of serious types
      const problematic = pageErrors.filter(err => {
        const name = err.name || '';
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(problematic.length).toBe(0);

      // Also ensure console.error wasn't used
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Capture console messages for debugging and ensure no fatal console errors occurred on load', async () => {
      // Allow initial animations and entry clicks to run
      await page.waitForTimeout(1000);

      // Confirm we captured some console messages or none but none are errors
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors.length).toBe(0);
    });
  });
});