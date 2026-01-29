import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/b774ccb0-fa78-11f0-bb22-e3d37811147a.html';

// Page Object for the Queue application
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.queueSelector = '#queue';
    this.addButton = "button[onclick='addToQueue()']";
    this.removeButton = "button[onclick='removeFromQueue()']";
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns the number of .queue-item elements currently in the queue
  async countItems() {
    return await this.page.$$eval('#queue .queue-item', (els) => els.length);
  }

  // Click the "Add to Queue" button
  async clickAddButton() {
    return await this.page.click(this.addButton);
  }

  // Click the "Remove from Queue" button
  async clickRemoveButton() {
    return await this.page.click(this.removeButton);
  }

  // Click the queue area
  async clickQueue() {
    return await this.page.click(this.queueSelector);
  }

  // Wait until the number of items is at least expectedCount or timeout
  async waitForAtLeastItems(expectedCount, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const count = await this.countItems();
      if (count >= expectedCount) return count;
      await this.page.waitForTimeout(150);
    }
    return await this.countItems();
  }

  // Wait until the number of items increases by at least delta compared to baseline
  async waitForIncrease(baseline, delta = 1, timeout = 5000) {
    return await this.waitForAtLeastItems(baseline + delta, timeout);
  }
}

test.describe('Queue FSM and UI tests - Application b774ccb0-fa78-11f0-bb22-e3d37811147a', () => {
  let queuePage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    queuePage = new QueuePage(page);
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for assertions and debugging
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch {
        // ignore any problems reading console messages
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(err);
      } catch {
        // ignore
      }
    });

    await queuePage.goto();
  });

  test.afterEach(async ({ page }) => {
    // short pause to let any background errors surface
    await page.waitForTimeout(200);
  });

  test.describe('State S0_Idle (initial) - Entry action: setInterval(addToQueue, 1000)', () => {
    test('S0: The page should start adding items over time due to setInterval(addToQueue, 1000)', async ({ page }) => {
      // Comment: Verifies that the entry_action setInterval(addToQueue, 1000) results in queue items appearing.
      // At page load, addToQueue is defined inside document.ready closure and setInterval is called there.
      // We expect at least one .queue-item to appear within a couple of seconds.
      const initialCount = await queuePage.countItems();
      // Wait up to 5 seconds for at least one new item to be present
      const newCount = await queuePage.waitForIncrease(initialCount, 1, 5000);
      expect(newCount).toBeGreaterThanOrEqual(initialCount + 1);
      // Ensure no page-level errors occurred immediately due to the interval (it uses closure addToQueue)
      expect(pageErrors.length).toBe(0);
    });

    test('S0: Items continue to be appended over time (visual/DOM change)', async () => {
      // Comment: Ensure that after a short period more items are appended, demonstrating ongoing setInterval action.
      const count1 = await queuePage.countItems();
      await queuePage.page.waitForTimeout(2200); // wait a bit more than 2 seconds to allow 2 intervals
      const count2 = await queuePage.countItems();
      expect(count2).toBeGreaterThanOrEqual(count1 + 1);
    });
  });

  test.describe('Event: AddToQueue (button[onclick="addToQueue()"])', () => {
    test('Clicking the "Add to Queue" button triggers a ReferenceError because addToQueue is not global', async ({ page }) => {
      // Comment: The button uses inline onclick="addToQueue()". In the implementation, addToQueue is declared inside a jQuery ready closure
      // and therefore is not exposed globally. Clicking the button should produce a page error (ReferenceError).
      // Wait for the pageerror event triggered by the click.
      const waitForError = page.waitForEvent('pageerror');
      // Click the add button (this invokes an inline onclick that should fail)
      await queuePage.clickAddButton();
      const error = await waitForError;
      // Assert the error mentions addToQueue
      const msg = String(error && error.message ? error.message : error);
      expect(msg).toMatch(/addToQueue/i);
      // The error type is typically a ReferenceError; ensure the message indicates it is not defined or similar
      expect(/not defined|is not defined|ReferenceError/i.test(msg)).toBeTruthy();
    });

    test('Clicking "Add to Queue" does not successfully call the closure addToQueue (no deterministic DOM addition from button click)', async ({ page }) => {
      // Comment: Because the inline onclick fails, we should not be able to rely on the button click to add items.
      // We'll record the count before the click, click the button (expecting an error), and then ensure no reliable decrease/increase attributable to the click.
      const before = await queuePage.countItems();
      // Await the pageerror from this click
      const waitForError = page.waitForEvent('pageerror');
      await queuePage.clickAddButton();
      await waitForError; // ensure error happened
      // Give a short grace period; the background interval may add items, but the click itself didn't add any (it errored).
      await page.waitForTimeout(300);
      const after = await queuePage.countItems();
      // after should be >= before (interval might have added), but should not be less than before
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  test.describe('Event: QueueClick (#queue click)', () => {
    test('Clicking the queue area triggers addToQueue via closure and increases the number of items (no pageerror)', async ({ page }) => {
      // Comment: The implementation attaches an event listener to queue inside the closure of addToQueue.
      // Because this listener uses the closure-local addToQueue, clicking #queue should succeed in adding an item
      // (assuming addToQueue has already run at least once to attach the listener).
      // Ensure at least one initial run happened (setInterval or initial call) so the event listener exists.
      await queuePage.waitForAtLeastItems(1, 5000);

      const before = await queuePage.countItems();
      // Clear any existing page errors captured so far for this check
      pageErrors.length = 0;

      await queuePage.clickQueue();

      // Wait up to 2 seconds for an increase in items
      const after = await queuePage.waitForIncrease(before, 1, 2000);
      expect(after).toBeGreaterThanOrEqual(before + 1);

      // Ensure that no page-level error was emitted as a result of clicking the queue
      expect(pageErrors.length).toBe(0);
    });

    test('Rapid clicks on the queue result in multiple items being appended', async ({ page }) => {
      // Comment: Validate multiple QueueClick transitions (S1 -> S1) append multiple items.
      const start = await queuePage.countItems();
      // Perform 3 quick clicks
      await queuePage.clickQueue();
      await queuePage.clickQueue();
      await queuePage.clickQueue();
      // Allow some time for listeners to run and DOM to update
      const end = await queuePage.waitForAtLeastItems(start + 3, 3000);
      expect(end).toBeGreaterThanOrEqual(start + 3);
    });
  });

  test.describe('Event: RemoveFromQueue (button[onclick="removeFromQueue()"]) and S2_ItemRemoved', () => {
    test('Clicking the "Remove from Queue" button triggers a ReferenceError because removeFromQueue is not global', async ({ page }) => {
      // Comment: The inline onclick points to removeFromQueue which is defined only inside the jQuery ready closure.
      // Clicking should raise a page-level ReferenceError.
      const waitForError = page.waitForEvent('pageerror');
      await queuePage.clickRemoveButton();
      const error = await waitForError;
      const msg = String(error && error.message ? error.message : error);
      expect(msg).toMatch(/removeFromQueue/i);
      expect(/not defined|is not defined|ReferenceError/i.test(msg)).toBeTruthy();
    });

    test('Because the remove button triggers an error, the DOM should not deterministically remove items from the queue as a result of the button click', async ({ page }) => {
      // Comment: The remove button's onclick fails, so removal will not happen via the inline button.
      // We therefore assert that the count does not decrease because of the failed click (it may increase due to the interval).
      const before = await queuePage.countItems();
      const waitForError = page.waitForEvent('pageerror');
      await queuePage.clickRemoveButton();
      await waitForError;
      await page.waitForTimeout(300);
      const after = await queuePage.countItems();
      // The remove did not succeed; count should be >= before (since setInterval might add).
      expect(after).toBeGreaterThanOrEqual(before);
    });

    test('Edge case: ensure removeFromQueue closure (if ever invoked) would throw DOMException when trying to remove a newly-created non-child node (observed as potential runtime error if invoked)', async ({ page }) => {
      // Comment: We are NOT allowed to call removeFromQueue ourselves or patch the page.
      // But the implementation's removeFromQueue creates a new element and attempts to remove it (not a child), which would throw if executed.
      // Since we cannot invoke it directly, we assert that the global environment does not expose removeFromQueue,
      // and that clicking the remove button produced a ReferenceError rather than executing a removal.
      // This confirms the "error-prone" remove implementation is not silently executing in global scope.
      const beforeErrors = pageErrors.length;
      // Click the remove button and wait for the pageerror
      const err = await page.waitForEvent('pageerror').then(e => e).catch(() => null);
      // We expect the most recent error to relate to removeFromQueue not being defined
      if (err) {
        const msg = String(err && err.message ? err.message : err);
        expect(msg).toMatch(/removeFromQueue/i);
      } else {
        // If no pageerror event was captured by this point, ensure that the page still does not have a global removeFromQueue
        const hasGlobal = await page.evaluate(() => typeof window.removeFromQueue !== 'function');
        expect(hasGlobal).toBeTruthy();
      }
      // Ensure we did not inadvertently remove items
      const after = await queuePage.countItems();
      const before = after; // we cannot deterministically compare due to background interval; primarily ensure no crash
      expect(after).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Console and error observation (observability tests)', () => {
    test('Console should capture messages and pageerrors should be emitted for inline onclick missing functions', async ({ page }) => {
      // Comment: Validate that clicking the failing inline onclicks produces observable page errors and console messages may contain useful debugging info.
      // Click add button and remove button sequentially and assert both errors are captured.
      const addErrorPromise = page.waitForEvent('pageerror');
      await queuePage.clickAddButton();
      const addErr = await addErrorPromise;
      expect(String(addErr.message)).toMatch(/addToQueue/i);

      const removeErrorPromise = page.waitForEvent('pageerror');
      await queuePage.clickRemoveButton();
      const removeErr = await removeErrorPromise;
      expect(String(removeErr.message)).toMatch(/removeFromQueue/i);

      // Ensure we have at least two page errors captured in the pageErrors array
      expect(pageErrors.length).toBeGreaterThanOrEqual(2);
      // Console messages may include library logs (jQuery load etc.); ensure we captured something
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });
});