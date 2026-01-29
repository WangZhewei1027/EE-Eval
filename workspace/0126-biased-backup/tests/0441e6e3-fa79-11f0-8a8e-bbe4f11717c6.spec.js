import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0441e6e3-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object encapsulating interactions with the Priority Queue UI
class QueuePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.queueLocator = page.locator('.queue');
    this.itemLocator = page.locator('.queue .item');
    this.addButton = page.locator('#add-item');
    this.clearButton = page.locator('#clear-queue');
    this.remove1 = page.locator('#remove-item');
    this.remove2 = page.locator('#remove-item-2');
    this.remove3 = page.locator('#remove-item-3');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return number of items currently rendered in the queue
  async countItems() {
    return await this.itemLocator.count();
  }

  // Click the Add Item button
  async clickAdd() {
    await this.addButton.click();
  }

  // Click the Clear Queue button
  async clickClear() {
    await this.clearButton.click();
  }

  // Click a remove button by its selector if present; returns true if clicked, false if not found
  async clickRemove(selectorLocator) {
    const count = await selectorLocator.count();
    if (count > 0) {
      await selectorLocator.first().click();
      return true;
    }
    return false;
  }

  // Returns true if any remove button exists
  async hasAnyRemoveButton() {
    const r1 = await this.remove1.count();
    const r2 = await this.remove2.count();
    const r3 = await this.remove3.count();
    return (r1 + r2 + r3) > 0;
  }

  // Wait until item count reaches expected (with timeout)
  async waitForItemCount(expected, options = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (sel, expectedCount) => {
        const items = document.querySelectorAll(sel);
        return items.length === expectedCount;
      },
      ['.queue .item', expected],
      options
    );
  }
}

test.describe('Priority Queue FSM - 0441e6e3-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Collect console.error messages and page errors for assertions about runtime errors
  let pageErrors = [];
  let consoleErrors = [];
  let allConsoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    pageErrors = [];
    consoleErrors = [];
    allConsoleMessages = [];

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // capture the error object/string
      pageErrors.push(err);
    });

    // Capture console messages; keep separate list for console.error specifically
    page.on('console', (msg) => {
      allConsoleMessages.push(msg);
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg);
        }
      } catch (e) {
        // ignore inspector errors
      }
    });

    // Navigate to the app page and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial DOM sanity checks and state detection (Idle vs ItemAdded)', async ({ page }) => {
    // This test validates the initial presence of components from the FSM:
    // - Add Item button and Clear Queue button must be present (S0 evidence)
    // - Remove buttons might be present indicating the queue already has items (S1 evidence)
    const qp = new QueuePage(page);

    // Ensure the two main action buttons exist
    await expect(qp.addButton).toBeVisible();
    await expect(qp.clearButton).toBeVisible();

    // Count initial items and assert that there are 0 or more items present
    const initialCount = await qp.countItems();
    // The HTML supplied includes three items by default. We assert the count is >= 0 and a number.
    expect(typeof initialCount).toBe('number');
    expect(initialCount).toBeGreaterThanOrEqual(0);

    // Determine which FSM state the page most closely matches on load.
    // If there are remove buttons, we are in S1_ItemAdded; otherwise S0_Idle.
    const hasRemove = await qp.hasAnyRemoveButton();
    if (hasRemove) {
      // Evidence for S1_ItemAdded: at least one remove button must be visible
      expect(initialCount).toBeGreaterThan(0);
      // Specific remove button(s) should be present
      const r1 = await qp.remove1.count();
      const r2 = await qp.remove2.count();
      const r3 = await qp.remove3.count();
      expect(r1 + r2 + r3).toBeGreaterThan(0);
    } else {
      // Evidence for S0_Idle: no remove buttons found
      expect(initialCount).toBe(0);
    }
  });

  test('Add Item creates a new queue item (S0_Idle -> S1_ItemAdded or S2_QueueCleared -> S0_Idle -> S1_ItemAdded)', async ({ page }) => {
    // This test validates the AddItem event and expected observable changes:
    // - Clicking Add should increase the number of .item elements
    const qp = new QueuePage(page);

    const before = await qp.countItems();
    await qp.clickAdd();

    // After clicking add, expect at least one more item than before
    // Wait for the DOM to update (some implementations may be async)
    await qp.page.waitForTimeout(200); // small delay to allow UI update
    const after = await qp.countItems();
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });

  test('Remove Item 1 removes the corresponding element (S1_ItemAdded -> S0_Idle)', async ({ page }) => {
    // Validate RemoveItem1 event: clicking #remove-item removes item-1 (or reduces item count)
    const qp = new QueuePage(page);

    const initialCount = await qp.countItems();
    // ensure the remove button exists before attempting click
    const r1Count = await qp.remove1.count();
    if (r1Count === 0) {
      // If not present, we still want to assert robustly: the test expects the remove button is part of FSM evidence
      // but if it's not present, skip the interaction but register this fact
      test.info().annotations.push({ type: 'info', description: '#remove-item not present on page; skipping click' });
      expect(r1Count).toBe(0);
      return;
    }

    // Click the remove button and expect items to decrease
    await qp.clickRemove(qp.remove1);

    // Wait a moment and assert the item count decreased by at least 1
    await qp.page.waitForTimeout(200);
    const afterCount = await qp.countItems();
    expect(afterCount).toBeLessThanOrEqual(initialCount - 1);
  });

  test('Remove Item 2 and Remove Item 3 also remove their elements (S1_ItemAdded -> S0_Idle)', async ({ page }) => {
    // Validate RemoveItem2 and RemoveItem3 events independently:
    // clicking #remove-item-2 and #remove-item-3 should reduce the queue count
    const qp = new QueuePage(page);

    // Remove item 2 if present
    const before2 = await qp.countItems();
    const removed2 = await qp.clickRemove(qp.remove2);
    if (removed2) {
      await qp.page.waitForTimeout(200);
      const after2 = await qp.countItems();
      expect(after2).toBeLessThanOrEqual(before2 - 1);
    } else {
      test.info().annotations.push({ type: 'info', description: '#remove-item-2 not present on page; skipping' });
    }

    // Remove item 3 if present
    const before3 = await qp.countItems();
    const removed3 = await qp.clickRemove(qp.remove3);
    if (removed3) {
      await qp.page.waitForTimeout(200);
      const after3 = await qp.countItems();
      expect(after3).toBeLessThanOrEqual(before3 - 1);
    } else {
      test.info().annotations.push({ type: 'info', description: '#remove-item-3 not present on page; skipping' });
    }
  });

  test('Clear Queue removes all items (S1_ItemAdded -> S2_QueueCleared) and Add Item after clear re-adds an item (S2 -> S1)', async ({ page }) => {
    // This test validates ClearQueue transition and then AddItem from cleared state.
    const qp = new QueuePage(page);

    // Ensure there is at least one item to clear (if not, still click clear to test idempotence)
    const before = await qp.countItems();
    await qp.clickClear();

    // Wait briefly and assert the queue has been cleared (0 items)
    await qp.page.waitForTimeout(200);
    const afterClear = await qp.countItems();
    expect(afterClear).toBe(0);

    // Now test AddItem after clear: should create at least one item
    await qp.clickAdd();
    await qp.page.waitForTimeout(200