import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b063e2-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object encapsulating common interactions and queries against the BST demo page
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#valueInput');
    this.insertBtn = page.locator('#insertBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.searchBtn = page.locator('#searchBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.svg = page.locator('#bstSvg');
    this.nodeLocator = this.svg.locator('.node');
    this.highlightedLocator = this.svg.locator('.node.highlight');
  }

  // Navigate to the app and wait for initial load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait for the svg element to be present
    await expect(this.svg).toBeVisible();
  }

  // get current number of visual nodes (g.node elements)
  async nodeCount() {
    return await this.nodeLocator.count();
  }

  // return array of node values as strings from the SVG
  async nodeValues() {
    const count = await this.nodeLocator.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const text = await this.nodeLocator.nth(i).locator('text').textContent();
      values.push((text || '').trim());
    }
    return values;
  }

  // return array of highlighted node values
  async highlightedValues() {
    const count = await this.highlightedLocator.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const text = await this.highlightedLocator.nth(i).locator('text').textContent();
      values.push((text || '').trim());
    }
    return values;
  }

  // Fill input with a value (string or number)
  async fillInput(value) {
    await this.input.fill(String(value));
  }

  // Clear input field
  async clearInput() {
    await this.input.fill('');
  }

  // Click insert button and wait for the node count to become expectedCount if provided
  async clickInsert(expectCount = undefined) {
    const before = await this.nodeCount();
    await this.insertBtn.click();
    if (typeof expectCount === 'number') {
      await expect(this.nodeLocator).toHaveCount(expectCount);
    } else {
      // wait for a small change or stabilization (up to 1s)
      await this.page.waitForTimeout(200);
      const after = await this.nodeCount();
      // allow same count if duplicate was attempted; tests will validate dialogs for duplicates
      return after;
    }
    return await this.nodeCount();
  }

  // Press Enter in the input field which triggers insert via keydown handler
  async pressEnterInInput(expectCount = undefined) {
    await this.input.press('Enter');
    if (typeof expectCount === 'number') {
      await expect(this.nodeLocator).toHaveCount(expectCount);
    } else {
      await this.page.waitForTimeout(200);
    }
  }

  // Click delete button
  async clickDelete(expectCount = undefined) {
    await this.deleteBtn.click();
    if (typeof expectCount === 'number') {
      await expect(this.nodeLocator).toHaveCount(expectCount);
    } else {
      await this.page.waitForTimeout(200);
    }
  }

  // Click search button
  async clickSearch() {
    await this.searchBtn.click();
    // renderTree is synchronous in page script; a short wait ensures DOM updated
    await this.page.waitForTimeout(150);
  }

  // Click reset button
  async clickReset() {
    await this.resetBtn.click();
    // clearSvg is synchronous; wait briefly
    await this.page.waitForTimeout(100);
  }

  // Query whether the svg contains any children
  async svgHasChildren() {
    const children = await this.page.evaluate(() => {
      const svg = document.getElementById('bstSvg');
      return svg && svg.childNodes && svg.childNodes.length > 0;
    });
    return !!children;
  }
}

test.describe('BST Visualization - FSM states and transitions', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    pageErrors = [];
    consoleMessages = [];
    dialogs = [];

    // Collect any uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Auto-dismiss dialogs but record their messages
    page.on('dialog', async (dialog) => {
      try {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      } catch (e) {
        // record any unexpected dialog handling errors
        pageErrors.push('Dialog handling error: ' + String(e));
      }
    });
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during the test run
    expect(pageErrors, `Page errors were logged: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
  });

  test.describe('Initial state (S0_Idle) and entry actions', () => {
    test('Initial render should produce the example tree (renderTree called on entry)', async ({ page }) => {
      // This validates S0 initial state entry_action renderTree() produced nodes
      const bst = new BSTPage(page);
      await bst.goto();

      // The page's script inserts an initial set of values: [50,30,70,20,40,60,80]
      // Expect 7 visual nodes rendered
      await expect(bst.nodeLocator).toHaveCount(7);

      // Ensure the SVG is not empty (clearSvg would have removed children)
      expect(await bst.svgHasChildren()).toBe(true);

      // No dialogs should have appeared on normal load
      expect(dialogs).toEqual([]);
    });
  });

  test.describe('Insertion events and transitions (S1_ValueInserted)', () => {
    test('Insert a new unique value via Insert button updates tree', async ({ page }) => {
      // Validate InsertValue event transitions from Idle to ValueInserted and calls renderTree()
      const bst = new BSTPage(page);
      await bst.goto();

      const before = await bst.nodeCount();
      // Insert a value that's not in the initial tree, e.g., 55
      await bst.fillInput(55);
      await bst.clickInsert(before + 1);

      // Verify the new node value is present among node texts
      const values = await bst.nodeValues();
      expect(values).toContain('55');

      // Ensure input was cleared by page script
      const inputValue = await page.locator('#valueInput').inputValue();
      expect(inputValue).toBe('');

      // No error dialogs expected
      expect(dialogs).toEqual([]);
    });

    test('Insert a duplicate value triggers an alert and does not change the tree', async ({ page }) => {
      // Attempt to insert an existing value (e.g., 50) - should trigger alert and no new node
      const bst = new BSTPage(page);
      await bst.goto();

      const before = await bst.nodeCount();
      await bst.fillInput(50);
      await bst.clickInsert(); // duplicate insertion

      // Because duplicate is disallowed, a dialog with a warning was shown
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      // The app shows: "Value already exists in the BST. No duplicates allowed."
      expect(dialogs.some(msg => msg.includes('already exists') || msg.includes('duplicates'))).toBe(true);

      // Node count should remain unchanged
      await expect(bst.nodeLocator).toHaveCount(before);
    });

    test('Insert via Enter key (InsertValueEnter) also inserts value', async ({ page }) => {
      // Validate pressing Enter in the input triggers an insert and clears the input
      const bst = new BSTPage(page);
      await bst.goto();

      const before = await bst.nodeCount();
      await bst.fillInput(25);
      await bst.pressEnterInInput(before + 1);

      const values = await bst.nodeValues();
      expect(values).toContain('25');

      // Input cleared by handler
      const inputValue = await page.locator('#valueInput').inputValue();
      expect(inputValue).toBe('');
    });
  });

  test.describe('Deletion events and transitions (S2_ValueDeleted)', () => {
    test('Deleting an existing value removes it from the visualization', async ({ page }) => {
      // Insert a unique value and then delete it, validating the transition and renderTree call
      const bst = new BSTPage(page);
      await bst.goto();

      // Insert 45 to ensure predictable deletion
      const beforeInsert = await bst.nodeCount();
      await bst.fillInput(45);
      await bst.clickInsert(beforeInsert + 1);
      await expect(bst.nodeLocator).toHaveCount(beforeInsert + 1);

      // Now delete 45
      await bst.fillInput(45);
      await bst.clickDelete(beforeInsert);

      // Ensure value 45 is no longer present
      const values = await bst.nodeValues();
      expect(values).not.toContain('45');

      // Verify input cleared
      const inputValue = await page.locator('#valueInput').inputValue();
      expect(inputValue).toBe('');
    });

    test('Deleting a non-existing value shows alert and tree remains unchanged', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      const before = await bst.nodeCount();
      // Try to delete a value unlikely to exist, e.g., 9999
      await bst.fillInput(9999);
      await bst.clickDelete();

      // The app should alert "Value not found in the BST."
      expect(dialogs.some(msg => /not found/i.test(msg))).toBe(true);

      // Node count should be unchanged
      await expect(bst.nodeLocator).toHaveCount(before);
    });
  });

  test.describe('Search events and transitions (S3_ValueSearched)', () => {
    test('Searching an existing value highlights the node', async ({ page }) => {
      // Search for 60 (present in initial tree) and check highlight class is applied
      const bst = new BSTPage(page);
      await bst.goto();

      // Ensure 60 is present
      const values = await bst.nodeValues();
      expect(values).toContain('60');

      // Search 60
      await bst.fillInput(60);
      await bst.clickSearch();

      // One node should be highlighted with text '60'
      const highlighted = await bst.highlightedValues();
      expect(highlighted).toContain('60');
    });

    test('Searching a non-existing value shows an alert and does not highlight', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Search for an unlikely value
      await bst.fillInput(424242);
      await bst.clickSearch();

      // Expect an alert mentioning not found
      expect(dialogs.some(msg => /not found/i.test(msg))).toBe(true);

      // Ensure no nodes are highlighted for that value
      const highlighted = await bst.highlightedValues();
      // It's possible other highlights remain from previous actions, but specifically '424242' must not be present
      expect(highlighted).not.toContain('424242');
    });
  });

  test.describe('Reset event and transition (S4_TreeReset)', () => {
    test('Reset clears the tree visual (clearSvg called on transition)', async ({ page }) => {
      // Validate that clicking Reset empties the SVG and clears the input
      const bst = new BSTPage(page);
      await bst.goto();

      // Ensure initial nodes exist
      await expect(bst.nodeLocator).toHaveCount(7);

      // Click reset
      await bst.clickReset();

      // After reset, svg should have no node elements
      await expect(bst.nodeLocator).toHaveCount(0);
      expect(await bst.svgHasChildren()).toBe(false);

      // Input should be cleared
      const inputValue = await page.locator('#valueInput').inputValue();
      expect(inputValue).toBe('');
    });

    test('After reset, deleting a value results in "Value not found" alert (edge case on empty tree)', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Reset first
      await bst.clickReset();
      await expect(bst.nodeLocator).toHaveCount(0);

      // Try deleting a value when tree is empty
      await bst.fillInput(10);
      await bst.clickDelete();

      // Should alert "Value not found in the BST."
      expect(dialogs.some(msg => /not found/i.test(msg))).toBe(true);
    });
  });

  test.describe('Edge cases & input validation', () => {
    test('Trying to Insert, Delete or Search with empty or invalid input shows validation alert', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Ensure input is empty
      await bst.clearInput();

      // Click Insert with empty input
      await bst.clickInsert();
      // Click Delete with empty input
      await bst.clickDelete();
      // Click Search with empty input
      await bst.clickSearch();

      // We should have seen three validation alerts; at minimum at least one with "Please enter a valid integer."
      expect(dialogs.some(msg => /Please enter a valid integer/i.test(msg))).toBe(true);

      // Tree should not be modified by these invalid attempts - count remains initial 7
      await expect(bst.nodeLocator).toHaveCount(7);
    });
  });

  test.describe('Console and runtime observations', () => {
    test('No unexpected page errors are logged to the console during interactions', async ({ page }) => {
      const bst = new BSTPage(page);
      await bst.goto();

      // Perform a sequence of typical interactions
      await bst.fillInput(33);
      await bst.clickInsert();
      await bst.fillInput(33);
      await bst.clickDelete();
      await bst.fillInput(60);
      await bst.clickSearch();
      await bst.clickReset();

      // Wait a moment to ensure any async page errors (if any) surface
      await page.waitForTimeout(200);

      // Validate there were no uncaught page errors (this is asserted again in afterEach)
      expect(pageErrors.length, 'Expected no uncaught page errors').toBe(0);

      // Inspect console messages for errors/warnings
      const errorLike = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      // Ideally there should be none. We assert no error or warning console messages were emitted.
      expect(errorLike.length, `Console errors/warnings: ${JSON.stringify(errorLike, null, 2)}`).toBe(0);
    });
  });
});