import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5207e762-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Doubly Linked List - FSM validation and runtime behavior', () => {
  // Arrays to collect console logs and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Before each test, reset collectors and navigate to the page.
  // Attach listeners to capture console.log outputs and uncaught page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture only 'log' and 'error' messages for inspection
      const type = msg.type();
      const text = msg.text();
      if (type === 'log' || type === 'error') {
        consoleMessages.push({ type, text });
      }
    });

    page.on('pageerror', error => {
      // capture uncaught exceptions from the page
      pageErrors.push(error);
    });

    // Navigate to the provided HTML page and wait for load so inline scripts run
    await page.goto(URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure the page is closed/clean for next test (Playwright usually handles this)
    // This is kept minimal to avoid interfering with the environment.
    try {
      await page.evaluate(() => {});
    } catch {
      // ignore
    }
  });

  test('Initialized state: entry actions append/prepend/printList produce expected console output', async ({ page }) => {
    // This test validates the FSM S0_Initialized entry actions:
    // dll.append(1..5), dll.prepend(0), dll.printList()
    //
    // The page script runs those actions on load. We expect the first printList()
    // to print node values: 0,1,2,3,4,5 in order (each logged as a separate console.log).
    //
    // Collect console messages that are numeric logs and assert the first sequence.

    // Filter console logs for numeric outputs (printList uses console.log(currentNode.data))
    const numericLogs = consoleMessages
      .filter(m => m.type === 'log' && /^\d+$/.test(m.text))
      .map(m => m.text);

    // There should be at least 6 numeric logs for the initial printList (0..5)
    expect(numericLogs.length).toBeGreaterThanOrEqual(6);

    // Verify the first six numeric logs correspond to 0..5 (initialized list printed)
    const firstSix = numericLogs.slice(0, 6);
    expect(firstSix).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  test('DeleteNode transition: deleteNode(1) executed and subsequent printList reflects deletion', async ({ page }) => {
    // This test validates the transition from S0_Initialized -> S1_Deleted_1:
    // The page script calls dll.deleteNode(1) and then dll.printList().
    //
    // Based on the provided implementation (which does not correctly delete node 1),
    // the runtime behavior is to remove the tail node instead. Therefore, after the
    // second printList we expect the printed sequence to be 0,1,2,3,4.
    //
    // We assert the entire numeric console log sequence includes both prints:
    // first: 0..5, second: 0..4

    const numericLogs1 = consoleMessages
      .filter(m => m.type === 'log' && /^\d+$/.test(m.text))
      .map(m => m.text);

    // Expect the combined prints to be [0,1,2,3,4,5,0,1,2,3,4]
    expect(numericLogs).toEqual(['0', '1', '2', '3', '4', '5', '0', '1', '2', '3', '4']);

    // Additional checks:
    // - '5' should appear only once (it is present in the first printList, removed in the second).
    const countOfFive = numericLogs.filter(n => n === '5').length;
    expect(countOfFive).toBe(1);

    // - Confirm that the second sequence (after deletion) has length 5 and equals 0..4
    const secondSequence = numericLogs.slice(6);
    expect(secondSequence).toEqual(['0', '1', '2', '3', '4']);
  });

  test('DOM: verify static table structure exists and contains expected cell values', async ({ page }) => {
    // Validate the static HTML table is present and contains expected values (1..12)
    const tableExists = await page.$('table');
    expect(tableExists).not.toBeNull();

    // Check header texts
    const headers = await page.$$eval('table tr:first-child th', ths => ths.map(t => t.textContent.trim()));
    expect(headers).toEqual(['Node 1', 'Node 2', 'Next', 'Prev']);

    // Check that the first data cell is '1' and the last data cell is '12'
    const firstDataCell = await page.$eval('table tr:nth-child(2) td:nth-child(1)', td => td.textContent.trim());
    expect(firstDataCell).toBe('1');

    const lastDataCell = await page.$eval('table tr:nth-child(4) td:nth-child(4)', td => td.textContent.trim());
    expect(lastDataCell).toBe('12');

    // Check total number of data rows (excluding header) is 3
    const dataRowCount = await page.$$eval('table tr', rows => rows.length - 1); // subtract header row
    expect(dataRowCount).toBe(3);
  });

  test('Edge case: calling deleteNode on an empty list should produce an uncaught TypeError (accessing head.data)', async ({ page }) => {
    // This test intentionally triggers an error scenario described by the implementation:
    // If deleteNode is called when head is null, the implementation attempts to access this.head.data,
    // which should produce a TypeError in the browser. We register a pageerror handler and then
    // invoke the faulty call in the page context, letting the error occur naturally.
    //
    // We expect a pageerror to be recorded.

    // Clear any previously captured errors/messages for clarity
    consoleMessages = [];
    pageErrors = [];

    // We will execute the dangerous call directly in the page context.
    // The evaluate is expected to reject because an exception occurs in the page.
    let evaluateThrown = false;
    try {
      // This will create a new DoublyLinkedList instance with head === null and call deleteNode,
      // which should throw when attempting to read this.head.data
      await page.evaluate(() => {
        // Intentionally call deleteNode on a fresh list (head is null)
        const d = new DoublyLinkedList();
        // Do not catch the error here; let it bubble to the window to be captured as pageerror
        d.deleteNode(12345);
      });
    } catch (e) {
      evaluateThrown = true;
      // swallow here; we'll assert pageErrors below
    }

    // The evaluate should have thrown due to the unhandled exception in the page.
    expect(evaluateThrown).toBe(true);

    // Ensure the pageerror event captured the thrown error
    expect(pageErrors.length).toBeGreaterThan(0);

    // Check that at least one of the captured errors looks like a TypeError about reading property 'data'
    const anyTypeErrorLike = pageErrors.some(err => {
      const msg = err.message || String(err);
      return /Cannot read|Cannot.*read|reading 'data'|reading \"data\"|Cannot read property 'data'/.test(msg);
    });
    expect(anyTypeErrorLike).toBe(true);
  });

  test('deleteNode on single-node list removes head and tail (onEnter/onExit validation for single-node delete)', async ({ page }) => {
    // This test covers the case when head.data === data branch is taken.
    // We create a fresh DoublyLinkedList instance in-page, append a single value,
    // delete that same value, and then assert that head and tail are null (list emptied).
    //
    // This validates the onEnter behavior of the S1_Deleted_1 state when the deleted node is head.

    const result = await page.evaluate(() => {
      const d1 = new DoublyLinkedList();
      d.append(999);
      // After append, head and tail should point to the same node with data 999
      const before = { headData: d.head ? d.head.data : null, tailData: d.tail ? d.tail.data : null };
      // Now delete the node with data 999; the implementation should set head and tail to null
      try {
        d.deleteNode(999);
      } catch (e) {
        // If an error occurs, surface it via return so test can see it (we do not want to throw here)
        return { error: e && e.message ? String(e.message) : String(e), before };
      }
      const after = { headIsNull: d.head === null, tailIsNull: d.tail === null };
      return { before, after };
    });

    // If an error key is present, fail the test with that message for clarity
    if (result && result.error) {
      throw new Error('Unexpected error during single-node delete test: ' + result.error);
    }

    // Validate preconditions: head and tail held 999 before deletion
    expect(result.before).toEqual({ headData: 999, tailData: 999 });

    // After deletion, the list should be empty (head and tail null)
    expect(result.after.headIsNull).toBe(true);
    expect(result.after.tailIsNull).toBe(true);
  });

  test('Sanity: ensure no unexpected uncaught page errors during normal page load (aside from intentional tests)', async ({ page }) => {
    // This test asserts that the normal page load (already performed in beforeEach) did not produce any
    // uncaught page errors beyond those we intentionally trigger in other tests.
    //
    // Note: The "empty delete" test intentionally triggers a pageerror; this test is isolated by beforeEach so
    // it inspects errors only from the current navigation.

    // There may be no pageerrors for the standard load; assert zero uncaught page errors.
    expect(pageErrors.length).toBe(0);
  });
});