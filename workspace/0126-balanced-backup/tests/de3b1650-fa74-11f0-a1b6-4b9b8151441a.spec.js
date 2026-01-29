import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b1650-fa74-11f0-a1b6-4b9b8151441a.html';

class HashMapPage {
  /**
   * Page object for interacting with the Hash Map demo.
   * It manages dialog responses via a queued array so tests can simulate prompt inputs or cancellations.
   */
  constructor(page, consoleErrors) {
    this.page = page;
    this.responses = []; // queued prompt responses; use `null` to dismiss
    this.consoleErrors = consoleErrors;

    // Collect console error messages
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    // Listen for unhandled page errors
    this.page.on('pageerror', (err) => {
      this.consoleErrors.push({ text: err.message || String(err) });
    });

    // Global dialog handler consumes responses from the queue in FIFO order.
    this.page.on('dialog', async (dialog) => {
      const next = this.responses.shift();
      try {
        if (next === null) {
          await dialog.dismiss();
        } else if (next === undefined) {
          // If no queued response, default to dismiss (safer than leaving it hanging)
          await dialog.dismiss();
        } else {
          await dialog.accept(String(next));
        }
      } catch (e) {
        // Allow natural errors to surface; also log to consoleErrors for test assertions
        this.consoleErrors.push({ text: e.message || String(e) });
      }
    });

    this.output = this.page.locator('#output');
    this.createBtn = this.page.locator("button[onclick='createHashMap()']");
    this.addBtn = this.page.locator("button[onclick='addItem()']");
    this.getBtn = this.page.locator("button[onclick='getItem()']");
    this.removeBtn = this.page.locator("button[onclick='removeItem()']");
    this.showAllBtn = this.page.locator("button[onclick='showAll()']");
    this.clearBtn = this.page.locator("button[onclick='clearHashMap()']");
  }

  // Set the dialog responses for upcoming interactions (consumed FIFO)
  setPromptResponses(values = []) {
    this.responses = [...values];
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // Ensure the page and output are available
    await expect(this.output).toBeVisible();
  }

  // Click helpers — return after clicking and allow UI to update
  async clickCreate() {
    await this.createBtn.click();
    // Wait for an update in output
    await this.page.waitForTimeout(50);
  }

  async clickAdd() {
    await this.addBtn.click();
    // wait briefly for dialogs and UI update
    await this.page.waitForTimeout(50);
  }

  async clickGet() {
    await this.getBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickRemove() {
    await this.removeBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickShowAll() {
    await this.showAllBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickClear() {
    await this.clearBtn.click();
    await this.page.waitForTimeout(50);
  }

  async getOutputText() {
    // Use textContent because output may contain HTML (<ul>) for showAll
    return (await this.output.textContent()) || '';
  }

  async getOutputHTML() {
    return (await this.output.innerHTML()) || '';
  }
}

test.describe('JavaScript Hash Map Demo (FSM validation)', () => {
  // Collect console/page errors across each test run
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    // Nothing else here; each test will create its own HashMapPage instance so it can set prompt responses.
  });

  test('Initial load: page renders buttons and empty output (FSM initial state S0_Idle)', async ({ page }) => {
    // Validate entry UI elements exist and initial output is empty-ish
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    // Verify buttons exist per FSM evidence
    await expect(pageObj.createBtn).toBeVisible();
    await expect(pageObj.addBtn).toBeVisible();
    await expect(pageObj.getBtn).toBeVisible();
    await expect(pageObj.removeBtn).toBeVisible();
    await expect(pageObj.showAllBtn).toBeVisible();
    await expect(pageObj.clearBtn).toBeVisible();

    // The initial output should be empty (or whitespace)
    const outText = await pageObj.getOutputText();
    expect(outText.trim()).toBe('');

    // Ensure no console or page errors occurred on load
    expect(consoleErrors).toHaveLength(0);
  });

  test('Create Hash Map: clicking Create Hash Map shows creation message (transition CreateHashMap)', async ({ page }) => {
    // This validates the CreateHashMap event and expected observable text
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    await pageObj.clickCreate();

    const outText = await pageObj.getOutputText();
    expect(outText).toContain('New empty hash map created.');

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Add Item: adds a key/value and updates current size (transition AddItem) ', async ({ page }) => {
    // This validates adding an item using prompt inputs
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    // Ensure map is fresh
    await pageObj.clickCreate();

    // Provide two prompt responses: key and value
    pageObj.setPromptResponses(['foo', 'bar']);
    await pageObj.clickAdd();

    const outText = await pageObj.getOutputText();
    // Should show the Added line and size
    expect(outText).toContain('Added: foo => bar');
    expect(outText).toContain('Current size: 1');

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Get Item: retrieves existing value and reports not found for missing key (transition GetItem)', async ({ page }) => {
    // Validate both success and failure cases for getItem()
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    // Setup: create and add an entry
    await pageObj.clickCreate();
    pageObj.setPromptResponses(['alpha', 'omega']);
    await pageObj.clickAdd();

    // Retrieve existing key
    pageObj.setPromptResponses(['alpha']);
    await pageObj.clickGet();
    const outText1 = await pageObj.getOutputText();
    expect(outText1).toContain('Value for "alpha": omega');

    // Retrieve non-existent key
    pageObj.setPromptResponses(['missing_key']);
    await pageObj.clickGet();
    const outText2 = await pageObj.getOutputText();
    expect(outText2).toContain('Key "missing_key" not found in the hash map.');

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Remove Item: removes existing key and updates size; missing key reports not found (transition RemoveItem)', async ({ page }) => {
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    // Setup: create and add two entries
    await pageObj.clickCreate();
    pageObj.setPromptResponses(['k1', 'v1']);
    await pageObj.clickAdd();
    pageObj.setPromptResponses(['k2', 'v2']);
    await pageObj.clickAdd();

    // Remove an existing key
    pageObj.setPromptResponses(['k1']);
    await pageObj.clickRemove();
    const outText1 = await pageObj.getOutputText();
    expect(outText1).toContain('Key "k1" removed successfully.');
    expect(outText1).toContain('Current size: 1');

    // Attempt to remove a key that doesn't exist
    pageObj.setPromptResponses(['nonexistent']);
    await pageObj.clickRemove();
    const outText2 = await pageObj.getOutputText();
    expect(outText2).toContain('Key "nonexistent" not found in the hash map.');

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Show All Items: shows list of entries when present and empty message when no items (transition ShowAllItems)', async ({ page }) => {
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    // Ensure empty map yields "Hash map is empty."
    await pageObj.clickCreate();
    await pageObj.clickShowAll();
    const emptyText = await pageObj.getOutputText();
    expect(emptyText).toContain('Hash map is empty.');

    // Add multiple items and then show all
    pageObj.setPromptResponses(['a', '1']);
    await pageObj.clickAdd();
    pageObj.setPromptResponses(['b', '2']);
    await pageObj.clickAdd();

    await pageObj.clickShowAll();
    const outHTML = await pageObj.getOutputHTML();
    // Should contain a UL with both items
    expect(outHTML).toContain('<ul>');
    expect(outHTML).toContain('a => 1');
    expect(outHTML).toContain('b => 2');

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Clear Hash Map: clears items and sets size to 0 (transition ClearHashMap)', async ({ page }) => {
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    // Add an item then clear
    await pageObj.clickCreate();
    pageObj.setPromptResponses(['temp', 'val']);
    await pageObj.clickAdd();

    await pageObj.clickClear();
    const outText = await pageObj.getOutputText();
    expect(outText).toContain('Hash map cleared. Current size: 0');

    // After clearing, showAll should indicate empty
    await pageObj.clickShowAll();
    const afterClear = await pageObj.getOutputText();
    expect(afterClear).toContain('Hash map is empty.');

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Edge case: user cancels prompts - operations should abort gracefully (prompt dismissed)', async ({ page }) => {
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    // Starting output snapshot
    await pageObj.clickCreate();
    const before = await pageObj.getOutputText();

    // Simulate user canceling the first addItem prompt (key prompt)
    pageObj.setPromptResponses([null]); // dismiss first prompt
    await pageObj.clickAdd();
    const afterAdd = await pageObj.getOutputText();
    // No change expected in output (operation aborted); still contains creation message
    expect(afterAdd.trim()).toBe(before.trim());

    // Simulate user canceling the getItem prompt
    pageObj.setPromptResponses([null]);
    await pageObj.clickGet();
    const afterGet = await pageObj.getOutputText();
    expect(afterGet.trim()).toBe(before.trim());

    // Simulate user canceling the removeItem prompt
    pageObj.setPromptResponses([null]);
    await pageObj.clickRemove();
    const afterRemove = await pageObj.getOutputText();
    expect(afterRemove.trim()).toBe(before.trim());

    // No console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('Stress: add multiple items, remove some, and verify final map contents and no runtime errors', async ({ page }) => {
    const pageObj = new HashMapPage(page, consoleErrors);
    await pageObj.goto();

    await pageObj.clickCreate();

    // Add 5 items
    for (let i = 1; i <= 5; i++) {
      pageObj.setPromptResponses([`key${i}`, `val${i}`]);
      await pageObj.clickAdd();
      const out = await pageObj.getOutputText();
      expect(out).toContain(`Added: key${i} => val${i}`);
    }

    // Remove a couple of keys
    pageObj.setPromptResponses(['key2']);
    await pageObj.clickRemove();
    expect((await pageObj.getOutputText())).toContain('removed successfully');

    pageObj.setPromptResponses(['key4']);
    await pageObj.clickRemove();
    expect((await pageObj.getOutputText())).toContain('removed successfully');

    // Show all and ensure remaining keys are present
    await pageObj.clickShowAll();
    const finalHTML = await pageObj.getOutputHTML();
    expect(finalHTML).toContain('key1 => val1');
    expect(finalHTML).not.toContain('key2 => val2'); // removed
    expect(finalHTML).toContain('key3 => val3');
    expect(finalHTML).not.toContain('key4 => val4'); // removed
    expect(finalHTML).toContain('key5 => val5');

    // Finally clear and ensure message and empty state
    await pageObj.clickClear();
    expect((await pageObj.getOutputText())).toContain('Hash map cleared. Current size: 0');

    await pageObj.clickShowAll();
    expect((await pageObj.getOutputText())).toContain('Hash map is empty.');

    // Assert no console or page errors were captured during the stress interactions
    expect(consoleErrors).toHaveLength(0);
  });
});