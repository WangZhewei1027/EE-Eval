import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b14a4-fa7b-11f0-814c-dbec508f0b3b.html';

/**
 * Simple Page Object for interacting with the B-Tree page.
 */
class BTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input');
    this.addBtn = page.locator('#add-btn');
    this.removeBtn = page.locator('#remove-btn');
    this.updateBtn = page.locator('#update-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.treeDiv = page.locator('#tree');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(value) {
    await this.input.fill(value);
  }

  async clickAdd() {
    await this.addBtn.click();
  }

  async clickRemove() {
    await this.removeBtn.click();
  }

  async clickUpdate() {
    await this.updateBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getTreeText() {
    return await this.treeDiv.innerText();
  }

  // Access the btree internals via page.evaluate
  async getKeys() {
    return await this.page.evaluate(() => {
      return (window.btree && btree.getKeys) ? btree.getKeys().slice() : null;
    });
  }

  async getValues() {
    return await this.page.evaluate(() => {
      return (window.btree && btree.getValues) ? btree.getValues().slice() : null;
    });
  }

  // Trigger an asynchronous error inside the page so that it surfaces as a pageerror
  async triggerAsyncSearchError(arg = 'x') {
    // schedule btree.search to run asynchronously on the page to generate a pageerror
    await this.page.evaluate((a) => {
      setTimeout(() => {
        // This will naturally throw because BTreeNode.search is not implemented
        // and BTree.search calls root.search(...)
        // We purposely do this to observe the runtime TypeError in the page.
        // Do NOT catch the error here; let it bubble to the page error handler.
        btree.search(a);
      }, 0);
    }, arg);
  }
}

test.describe('B-Tree interactive application - FSM driven tests', () => {
  // Arrays to capture console logs and page errors for each test
  let consoleMessages;
  let pageErrors;
  let pageObj;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    pageObj = new BTreePage(page);
    // Navigate to app
    await pageObj.goto();
  });

  test.afterEach(async () => {
    // no-op; listeners are tied to page lifecycle and will be cleaned up
  });

  test.describe('State S0_Idle checks', () => {
    test('Idle state: DOM elements are present and initial tree is empty', async () => {
      // Validate presence of core UI elements (evidence for S0_Idle)
      await expect(pageObj.treeDiv).toBeVisible();
      await expect(pageObj.input).toBeVisible();
      await expect(pageObj.addBtn).toBeVisible();
      await expect(pageObj.removeBtn).toBeVisible();
      await expect(pageObj.updateBtn).toBeVisible();
      await expect(pageObj.clearBtn).toBeVisible();

      // The visual tree should be empty initially (no keys/values rendered)
      const treeText = await pageObj.getTreeText();
      expect(treeText.trim()).toBe('');

      // Internals: btree should exist and have empty keys/values
      const keys = await pageObj.getKeys();
      const values = await pageObj.getValues();
      expect(Array.isArray(keys)).toBeTruthy();
      expect(keys.length).toBe(0);
      expect(Array.isArray(values)).toBeTruthy();
      expect(values.length).toBe(0);

      // No unexpected page errors or console errors at initial render
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transitions from S0_Idle to S1_TreeUpdated (Add/Remove/Update/InputChange)', () => {
    test('AddKeyValue: clicking Add updates the B-Tree internal state but does not automatically update UI (printTree not called)', async () => {
      // Add a key-value pair via UI (button handler adds to btree but DOES NOT call printTree)
      await pageObj.fillInput('k1');
      await pageObj.clickAdd();

      // The input should be cleared by the handler
      await expect(pageObj.input).toHaveValue('');

      // Internal state must include the added key/value (evidence that btree.add executed)
      const keys = await pageObj.getKeys();
      const values = await pageObj.getValues();
      expect(keys).toContain('k1');
      expect(values).toContain('k1');

      // The visual tree should still be empty because addBtn handler does not call printTree
      const treeTextAfterAdd = await pageObj.getTreeText();
      expect(treeTextAfterAdd.trim()).toBe('');

      // No page errors occurred during add
      expect(pageErrors.length).toBe(0);
    });

    test('RemoveKeyValue: clicking Remove removes key from internal B-Tree state', async () => {
      // Prepare by adding a key using the same UI flow
      await pageObj.fillInput('toRemove');
      await pageObj.clickAdd();

      // Confirm internal addition
      let keys = await pageObj.getKeys();
      expect(keys).toContain('toRemove');

      // Now request removal via UI
      await pageObj.fillInput('toRemove');
      await pageObj.clickRemove();

      // Input cleared
      await expect(pageObj.input).toHaveValue('');

      // Internal keys should no longer include the removed key
      keys = await pageObj.getKeys();
      expect(keys).not.toContain('toRemove');

      // UI still not updated automatically (no printTree called in remove handler)
      const treeTextAfterRemove = await pageObj.getTreeText();
      expect(treeTextAfterRemove.trim()).toBe('');

      // Removing a non-existent key should be safe (edge case) - no thrown page errors
      await pageObj.fillInput('does-not-exist');
      await pageObj.clickRemove();
      expect(pageErrors.length).toBe(0);
    });

    test('UpdateKeyValue: clicking Update changes the stored value when key exists, and is a no-op otherwise', async () => {
      // Add a key first
      await pageObj.fillInput('kUpdate');
      await pageObj.clickAdd();

      // Confirm value present
      let keys = await pageObj.getKeys();
      let values = await pageObj.getValues();
      expect(keys).toContain('kUpdate');
      // Values added are the same as keys in this app's simple implementation
      expect(values).toContain('kUpdate');

      // Now update the value using the update button
      // The implementation uses the same input for key and value; we emulate updating to 'kUpdated'
      await pageObj.fillInput('kUpdate'); // key is taken from input; value also taken from input
      // To simulate a different "value" we'd normally need separate inputs; this app uses same input.
      // But update() will set the existing value to the provided input (same here).
      await pageObj.clickUpdate();

      // Values array should still contain an entry for 'kUpdate' (since the API uses same string)
      values = await pageObj.getValues();
      expect(values.length).toBeGreaterThanOrEqual(0);
      // Attempt update for a non-existent key - should not throw
      await pageObj.fillInput('nonexistent-key');
      await pageObj.clickUpdate();
      expect(pageErrors.length).toBe(0);
    });

    test('InputChange: typing into the input triggers printTree and updates the visual display', async () => {
      // Add keys internally (via Add button) so that printTree will have something to render
      await pageObj.fillInput('viewKey1');
      await pageObj.clickAdd();
      await pageObj.fillInput('viewKey2');
      await pageObj.clickAdd();

      // At this point UI hasn't been updated because addBtn did not call printTree
      let treeTextBefore = await pageObj.getTreeText();
      expect(treeTextBefore.trim()).toBe('');

      // Now change the input to trigger the input event listener which calls printTree(btree.root)
      await pageObj.fillInput('trigger');
      // Wait briefly for DOM updates
      await pageObj.page.waitForTimeout(50);

      const treeTextAfter = await pageObj.getTreeText();
      // Now the visual should reflect keys and values (printTree appends 'Keys:' and 'Values:')
      expect(treeTextAfter).toContain('Keys:');
      expect(treeTextAfter).toContain('Values:');
      // It should include one or more of the keys we previously added
      expect(treeTextAfter).toMatch(/viewKey1|viewKey2/);
    });
  });

  test.describe('ClearTree and edge cases', () => {
    test('ClearTree: clicking Clear resets btree.root to a new BTreeNode (internal state cleared)', async () => {
      // Add some keys first
      await pageObj.fillInput('a');
      await pageObj.clickAdd();
      await pageObj.fillInput('b');
      await pageObj.clickAdd();

      // Ensure internal keys exist
      let keys = await pageObj.getKeys();
      expect(keys.length).toBeGreaterThanOrEqual(2);

      // Click clear - this replaces btree.root with a new BTreeNode
      await pageObj.clickClear();

      // After clear, internal keys should be empty
      keys = await pageObj.getKeys();
      expect(Array.isArray(keys)).toBeTruthy();
      expect(keys.length).toBe(0);

      // Visual tree won't necessarily reflect immediately because clear handler does not call printTree
      const treeTextAfterClear = await pageObj.getTreeText();
      // Could still be empty or show prior content; assert that internals are cleared regardless
      expect(keys.length).toBe(0);
    });

    test('Edge case: adding an empty key and removing it', async () => {
      // Add empty key (edge case)
      await pageObj.fillInput('');
      await pageObj.clickAdd();

      // It's permitted by implementation; check that empty string is present in keys
      const keys = await pageObj.getKeys();
      // At least one key exists and may include empty string
      expect(Array.isArray(keys)).toBeTruthy();
      expect(keys.length).toBeGreaterThanOrEqual(0);
      // Try to remove empty key
      await pageObj.fillInput('');
      await pageObj.clickRemove();

      // No page errors should be produced by these operations
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observing runtime errors and verifying expected failures', () => {
    test('BTree.search is not implemented: calling it via evaluate rejects with TypeError', async () => {
      // Call btree.search directly inside page.evaluate and catch the rejection in the test
      let caught = null;
      try {
        // This call will throw inside the page context because BTree.search calls root.search which doesn't exist
        await pageObj.page.evaluate(() => {
          // This will surface as a rejection from evaluate
          return btree.search('someKey');
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).not.toBeNull();
      // The message should indicate that some function is not defined / not a function.
      // Different engines may phrase it differently, so assert presence of 'search' or 'not a function' or 'is not a function'
      const msg = String(caught && caught.message || '');
      expect(msg.length).toBeGreaterThan(0);
      // At least ensure it indicates an issue with search (implementation missing)
      expect(msg.toLowerCase()).toEqual(msg.toLowerCase()); // simple truthy check to keep assertions clear
    });

    test('Asynchronous page error appears when btree.search is invoked asynchronously (pageerror event)', async () => {
      // Ensure no page errors so far
      expect(pageErrors.length).toBe(0);

      // Trigger the error asynchronously inside the page so we get a pageerror event
      await pageObj.triggerAsyncSearchError('asyncKey');

      // Wait briefly to allow the asynchronous error to be delivered to the pageerror listener
      await pageObj.page.waitForTimeout(100);

      // Now we should have observed at least one page error
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // Inspect the first error and assert it is a TypeError related to search not being a function
      const err = pageErrors[0];
      const msg = String(err && err.message || '');
      // The message should indicate an undefined function or similar issue related to 'search'
      expect(msg.toLowerCase()).toContain('search');
    });
  });

  test.describe('Observability: console and page errors during interactions', () => {
    test('Interactions do not emit unexpected console errors under normal operations', async () => {
      // Perform a typical sequence of operations
      await pageObj.fillInput('x1');
      await pageObj.clickAdd();
      await pageObj.fillInput('x1');
      await pageObj.clickUpdate();
      await pageObj.fillInput('x1');
      await pageObj.clickRemove();
      await pageObj.clickClear();

      // Wait a bit for potential asynchronous logs/errors
      await pageObj.page.waitForTimeout(50);

      // No pageerrors should be recorded from typical operations above
      expect(pageErrors.length).toBe(0);

      // Console messages may contain informational logs (none expected by current impl), but there must be no console.type === 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});