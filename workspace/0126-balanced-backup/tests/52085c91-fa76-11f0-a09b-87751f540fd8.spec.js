import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52085c91-fa76-11f0-a09b-87751f540fd8.html';

// Comprehensive Playwright tests for the Binary Search Tree interactive application.
// Filename requirement: 52085c91-fa76-11f0-a09b-87751f540fd8.spec.js

test.describe('52085c91-fa76-11f0-a09b-87751f540fd8 - Binary Search Tree FSM and Implementation', () => {
  // Each test gets a fresh page fixture from Playwright.
  // We navigate to the page in beforeEach so that each test observes the page load and any runtime errors independently.
  test.beforeEach(async ({ page }) => {
    // Collect console and page errors to make assertions later if needed.
    page.context()._collectedConsole = [];
    page.on('console', (msg) => {
      try {
        page.context()._collectedConsole.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore any console introspection errors
      }
    });
    page.context()._collectedPageErrors = [];
    page.on('pageerror', (err) => {
      // Store the Error object for more flexible assertions
      page.context()._collectedPageErrors.push(err);
    });

    // Navigate to the application page (exact URL provided by the task).
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Test 1: Validate that the script throws a TypeError during inorder traversal.
  test('Script runtime error occurs during inorder traversal (expected TypeError)', async ({ page }) => {
    // The implementation's inorder() attempts to read .key from root.left or root.right without null checks.
    // This should produce a runtime TypeError. We wait for a pageerror event.
    const pageError = await page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    expect(pageError, 'Expected a page runtime error (TypeError) but none was thrown').not.toBeNull();

    // Confirm the error message indicates an attempt to read .key of null/undefined.
    // Different browsers/engines produce different messages, so use a permissive regex.
    const message = pageError ? String(pageError.message || pageError) : '';
    const expectedRegex = /(Cannot read (?:property|properties) 'key' of null)|(Cannot read properties of null \(reading 'key'\))|(Cannot read property 'key' of null)|(reading 'key')/i;
    expect(message).toMatch(expectedRegex);

    // The DOM update for the tree should be incomplete because the error occurs during inorder traversal.
    const treeHtml = await page.locator('#tree').innerHTML();
    // We expect the traversal to have failed early, so the tree container should not contain the full inorder output.
    // It might be empty or partially filled depending on execution timing; assert it does NOT contain a valid "Key: 5" line.
    expect(treeHtml.includes('Key: 5')).toBeFalsy();
  });

  // Test 2: Verify that the source script contains the FSM evidence lines (insert, inorder, search, delete).
  test('Script source contains evidence of Insert, Inorder, Search, and Delete operations', async ({ page }) => {
    // Retrieve the inline script text (the page uses a single script block).
    const scriptText = await page.locator('script').nth(0).textContent();
    expect(scriptText).toBeTruthy();

    // Check for insertion loop evidence.
    expect(scriptText).toContain('for (let i = 0; i < 10; i++)');
    expect(scriptText).toContain('root = insert(root, i);');

    // Check for inorder traversal call evidence.
    expect(scriptText).toContain('inorder(root);');

    // Check for search evidence.
    expect(scriptText).toContain('let found = search(root, 5);');

    // Check for deletion evidence.
    expect(scriptText).toContain('root = deleteNode(root, 5);');

    // Also assert the specific problematic lines are present (to validate edge cases described in FSM extraction).
    expect(scriptText).toContain('root.left.key');
    expect(scriptText).toContain('root.right.key');
    expect(scriptText).toContain('root.right.length');
    expect(scriptText).toContain('root.right[i].key');
  });

  // Test 3: Validate that core functions (insert, search, deleteNode, inorder) are defined on the page.
  test('Core BST functions are defined (insert, search, deleteNode, inorder)', async ({ page }) => {
    // Evaluate types of the functions from the page context.
    const types = await page.evaluate(() => {
      return {
        insert: typeof window.insert,
        search: typeof window.search,
        deleteNode: typeof window.deleteNode,
        inorder: typeof window.inorder
      };
    });

    expect(types.insert).toBe('function');
    expect(types.search).toBe('function');
    expect(types.deleteNode).toBe('function');
    expect(types.inorder).toBe('function');
  });

  // Test 4: Validate that the insertion transition occurred by inspecting the in-memory root structure.
  // We do not modify or patch any code; we only read the existing global "root" built by the page script.
  test('InsertKey transition evidence: root contains keys 0 through 9 in BST ordering', async ({ page }) => {
    // The script builds the tree via for loop before the inorder error, so root should exist and contain all keys.
    const inorderKeys = await page.evaluate(() => {
      // Safe traversal that does not rely on page's broken inorder implementation.
      // We only read the object graph produced by the insertion loop.
      function safeTraverse(root) {
        const result = [];
        function trav(node) {
          if (!node) return;
          trav(node.left);
          // Only push node.key if it exists
          result.push(node.key);
          trav(node.right);
        }
        // Access the global root variable defined by the page; may be null or a Node object.
        try {
          trav(window.root);
        } catch (e) {
          // If traversal fails, return what we've gathered so far.
        }
        return result;
      }
      return safeTraverse(window.root);
    });

    // Ensure the tree contains 10 keys (0..9) in ascending order as expected from repeated insert of 0..9 into BST.
    expect(Array.isArray(inorderKeys)).toBeTruthy();
    expect(inorderKeys.length).toBe(10);
    expect(inorderKeys).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });

  // Test 5: Verify that the search and delete operations were present in the script but did not produce DOM output due to the runtime error.
  test('SearchKey and DeleteKey evidence present but their outputs are absent due to earlier error', async ({ page }) => {
    // The script contains 'let found = search(root, 5);' and writes to DOM if found.
    // Because the runtime error likely happened during inorder, the search and deletion code likely did not complete.
    // We assert the variable 'found' is NOT present as a global property (top-level let not executed) and the DOM does not show a successful search line.
    const windowFoundType = await page.evaluate(() => {
      // We must not reference "found" directly as it may not be declared/executed and could throw in some engines.
      return typeof window.found; // top-level let/const do not create window properties normally; this will be 'undefined'.
    });

    expect(windowFoundType).toBe('undefined');

    // Ensure no successful search output exists in the tree container (no "Key: 5" extra line).
    const treeHtml = await page.locator('#tree').innerHTML();
    expect(treeHtml.includes('Key: 5')).toBeFalsy();

    // Also ensure the "Key not found" message wasn't appended (search code likely didn't run).
    expect(treeHtml.includes('Key not found in the BST')).toBeFalsy();
  });

  // Test 6: Edge-case assertions for buggy deleteNode implementation
  test('DeleteNode implementation contains array-like operations on Node objects (edge case bug)', async ({ page }) => {
    // Confirm the script includes evidence of treating node.right as an array (bug).
    const scriptText = await page.locator('script').nth(0).textContent();
    expect(scriptText).toContain('for (let i = 0; i < root.right.length; i++)');
    expect(scriptText).toContain('if (root.right[i].key < minVal)');
    // These lines indicate the code will attempt array operations on a Node object, which is an edge case bug.
  });

  // Test 7: Collect and assert console messages and page errors for diagnostics (structured output).
  test('Collect console and page errors for diagnostics and ensure at least one pageerror was emitted', async ({ page }) => {
    // page.on handlers were set in beforeEach; we can read collected arrays from the context.
    // There may be a slight delay before the error handlers captured events, but the initial navigation triggered scripts already.
    // To be safe, wait briefly for any asynchronous console logging to settle.
    await page.waitForTimeout(200);

    const collectedConsole = page.context()._collectedConsole || [];
    const collectedPageErrors = page.context()._collectedPageErrors || [];

    // There should be at least one pageerror captured (the TypeError from inorder).
    expect(collectedPageErrors.length).toBeGreaterThanOrEqual(1);

    // Ensure that any captured console messages (if present) are strings.
    for (const msg of collectedConsole) {
      expect(typeof msg.text).toBe('string');
      expect(['log', 'error', 'warning', 'info', 'debug', 'trace', 'dir'].includes(msg.type)).toBeTruthy();
    }
  });

  // Teardown is implicit per-test in Playwright; no explicit teardown actions required.
});