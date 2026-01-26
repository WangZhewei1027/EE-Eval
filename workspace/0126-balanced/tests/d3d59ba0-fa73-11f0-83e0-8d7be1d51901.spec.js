import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d59ba0-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for interacting with the B+ Tree demo
class BPlusPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // helpers to access controls
  get keyInput() { return this.page.locator('#keyInput'); }
  get insBtn() { return this.page.locator('#insBtn'); }
  get searchInput() { return this.page.locator('#searchInput'); }
  get searchBtn() { return this.page.locator('#searchBtn'); }
  get delInput() { return this.page.locator('#delInput'); }
  get delBtn() { return this.page.locator('#delBtn'); }
  get randBtn() { return this.page.locator('#randBtn'); }
  get bulkBtn() { return this.page.locator('#bulkBtn'); }
  get clearBtn() { return this.page.locator('#clearBtn'); }
  get orderInput() { return this.page.locator('#order'); }
  get orderVal() { return this.page.locator('#orderVal'); }
  get animateCheckbox() { return this.page.locator('#animate'); }
  get svg() { return this.page.locator('xpath=//svg'); }

  // toggle animation off to make tests deterministic and fast
  async disableAnimation() {
    const checked = await this.animateCheckbox.isChecked();
    if (checked) {
      await this.animateCheckbox.click();
    }
    // ensure animation is off
    expect(await this.animateCheckbox.isChecked()).toBe(false);
  }

  // Insert a numeric key via UI
  async insertKey(value) {
    await this.keyInput.fill(String(value));
    await Promise.all([
      this.page.waitForTimeout(10), // give tiny tick
      this.insBtn.click()
    ]);
    // keyInput should be cleared by the page code after successful insert
    await this.page.waitForTimeout(50);
  }

  // Search UI
  async searchKey(value) {
    await this.searchInput.fill(String(value));
    await Promise.all([
      this.page.waitForTimeout(10),
      this.searchBtn.click()
    ]);
  }

  // Delete UI
  async deleteKey(value) {
    await this.delInput.fill(String(value));
    await Promise.all([
      this.page.waitForTimeout(10),
      this.delBtn.click()
    ]);
  }

  // Click Insert 8 random button
  async clickRandomInsert() {
    await this.randBtn.click();
  }

  // Click bulk insert sequence button
  async clickBulkInsert() {
    await this.bulkBtn.click();
  }

  // Click clear button (will show confirm)
  async clickClear() {
    await this.clearBtn.click();
  }

  // Change order slider value and trigger change event
  async changeOrderTo(value) {
    // set the value via UI (dragging is simulated by filling value attribute then dispatching events)
    await this.orderInput.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    // Now trigger change (which in UI triggers confirm)
    await this.orderInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  // Utility: wait for a specific text inside SVG <text> nodes
  async waitForSvgText(text, timeout = 5000) {
    return await this.page.waitForSelector(`xpath=//svg//text[normalize-space()="${text}"]`, { timeout });
  }

  // Utility: check whether SVG contains a text node with the given text
  async hasSvgText(text) {
    const loc = this.page.locator(`xpath=//svg//text[normalize-space()="${text}"]`);
    return await loc.count() > 0;
  }

  // Get count of SVG keyText elements
  async countSvgKeyTexts() {
    return await this.page.locator('xpath=//svg//text[contains(@class,"keyText")]').count();
  }

  // Check for highlighted rects created by render (class "highlight")
  async hasHighlightedRect() {
    return await this.page.locator('xpath=//svg//rect[contains(@class,"highlight")]').count() > 0;
  }

  // Click first node rectangle to trigger node-details alert
  async clickFirstNodeRect() {
    const rect = this.page.locator('xpath=//svg//rect').first();
    await rect.click();
  }

  // Wait for '(empty)' marker inside svg which is used to indicate empty tree node
  async waitForEmptyMarker(timeout = 3000) {
    return await this.page.waitForSelector(`xpath=//svg//text[normalize-space()="(empty)"]`, { timeout });
  }
}

test.describe('B+ Tree Interactive Demo - FSM and UI end-to-end tests', () => {
  // shared collectors for console errors and page errors and dialogs
  let consoleErrors;
  let pageErrors;
  let dialogEvents;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogEvents = [];

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Auto-accept dialogs but store them for assertions
    page.on('dialog', async (dialog) => {
      dialogEvents.push({ type: dialog.type(), message: dialog.message() });
      // Accept all dialogs to let app continue (alerts/confirms)
      try {
        await dialog.accept();
      } catch (e) {
        // swallow any acceptance issues
      }
    });

    // Navigate to the app
    const app = new BPlusPage(page);
    await app.goto();

    // Disable animations to speed up and make behaviors deterministic
    await app.disableAnimation();

    // Wait for the initial seeded insertions to complete and render at least one known key (10)
    // The page seeds [10, 20, 5, 6, 12] on init with small timeouts.
    // Wait for '10' to appear to ensure initial render completed.
    await app.waitForSvgText('10', 4000);
  });

  test.afterEach(async () => {
    // Ensure there are no uncaught exceptions in console/page by default
    // Tests will assert dialog contents when required. These arrays help observe runtime issues.
    expect(pageErrors, `No uncaught page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
    expect(consoleErrors, `No console errors: ${JSON.stringify(consoleErrors)}`).toEqual([]);
  });

  test.describe('Initial state and reset (S0_Idle / S1_TreeReset)', () => {
    test('renders initial seeded keys and shows order value', async ({ page }) => {
      const app = new BPlusPage(page);

      // Order value should match the slider default (4)
      await expect(app.orderVal).toHaveText('4');

      // The seeded key '10' should be rendered in the SVG
      await app.waitForSvgText('10');

      // The SVG should contain at least one node label and key text
      const keyCount = await app.countSvgKeyTexts();
      expect(keyCount).toBeGreaterThanOrEqual(1);
    });

    test('clear tree (ClearTree -> S1_TreeReset) resets tree when confirmed', async ({ page }) => {
      const app = new BPlusPage(page);

      // Before clearing, ensure some key exists
      expect(await app.hasSvgText('10')).toBe(true);

      // Click Clear; a confirm dialog is expected and will be auto-accepted by dialog handler
      await app.clickClear();

      // Wait for reset: the tree should display '(empty)' marker
      await app.waitForEmptyMarker(3000);

      // Confirm a dialog event happened (the confirm)
      expect(dialogEvents.some(d => /Clear the tree\?/i.test(d.message))).toBe(true);
    });
  });

  test.describe('Insert (S2_KeyInserted) behaviors', () => {
    test('insert a single key and verify it appears in the DOM', async ({ page }) => {
      const app = new BPlusPage(page);

      // Insert a fresh value unlikely to be in the seeded set
      const key = 42;
      await app.insertKey(key);

      // Wait for the key to appear in the SVG
      await app.waitForSvgText(String(key), 2000);

      // Ensure keyInput was cleared by the app script
      await expect(app.keyInput).toHaveValue('');

      // Verify there's at least one keyText now
      const keyTexts = await app.countSvgKeyTexts();
      expect(keyTexts).toBeGreaterThan(0);
    });

    test('insert invalid input triggers an alert and does not crash', async ({ page }) => {
      const app = new BPlusPage(page);

      // Ensure empty input and click insert - should trigger alert 'Enter a number to insert'
      // Clear any previous dialog messages
      dialogEvents.length = 0;

      // Make sure input is empty
      await app.keyInput.fill('');
      await app.insBtn.click();

      // Wait briefly for dialog to be captured
      await page.waitForTimeout(200);

      // There should be an alert recorded about entering a number
      const alertMsg = dialogEvents.find(d => /Enter a number to insert/i.test(d.message));
      expect(alertMsg).toBeTruthy();
    });

    test('Insert 8 random keys (InsertRandomKeys) increases key count', async ({ page }) => {
      const app = new BPlusPage(page);

      const beforeCount = await app.countSvgKeyTexts();

      // Click the "Insert 8 random" button
      await app.clickRandomInsert();

      // Wait for some insertions to occur - we should at least see more keys than before
      // Because insertion is scheduled with setTimeouts, poll until count increases
      const maxWait = 5000;
      const start = Date.now();
      let afterCount = beforeCount;
      while (Date.now() - start < maxWait) {
        afterCount = await app.countSvgKeyTexts();
        if (afterCount > beforeCount) break;
        await page.waitForTimeout(150);
      }
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    test('Insert sequence (InsertSequence) produces expected known values', async ({ page }) => {
      const app = new BPlusPage(page);

      // Insert bulk sequence via button
      await app.clickBulkInsert();

      // One known value in the sequence is '30' - wait for it to appear
      await app.waitForSvgText('30', 4000);

      // Also check another value '17' exists
      await app.waitForSvgText('17', 4000);
    });
  });

  test.describe('Search (S3_KeySearched) behaviors', () => {
    test('search for an existing key highlights path', async ({ page }) => {
      const app = new BPlusPage(page);

      // Insert a unique key and then search it
      const key = 77;
      await app.insertKey(key);
      await app.waitForSvgText(String(key));

      // Clear previous dialog events
      dialogEvents.length = 0;

      await app.searchKey(key);

      // With animation disabled the render should immediately add highlights if implemented
      // Check that a highlighted rectangle exists in the svg (path highlight)
      const hasHighlight = await app.hasHighlightedRect();
      expect(hasHighlight).toBe(true);
    });

    test('search for a non-existing key still renders and does not crash', async ({ page }) => {
      const app = new BPlusPage(page);

      // Choose a value likely not present
      const key = 9999;
      // Ensure not present initially
      if (await app.hasSvgText(String(key))) {
        // if present for some reason delete it first
        await app.deleteKey(key);
      }

      await app.searchKey(key);

      // No exception should have been thrown; pageErrors array will be asserted in afterEach
      // Also, since not found, searching does not add the key; ensure not present
      const present = await app.hasSvgText(String(key));
      expect(present).toBe(false);
    });
  });

  test.describe('Delete (S4_KeyDeleted) behaviors and rebalancing', () => {
    test('delete an existing key removes it from DOM', async ({ page }) => {
      const app = new BPlusPage(page);

      // Insert and then delete a key
      const key = 99;
      await app.insertKey(key);
      await app.waitForSvgText(String(key));

      // Delete the key
      await app.deleteKey(key);

      // Wait briefly for render / delete completion
      const maxWait = 3000;
      const start = Date.now();
      let stillPresent = true;
      while (Date.now() - start < maxWait) {
        stillPresent = await app.hasSvgText(String(key));
        if (!stillPresent) break;
        await page.waitForTimeout(100);
      }

      expect(stillPresent).toBe(false);
    });

    test('delete invalid input triggers an alert and no crash occurs', async ({ page }) => {
      const app = new BPlusPage(page);

      // Ensure delInput empty and click delete
      dialogEvents.length = 0;
      await app.delInput.fill('');
      await app.delBtn.click();

      // Wait briefly for dialog to be captured
      await page.waitForTimeout(200);

      const alertMsg = dialogEvents.find(d => /Enter a number to delete/i.test(d.message));
      expect(alertMsg).toBeTruthy();
    });

    test('clicking node rect shows node details alert (UI click handler)', async ({ page }) => {
      const app = new BPlusPage(page);

      // Click first rectangle to show an alert with node details
      dialogEvents.length = 0;
      await app.clickFirstNodeRect();

      // Wait briefly for the alert to be captured
      await page.waitForTimeout(200);

      // Ensure an alert occurred and its message includes 'Leaf' or 'Internal'
      const detailsDialog = dialogEvents.find(d => /(Leaf|Internal)/i.test(d.message));
      expect(detailsDialog).toBeTruthy();
    });
  });

  test.describe('Change order (ChangeOrder -> TreeReset)', () => {
    test('changing order prompts confirmation and resets tree (S1_TreeReset)', async ({ page }) => {
      const app = new BPlusPage(page);

      // Choose a different order value than current (default 4). Set to 5.
      dialogEvents.length = 0;
      await app.changeOrderTo(5);

      // The change event triggers a confirm dialog; our handler auto-accepted and stored it
      const confirmEvent = dialogEvents.find(d => /Changing order will reset the tree/i.test(d.message) || /reset the tree/i.test(d.message));
      expect(confirmEvent).toBeTruthy();

      // After accept, tree should be reset to empty; wait for '(empty)'
      await app.waitForEmptyMarker(3000);

      // orderVal should reflect the new order '5'
      await expect(app.orderVal).toHaveText('5');
    });

    test('cancelling change order leaves tree intact', async ({ page }) => {
      const app = new BPlusPage(page);

      // To test canceling, we need to attach a temporary dialog handler that dismisses the confirm
      const localDialogs = [];
      const handler = async (dialog) => {
        localDialogs.push({ type: dialog.type(), message: dialog.message() });
        // Dismiss instead of accept to simulate cancellation
        try {
          await dialog.dismiss();
        } catch (e) { /* ignore */ }
      };
      page.on('dialog', handler);

      // Record current order and ensure a known key exists
      const originalOrder = await app.orderVal.innerText();
      const someKey = '10';
      expect(await app.hasSvgText(someKey)).toBe(true);

      // Trigger change to a different value (e.g., 6) but our handler will dismiss the confirm
      await app.orderInput.evaluate((el) => { el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await app.orderInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

      // Wait briefly and then remove the temporary handler
      await page.waitForTimeout(200);
      page.off('dialog', handler);

      // Ensure tree still has the known key (i.e., change was cancelled)
      expect(await app.hasSvgText(someKey)).toBe(true);

      // order value should remain unchanged (original)
      await expect(app.orderVal).toHaveText(originalOrder);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('multiple rapid inserts do not cause uncaught exceptions', async ({ page }) => {
      const app = new BPlusPage(page);

      // Rapidly insert multiple keys
      const keys = [111, 222, 333, 444, 555];
      for (const k of keys) {
        await app.insertKey(k);
      }

      // Wait until at least one of them appears
      await app.waitForSvgText('111', 2000);

      // No page errors should have been recorded (asserted in afterEach)
      for (const k of keys) {
        expect(await app.hasSvgText(String(k))).toBe(true);
      }
    });

    test('bulk inserts and deletes combined keep the tree stable', async ({ page }) => {
      const app = new BPlusPage(page);

      // Bulk insert known sequence
      await app.clickBulkInsert();

      // Wait for one known member of sequence
      await app.waitForSvgText('12', 4000);

      // Delete an existing sequence value and ensure it disappears
      await app.deleteKey(12);

      // Wait for removal
      const maxWait = 3000;
      const start = Date.now();
      let present = true;
      while (Date.now() - start < maxWait) {
        present = await app.hasSvgText('12');
        if (!present) break;
        await page.waitForTimeout(120);
      }
      expect(present).toBe(false);
    });
  });
});