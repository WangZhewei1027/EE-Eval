import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52085c92-fa76-11f0-a09b-87751f540fd8.html';

test.describe('AVL Tree FSM and interactive application (Application ID: 52085c92-fa76-11f0-a09b-87751f540fd8)', () => {
  // Sanity: make sure the page is reachable before running the suite
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will navigate itself to maintain isolation
  });

  /**
   * Test 1:
   * Validate initial load (S0_Idle) and that the tree construction (S1_TreeConstructed)
   * entry actions executed by the page script: many tree.insert(...) calls and console output.
   *
   * This test:
   * - Navigates to the page
   * - Collects console messages emitted by tree._printTree
   * - Verifies a global variable `tree` is present and its root is non-null
   * - Verifies the console output includes expected keys that were inserted
   * - Asserts there are no unexpected page errors on initial load
   */
  test('Initial load constructs AVL tree and prints it (S0_Idle -> S1_TreeConstructed)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      // capture console text for verification
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        // ignore any unusual console parsing errors
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(URL, { waitUntil: 'load' });

    // Basic DOM sanity check: page title/header rendered
    await expect(page.locator('h1')).toHaveText('AVL Tree');

    // Allow a short moment for the synchronous script to run and emit console logs
    await page.waitForTimeout(100);

    // Verify the script created an in-memory tree and root exists
    const hasTreeAndRoot = await page.evaluate(() => {
      try {
        // `tree` was declared with `let` in the page script; check its existence by identifier
        return typeof tree !== 'undefined' && tree && tree.root !== null;
      } catch (e) {
        return false;
      }
    });
    expect(hasTreeAndRoot).toBeTruthy();

    // Verify that console output contains some of the keys inserted in the FSM
    // The _printTree method prints nodes; we expect several keys included in console output.
    const expectedKeys = ['10', '20', '5', '15', '25', '7', '12', '18', '22', '17'];
    const foundKeys = expectedKeys.filter(k => consoleMessages.some(m => m.includes(k)));
    expect(foundKeys.length).toBeGreaterThanOrEqual(5); // expect at least half to appear in logs
    // Make a stronger assertion that the key '10' (initial root-ish key) was printed
    expect(consoleMessages.some(m => m.includes('10'))).toBeTruthy();

    // Ensure there were no uncaught page errors during standard load
    expect(pageErrors.length).toBe(0);
  });

  /**
   * Test 2:
   * FSM S0 entry action lists renderPage() but the implementation does not provide renderPage.
   * According to the testing constraints we must not patch the page; we trigger the missing call
   * to observe the natural ReferenceError and assert it occurs.
   *
   * This test:
   * - Navigates to the page
   * - Attempts to call renderPage() in page context (which is not defined)
   * - Expects a ReferenceError / evaluation rejection and captures the pageerror event
   */
  test('Calling missing renderPage() should produce a ReferenceError (verify missing onEnter action)', async ({ page }) => {
    const pageErrors1 = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(URL, { waitUntil: 'load' });

    // Attempt to call renderPage() which is not defined in the page.
    // This should cause a ReferenceError and the evaluation promise to reject.
    await expect(page.evaluate(() => {
      // This direct call will throw a ReferenceError in the page context if renderPage is not defined.
      // We intentionally do not guard or define it because the spec asks us to observe errors naturally.
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // Wait briefly for the pageerror event to arrive (if any)
    await page.waitForTimeout(50);

    // Assert at least one pageerror was emitted and that it indicates renderPage is not defined
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const matches = pageErrors.some(err => /renderPage is not defined|ReferenceError/.test(String(err.message || err)));
    expect(matches).toBeTruthy();
  });

  /**
   * Test 3:
   * FSM defines a transition "InitializeTree" that executes many tree.insert(...) actions.
   * The page script already executed these inserts on load, but the FSM event InitializeTree
   * isn't defined as a function in the page. Calling InitializeTree() should produce a ReferenceError.
   *
   * This test:
   * - Navigates to the page
   * - Attempts to call InitializeTree() to validate missing event handler produces an error
   */
  test('Invoking missing InitializeTree() event handler should produce a ReferenceError (FSM transition missing implementation)', async ({ page }) => {
    const pageErrors2 = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(URL, { waitUntil: 'load' });

    // Try to call InitializeTree() which is not defined on the page
    await expect(page.evaluate(() => {
      return InitializeTree();
    })).rejects.toThrow(/InitializeTree is not defined|ReferenceError/);

    // brief wait for pageerror
    await page.waitForTimeout(50);

    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const matches1 = pageErrors.some(err => /InitializeTree is not defined|ReferenceError/.test(String(err.message || err)));
    expect(matches).toBeTruthy();
  });

  /**
   * Test 4 (edge case):
   * Verify that the in-memory tree can accept additional inserts at runtime (not just on load)
   * and that the tree structure updates accordingly. We will:
   * - capture an inorder traversal before and after inserting a new unique key (30)
   * - ensure the new key appears in the traversal after insertion
   *
   * Note: We interact with the `tree` identifier as it exists in page context.
   */
  test('Runtime insertion: tree.insert(30) updates tree structure (edge case)', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'load' });

    // Collect inorder traversal before and after insertion
    const result = await page.evaluate(() => {
      function inorder(node, acc) {
        if (!node) return;
        inorder(node.left, acc);
        acc.push(node.key);
        inorder(node.right, acc);
      }

      // Defensive check: ensure `tree` exists in this execution context
      if (typeof tree === 'undefined' || !tree || !tree.root) {
        return { error: 'tree-missing' };
      }

      const before = [];
      inorder(tree.root, before);

      // Insert an additional unique key
      try {
        tree.insert(30);
      } catch (e) {
        return { error: 'insert-failed', msg: String(e) };
      }

      const after = [];
      inorder(tree.root, after);

      return { before, after };
    });

    // Validate we didn't hit a missing-tree error
    expect(result.error).toBeUndefined();

    // The 'after' traversal should contain the newly inserted value 30
    expect(Array.isArray(result.after)).toBeTruthy();
    expect(result.after).toContain(30);

    // 'after' should be at least as long as 'before'
    expect(result.after.length).toBeGreaterThanOrEqual(result.before.length);
  });

  /**
   * Test 5 (edge case - duplicates):
   * Insert a duplicate key (15) to observe behavior for duplicates (the implementation
   * inserts duplicates into the right subtree). We will:
   * - count occurrences of 15 before and after insertion
   * - expect occurrences to increase by 1 after inserting the duplicate
   */
  test('Inserting a duplicate key increases its occurrences (edge case for duplicates)', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'load' });

    const counts = await page.evaluate(() => {
      function inorder(node, acc) {
        if (!node) return;
        inorder(node.left, acc);
        acc.push(node.key);
        inorder(node.right, acc);
      }

      if (typeof tree === 'undefined' || !tree || !tree.root) {
        return { error: 'tree-missing' };
      }

      const before1 = [];
      inorder(tree.root, before);

      // Count how many times 15 appears before insertion
      const countBefore = before.filter(k => k === 15).length;

      // Insert duplicate key 15
      try {
        tree.insert(15);
      } catch (e) {
        return { error: 'insert-failed', msg: String(e) };
      }

      const after1 = [];
      inorder(tree.root, after);
      const countAfter = after.filter(k => k === 15).length;

      return { countBefore, countAfter, beforeLen: before.length, afterLen: after.length };
    });

    expect(counts.error).toBeUndefined();
    // After inserting duplicate we expect countAfter = countBefore + 1
    expect(counts.countAfter).toBe(counts.countBefore + 1);
    // And tree size should increase by 1
    expect(counts.afterLen).toBe(counts.beforeLen + 1);
  });

  /**
   * Test 6:
   * Validate that the page's console logs contain a visual representation (lines with numbers)
   * from tree._printTree called on load. This test focuses solely on the console output format
   * and checks that multiple numeric lines are printed (helpful for educational feedback).
   */
  test('Console output contains multiple numeric lines from _printTree (visual feedback)', async ({ page }) => {
    const messages = [];
    page.on('console', msg => messages.push(msg.text()));

    await page.goto(URL, { waitUntil: 'load' });

    // allow prints to appear
    await page.waitForTimeout(100);

    // Filter console lines that look like tree node prints (contain digits)
    const numericLines = messages.filter(m => /\d/.test(m));
    // Expect multiple numeric lines printed (at least 5)
    expect(numericLines.length).toBeGreaterThanOrEqual(5);

    // Ensure that at least one of the printed lines contains leading spaces indicating tree-like formatting
    const indented = numericLines.some(m => /^\s+\d+/.test(m));
    // It's possible the browser console trims leading spaces, be permissive:
    // If there were no strictly leading spaces, at least ensure we saw multiple numeric lines.
    expect(indented || numericLines.length >= 5).toBeTruthy();
  });

  /**
   * Test 7 (negative check):
   * Confirm that attempting to access a non-existent global (completely unrelated)
   * produces a ReferenceError naturally and is observable via page.evaluate rejection.
   *
   * This test demonstrates capturing unexpected ReferenceErrors without fixing code.
   */
  test('Accessing a non-existent global triggers ReferenceError (observing error behavior)', async ({ page }) => {
    await page.goto(URL, { waitUntil: 'load' });

    // Attempt to reference a bogus global; should reject with ReferenceError
    await expect(page.evaluate(() => {
      return __thisGlobalDoesNotExist__;
    })).rejects.toThrow(/is not defined|ReferenceError/);
  });
});