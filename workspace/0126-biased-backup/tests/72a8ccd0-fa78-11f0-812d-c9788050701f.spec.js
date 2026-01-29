import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a8ccd0-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Visual Hash Table application
class HashTablePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertBtn = page.locator('#insert-btn');
    this.highlightBtn = page.locator('#highlight-btn');
    this.hashTable = page.locator('#hash-table');
    this.items = page.locator('.item');
    this.itemKeys = page.locator('.item-key');
    this.bucketHeaders = page.locator('.bucket-header');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait until the initial hash table buckets are rendered
    await expect(this.hashTable).toBeVisible();
    // The app inserts 3 random items during initialization. Wait for that.
    await this.page.waitForFunction(() => document.querySelectorAll('.item').length >= 3);
  }

  async getItemCount() {
    return await this.items.count();
  }

  async getBucketCount() {
    return await this.page.evaluate(() => document.querySelectorAll('.bucket').length);
  }

  async clickInsert() {
    await this.insertBtn.click();
  }

  async clickHighlight() {
    await this.highlightBtn.click();
  }

  async getHighlightedItemsCount() {
    return await this.page.locator('.item.highlight').count();
  }

  async getHighlightedBucketHeadersCount() {
    return await this.page.locator('.bucket-header.highlight').count();
  }

  // Wait until at least one item has highlight class (used for inserted-item highlight)
  async waitForAnyItemHighlight(timeout = 2000) {
    await this.page.waitForFunction(() => !!document.querySelector('.item.highlight'), { timeout });
  }

  // Wait until no elements have highlight class
  async waitForAllHighlightsRemoved(timeout = 3000) {
    await this.page.waitForFunction(() => document.querySelectorAll('.highlight').length === 0, { timeout });
  }
}

// Group tests related to the FSM and UI behaviors
test.describe('Visual Hash Table - FSM states and transitions', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays
    consoleErrors = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      // err is an Error object
      pageErrors.push(err.message ?? String(err));
    });

    // Capture and auto-accept dialogs (alerts). Store their messages for assertions.
    page.on('dialog', async dialog => {
      try {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      } catch (e) {
        // swallow any dialog handling errors; they will be captured by pageErrors if they surface
      }
    });
  });

  test.afterEach(async ({ }, testInfo) => {
    // For debugging, attach info about any console/page errors to the test output if present
    if (consoleErrors.length > 0) {
      testInfo.attach('consoleErrors', { body: consoleErrors.join('\n'), contentType: 'text/plain' });
    }
    if (pageErrors.length > 0) {
      testInfo.attach('pageErrors', { body: pageErrors.join('\n'), contentType: 'text/plain' });
    }
    if (dialogMessages.length > 0) {
      testInfo.attach('dialogMessages', { body: dialogMessages.join('\n'), contentType: 'text/plain' });
    }
  });

  test('Initial render: Idle (S0_Idle) - renders 5 buckets and 3 initial items', async ({ page }) => {
    // This test validates the initial state (S0_Idle) and the onEnter action renderHashTable()
    // It also monitors console errors and page errors during page load.
    const app = new HashTablePage(page);
    await app.goto();

    // Verify there are 5 buckets created (per implementation)
    const bucketCount = await app.getBucketCount();
    expect(bucketCount).toBe(5);

    // Verify exactly 3 items were inserted on initialization (as described in FSM)
    const initialItems = await app.getItemCount();
    expect(initialItems).toBeGreaterThanOrEqual(3);
    // The specification mentions "Initialize with 3 random items" — the implementation inserts 3 items.
    // We assert at least 3 to be tolerant of environment variations, but expect exactly 3 in most runs.
    expect(initialItems).toBe(3);

    // Assert that no console errors or uncaught page errors occurred during initial render
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Insert Random Item (S0_Idle -> S1_ItemInserted then S1_ItemInserted -> S2_Highlighted): item count increases and inserted item is highlighted temporarily', async ({ page }) => {
    // This test validates both transitions related to InsertRandomItem:
    // - From Idle to ItemInserted: new item added
    // - From ItemInserted to Highlighted: inserted item gets .highlight class then removed
    const app = new HashTablePage(page);
    await app.goto();

    const beforeCount = await app.getItemCount();

    // Click insert button to trigger InsertRandomItem
    await app.clickInsert();

    // After insertion, item count should increase by 1
    await page.waitForFunction((prev) => document.querySelectorAll('.item').length === prev + 1, {}, beforeCount);
    const afterCount = await app.getItemCount();
    expect(afterCount).toBe(beforeCount + 1);

    // The inserted item should receive .highlight class temporarily
    // Wait for at least one highlighted item to appear
    await app.waitForAnyItemHighlight(2000);
    const highlightedCount = await app.getHighlightedItemsCount();
    expect(highlightedCount).toBeGreaterThanOrEqual(1);

    // Wait for highlight to be removed (~1500ms) and verify removal
    await app.waitForAllHighlightsRemoved(3000);
    const highlightedAfter = await app.getHighlightedItemsCount();
    expect(highlightedAfter).toBe(0);

    // Verify there were no console or uncaught page errors during this interaction
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Show Hash Function (S1_ItemInserted -> S0_Idle and S2_Highlighted -> S0_Idle): highlights mapping from keys to buckets and removes highlighting', async ({ page }) => {
    // This test validates the ShowHashFunction event:
    // - It should add highlight class to each item and its corresponding bucket header
    // - After the timeout, highlighting should be removed (return to Idle)
    const app = new HashTablePage(page);
    await app.goto();

    // Ensure we have some items (initial has 3)
    const totalItems = await app.getItemCount();
    expect(totalItems).toBeGreaterThanOrEqual(1);

    // Click the Show Hash Function button
    await app.clickHighlight();

    // Immediately after click, each .item should be highlighted and some bucket headers should be highlighted.
    // Wait for highlight to be applied (the implementation applies it synchronously inside the click handler)
    await page.waitForFunction(() => document.querySelectorAll('.item.highlight').length > 0, {}, { timeout: 500 });
    const highlightedItemsCount = await app.getHighlightedItemsCount();
    expect(highlightedItemsCount).toBeGreaterThanOrEqual(totalItems); // all items should be highlighted; >= to be tolerant

    // Check that at least one bucket header has highlight (since some buckets will be targeted)
    const highlightedBuckets = await app.getHighlightedBucketHeadersCount();
    expect(highlightedBuckets).toBeGreaterThan(0);

    // Wait for highlights to be removed after ~1500ms
    await app.waitForAllHighlightsRemoved(3000);

    // Validate no highlights remain
    const highlightedItemsAfter = await app.getHighlightedItemsCount();
    const highlightedBucketsAfter = await app.getHighlightedBucketHeadersCount();
    expect(highlightedItemsAfter).toBe(0);
    expect(highlightedBucketsAfter).toBe(0);

    // Verify no console or page errors occurred during this transition
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Edge case: repeatedly insert until sample items exhausted should trigger alert dialog "No more sample items available!"', async ({ page }) => {
    // This test drives the app toward the edge-case where sampleItems is emptied.
    // It validates that an alert dialog is shown and that the message matches the expected evidence.
    const app = new HashTablePage(page);
    await app.goto();

    // We know the app starts with 10 sampleItems and inserts 3 during initialization -> 7 remain.
    // We'll attempt to insert repeatedly until the dialog appears. This may require up to 8 clicks:
    // 7 successful inserts, then the 8th triggers the alert.
    const maxAttempts = 12; // generous cap to avoid infinite loops in case of unexpected behavior
    let dialogShown = false;

    for (let i = 0; i < maxAttempts; i++) {
      await app.clickInsert();
      // Briefly wait to allow potential alert to appear and be handled by our dialog handler in beforeEach
      await page.waitForTimeout(120);
      if (dialogMessages.length > 0) {
        dialogShown = true;
        break;
      }
    }

    // Assert that we observed a dialog indicating no more sample items (per implementation)
    expect(dialogShown).toBe(true);
    expect(dialogMessages[0]).toBe('No more sample items available!');

    // Verify that no console or page errors were logged during these repeated interactions
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Observability: capture and assert console and page errors arrays (should be empty for healthy run)', async ({ page }) => {
    // This test's goal is to explicitly observe console logs and page errors as described in the instructions.
    // It does not mutate the application state beyond loading it.
    const app = new HashTablePage(page);
    await app.goto();

    // The arrays are collected via listeners in beforeEach. This assertion verifies we observed them and that they are empty.
    // If any runtime ReferenceError, TypeError, or other page errors occurred they would be present in pageErrors or consoleErrors.
    expect(Array.isArray(consoleErrors)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // For this particular implementation, we expect no runtime errors. Assert zero length to validate health.
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});