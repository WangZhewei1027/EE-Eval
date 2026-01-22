import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e1535b0-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page Object to collect console messages and page errors and expose helpers
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages
    this.page.on('console', (msg) => {
      // store the entire ConsoleMessage for later inspection
      this.consoleMessages.push(msg);
    });

    // Collect unhandled page errors (ReferenceError, TypeError, etc.)
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // allow a short grace period for inline script execution and possible errors
    await this.page.waitForTimeout(250);
  }

  rootLocator() {
    return this.page.locator('#root');
  }

  async rootInnerHTML() {
    return await this.rootLocator().innerHTML();
  }

  // Helper to find console messages by substring and optionally by type
  findConsoleMessagesContaining(substring, type = undefined) {
    return this.consoleMessages.filter((msg) => {
      const matchesText = msg.text().includes(substring);
      const matchesType = type ? msg.type() === type : true;
      return matchesText && matchesType;
    });
  }

  // Helper to find pageerrors containing substring
  findPageErrorsContaining(substring) {
    return this.pageErrors.filter((err) => (err && String(err.message || err).includes(substring)));
  }
}

test.describe('Binary Tree FSM - Interactive Application (0e1535b0-d5c5-11f0-92ee-f5994b4f4c99)', () => {
  // Each test will create its own page and BinaryTreePage wrapper
  test.describe('S0_Idle (Initial State) validations', () => {
    test('S0_Idle: Page renders and root element exists and is initially empty', async ({ page }) => {
      // This test validates the Idle state's evidence: <div id="root"></div>
      const bt = new BinaryTreePage(page);
      await bt.goto();

      // Verify the root element exists
      const root = bt.rootLocator();
      await expect(root).toHaveCount(1);

      // Verify the root element is initially empty (no innerHTML)
      const inner = await bt.rootInnerHTML();
      // The implementation may throw errors during the script run, but the DOM element should exist
      expect(inner).toBe('', 'Expected #root to be empty on initial render (Idle state).');
    });
  });

  test.describe('S1_NodeInserted (Transition and script execution)', () => {
    test('Transition insertNode: script execution should run and produce runtime error (root is not defined)', async ({ page }) => {
      // This test validates that the transition actions attempted by the script produce a ReferenceError
      // according to the unmodified page implementation. We observe console messages and page errors.
      const bt = new BinaryTreePage(page);
      await bt.goto();

      // Expect that a page-level error occurred due to the script using "root" without declaring it.
      // Collect page errors and assert the ReferenceError is present.
      const errorsContainingRoot = bt.findPageErrorsContaining('root is not defined');
      const errorsContainingReference = bt.findPageErrorsContaining('ReferenceError');

      // At least one of these should be present. The exact message format may vary by browser,
      // so we accept either direct root message or ReferenceError mention.
      expect(
        errorsContainingRoot.length > 0 || errorsContainingReference.length > 0
      ).toBeTruthy();

      // Additionally, assert that console did not record the successful Node logs ("Node 1:", "Node 2:", "Node 3:")
      // because the script throws before those console.log calls execute.
      const node1Msgs = bt.findConsoleMessagesContaining('Node 1:');
      const node2Msgs = bt.findConsoleMessagesContaining('Node 2:');
      const node3Msgs = bt.findConsoleMessagesContaining('Node 3:');

      expect(node1Msgs.length).toBe(0);
      expect(node2Msgs.length).toBe(0);
      expect(node3Msgs.length).toBe(0);

      // Confirm that the DOM was not mutated to include list nodes (no <li> elements created)
      const liCount = await page.locator('#root li').count();
      expect(liCount).toBe(0);
    });

    test('Console should surface the runtime error as an error-level console message', async ({ page }) => {
      // Validate that the runtime problem also appears as a console message of type 'error'
      const bt = new BinaryTreePage(page);
      await bt.goto();

      // Give the page a slight moment after initial script run
      await page.waitForTimeout(50);

      // Look for console messages of type 'error' that contain 'root' or 'ReferenceError'
      const errorConsoleMsgs = bt.consoleMessages.filter((m) => {
        const text = m.text();
        return m.type() === 'error' && (text.includes('root') || text.includes('ReferenceError'));
      });

      // Depending on engine, the console.error output may vary; assert that at least one error console message exists
      expect(errorConsoleMsgs.length).toBeGreaterThanOrEqual(1);
    });

    test('Edge case: ensure subsequent insertNode calls are not reached after the initial ReferenceError', async ({ page }) => {
      // The page attempts three insertNode calls sequentially. If the first throws, the others should not execute.
      // This test ensures that only the error from the first attempt is observed and no "Node 2" or "Node 3" logs appear.
      const bt = new BinaryTreePage(page);
      await bt.goto();

      // Wait briefly to ensure all synchronous script activity has finished
      await page.waitForTimeout(100);

      // There should be no "Node 2" or "Node 3" log lines
      const node2Msgs = bt.findConsoleMessagesContaining('Node 2:');
      const node3Msgs = bt.findConsoleMessagesContaining('Node 3:');
      expect(node2Msgs.length).toBe(0);
      expect(node3Msgs.length).toBe(0);

      // Page errors should include the initial ReferenceError for root; assert it's present
      const initialError = bt.findPageErrorsContaining('root is not defined');
      expect(initialError.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('General robustness and error evidence checks', () => {
    test('Validate that no unexpected successful insertion occurred (DOM remains unchanged)', async ({ page }) => {
      // This test double-checks that despite the script being present, the DOM does not show inserted nodes.
      const bt = new BinaryTreePage(page);
      await bt.goto();

      // The #root should have no child <li> elements because the insertion code fails early
      const listItemCount = await page.locator('#root li').count();
      expect(listItemCount).toBe(0);

      // Also the innerHTML should be empty string (no inserted markup)
      const inner = await bt.rootInnerHTML();
      expect(inner).toBe('', 'Expected no markup to be inserted into #root due to runtime error.');
    });

    test('Capture and assert presence of technical notes in error messages (Type/Reference)', async ({ page }) => {
      // This test checks that the page produced a runtime error whose message indicates typical JS runtime failures.
      const bt = new BinaryTreePage(page);
      await bt.goto();

      // Wait to ensure errors are captured
      await page.waitForTimeout(50);

      // Collect messages mentioning ReferenceError or TypeError
      const refErrors = bt.findPageErrorsContaining('ReferenceError');
      const typeErrors = bt.findPageErrorsContaining('TypeError');

      // We expect at least a ReferenceError due to 'root' not being defined; TypeError may or may not be present.
      expect(refErrors.length + typeErrors.length).toBeGreaterThanOrEqual(1);
    });
  });
});