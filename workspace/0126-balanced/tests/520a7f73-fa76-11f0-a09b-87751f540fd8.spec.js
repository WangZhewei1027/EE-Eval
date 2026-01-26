import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a7f73-fa76-11f0-a09b-87751f540fd8.html';

test.describe('B-Tree Index FSM tests (Application ID: 520a7f73-fa76-11f0-a09b-87751f540fd8)', () => {

  // Helper to attach listeners and collect console messages and page errors
  async function attachListeners(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', err => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    return { consoleMessages, pageErrors };
  }

  test('S0_Idle - initial page load shows static table and runtime errors from inline script are observed', async ({ page }) => {
    // This test validates the Idle state: page loads, DOM contains the provided static table
    // and the inline script's runtime error(s) are captured via pageerror events.
    const { consoleMessages, pageErrors } = await attachListeners(page);

    // Navigate to the page under test
    await page.goto(APP_URL);

    // Verify title and heading - basic smoke checks for successful load
    await expect(page).toHaveTitle(/B-Tree Index/);
    await expect(page.locator('h1')).toHaveText('B-Tree Index');

    // Verify the static HTML table is present and contains expected static rows (header + 3 rows)
    const rows = page.locator('#tree tr');
    await expect(rows).toHaveCount(4); // 1 header row + 3 data rows

    // Verify the table contains the expected keys and values as static markup
    const cellsText = await page.locator('#tree td').allTextContents();
    // cellsText should be ['1','10','2','20','3','30']
    expect(cellsText).toEqual(['1', '10', '2', '20', '3', '30']);

    // The inline script in the page has a runtime error (this.root.insert is not a function)
    // We assert that at least one pageerror has been emitted and it is a TypeError related to missing function.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the errors should be a TypeError (implementation attempts to call node.insert which doesn't exist)
    const hasTypeError = pageErrors.some(e => e && (e.name === 'TypeError' || String(e).includes('TypeError')));
    expect(hasTypeError).toBeTruthy();

    // Also assert that the error message text references "is not a function" which is indicative of the missing method bug
    const hasIsNotFunctionMsg = pageErrors.some(e => e && String(e.message).includes('is not a function'));
    expect(hasIsNotFunctionMsg).toBeTruthy();

    // Confirm that some expected console logs from later parts of the script did NOT appear
    // (because the runtime error stops further execution). We expect not to see the 'Search result' or 'Delete 1' logs.
    const consoleTexts = consoleMessages.map(c => c.text);
    const containsSearchResultLog = consoleTexts.some(t => t.includes('Search result'));
    const containsDeleteLog = consoleTexts.some(t => t.includes('Delete 1'));
    expect(containsSearchResultLog).toBeFalsy();
    expect(containsDeleteLog).toBeFalsy();
  });

  test('S1_Insert - entry action verification: single insert on a fresh BTree works; insert on global tree throws', async ({ page }) => {
    // This test validates Insert state behavior.
    // - Creating a fresh BTree and inserting one key should set its root (onEnter action effect).
    // - Attempting to insert into the global `tree` created by the page (which already has a root) should surface the same runtime error.

    const { consoleMessages, pageErrors } = await attachListeners(page);
    await page.goto(APP_URL);

    // Create a fresh BTree instance in page context and insert a single key (should succeed).
    // We keep this local to the evaluate scope to avoid polluting global namespace.
    const freshTreeRoot = await page.evaluate(() => {
      // Create fresh tree and insert one key
      const t = new BTree();
      t.insert(42, 4242); // since tree.root === null, this should set root to new Node(42,4242)
      // Return minimal root info
      return {
        key: t.root ? t.root.key : null,
        value: t.root ? t.root.value : null,
        hasLeft: t.root ? (t.root.left !== null) : null,
        hasRight: t.root ? (t.root.right !== null) : null
      };
    });

    expect(freshTreeRoot).toEqual({
      key: 42,
      value: 4242,
      hasLeft: false,
      hasRight: false
    });

    // Now, attempt to insert into the global `tree` (created by the page script).
    // Because the page's global tree already has a root, BTree.insert will call this.root.insert(...) and throw.
    const globalInsertResult = await page.evaluate(() => {
      try {
        // Attempt to insert into the global `tree` which was created by the page.
        // This should throw inside the page context; we catch and serialize the error message.
        tree.insert(999, 9999);
        return { success: true };
      } catch (err) {
        return { success: false, name: err && err.name, message: err && err.message };
      }
    });

    expect(globalInsertResult.success).toBe(false);
    expect(globalInsertResult.message).toEqual(expect.stringContaining('is not a function'));
    expect(globalInsertResult.name).toBeDefined();

    // Confirm that the pageerror list includes a TypeError (from initial script run or this action).
    const anyTypeError = pageErrors.some(e => e && (e.name === 'TypeError' || String(e).includes('is not a function')));
    expect(anyTypeError).toBeTruthy();
  });

  test('S2_Search - search operations via provided functions and BTree.search', async ({ page }) => {
    // This test validates Search state behavior:
    // - The page defines both a global `search(node, key)` function and a BTree.search method.
    // - Because the initial script set tree.root to a Node(1,10) before failing, searching for key 1 should return 10.
    // - Searching for a missing key or searching a null node should return null.

    await page.goto(APP_URL);

    // search(tree.root, 1) should return the stored value 10
    const searchResultValue = await page.evaluate(() => {
      // The global `search` function returns node.value when found, or null when not found.
      return search(tree.root, 1);
    });
    expect(searchResultValue).toBe(10);

    // tree.search(1) should also return 10 (BTree.search delegates to searchNode and returns node.value)
    const btreeSearchValue = await page.evaluate(() => {
      return tree.search(1);
    });
    expect(btreeSearchValue).toBe(10);

    // Searching for a key that does not exist should return null
    const missingKeyResult = await page.evaluate(() => {
      return tree.search(12345);
    });
    expect(missingKeyResult).toBeNull();

    // Searching on a null node using the standalone search function should return null
    const searchOnNull = await page.evaluate(() => {
      return search(null, 1);
    });
    expect(searchOnNull).toBeNull();
  });

  test('S3_Delete - verify standalone deleteNode works; tree.delete surfaces runtime error', async ({ page }) => {
    // This test validates Delete state behavior:
    // - There is a standalone deleteNode function that performs deletion correctly on a given node.
    // - The BTree.delete method in the page attempts to call this.root.delete(...) which does not exist and should throw.

    await page.goto(APP_URL);

    // Using standalone deleteNode on the global tree.root should return null after deleting key 1
    // (the initial tree.root from the page is Node(1,10) because the first insert succeeded)
    const deleteNodeResult = await page.evaluate(() => {
      // Perform deletion on the standalone root object and return whether it becomes null
      const after = deleteNode(tree.root, 1); // deleteNode returns the new subtree root
      return { newRoot: after ? { key: after.key, value: after.value } : null };
    });

    // Expectation: deleting the only node (key 1) results in null
    expect(deleteNodeResult.newRoot).toBeNull();

    // Now attempt to call the BTree.delete method on the global tree which uses this.root.delete and will throw.
    const treeDeleteAttempt = await page.evaluate(() => {
      try {
        tree.delete(1);
        return { success: true };
      } catch (err) {
        return { success: false, name: err && err.name, message: err && err.message };
      }
    });

    expect(treeDeleteAttempt.success).toBe(false);
    expect(treeDeleteAttempt.message).toEqual(expect.stringContaining('is not a function'));
    expect(treeDeleteAttempt.name).toBeDefined();
  });

  test('Edge cases: ensure functions handle nulls and invalid input gracefully', async ({ page }) => {
    // This test explores edge cases mentioned in the FSM and implementation:
    // - search on null nodes
    // - deleteNode on null nodes
    // - findMin on a single node
    // - printTree on null should not throw (it simply returns)
    await page.goto(APP_URL);

    // search on null node
    const searchNull = await page.evaluate(() => {
      return search(null, 999);
    });
    expect(searchNull).toBeNull();

    // deleteNode on null node should return null
    const deleteNull = await page.evaluate(() => {
      return deleteNode(null, 999);
    });
    expect(deleteNull).toBeNull();

    // findMin on a single node should return that node's key/value
    const minOfSingle = await page.evaluate(() => {
      const node = new Node(7, 70);
      const min = findMin(node);
      return { key: min.key, value: min.value };
    });
    expect(minOfSingle).toEqual({ key: 7, value: 70 });

    // printTree on null should simply be a no-op; ensure it does not throw and returns undefined
    const printResult = await page.evaluate(() => {
      return printTree(null);
    });
    expect(printResult).toBeUndefined();
  });

});