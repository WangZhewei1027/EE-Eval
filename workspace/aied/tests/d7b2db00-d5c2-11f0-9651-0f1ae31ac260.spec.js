import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b2db00-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for interacting with the BST demo page
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.insertBtn = page.locator('#insertBtn');
    this.searchBtn = page.locator('#searchBtn');
    this.deleteBtn = page.locator('#deleteBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.log = page.locator('#log');
    this.svg = page.locator('#bst-svg');
  }

  // Fill the numeric input (as string)
  async fillInput(value) {
    await this.input.fill(String(value));
  }

  // Click Insert button
  async clickInsert() {
    await this.insertBtn.click();
  }

  // Click Search button
  async clickSearch() {
    await this.searchBtn.click();
  }

  // Click Delete button
  async clickDelete() {
    await this.deleteBtn.click();
  }

  // Click Clear button
  async clickClear() {
    await this.clearBtn.click();
  }

  // Press Enter while focused on the input
  async pressEnter() {
    await this.input.press('Enter');
  }

  // Get complete log text content
  async getLogText() {
    return await this.page.evaluate(() => document.getElementById('log').innerText);
  }

  // Wait until a specific message appears in the log
  async waitForLogContains(text, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, t) => {
        const el = document.querySelector(sel);
        return el && el.innerText.includes(t);
      },
      ['#log', text],
      { timeout }
    );
  }

  // Count number of node groups in the SVG (#bst-svg g.node)
  async countNodes() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('bst-svg');
      if (!svg) return 0;
      return svg.querySelectorAll('.node').length;
    });
  }

  // Check whether SVG contains the "Tree is empty" placeholder text
  async isTreeEmptyPlaceholderVisible() {
    return await this.page.evaluate(() => {
      const svg = document.getElementById('bst-svg');
      if (!svg) return false;
      return !!svg.querySelector('text') && svg.querySelector('text').textContent.includes('Tree is empty');
    });
  }

  // Check whether a node with given value exists in the SVG
  async nodeExists(value) {
    return await this.page.evaluate((v) => {
      const svg = document.getElementById('bst-svg');
      if (!svg) return false;
      // Find any <text> element with exact text === v
      const texts = Array.from(svg.querySelectorAll('text'));
      return texts.some(t => t.textContent === String(v));
    }, value);
  }

  // Check whether a node with given value is currently highlighted (has class 'highlight')
  async nodeIsHighlighted(value) {
    return await this.page.evaluate((v) => {
      const svg = document.getElementById('bst-svg');
      if (!svg) return false;
      const texts = Array.from(svg.querySelectorAll('text'));
      for (const t of texts) {
        if (t.textContent === String(v)) {
          const parent = t.parentElement;
          return parent && parent.classList.contains('highlight');
        }
      }
      return false;
    }, value);
  }
}

test.describe('BST Demo - FSM states and transitions', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Setup before each test: navigate and wire up listeners
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  // After each test assert that there were no runtime errors logged to console or page
  test.afterEach(async () => {
    // Assert there were no page-level uncaught errors
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    // Assert there were no console.error messages
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Initial Idle state: initial render and log entries', async ({ page }) => {
    // Validate initial application state corresponds to S0_Idle entry actions / evidence
    const app = new BSTPage(page);

    // The initial log should contain the initialization message
    await app.waitForLogContains('Binary Search Tree demonstration initialized.');

    // Also a guidance message is logged
    const logText = await app.getLogText();
    expect(logText).toContain('Use the input box and buttons above to insert, search, and delete nodes.');

    // SVG should show "Tree is empty" placeholder
    const isEmpty = await app.isTreeEmptyPlaceholderVisible();
    expect(isEmpty).toBeTruthy();

    // All controls should be visible and enabled initially
    await expect(app.input).toBeVisible();
    await expect(app.insertBtn).toBeEnabled();
    await expect(app.searchBtn).toBeEnabled();
    await expect(app.deleteBtn).toBeEnabled();
    await expect(app.clearBtn).toBeEnabled();
  });

  test.describe('Insert operations and duplicates', () => {
    test('Insert a value transitions to Value Inserted (S1_ValueInserted)', async ({ page }) => {
      // This validates the Insert event transition and the associated log + rendering
      const app = new BSTPage(page);

      // Insert value 10
      await app.fillInput(10);
      await app.clickInsert();

      // Expect specific log message
      await app.waitForLogContains('Inserted 10 into the BST.');

      // After insertion, the tree should contain a node with value 10
      const exists = await app.nodeExists(10);
      expect(exists).toBeTruthy();

      // Input should be cleared by the implementation after insert
      expect(await app.input.inputValue()).toBe('');
    });

    test('Insert duplicate value transitions to Value Exists (S2_ValueExists)', async ({ page }) => {
      // Insert 20, then insert 20 again to assert duplicate handling
      const app = new BSTPage(page);

      // Insert 20 first time
      await app.fillInput(20);
      await app.clickInsert();
      await app.waitForLogContains('Inserted 20 into the BST.');
      expect(await app.nodeExists(20)).toBeTruthy();

      // Insert 20 second time (duplicate)
      await app.fillInput(20);
      await app.clickInsert();
      await app.waitForLogContains('Value 20 already exists in the BST. No duplicates allowed.');

      // Ensure number of nodes for value 20 remains 1 (no duplicate nodes)
      // Count nodes overall (should be >=1). We'll ensure that a single textual node '20' exists.
      const foundOnce = await page.evaluate(() => {
        const svg = document.getElementById('bst-svg');
        const texts = Array.from(svg.querySelectorAll('text'));
        return texts.filter(t => t.textContent === '20').length === 1;
      });
      expect(foundOnce).toBeTruthy();
    });
  });

  test.describe('Search operations (found and not found)', () => {
    test('Search for existing value transitions to Value Found (S3_ValueFound) and highlights node', async ({ page }) => {
      // Insert a small tree and search for a value that exists; check highlighting animation completes
      const app = new BSTPage(page);

      // Build a little tree: root 50, left 30, right 70
      await app.fillInput(50);
      await app.clickInsert();
      await app.waitForLogContains('Inserted 50 into the BST.');
      await app.fillInput(30);
      await app.clickInsert();
      await app.waitForLogContains('Inserted 30 into the BST.');
      await app.fillInput(70);
      await app.clickInsert();
      await app.waitForLogContains('Inserted 70 into the BST.');

      // Search for 30 (exists)
      await app.fillInput(30);

      // Kick off the search
      await app.clickSearch();

      // The UI logs the searching message immediately
      await app.waitForLogContains('Searching for value 30...');

      // Wait for final "found" message which happens after the highlight animation completes
      await app.waitForLogContains('Value 30 found in the BST.', 8000);

      // Verify that the node with value 30 is highlighted at the end of animation
      // Wait a short bit to ensure highlightValue has been applied
      await page.waitForTimeout(50);
      const highlighted = await app.nodeIsHighlighted(30);
      expect(highlighted).toBeTruthy();

      // Buttons should be re-enabled by the end of search (search disables during animation)
      await expect(app.insertBtn).toBeEnabled();
      await expect(app.deleteBtn).toBeEnabled();
      await expect(app.searchBtn).toBeEnabled();
    });

    test('Search for non-existing value transitions to Value Not Found (S4_ValueNotFound)', async ({ page }) => {
      const app = new BSTPage(page);

      // Ensure tree has some nodes
      await app.fillInput(25);
      await app.clickInsert();
      await app.waitForLogContains('Inserted 25 into the BST.');

      // Search for a value we didn't insert
      await app.fillInput(9999);
      await app.clickSearch();

      await app.waitForLogContains('Searching for value 9999...');
      await app.waitForLogContains('Value 9999 NOT found in the BST.', 8000);

      // Ensure no node with that value exists
      const exists = await app.nodeExists(9999);
      expect(exists).toBeFalsy();
    });
  });

  test.describe('Delete operations', () => {
    test('Delete existing value transitions to Value Deleted (S5_ValueDeleted)', async ({ page }) => {
      const app = new BSTPage(page);

      // Insert node to delete
      await app.fillInput(200);
      await app.clickInsert();
      await app.waitForLogContains('Inserted 200 into the BST.');
      expect(await app.nodeExists(200)).toBeTruthy();

      // Delete the node
      await app.fillInput(200);
      await app.clickDelete();

      // Expect deletion log
      await app.waitForLogContains('Deleted 200 from the BST.');

      // Node should no longer exist
      expect(await app.nodeExists(200)).toBeFalsy();
    });

    test('Delete non-existing value transitions to Value Not Found for Deletion (S6_ValueNotFoundForDeletion)', async ({ page }) => {
      const app = new BSTPage(page);

      // Ensure value does not exist
      const existsBefore = await app.nodeExists(123456);
      if (existsBefore) {
        // If it unexpectedly exists, delete it first
        await app.fillInput(123456);
        await app.clickDelete();
        await app.waitForLogContains(`Deleted 123456 from the BST.`);
      }

      // Attempt to delete non-existing value
      await app.fillInput(123456);
      await app.clickDelete();

      // Expect appropriate log message
      await app.waitForLogContains('Value 123456 not found in the BST. Nothing deleted.');

      // Tree unchanged for that value
      expect(await app.nodeExists(123456)).toBeFalsy();
    });
  });

  test.describe('Clear tree operations', () => {
    test('Clear non-empty tree transitions to Tree Cleared (S7_TreeCleared) after user confirms', async ({ page }) => {
      const app = new BSTPage(page);

      // Build a small tree to ensure clear shows confirm
      await app.fillInput(1);
      await app.clickInsert();
      await app.waitForLogContains('Inserted 1 into the BST.');

      // Intercept the confirm dialog and accept it
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.clickClear(), // triggers confirm when tree is not empty
      ]);
      expect(dialog.type()).toBe('confirm');
      // Accept the confirm to clear the tree
      await dialog.accept();

      // Expect cleared log message
      await app.waitForLogContains('Cleared the entire BST.');

      // Verify the tree is now rendered as empty
      const isEmpty = await app.isTreeEmptyPlaceholderVisible();
      expect(isEmpty).toBeTruthy();
    });

    test('Clear when already empty transitions to Tree Already Empty (S8_TreeAlreadyEmpty) without prompting', async ({ page }) => {
      const app = new BSTPage(page);

      // Ensure tree is empty (clear once if needed)
      const emptyBefore = await app.isTreeEmptyPlaceholderVisible();
      if (!emptyBefore) {
        // If not empty, clear with confirm
        const [dialog] = await Promise.all([
          page.waitForEvent('dialog'),
          app.clickClear(),
        ]);
        await dialog.accept();
        await app.waitForLogContains('Cleared the entire BST.');
      }

      // Now tree is empty: clicking clear should NOT trigger a confirm dialog
      // We add a short timeout shape: waitForEvent('dialog', { timeout: 500 }) should timeout -> so we'll attempt clickClear and assert no dialog appears
      let dialogAppeared = false;
      const dialogPromise = page.waitForEvent('dialog', { timeout: 500 }).then(() => { dialogAppeared = true }).catch(() => {});
      await app.clickClear();
      await dialogPromise; // await the short wait
      expect(dialogAppeared).toBeFalsy();

      // And the log should contain the "already empty" message
      await app.waitForLogContains('Tree is already empty.');
    });
  });

  test.describe('Input and keyboard behavior, and validation alerts', () => {
    test('Press Enter in the input triggers insert (EnterKey event)', async ({ page }) => {
      const app = new BSTPage(page);

      // Use a fresh value to avoid conflicts
      await app.fillInput(77);

      // Press Enter to trigger insertion via input keydown handler
      await app.pressEnter();

      // Expect insert log and node present
      await app.waitForLogContains('Inserted 77 into the BST.');
      expect(await app.nodeExists(77)).toBeTruthy();
    });

    test('Invalid input triggers alert and insertion is not performed (edge case)', async ({ page }) => {
      const app = new BSTPage(page);

      // Provide a non-integer value that will fail validation (e.g., 3.14)
      await app.input.fill('3.14');

      // Listen for the alert dialog triggered by invalid input and accept it
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        app.clickInsert(),
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Please enter a valid integer/);
      await dialog.accept();

      // Ensure no insertion log for 3.14 appeared
      const log = await app.getLogText();
      expect(log).not.toContain('Inserted 3.14 into the BST.');
      // And no node '3.14' should exist (text nodes are integers only)
      expect(await app.nodeExists('3.14')).toBeFalsy();
    });
  });

  test('Verify there are no runtime ReferenceError/SyntaxError/TypeError occurrences during interactions', async ({ page }) => {
    // This test explicitly exercises a sequence of operations while we monitor page errors & console errors
    const app = new BSTPage(page);

    // Perform a sequence: insert a few values, search a missing value, delete a missing and an existing, clear tree
    await app.fillInput(5);
    await app.clickInsert();
    await app.waitForLogContains('Inserted 5 into the BST.');

    await app.fillInput(3);
    await app.clickInsert();
    await app.waitForLogContains('Inserted 3 into the BST.');

    await app.fillInput(99999);
    await app.clickSearch();
    await app.waitForLogContains('Searching for value 99999...');
    await app.waitForLogContains('Value 99999 NOT found in the BST.', 8000);

    // Delete an existing and a non-existing
    await app.fillInput(3);
    await app.clickDelete();
    await app.waitForLogContains('Deleted 3 from the BST.');

    await app.fillInput(1234567);
    const [alertDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.clickDelete(),
    ]);
    // delete invalid input triggers alert => because getInputNumber returns null for large out-of-range or non-integer
    // But if the implementation uses getInputNumber and returns null, delete click will alert
    // Accept alert if present
    await alertDialog.accept();

    // Finally clear the tree (confirm)
    await app.fillInput(5); // ensure a node exists
    // double-check there is a root now
    const [confirmDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      app.clickClear(),
    ]);
    await confirmDialog.accept();
    await app.waitForLogContains('Cleared the entire BST.');

    // Ensure no runtime page errors or console.error messages occurred during these interactions
    // (The afterEach will also assert this, but we explicitly check here as well)
    // The arrays consoleErrors and pageErrors are referenced from closure in beforeEach/afterEach.
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

});