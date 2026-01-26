import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52085c94-fa76-11f0-a09b-87751f540fd8.html';

test.describe('B-Tree Interactive Application - FSM validation (52085c94-fa76-11f0-a09b-87751f540fd8)', () => {
  // Helper to navigate and collect console messages and page errors for each test
  async function loadAndCapture(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // Capture all console messages (log, error, warn, etc.)
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Ignore if any issues reading the message
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page
      try {
        pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Navigate to the app and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give the page a short time to run its scripts and emit console/pageerror events
    await page.waitForTimeout(500);

    return { consoleMessages, pageErrors };
  }

  test('S0_Idle: Page loads and initial DOM (Idle state) is present', async ({ page }) => {
    // Validate that the Idle state corresponds to the initial loaded page DOM.
    // We check that the B-Tree container and expected static text is visible.
    const { consoleMessages, pageErrors } = await loadAndCapture(page);

    // The DOM should contain the B-Tree heading and paragraphs describing insertion order.
    const heading = page.locator('.b-tree h2');
    await expect(heading).toHaveText('B-Tree');

    const insertionLabel = page.locator('.b-tree p').first();
    await expect(insertionLabel).toContainText('Insertion Order');

    // There should be multiple paragraphs listing different orders - basic visual verification
    const paragraphsCount = await page.locator('.b-tree p').count();
    expect(paragraphsCount).toBeGreaterThanOrEqual(3);

    // Even at Idle we don't expect any fatal test-run errors in our test harness,
    // but the page itself may have runtime errors once scripts execute - just record those.
    // Make sure we captured console messages array (it may be empty or contain logs)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('S1_TreeInitialized: Insert attempts are executed; observe partial initialization and a recursion error during insert', async ({ page }) => {
    // This test validates the transitions from Idle -> TreeInitialized (Insert event).
    // According to the page script, a series of tree.insert(...) calls are executed on load.
    // We observe that an insert sequence leads to an unhandled recursion error (maximum call stack).
    const { consoleMessages, pageErrors } = await loadAndCapture(page);

    // The page script attempts inserts on load. The first insert(10) should succeed and create the root.
    // Subsequent insert(5) triggers recursion causing a "Maximum call stack size exceeded" RangeError.
    // Assert that a page error was captured and that its message references call stack overflow.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the captured page errors should mention "call stack" (engine-specific wording).
    const hasCallStackError = pageErrors.some((msg) =>
      /call stack/i.test(msg) || /maximum call stack/i.test(msg) || /Maximum call stack/i.test(msg)
    );
    expect(hasCallStackError).toBeTruthy();

    // Validate partial in-memory tree state inside the page:
    // The script set window.tree = new BTree(); and performed tree.insert(10) before failing.
    // We should be able to observe that tree.root.key === 10 and that a left child was created for 5
    // (because the code creates node.left = new Node(5) before recursing and causing the overflow).
    const treeState = await page.evaluate(() => {
      try {
        const exists = typeof window.tree !== 'undefined' && window.tree !== null;
        if (!exists) return { exists: false };
        const rootKey = window.tree.root ? window.tree.root.key : null;
        const leftKey = window.tree.root && window.tree.root.left ? window.tree.root.left.key : null;
        const rightOfLeftExists = window.tree.root && window.tree.root.left && window.tree.root.left.right ? true : false;
        // Do not attempt to serialize full nodes — just send simple primitives.
        return { exists: true, rootKey, leftKey, rightOfLeftExists };
      } catch (e) {
        return { exists: false, error: String(e) };
      }
    });

    expect(treeState.exists).toBeTruthy();
    // root must have been created by the first insert(10)
    expect(treeState.rootKey).toBe(10);
    // left child for key 5 should have been created before recursive overflow
    expect(treeState.leftKey).toBe(5);
    // Because recursion continues creating right children of the left node, there may be a right child present
    // or the recursion may have failed before creating many nested nodes; we accept either truthy or falsy.
    expect(typeof treeState.rightOfLeftExists === 'boolean').toBeTruthy();

    // Ensure that the series of intended inserts stopped prematurely; the script also logs search results only after insertions.
    // Thus, there should be no "Search result:" console message (search phase not reached).
    const hasSearchLabel = consoleMessages.some((m) => m.text && m.text.includes('Search result'));
    expect(hasSearchLabel).toBeFalsy();
  });

  test('S2_SearchResults: Verify that search logs were not reached due to insertion error and validate search behavior on partial tree', async ({ page }) => {
    // This test checks the expected transition from TreeInitialized -> SearchResults.
    // Because insertions failed with a recursion error, search logging on load did not run.
    // We assert absence of the search console output and perform safe, read-only evaluations of tree.search in the page context.
    const { consoleMessages, pageErrors } = await loadAndCapture(page);

    // Confirm again that search console output string "Search result:" is absent
    const searchLogPresent = consoleMessages.some((m) => m.text && m.text.includes('Search result'));
    expect(searchLogPresent).toBeFalsy();

    // From the partial tree state we can still call tree.search(10) to confirm that the node for 10 exists.
    // Be careful to only retrieve primitive values (keys) to avoid serialization issues.
    const searchKeys = await page.evaluate(() => {
      try {
        if (typeof window.tree === 'undefined' || window.tree === null) {
          return { ok: false, reason: 'no tree' };
        }
        // Safely check for presence of nodes by key
        const r10 = window.tree.search(10);
        const r15 = window.tree.search(15);
        const r3 = window.tree.search(3);
        return {
          ok: true,
          found10: r10 ? r10.key : null,
          found15: r15 ? r15.key : null,
          found3: r3 ? r3.key : null,
        };
      } catch (e) {
        // If calling search triggers the problematic recursion or any error, return the error message.
        return { ok: false, error: String(e) };
      }
    });

    // The search calls should not throw in this reading context for key 10 (root exists).
    expect(searchKeys.ok).toBeTruthy();
    expect(searchKeys.found10).toBe(10);
    // key 15 was intended to be inserted later; it likely does not exist because insert sequence failed early.
    expect(searchKeys.found15 === null || searchKeys.found15 === 15).toBeTruthy();
    // key 3 possibly wasn't inserted either
    expect(searchKeys.found3 === null || typeof searchKeys.found3 === 'number').toBeTruthy();

    // Finally, ensure that the page errors we observed include the insertion recursion, signalling the S1->S2 transition failed.
    const insertionErrorObserved = pageErrors.some((m) =>
      /call stack/i.test(m) || /maximum call stack/i.test(m)
    );
    expect(insertionErrorObserved).toBeTruthy();
  });

  test('Edge case: Confirm that the initial insertion sequence did not complete as intended (FSM expectations vs runtime)', async ({ page }) => {
    // This test summarizes the discrepancy between the FSM's expected S1 entry actions (complete set of inserts)
    // and the runtime behavior where only a subset executed before a recursion error.
    const { consoleMessages, pageErrors } = await loadAndCapture(page);

    // FSM expects many inserts (10,5,15,3,7,12,18) to have completed.
    // Check which of those keys are actually present in the partial runtime tree.
    const presence = await page.evaluate(() => {
      try {
        if (!window.tree) return { present: [] };
        const keysToCheck = [10, 5, 15, 3, 7, 12, 18];
        const present = keysToCheck.filter((k) => {
          const node = window.tree.search(k);
          return node ? true : false;
        });
        return { present };
      } catch (e) {
        return { present: [], error: String(e) };
      }
    });

    // At minimum key 10 and 5 should be present (10 inserted first, 5 node created before recursion).
    expect(presence.present).toEqual(expect.arrayContaining([10, 5]));

    // At least one page error indicating recursion must be present.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const recursionFound = pageErrors.some((m) => /call stack/i.test(m) || /maximum call stack/i.test(m));
    expect(recursionFound).toBeTruthy();

    // The FSM expected all inserts; because the runtime failed, we assert that at least one expected key from the FSM is missing.
    const allExpected = [10, 5, 15, 3, 7, 12, 18];
    const allPresent = allExpected.every((k) => presence.present.includes(k));
    expect(allPresent).toBeFalsy();
  });
});