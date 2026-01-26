import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52085c93-fa76-11f0-a09b-87751f540fd8.html';

// Page Object to encapsulate page interactions and observations
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for later assertions
    this.page.on('console', msg => {
      // store type and text for easier assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application and wait for load event
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Give a small pause to ensure all synchronous console logs from scripts are captured
    await this.page.waitForTimeout(50);
  }

  // Return all captured console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Return all captured page errors
  getPageErrors() {
    return this.pageErrors;
  }

  // Get trimmed text content of a selector
  async textContent(selector) {
    const el = await this.page.$(selector);
    if (!el) return null;
    const text = await this.page.evaluate(e => e.textContent, el);
    return text === null ? '' : text.trim();
  }

  // Evaluate an expression in page context and return the result
  async eval(fn) {
    return this.page.evaluate(fn);
  }
}

test.describe('Red-Black Tree FSM tests for Application ID 52085c93-fa76-11f0-a09b-87751f540fd8', () => {
  let treePage;
  let page;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context and page for isolation
    const context = await browser.newContext();
    page = await context.newPage();
    treePage = new TreePage(page);
    await treePage.goto();
  });

  test.afterEach(async () => {
    // Clean up: close the page/context
    try {
      await page.close();
    } catch (e) {
      // ignore errors during teardown
    }
  });

  test('Initial Idle state (S0_Idle) - static DOM verification and presence of script constructs', async () => {
    // This test validates the initial static HTML state and that expected JS constructs are present.
    // Even though the FSM's Idle state is "initial", the page scripts run immediately on load.
    // We therefore verify that the page loaded correctly and that key functions/classes are defined.

    // Verify page title/header is present
    const header = await treePage.textContent('h1');
    expect(header).toBe('Red-Black Tree');

    // Verify the <p id="tree"> remains empty (no dynamic DOM rendering attempted in provided script)
    const treeText = await treePage.textContent('#tree');
    expect(treeText).toBe('');

    // Verify that core functions/classes expected by the FSM exist on the page
    const defs = await treePage.eval(() => {
      return {
        hasNodeClass: typeof Node === 'function',
        hasInsertFn: typeof insert === 'function',
        hasPrintTreeFn: typeof printTree === 'function',
        hasRedBlackTreeFn: typeof redBlackTree === 'function'
      };
    });

    expect(defs.hasNodeClass).toBe(true);
    expect(defs.hasInsertFn).toBe(true);
    expect(defs.hasPrintTreeFn).toBe(true);
    expect(defs.hasRedBlackTreeFn).toBe(true);
  });

  test('Transition "Insert" executed -> Tree constructed (S1_TreeConstructed) validated via console output', async () => {
    // This test verifies the FSM transition from Idle to TreeConstructed by checking the console logs
    // produced by the printTree(root) entry action. The script prints the tree twice; we validate both.

    // Capture only "log" console messages (printTree uses console.log)
    const consoleMsgs = treePage.getConsoleMessages().filter(m => m.type === 'log').map(m => m.text);

    // There should be multiple log entries corresponding to printed node values.
    // Extract numeric values from each logged line (trim whitespace, extract first integer if present)
    const extractedNumbers = consoleMsgs.map(t => {
      const match = t.match(/-?\d+/);
      return match ? match[0] : null;
    }).filter(Boolean);

    // Expected sequence produced by printTree for this BST (pre-order traversal used by printTree)
    const expectedSequence = ['10', '5', '3', '7', '15', '12', '17'];

    // The script calls printTree twice with the same tree construction, so expect the sequence twice
    const expectedRepeated = expectedSequence.concat(expectedSequence);

    // Assert that we captured at least the expected number of numeric logs (14)
    expect(extractedNumbers.length).toBeGreaterThanOrEqual(expectedRepeated.length);

    // Verify that the first occurrence of the pattern equals expectedSequence,
    // and that the next contiguous set equals expectedSequence again (i.e., two prints)
    const firstChunk = extractedNumbers.slice(0, expectedSequence.length);
    const secondChunk = extractedNumbers.slice(expectedSequence.length, expectedSequence.length * 2);

    expect(firstChunk).toEqual(expectedSequence);
    expect(secondChunk).toEqual(expectedSequence);
  });

  test('Verify FSM onEnter action "printTree(root)" executed and tree structure in memory matches inserts', async () => {
    // Validate the onEnter (entry) action of the S1_TreeConstructed state by checking
    // that the page's in-memory "root" object represents the inserted values.

    // Access the page's root object properties
    const rootInfo = await treePage.eval(() => {
      // Return a lightweight snapshot (avoid returning DOM nodes or complex cyclic structures)
      if (typeof root === 'undefined' || root === null) {
        return { exists: false };
      }
      function nodeSummary(n) {
        if (!n) return null;
        return {
          value: n.value,
          color: n.color,
          leftValue: n.left ? n.left.value : null,
          rightValue: n.right ? n.right.value : null
        };
      }
      return {
        exists: true,
        root: nodeSummary(root),
        left: nodeSummary(root.left),
        right: nodeSummary(root.right),
        leftLeft: root.left && root.left.left ? root.left.left.value : null,
        leftRight: root.left && root.left.right ? root.left.right.value : null,
        rightLeft: root.right && root.right.left ? root.right.left.value : null,
        rightRight: root.right && root.right.right ? root.right.right.value : null
      };
    });

    // Ensure root exists and has expected structure (based on insertion sequence)
    expect(rootInfo.exists).toBe(true);
    expect(rootInfo.root.value).toBe(10);
    expect(rootInfo.left.value).toBe(5);
    expect(rootInfo.right.value).toBe(15);
    expect(rootInfo.leftLeft).toBe(3);
    expect(rootInfo.leftRight).toBe(7);
    expect(rootInfo.rightLeft).toBe(12);
    expect(rootInfo.rightRight).toBe(17);

    // Colors are assigned 'black' in the simple insert implementation for each created node
    expect(rootInfo.root.color).toBeDefined();
    expect(['black', 'red']).toContain(rootInfo.root.color); // be permissive: implementation sets 'black'
  });

  test('Edge cases and runtime errors - verify no unexpected page errors occurred during load', async () => {
    // The provided script performs all operations synchronously on load.
    // We assert that no uncaught page errors (ReferenceError, TypeError, SyntaxError) were emitted.

    const pageErrors = treePage.getPageErrors();

    // If any runtime errors occurred they would be captured here. We expect none.
    expect(pageErrors.length).toBe(0);

    // Also assert that there are no console messages of type 'error'
    const consoleErrors = treePage.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM completeness checks: states and transition evidence presence', async () => {
    // This test verifies that evidence described in the FSM (printTree invocations and insert sequences)
    // can be observed in the application's behavior and logs.

    // Check console logs again to ensure 'printTree' produced outputs that match inserted values
    const consoleMsgs = treePage.getConsoleMessages().filter(m => m.type === 'log').map(m => m.text);

    // Confirm that at least one console log contains the root value '10' (with or without indent)
    const foundRootLog = consoleMsgs.some(t => /\b10\b/.test(t));
    expect(foundRootLog).toBe(true);

    // Confirm that evidence of insertion for a leaf like '3' and '17' exist in logs
    const foundLeafLogs = consoleMsgs.some(t => /\b3\b/.test(t)) && consoleMsgs.some(t => /\b17\b/.test(t));
    expect(foundLeafLogs).toBe(true);
  });
});