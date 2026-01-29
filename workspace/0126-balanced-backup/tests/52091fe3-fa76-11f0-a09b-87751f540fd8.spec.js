import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52091fe3-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for interacting with the DFS demo page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this._boundConsoleHandler = (msg) => {
      // Capture console messages with their type and text
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this._boundPageErrorHandler = (err) => {
      // Capture unhandled errors from the page
      this.pageErrors.push(err);
    };
  }

  async initListeners() {
    // Attach listeners BEFORE navigation to capture early runtime errors
    this.page.on('console', this._boundConsoleHandler);
    this.page.on('pageerror', this._boundPageErrorHandler);
  }

  async removeListeners() {
    this.page.off('console', this._boundConsoleHandler);
    this.page.off('pageerror', this._boundPageErrorHandler);
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Allow some microtask time for scripts to run and possibly throw
    await this.page.waitForTimeout(100);
  }

  async getCanvasCount() {
    return await this.page.evaluate(() => document.querySelectorAll('canvas').length);
  }

  async getOriginalCanvasExists() {
    return await this.page.evaluate(() => !!document.getElementById('graph'));
  }

  async getVisitedArray() {
    // Convert the Set to an Array in page context and return
    return await this.page.evaluate(() => {
      try {
        return Array.from(window.visited || []);
      } catch (e) {
        return { error: String(e) };
      }
    });
  }

  async getStackArray() {
    return await this.page.evaluate(() => {
      try {
        return Array.from(window.stack || []);
      } catch (e) {
        return { error: String(e) };
      }
    });
  }

  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    // Map Error objects to strings for easier assertions
    return this.pageErrors.map(e => {
      try {
        // Some errors are Error objects, some might be Playwright wrappers
        return e && e.message ? String(e.message) : String(e);
      } catch {
        return String(e);
      }
    });
  }
}

test.describe('DFS Interactive Application - FSM validation and runtime errors', () => {
  // Shared page object per test to ensure fresh listeners and environment
  let graphPage;

  test.beforeEach(async ({ page }) => {
    graphPage = new GraphPage(page);
    await graphPage.initListeners();
    // Navigate to the app; listeners are attached so we capture errors during load
    await graphPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // cleanup listeners to avoid cross-test leakage
    await graphPage.removeListeners();
    // close any leftover resources if needed
    await page.evaluate(() => {}); // noop to ensure any pending tasks settle
  });

  test('S0_Idle: drawGraph is invoked on load and appends at least one additional canvas', async () => {
    // This validates the Idle state's entry action drawGraph() produced DOM side-effects.
    // Original canvas with id="graph" should exist
    const originalExists = await graphPage.getOriginalCanvasExists();
    expect(originalExists).toBe(true);

    // drawGraph in the page appends additional canvas elements before recursing.
    const canvasCount = await graphPage.getCanvasCount();
    // At minimum, the original canvas + at least one appended canvas is expected.
    expect(canvasCount).toBeGreaterThanOrEqual(2);
  });

  test('S1_VisitingNode: startDFS executed and dfs visited all nodes (visited set contains graph nodes)', async () => {
    // Validate that the StartDFS event fired (startDFS() was called) by checking visited nodes.
    const visited = await graphPage.getVisitedArray();
    // If an error occurred while serializing visited, fail with the error message
    if (visited && visited.error) {
      throw new Error('Error reading visited set from page: ' + visited.error);
    }

    // The graph in the page has nodes A-F; ensure all are present
    const expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    // visited may be in DFS order; assert it contains the same set
    for (const n of expectedNodes) {
      expect(visited).toContain(n);
    }
    expect(visited.length).toBe(expectedNodes.length);

    // Also assert that the stack ended empty after DFS completion (dfs pops nodes)
    const stack = await graphPage.getStackArray();
    if (stack && stack.error) {
      throw new Error('Error reading stack from page: ' + stack.error);
    }
    expect(Array.isArray(stack)).toBe(true);
    expect(stack.length).toBe(0);
  });

  test('S2_CompletedDFS: completion condition - all nodes traversed and visited remains stable after load', async () => {
    // Validate CompletedDFS by ensuring visited has the complete set and remains stable across short time
    const firstVisited = await graphPage.getVisitedArray();
    await graphPage.page.waitForTimeout(50);
    const secondVisited = await graphPage.getVisitedArray();

    expect(firstVisited.sort()).toEqual(secondVisited.sort());
    const expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    expect(firstVisited.length).toBe(expectedNodes.length);
    for (const n of expectedNodes) expect(firstVisited).toContain(n);
  });

  test('Transitions: StartDFS -> VisitingNode -> CompletedDFS are implicitly validated via visited set and stack', async () => {
    // This test ensures that the transitions described in the FSM occurred in the page:
    // - StartDFS triggers dfs calls (VisitNode)
    // - Recursion over children (VisitNode repeated)
    // - Completion leads to empty stack and full visited set
    const visited = await graphPage.getVisitedArray();
    const stack = await graphPage.getStackArray();

    expect(visited.length).toBeGreaterThanOrEqual(1); // StartDFS at least visited something
    expect(stack.length).toBe(0); // Completed DFS should leave stack empty
    // Ensure that repeated visits occurred (multiple nodes visited)
    expect(visited.length).toBeGreaterThan(1);
  });

  test('Edge case & error scenario: drawGraph recursion leads to a runtime error (stack overflow or reference error)', async () => {
    // This test asserts that one or more runtime errors were emitted during page execution.
    // We attached listeners before navigation and thus should have captured page errors.
    const errors = graphPage.getPageErrors();
    const consoles = graphPage.getConsoleMessages();

    // There should be at least one page error from the faulty drawGraph recursion
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // Acceptable error messages include "Maximum call stack size exceeded" (RangeError)
    // or "parent is not defined" (ReferenceError) due to usage of undefined 'parent' in drawGraph.
    const joined = errors.join(' || ').toLowerCase();

    const matchesStackOverflow = joined.includes('maximum call stack') || joined.includes('maximum call stack size');
    const matchesParentRef = joined.includes('parent is not defined') || joined.includes('parent is undefined') || joined.includes('referenceerror');
    // Ensure at least one of the expected error types is present
    expect(matchesStackOverflow || matchesParentRef).toBeTruthy();

    // Additionally ensure that console messages were captured (helpful for debugging/observability)
    expect(Array.isArray(consoles)).toBe(true);
    // There may or may not be console logs; just assert that we captured any console entry (zero is acceptable),
    // but we assert that our pageErrors are not empty (primary check above).
  });

  test('Robustness: despite runtime errors from drawing, DFS algorithm side-effects completed before drawGraph error', async () => {
    // This final test ensures the logical algorithm work (visited set) completed before UI drawing crashed.
    const visited = await graphPage.getVisitedArray();

    // Confirm visited still contains expected nodes
    const expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const n of expectedNodes) expect(visited).toContain(n);
    expect(visited.length).toBe(expectedNodes.length);
  });
});