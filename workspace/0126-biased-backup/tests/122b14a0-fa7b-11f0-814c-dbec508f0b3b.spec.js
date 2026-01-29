import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b14a0-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for interacting with the Binary Tree page
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Call the global insert function in page context with a proper value
  async insertValue(value) {
    return this.page.evaluate((v) => {
      // call existing function as-is
      if (typeof insert === 'function') insert(v);
      else throw new Error('insert is not defined');
    }, value);
  }

  // Call remove(value)
  async removeValue(value) {
    return this.page.evaluate((v) => {
      if (typeof remove === 'function') remove(v);
      else throw new Error('remove is not defined');
    }, value);
  }

  // Call update(value)
  async updateValue(value) {
    return this.page.evaluate((v) => {
      if (typeof update === 'function') update(v);
      else throw new Error('update is not defined');
    }, value);
  }

  // Call print()
  async printValues() {
    return this.page.evaluate(() => {
      if (typeof print === 'function') print();
      else throw new Error('print is not defined');
    });
  }

  // Call clear()
  async clearTree() {
    return this.page.evaluate(() => {
      if (typeof clear === 'function') clear();
      else throw new Error('clear is not defined');
    });
  }

  // Return array of objects describing list items in the tree UL
  async getListItems() {
    return this.page.$$eval('.tree ul li', (nodes) => {
      return nodes.map((n) => {
        const input = n.querySelector('input[type="text"]');
        return {
          text: n.childNodes && n.childNodes.length ? n.childNodes[0].textContent?.trim() ?? '' : n.textContent?.trim() ?? '',
          fullText: n.textContent?.trim() ?? '',
          inputValue: input ? input.value : null,
        };
      });
    });
  }

  async getListCount() {
    return this.page.$$eval('.tree ul li', (nodes) => nodes.length);
  }

  // Click the first visible "Insert" button (the static template)
  async clickFirstInsertButton() {
    const button = await this.page.$('.tree ul li button:text("Insert")') || await this.page.$('.tree ul li >> text=Insert');
    if (!button) throw new Error('Insert button not found');
    await button.click();
  }

  // Helper to fill first input (this will trigger input events)
  async fillFirstInput(value) {
    const input = await this.page.$('.tree ul li input[type="text"]');
    if (!input) throw new Error('input not found');
    await input.fill(value);
  }
}

test.describe('Binary Tree FSM - Application 122b14a0-fa7b-11f0-814c-dbec508f0b3b', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages and page errors
    page.on('console', (msg) => {
      try {
        // prefer text for assertions
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to the app
    const tree = new TreePage(page);
    await tree.goto();
  });

  test.afterEach(async ({ page }) => {
    // small tear-down: capture any remaining console messages
    // (listeners already collected them)
  });

  test('Initial Idle state shows the template list and Clear Tree button', async ({ page }) => {
    // Validate initial Idle state (S0_Idle)
    // - There are 4 template list items per the HTML
    // - "Clear Tree" button exists
    const tree = new TreePage(page);

    const count = await tree.getListCount();
    // The static HTML contains 4 list items before any updateTree() runs
    expect(count).toBe(4);

    const clearButton = await page.$('.tree >> text=Clear Tree');
    expect(clearButton).not.toBeNull();

    // No page errors should have occurred during initial load
    expect(pageErrors).toEqual([]);
  });

  test('InsertValue transition: calling insert(value) transitions to Tree Updated (S1_TreeUpdated)', async ({ page }) => {
    // This test validates:
    // - Calling the insert(value) function updates the internal values and triggers updateTree()
    // - The UL is replaced with list items representing the inserted value
    const tree = new TreePage(page);

    // Insert a string value using the global function (ensures proper value is passed)
    await tree.insertValue('alpha');

    // After insert, updateTree() should have been called (entry action)
    // which replaces the static template with the values array items.
    const items = await tree.getListItems();
    expect(items.length).toBe(1);

    // The text content should include "1. alpha"
    expect(items[0].fullText).toContain('1. alpha');

    // The input inside the LI should have the inserted value
    expect(items[0].inputValue).toBe('alpha');

    // No runtime page errors occurred
    expect(pageErrors).toEqual([]);
  });

  test('RemoveValue transition: remove(value) updates the tree (S1_TreeUpdated -> S1_TreeUpdated)', async ({ page }) => {
    // Validate removing: insert two values, remove one, and ensure tree updates
    const tree = new TreePage(page);

    await tree.insertValue('one');
    await tree.insertValue('two');

    // Ensure two items present
    let items = await tree.getListItems();
    expect(items.length).toBe(2);
    expect(items.map(i => i.inputValue)).toEqual(['one', 'two']);

    // Remove 'one'
    await tree.removeValue('one');

    // After remove, only 'two' should remain
    items = await tree.getListItems();
    expect(items.length).toBe(1);
    expect(items[0].inputValue).toBe('two');

    // No page errors occurred during removal
    expect(pageErrors).toEqual([]);
  });

  test('UpdateValue transition: update(value) transforms existing values (S1_TreeUpdated -> S1_TreeUpdated)', async ({ page }) => {
    // Validate update: values.map(v => v + ' -> ' + value)
    const tree = new TreePage(page);

    // Insert two known values
    await tree.insertValue('A');
    await tree.insertValue('B');

    // Update with 'UPD' string
    await tree.updateValue('UPD');

    // After update, each value should be appended with " -> UPD"
    const items = await tree.getListItems();
    expect(items.length).toBe(2);
    expect(items[0].inputValue).toBe('A -> UPD');
    expect(items[1].inputValue).toBe('B -> UPD');

    // No page errors during update
    expect(pageErrors).toEqual([]);
  });

  test('PrintValues transition: print() logs current values to console', async ({ page }) => {
    // Validate that print() outputs joined values via console.log
    const tree = new TreePage(page);

    // Clear any prior messages
    consoleMessages = [];

    await tree.insertValue('x');
    await tree.insertValue('y');

    // Invoke print(); it should console.log "x, y"
    await tree.printValues();

    // Wait a short time to ensure console messages propagated
    await page.waitForTimeout(50);

    // Find a console message that matches the printed values
    const found = consoleMessages.find(msg => msg.includes('x') && msg.includes('y'));
    expect(found).toBeTruthy();

    // No page errors expected
    expect(pageErrors).toEqual([]);
  });

  test('ClearTree transition: clear() empties the tree and returns to Idle-like state (S1_TreeUpdated -> S0_Idle)', async ({ page }) => {
    // Validate clear behavior
    const tree = new TreePage(page);

    // Insert some values
    await tree.insertValue('val1');
    await tree.insertValue('val2');

    // Ensure items present
    let count = await tree.getListCount();
    expect(count).toBe(2);

    // Clear the tree
    await tree.clearTree();

    // After clear, updateTree() sets innerHTML = '', so there should be 0 list items
    count = await tree.getListCount();
    expect(count).toBe(0);

    // No page errors during clear
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: calling insert with empty string and null, and verifying behavior', async ({ page }) => {
    // Validate edge handling when insert is called with empty string or null
    const tree = new TreePage(page);

    // Insert empty string
    await tree.insertValue('');
    // Insert null (will coerce to 'null' when added and displayed)
    await tree.insertValue(null);

    const items = await tree.getListItems();
    // Expect two items to be present
    expect(items.length).toBe(2);

    // The first item input value should be empty string
    expect(items[0].inputValue).toBe('');
    // The second item input value should be string 'null' (because null coerced to 'null' when set as input.value)
    expect(items[1].inputValue).toBe(String(null));

    // No page errors occurred
    expect(pageErrors).toEqual([]);
  });

  test('Interactive UI click edge-case: clicking template "Insert" button triggers global handlers (observe effects and no uncaught errors)', async ({ page }) => {
    // The HTML attaches a series of click listeners to all buttons that call remove/update/print/clear
    // This test verifies clicking the UI button does not produce uncaught exceptions and inspects resulting DOM changes.
    const tree = new TreePage(page);

    // Ensure starting from known clean state
    await tree.clearTree();

    // Fill the first input (this triggers input handlers in the page; we rely on the page behavior)
    // Note: this will call input event listeners registered in the original code; we don't modify them.
    await tree.fillFirstInput('uiValue');

    // After filling, because the original code attaches input event handlers that pass the event
    // (not the input value), behavior may be unexpected; ensure no page errors
    expect(pageErrors).toEqual([]);

    // Now click the first Insert button in the original template (if present)
    // If the template was removed by earlier handlers this might fail; guard accordingly
    const firstInsert = await page.$('.tree ul li button:text("Insert")') || await page.$('.tree ul li >> text=Insert');
    if (firstInsert) {
      await firstInsert.click();
      // Wait briefly to allow any handlers to run
      await page.waitForTimeout(50);
    }

    // Ensure no uncaught page errors after click
    expect(pageErrors).toEqual([]);

    // We cannot assert a deterministic DOM state because the original code attaches multiple handlers incorrectly.
    // Instead, assert that the application remains responsive: fetching list count should not throw and returns a number.
    const count = await tree.getListCount();
    expect(typeof count).toBe('number');
  });

  test('Observability: console logging and page errors are captured across operations', async ({ page }) => {
    // This test ensures our instrumentation for console and page errors is functioning.
    const tree = new TreePage(page);

    consoleMessages = [];
    pageErrors = [];

    // Perform operations that produce console output
    await tree.insertValue('p1');
    await tree.insertValue('p2');
    await tree.printValues();

    // Wait for console messages to arrive
    await page.waitForTimeout(50);

    // There should be at least one console message containing the printed values
    const printed = consoleMessages.find(m => m.includes('p1') && m.includes('p2'));
    expect(printed).toBeTruthy();

    // Ensure no uncaught exceptions were thrown during these operations
    expect(pageErrors).toEqual([]);
  });
});