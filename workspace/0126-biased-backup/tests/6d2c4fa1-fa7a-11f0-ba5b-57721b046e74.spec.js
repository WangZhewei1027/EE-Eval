import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2c4fa1-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Interactive Linked List - FSM and UI tests (Application ID: 6d2c4fa1-fa7a-11f0-ba5b-57721b046e74)', () => {
  let consoleErrors;
  let pageErrors;

  // Helper selectors used throughout tests
  const sel = {
    nodeValue: '#nodeValue',
    addToHead: "button[onclick='addToHead()']",
    addToTail: "button[onclick='addToTail()']",
    removeFromHead: "button[onclick='removeFromHead()']",
    removeFromTail: "button[onclick='removeFromTail()']",
    clearList: "button[onclick='clearList()']",
    listDisplay: '#listDisplay',
    listLength: '#listLength',
    headValue: '#headValue',
    tailValue: '#tailValue',
    operationLog: '#operationLog',
    insertPos: '#insertPos',
    insertValue: '#insertValue',
    insertBtn: "button[onclick='insertAtPosition()']",
    removePos: '#removePos',
    removeAtPosBtn: "button[onclick='removeAtPosition()']",
    searchValue: '#searchValue',
    findValueBtn: "button[onclick='findValue()']",
    findAllBtn: "button[onclick='findAllOccurrences()']",
    countBtn: "button[onclick='countOccurrences()']",
    searchResults: '#searchResults',
    reverseBtn: "button[onclick='reverseList()']",
    sortBtn: "button[onclick='sortList()']",
    removeDupBtn: "button[onclick='removeDuplicates()']",
    rotateBtn: "button[onclick='rotateList()']",
    rotateBy: '#rotateBy',
    startTraversalBtn: "button[onclick='startTraversal()']",
    stepForwardBtn: "button[onclick='stepForward()']",
    stepBackwardBtn: "button[onclick='stepBackward()']",
    stopTraversalBtn: "button[onclick='stopTraversal()']",
    traversalSpeed: '#traversalSpeed'
  };

  // Common setup: navigate to page and attach listeners for console and page errors
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure we start each test with an empty list by clicking Clear List (UI action)
    // This respects the constraint to not modify runtime globals.
    const clearButton = await page.$(sel.clearList);
    if (clearButton) {
      await clearButton.click();
      // wait for DOM update
      await page.waitForFunction(() => document.getElementById('listLength').textContent === '0');
    }
  });

  test.afterEach(async ({ page }) => {
    // In teardown ensure there are no uncaught page errors or console error messages produced during the test.
    // We assert that there were zero page errors and zero console errors of type 'error'.
    // If the app naturally produces ReferenceError/SyntaxError/TypeError these assertions will fail,
    // surface the problem, and match the directive to observe errors naturally.
    expect(pageErrors, `Unhandled page errors encountered: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `Console errors encountered: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test.describe('State S0_Idle (Idle)', () => {
    test('Initial state shows empty list and proper stats', async ({ page }) => {
      // Validate idle UI: "List is empty", length 0, head/tail null, and operation log initially empty.
      const listText = await page.locator(sel.listDisplay).innerText();
      expect(listText).toContain('List is empty');

      const length = await page.locator(sel.listLength).innerText();
      expect(length).toBe('0');

      const head = await page.locator(sel.headValue).innerText();
      const tail = await page.locator(sel.tailValue).innerText();
      expect(head).toBe('null');
      expect(tail).toBe('null');

      const opLogCount = await page.locator(sel.operationLog).locator('p').count();
      expect(opLogCount).toBe(0);
    });

    test('Removing from empty list logs an attempted remove', async ({ page }) => {
      // Edge case: click remove from head/tail when list is empty, ensures proper logging
      await page.click(sel.removeFromHead);
      await page.click(sel.removeFromTail);

      // Operation log should show attempted remove messages
      const firstLog = await page.locator(sel.operationLog).locator('p').first().innerText();
      expect(firstLog.toLowerCase()).toContain('attempted to remove');

      const allLogs = await page.locator(sel.operationLog).locator('p').allTextContents();
      // There should be at least two log entries (for both attempts)
      expect(allLogs.length).toBeGreaterThanOrEqual(2);
      expect(allLogs.join(' | ').toLowerCase()).toContain('attempted to remove from empty list');
    });
  });

  test.describe('State S1_ListNotEmpty (List Not Empty) and transitions', () => {
    // Helper to get list node texts in display (order)
    async function getDisplayedNodeTexts(page) {
      // select all .node elements and return their text contents in order
      const nodes = await page.locator(`${sel.listDisplay} .node`).allTextContents();
      return nodes.map(s => s.trim());
    }

    test('Add to Head transitions Idle -> ListNotEmpty and updates UI and log', async ({ page }) => {
      // Add single node to head
      await page.fill(sel.nodeValue, 'A');
      await page.click(sel.addToHead);

      // validate list stats
      expect(await page.locator(sel.listLength).innerText()).toBe('1');
      expect(await page.locator(sel.headValue).innerText()).toBe('A');
      expect(await page.locator(sel.tailValue).innerText()).toBe('A');

      const nodes = await getDisplayedNodeTexts(page);
      expect(nodes).toEqual(['A']);

      // Most recent operation log should reference "Added A to head"
      const latestLog = await page.locator(sel.operationLog).locator('p').first().innerText();
      expect(latestLog).toContain('Added A to head');

      // Also validate the internal list length variable via the page context (entry_actions: updateDisplay executed)
      const jsListLength = await page.evaluate(() => window.list && window.list.length);
      expect(jsListLength).toBe(1);
    });

    test('Add to Tail updates tail value and preserves order', async ({ page }) => {
      // Prepare list by adding head 'A' then tail 'B'
      await page.fill(sel.nodeValue, 'A');
      await page.click(sel.addToHead);
      await page.fill(sel.nodeValue, 'B');
      await page.click(sel.addToTail);

      expect(await page.locator(sel.listLength).innerText()).toBe('2');
      expect(await page.locator(sel.tailValue).innerText()).toBe('B');

      const nodes = await getDisplayedNodeTexts(page);
      expect(nodes).toEqual(['A', 'B']);

      // Check operation log contains both additions
      const ops = await page.locator(sel.operationLog).locator('p').allTextContents();
      expect(ops.join(' | ')).toContain('Added B to tail');
      expect(ops.join(' | ')).toContain('Added A to head');
    });

    test('Remove from Head and Remove from Tail update stats and logs', async ({ page }) => {
      // Build list A -> B -> C
      await page.fill(sel.nodeValue, 'A'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, 'B'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, 'C'); await page.click(sel.addToTail);
      expect(await page.locator(sel.listLength).innerText()).toBe('3');

      // Remove head (A)
      await page.click(sel.removeFromHead);
      expect(await page.locator(sel.listLength).innerText()).toBe('2');
      expect(await page.locator(sel.headValue).innerText()).toBe('B');
      // Remove tail (C)
      await page.click(sel.removeFromTail);
      expect(await page.locator(sel.listLength).innerText()).toBe('1');
      expect(await page.locator(sel.tailValue).innerText()).toBe('B');

      // Logs should include removed messages
      const logs = await page.locator(sel.operationLog).locator('p').allTextContents();
      expect(logs.join(' | ')).toContain('Removed A from head');
      expect(logs.join(' | ')).toContain('Removed C from tail');
    });

    test('InsertAtPosition and RemoveAtPosition handle valid and invalid positions', async ({ page }) => {
      // Build list [1,2,3]
      await page.fill(sel.nodeValue, '1'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, '2'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, '3'); await page.click(sel.addToTail);

      // Valid insert at position 1 -> [1, X, 2, 3]
      await page.fill(sel.insertPos, '1');
      await page.fill(sel.insertValue, 'X');
      await page.click(sel.insertBtn);

      let nodes = await getDisplayedNodeTexts(page);
      expect(nodes).toEqual(['1', 'X', '2', '3']);
      expect(await page.locator(sel.listLength).innerText()).toBe('4');

      // Invalid insert at negative position should log failure
      await page.fill(sel.insertPos, '-1');
      await page.fill(sel.insertValue, 'Z');
      await page.click(sel.insertBtn);

      const logs = await page.locator(sel.operationLog).locator('p').allTextContents();
      // Expect a "Failed to insert at position -1" message
      const joined = logs.join(' | ');
      expect(joined).toContain('Failed to insert at position -1');

      // Remove at a valid position (remove the inserted 'X' at position 1)
      await page.fill(sel.removePos, '1');
      await page.click(sel.removeAtPosBtn);
      nodes = await getDisplayedNodeTexts(page);
      expect(nodes).toEqual(['1', '2', '3']);
      expect(await page.locator(sel.listLength).innerText()).toBe('3');
      // Log should indicate removed value
      expect((await page.locator(sel.operationLog).locator('p').first().innerText()).toLowerCase()).toContain('removed');
    });

    test('FindValue, FindAllOccurrences, and CountOccurrences update search results, highlight, and logs', async ({ page }) => {
      // Build list: [A, B, A, C]
      await page.fill(sel.nodeValue, 'A'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, 'B'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, 'A'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, 'C'); await page.click(sel.addToTail);
      expect(await page.locator(sel.listLength).innerText()).toBe('4');

      // FindValue for 'B' (single occurrence)
      await page.fill(sel.searchValue, 'B');
      await page.click(sel.findValueBtn);

      const searchText1 = await page.locator(sel.searchResults).innerText();
      expect(searchText1).toContain('Value B found at position');

      // The node should be highlighted immediately (highlightNode sets background and clears after 2s)
      // Check that some node element has non-empty background style
      const highlightedStyle = await page.locator(`${sel.listDisplay} .node`).filter({ hasText: 'B' }).evaluate(node => {
        return window.getComputedStyle(node).backgroundColor || node.style.backgroundColor;
      });
      // It should be non-empty / different from default empty string (browser default)
      expect(highlightedStyle).toBeTruthy();

      // FindAllOccurrences for 'A' should list positions 0 and 2
      await page.fill(sel.searchValue, 'A');
      await page.click(sel.findAllBtn);

      // The results should list both positions
      await page.waitForTimeout(200); // allow scheduled highlights to start
      const searchText2 = await page.locator(sel.searchResults).innerText();
      expect(searchText2).toContain('positions: 0, 2');

      // CountOccurrences for 'A' should report 2
      await page.fill(sel.searchValue, 'A');
      await page.click(sel.countBtn);
      const countText = await page.locator(sel.searchResults).innerText();
      expect(countText).toContain('appears 2 time(s)');

      // Logs should reflect these operations
      const ops = await page.locator(sel.operationLog).locator('p').allTextContents();
      expect(ops.join(' | ')).toContain('Found A at positions: 0, 2');
      expect(ops.join(' | ')).toContain('Counted 2 occurrences of A');
    });

    test('Reverse, Sort, RemoveDuplicates, and Rotate list manipulations work and update UI and logs', async ({ page }) => {
      // Build list with duplicates and unsorted values: [3,1,2,3]
      await page.fill(sel.nodeValue, '3'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, '1'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, '2'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, '3'); await page.click(sel.addToTail);
      expect(await page.locator(sel.listLength).innerText()).toBe('4');

      // Reverse -> expected display [3,2,1,3]
      await page.click(sel.reverseBtn);
      let nodes = await getDisplayedNodeTexts(page);
      expect(nodes).toEqual(['3', '2', '1', '3']);
      expect((await page.locator(sel.operationLog).locator('p').first().innerText())).toContain('List reversed');

      // Sort -> numerical sort -> expect [1,2,3,3]
      // Note: stored values are strings but sort uses numeric comparator; using numeric-like strings ensures predictable behavior.
      await page.click(sel.sortBtn);
      nodes = await getDisplayedNodeTexts(page);
      expect(nodes).toEqual(['1', '2', '3', '3']);
      expect((await page.locator(sel.operationLog).locator('p').first().innerText())).toContain('List sorted');

      // Remove duplicates -> expect [1,2,3]
      await page.click(sel.removeDupBtn);
      nodes = await getDisplayedNodeTexts(page);
      expect(nodes).toEqual(['1', '2', '3']);
      expect((await page.locator(sel.operationLog).locator('p').first().innerText())).toContain('Duplicates removed');

      // Rotate by 2 -> with list [1,2,3], rotating by 2 should produce [2,3,1] according to implementation logic:
      // Implementation sets newTailPos = length - k - 1. For length 3, k=2 => newTailPos = 0 => newHead = node at 1 (value '2')
      await page.fill(sel.rotateBy, '2');
      await page.click(sel.rotateBtn);
      nodes = await getDisplayedNodeTexts(page);
      expect(nodes).toEqual(['2', '3', '1']);
      expect((await page.locator(sel.operationLog).locator('p').first().innerText())).toContain('List rotated by 2 positions');
    });

    test('ClearList brings list back to Idle state and logs clearing', async ({ page }) => {
      // Add some nodes then clear
      await page.fill(sel.nodeValue, 'X'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, 'Y'); await page.click(sel.addToTail);
      expect(await page.locator(sel.listLength).innerText()).toBe('2');

      await page.click(sel.clearList);
      expect(await page.locator(sel.listLength).innerText()).toBe('0');
      expect(await page.locator(sel.listDisplay).innerText()).toContain('List is empty');

      // Log should indicate cleared
      const firstLog = await page.locator(sel.operationLog).locator('p').first().innerText();
      expect(firstLog).toContain('List cleared');
    });
  });

  test.describe('State S2_Traversing (Traversing) and traversal controls', () => {
    test('StartTraversal sets traversal node to head and StepForward / StepBackward behave as expected', async ({ page }) => {
      // Build list [a,b,c]
      await page.fill(sel.nodeValue, 'a'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, 'b'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, 'c'); await page.click(sel.addToTail);
      expect(await page.locator(sel.listLength).innerText()).toBe('3');

      // Start traversal - entry action startTraversal() should set traversalNode to head and log
      await page.click(sel.startTraversalBtn);

      // Verify internal traversalNode points to head via page.evaluate (allowed read-only)
      const traversalNodeValue = await page.evaluate(() => window.list && window.list.traversalNode && window.list.traversalNode.value);
      expect(traversalNodeValue).toBe('a');

      // UI should bold the traversal node (font-weight bold)
      const nodeElements = page.locator(`${sel.listDisplay} .node`);
      const firstNodeFontWeight = await nodeElements.nth(0).evaluate(node => window.getComputedStyle(node).fontWeight);
      // Different browsers report bold as '700' or 'bold' - just assert it is heavier than normal (>= 600 or 'bold')
      expect(['700', 'bold', 'bolder'].includes(firstNodeFontWeight) || Number(firstNodeFontWeight) >= 600).toBeTruthy();

      // Attempt stepBackward immediately after startTraversal should return null (per implementation) and log accordingly
      await page.click(sel.stepBackwardBtn);
      // Operation log will have "Traversal step backward" but internal state may not change - check that traversalIndex <= 0 results in no backward movement
      // Evaluate traversalIndex to ensure still 0 or unchanged
      const traversalIndex = await page.evaluate(() => window.list && window.list.traversalIndex);
      expect(traversalIndex).toBeGreaterThanOrEqual(0);

      // Step forward once -> traversalNode should move to 'b'
      await page.click(sel.stepForwardBtn);
      const traversalNodeValueAfterStep = await page.evaluate(() => window.list && window.list.traversalNode && window.list.traversalNode.value);
      expect(traversalNodeValueAfterStep).toBe('b');

      // Now step backward should move back to 'a'
      await page.click(sel.stepBackwardBtn);
      const traversalNodeValueAfterBack = await page.evaluate(() => window.list && window.list.traversalNode && window.list.traversalNode.value);
      // If traversalIndex allowed moving back, we expect 'a'; otherwise ensure no crash and correct indexing behavior
      // The implementation sets traversalNode based on traversalHistory when stepping backward, so expect 'a'
      expect(traversalNodeValueAfterBack).toBe('a');

      // Stop traversal -> should log and clear any intervals (none present here)
      await page.click(sel.stopTraversalBtn);
      const lastLog = await page.locator(sel.operationLog).locator('p').first().innerText();
      expect(lastLog).toContain('Stopped traversal');
    });

    test('Auto traversal uses traversal speed and stops when finished (sanity check)', async ({ page }) => {
      // Build short list [1,2]
      await page.fill(sel.nodeValue, '1'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, '2'); await page.click(sel.addToTail);

      // Start auto traversal by invoking the autoTraverse function via the UI control for speed then calling the function
      // The page has an autoTraverse() function but no direct button; use set traversalSpeed then call the function indirectly via evaluate,
      // This is a read-only access to the global function; it does not inject or modify global vars.
      await page.fill(sel.traversalSpeed, '100'); // set speed to small value
      // call autoTraverse in page context to test behavior (not injecting functions, only invoking existing function)
      await page.evaluate(() => {
        // call existing autoTraverse if present; this will naturally run and may create intervals that stop themselves
        if (typeof autoTraverse === 'function') {
          autoTraverse();
        }
      });

      // Wait a bit for the traversal to complete and update display
      await page.waitForTimeout(400);

      // After traversal finishes, the traversalInterval should be null
      const intervalExists = await page.evaluate(() => !!(window.list && window.list.traversalInterval));
      // Should be falsey (interval cleared when finished)
      expect(intervalExists).toBeFalsy();

      // Ensure operation log contains an entry about auto traversal
      const logs = await page.locator(sel.operationLog).locator('p').allTextContents();
      expect(logs.join(' | ')).toMatch(/Started auto traversal \(speed: .*ms\)|Started auto traversal/);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempt invalid removals and insertions produce expected logs and do not crash', async ({ page }) => {
      // Attempt to remove at a position on empty list
      await page.fill(sel.removePos, '5');
      await page.click(sel.removeAtPosBtn);

      const logs = await page.locator(sel.operationLog).locator('p').allTextContents();
      expect(logs.join(' | ')).toContain('Failed to remove from position 5');

      // Attempt to find a value that does not exist
      await page.fill(sel.searchValue, 'nonexistent');
      await page.click(sel.findValueBtn);
      const searchMsg = await page.locator(sel.searchResults).innerText();
      expect(searchMsg).toContain('not found');

      // Attempt rotation by 0 (should default to behavior: rotate with k%length == 0 => no change)
      // Build [7,8,9]
      await page.fill(sel.nodeValue, '7'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, '8'); await page.click(sel.addToTail);
      await page.fill(sel.nodeValue, '9'); await page.click(sel.addToTail);

      await page.fill(sel.rotateBy, '0');
      await page.click(sel.rotateBtn);
      // List should remain [7,8,9]
      const nodes = await page.locator(`${sel.listDisplay} .node`).allTextContents();
      expect(nodes.map(s => s.trim())).toEqual(['7', '8', '9']);
      expect((await page.locator(sel.operationLog).locator('p').first().innerText())).toContain('List rotated by 0 positions');
    });
  });
});