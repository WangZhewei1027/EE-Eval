import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3bc081-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page Object for the DFS Visualization page.
 * Encapsulates common interactions and observations used across tests.
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} consoleMessages - reference to collected console messages
   * @param {Array} pageErrors - reference to collected page errors
   */
  constructor(page, consoleMessages, pageErrors) {
    this.page = page;
    this.consoleMessages = consoleMessages;
    this.pageErrors = pageErrors;
    this.startButton = page.locator('#start');
    this.graph = page.locator('#graph');
    this.nodeLocator = (id) => page.locator(`#${id}`);
    this.allNodes = page.locator('.node');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async nodeCount() {
    return this.allNodes.count();
  }

  async clickStart() {
    await this.startButton.click();
  }

  async getVisitedNodeIds() {
    // return array of ids that contain the 'visited' class
    const count = await this.nodeCount();
    const visited = [];
    for (let i = 0; i < count; i++) {
      const el = this.allNodes.nth(i);
      const cls = await el.getAttribute('class');
      if (cls && cls.split(/\s+/).includes('visited')) {
        const id = await el.getAttribute('id');
        visited.push(id);
      }
    }
    return visited;
  }

  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('DFS Visualization FSM tests (Application: 7b3bc081-d360-11f0-b42e-71f0e7238799)', () => {
  let graphPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Save type and text for richer assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture the Error object (message, name, stack)
      pageErrors.push(err);
    });

    graphPage = new GraphPage(page, consoleMessages, pageErrors);
    await graphPage.goto();
  });

  test.afterEach(async () => {
    // cleanup references
    graphPage = null;
    consoleMessages = null;
    pageErrors = null;
  });

  test.describe('Initial state S0_Idle (createGraphUI)', () => {
    test('should render graph UI with 5x5 nodes and show Start button', async () => {
      // This test validates the S0_Idle onEnter action createGraphUI()
      // - checks that the graph container exists
      // - ensures 25 node elements are present (5x5 grid)
      // - verifies no node has the visited class initially
      // - confirms the Start DFS button is visible and enabled
      await expect(graphPage.graph).toBeVisible();
      const count = await graphPage.nodeCount();
      expect(count).toBe(25); // 5 rows * 5 columns

      // Verify ids for a few sample nodes exist
      await expect(graphPage.nodeLocator('node-0-0')).toBeVisible();
      await expect(graphPage.nodeLocator('node-4-4')).toBeVisible();

      // No node should be visited initially
      const visitedInitially = await graphPage.getVisitedNodeIds();
      expect(visitedInitially.length).toBe(0);

      // Start button present and visible
      await expect(graphPage.startButton).toBeVisible();
      await expect(graphPage.startButton).toBeEnabled();
    });
  });

  test.describe('Transition S0_Idle -> S1_DFS_Started (StartDFS event)', () => {
    test('clicking Start should start DFS, mark node-0-0 visited, and emit Visiting console log', async () => {
      // This test validates the StartDFS event triggers the dfs('node-0-0', visited)
      // and that the S1_DFS_Started -> S2_Node_Visited transition happens at least for the root node.
      // We also observe console output for the Visiting logs.

      // Ensure no console messages related to visiting exist yet
      expect(graphPage.getConsoleMessages().some(m => /Visiting:/.test(m.text))).toBeFalsy();

      // Click start to begin DFS
      await graphPage.clickStart();

      // The algorithm logs the first visit synchronously before recursing.
      // Assert that we saw a Visiting log for node-0-0
      const logs = graphPage.getConsoleMessages().map(m => m.text);
      const visitedRootLogFound = logs.some(t => t.includes('Visiting: node-0-0'));
      expect(visitedRootLogFound).toBeTruthy();

      // The implementation adds 'visited' class to the DOM for the node before recursing.
      const classAttr = await graphPage.nodeLocator('node-0-0').getAttribute('class');
      expect(classAttr).toBeTruthy();
      expect(classAttr.split(/\s+/)).toContain('visited');

      // Because the code contains a bug in neighbor parsing, we expect at least one runtime page error (TypeError).
      const errors = graphPage.getPageErrors();
      expect(errors.length).toBeGreaterThan(0);

      // At least one error should be a TypeError related to reading properties of undefined,
      // which is consistent with the neighbor split bug in the implementation.
      const hasTypeErrorLike = errors.some(err =>
        (err && typeof err.name === 'string' && err.name === 'TypeError') ||
        (err && typeof err.message === 'string' && (
          err.message.includes('Cannot read') ||
          err.message.toLowerCase().includes('undefined') ||
          err.message.toLowerCase().includes('cannot read properties')
        ))
      );
      expect(hasTypeErrorLike).toBeTruthy();
    });
  });

  test.describe('Transition S1_DFS_Started -> S2_Node_Visited and error scenarios', () => {
    test('multiple starts: repeated clicks should re-run DFS and produce additional errors (edge case)', async () => {
      // This test validates behavior on repeated Start clicks.
      // The implementation resets visited array each time, then runs dfs synchronously.
      // Because of the bug, each run is expected to produce similar runtime errors.

      // First run
      await graphPage.clickStart();
      const errorsAfterFirst = graphPage.getPageErrors();
      expect(errorsAfterFirst.length).toBeGreaterThan(0);

      // Record console logs and visited nodes after first click
      const logsAfterFirst = graphPage.getConsoleMessages().map(m => m.text);
      const visitedAfterFirst = await graphPage.getVisitedNodeIds();
      expect(visitedAfterFirst).toContain('node-0-0');
      expect(logsAfterFirst.some(t => t.includes('Visiting: node-0-0'))).toBeTruthy();

      // Clear collected console messages locally (but not pageErrors) to simplify second-run assertions
      // NOTE: We do not modify the page environment; we only clear our local copy for test clarity.
      consoleMessages.length = 0;

      // Second run: click start again
      await graphPage.clickStart();
      const errorsAfterSecond = graphPage.getPageErrors();

      // We expect additional errors appended from the second run (at least as many as first run)
      expect(errorsAfterSecond.length).toBeGreaterThanOrEqual(errorsAfterFirst.length);

      // The root node should still be marked visited (the new run will re-add the class).
      const visitedAfterSecond = await graphPage.getVisitedNodeIds();
      expect(visitedAfterSecond).toContain('node-0-0');

      // Also expect console logs for the second run to include Visiting for the root again
      const logsAfterSecond = graphPage.getConsoleMessages().map(m => m.text);
      const foundSecondRootLog = logsAfterSecond.some(t => t.includes('Visiting: node-0-0'));
      expect(foundSecondRootLog).toBeTruthy();
    });
  });

  test.describe('Observability: console and page errors', () => {
    test('should capture console messages and page errors for diagnosis', async () => {
      // This test demonstrates capturing and asserting console and error observability,
      // as required by the FSM test plan and the "observe console logs and page errors" directive.

      // Sanity check: at initial load there should be no 'Visiting' console messages yet
      expect(graphPage.getConsoleMessages().some(m => m.text.includes('Visiting:'))).toBeFalsy();

      // Trigger DFS
      await graphPage.clickStart();

      // Collect current console messages and error snapshots
      const msgs = graphPage.getConsoleMessages();
      const errs = graphPage.getPageErrors();

      // There should be at least one visiting console message
      const visitingMsgs = msgs.filter(m => m.text.startsWith('Visiting:'));
      expect(visitingMsgs.length).toBeGreaterThan(0);

      // There should be at least one page error (TypeError) due to implementation bug in neighbor handling
      expect(errs.length).toBeGreaterThan(0);

      // Log-level assertions: ensure that console error events (if any) are captured as type 'error'
      const consoleErrors = msgs.filter(m => m.type === 'error');
      // It's acceptable whether or not console errors exist; we just verify that we captured types correctly
      expect(Array.isArray(consoleErrors)).toBeTruthy();
    });
  });
});