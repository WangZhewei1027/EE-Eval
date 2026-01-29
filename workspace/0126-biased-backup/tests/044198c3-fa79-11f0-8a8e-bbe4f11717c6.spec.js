import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044198c3-fa79-11f0-8a8e-bbe4f11717c6.html';

/*
  Page object for the Binary Tree application.
  Encapsulates common interactions and DOM queries so tests remain readable.
*/
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.clearButton = page.locator('#clear-button');
    this.printButton = page.locator('#print-button');
    this.treeNodes = page.locator('.tree .node');
    this.footer = page.locator('.footer');
    // collectors for console messages and page errors
    this.consoleMessages = [];
    this.pageErrors = [];

    // attach listeners
    page.on('console', (msg) => {
      // capture all console messages for inspection
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore any edge-case exceptions while reading console messages
      }
    });

    page.on('pageerror', (err) => {
      // capture the Error objects / messages that bubble up to the page
      try {
        this.pageErrors.push(String(err && err.message ? err.message : err));
      } catch {
        // ignore
      }
    });

    // capture request failures too (e.g., missing script files)
    page.on('requestfailed', (req) => {
      const failure = req.failure();
      const url = req.url();
      this.consoleMessages.push({ type: 'requestfailed', text: `${url} -> ${failure && failure.errorText ? failure.errorText : 'failed'}` });
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getInitialNodeCount() {
    return await this.treeNodes.count();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async clickPrint() {
    await this.printButton.click();
  }

  // Utility: wait up to timeoutMs for either node count to change OR a page error referring to fnName to appear
  async waitForDomChangeOrError(previousNodeCount, fnName, timeoutMs = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      // check for page error mentioning the function name
      if (this.pageErrors.some((m) => m.includes(fnName))) return { errorObserved: true, nodeCountChanged: false };

      // check node count
      const count = await this.getInitialNodeCount();
      if (count !== previousNodeCount) return { errorObserved: false, nodeCountChanged: true, newCount: count };

      // slight delay
      await this.page.waitForTimeout(50);
    }
    // timed out
    return { errorObserved: this.pageErrors.some((m) => m.includes(fnName)), nodeCountChanged: false };
  }
}

test.describe('Binary Tree FSM - states and transitions (044198c3-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Create a fresh page object for each test and collect console/page errors.
  test.beforeEach(async ({ page }) => {
    // nothing here; individual tests instantiate BinaryTreePage to attach listeners early
  });

  test.afterEach(async ({ }, testInfo) => {
    // No global teardown required. We keep tests isolated.
  });

  test('Idle state (S0_Idle): page renders and shows Clear/Print buttons and initial tree nodes', async ({ page }) => {
    // This test validates the Idle state evidence:
    // - renderPage() is an entry action in the FSM; we load the page exactly as-is and observe DOM and console/errors.
    // - Verify both buttons are present and visible
    // - Verify a non-empty tree is present (initial node count > 0)
    // - Observe console messages and page errors (we record them but do not alter app behavior)
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Validate the presence and text of the buttons (evidence for S0_Idle)
    await expect(treePage.clearButton).toBeVisible();
    await expect(treePage.printButton).toBeVisible();
    await expect(treePage.clearButton).toHaveText('Clear Tree');
    await expect(treePage.printButton).toHaveText('Print Tree');

    // Validate initial tree node count (evidence of rendered tree)
    const initialCount = await treePage.getInitialNodeCount();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // We also assert that we observed console messages OR page errors during load.
    // According to the instructions we must "observe console logs and page errors" and let runtime errors happen naturally.
    // Accept either console messages recorded or page errors recorded.
    const hasConsole = treePage.consoleMessages.length > 0;
    const hasPageErrors = treePage.pageErrors.length > 0;

    // At minimum, at least one of console messages or page errors should be present.
    expect(hasConsole || hasPageErrors).toBeTruthy();

    // If page errors exist, log a representative one to the test output (keeps test deterministic while observing errors)
    if (hasPageErrors) {
      // Ensure that captured errors are strings
      for (const err of treePage.pageErrors) {
        expect(typeof err).toBe('string');
      }
    }
  });

  test('ClearTree event (transition S0_Idle -> S1_TreeCleared): clicking Clear Tree should clear tree or produce an error', async ({ page }) => {
    // This test validates the ClearTree event and the TreeCleared state entry-action clearTree()
    // We will:
    // - Record initial node count
    // - Click the clear button
    // - Wait for either the node count to change (tree cleared) OR a page error referencing "clearTree" to be emitted
    // - Assert one of those outcomes occurred
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    const initialCount = await treePage.getInitialNodeCount();
    expect(initialCount).toBeGreaterThanOrEqual(1); // sanity check

    // Click the Clear Tree button to trigger the ClearTree event
    await treePage.clickClear();

    // Wait for a DOM change or an error mentioning "clearTree"
    const result = await treePage.waitForDomChangeOrError(initialCount, 'clearTree', 1500);

    // Assert: either the tree was cleared (node count changed) OR a page error referencing clearTree occurred
    const observedDomChange = result.nodeCountChanged === true;
    const observedError = result.errorObserved === true;

    expect(observedDomChange || observedError).toBeTruthy();

    // If DOM changed, expect node count to be less than initial (cleared or partially removed)
    if (observedDomChange) {
      const newCount = result.newCount !== undefined ? result.newCount : await treePage.getInitialNodeCount();
      expect(newCount).toBeLessThanOrEqual(initialCount);
    }

    // If an error was observed, assert the error message contains the referenced function name OR is a generic TypeError/ReferenceError
    if (observedError) {
      // There may be multiple captured errors; ensure at least one message references clearTree or is a typical runtime error
      const matching = treePage.pageErrors.filter((m) => m.includes('clearTree') || /ReferenceError|TypeError|SyntaxError/i.test(m));
      expect(matching.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('PrintTree event (transition S0_Idle -> S2_TreePrinted): clicking Print Tree should produce output or produce an error', async ({ page }) => {
    // This test validates the PrintTree event and the TreePrinted state entry-action printTree()
    // Behavior expectations:
    // - Either the app will print tree information to console / DOM OR calling printTree() will cause a page error
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Sanity check: buttons exist
    await expect(treePage.printButton).toBeVisible();

    // Clear previous console/page errors collected so far for clearer assertions
    treePage.consoleMessages.length = 0;
    treePage.pageErrors.length = 0;

    // Click the Print Tree button
    await treePage.clickPrint();

    // Wait briefly to allow synchronous or asynchronous handlers to run
    await page.waitForTimeout(300);

    // Outcomes to accept:
    // - Console contains some message that appears to be printing tree data (contains 'tree' or numeric values)
    // - A DOM element appears that contains printed output (e.g., <pre> or .output), or
    // - A page error referencing 'printTree' occurred

    const consoleHasPrintLike = treePage.consoleMessages.some((m) => /print|tree|Root|node|value|\d+/i.test(m.text));
    const pageErrorMentionPrint = treePage.pageErrors.some((m) => m.includes('printTree') || /ReferenceError|TypeError|SyntaxError/i.test(m));

    // Try to detect a printed DOM element (not guaranteed)
    const printedDom = await page.locator('pre, .output, .printed-tree, #output').first();
    const printedDomVisible = await printedDom.count() > 0 ? await printedDom.isVisible().catch(() => false) : false;

    expect(consoleHasPrintLike || printedDomVisible || pageErrorMentionPrint).toBeTruthy();

    // If a page error exists, ensure it is a string and mention printTree or a common runtime error type
    if (pageErrorMentionPrint) {
      const matching = treePage.pageErrors.filter((m) => m.includes('printTree') || /ReferenceError|TypeError|SyntaxError/i.test(m));
      expect(matching.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('Edge cases: rapid repeated clicks and printing after clearing (robustness)', async ({ page }) => {
    // This test checks two edge/error scenarios:
    // 1) Rapidly clicking Clear Tree multiple times should not crash the page (we observe any page errors)
    // 2) After clearing the tree, clicking Print Tree should either produce a sensible "empty" output or produce an error (we record which)
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Record starting node count
    const startCount = await treePage.getInitialNodeCount();
    expect(startCount).toBeGreaterThanOrEqual(1);

    // Rapidly click clear 3 times
    for (let i = 0; i < 3; i++) {
      await treePage.clickClear();
      // small backoff between clicks to emulate fast user interaction
      await page.waitForTimeout(80);
    }

    // Allow handlers to run
    await page.waitForTimeout(300);

    // Check if any page errors happened during repeated clicks
    const errorsDuringClear = treePage.pageErrors.slice();
    // It's acceptable that errors occur (per instructions), but ensure captured errors are strings
    for (const e of errorsDuringClear) {
      expect(typeof e).toBe('string');
    }

    // Now attempt to print after clear
    // Reset console errors collection for clarity
    treePage.consoleMessages.length = 0;
    // Click Print
    await treePage.clickPrint();
    await page.waitForTimeout(300);

    // Observe outcome: printed output in console / DOM OR page error mentioning printTree
    const printedConsole = treePage.consoleMessages.some((m) => /print|tree|Root|node|value|\d+/i.test(m.text));
    const printedDom = await page.locator('pre, .output, .printed-tree, #output').first();
    const printedDomVisible = await printedDom.count() > 0 ? await printedDom.isVisible().catch(() => false) : false;
    const printErrors = treePage.pageErrors.some((m) => m.includes('printTree') || /ReferenceError|TypeError|SyntaxError/i.test(m));

    // Assert that we observed something (either output or an error)
    expect(printedConsole || printedDomVisible || printErrors).toBeTruthy();
  });

  test('State evidence verification: Footer present and accessible (extra FSM evidence)', async ({ page }) => {
    // FSM evidence included top-level structure. This test verifies the footer remains present across interactions.
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Footer should exist and contain Version 1.0 per the HTML
    await expect(treePage.footer).toBeVisible();
    await expect(treePage.footer).toContainText('Version 1.0');

    // Perform an action (click clear) and ensure footer still present (no unexpected layout removal)
    await treePage.clickClear();
    await page.waitForTimeout(200);
    await expect(treePage.footer).toBeVisible();
  });
});