import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf1e80-fa79-11f0-8075-e54a10595dde.html';

// Page Object for interacting with the BFS demo page
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodesInput = page.locator('#nodes');
    this.edgesInput = page.locator('#edges');
    this.startNodeInput = page.locator('#startNode');
    this.runButton = page.locator('#runBFS');
    this.output = page.locator('#output');

    // Containers for observed console errors and page errors
    this.consoleErrors = [];
    this.pageErrors = [];

    // Attach listeners
    this._attachListeners();
  }

  _attachListeners() {
    this.page.on('console', msg => {
      // collect console error messages for later assertions
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // ignore listener side errors
      }
    });

    this.page.on('pageerror', err => {
      // collect page runtime errors (ReferenceError, TypeError, etc.)
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setNodes(value) {
    await this.nodesInput.fill(String(value));
  }

  async setEdges(value) {
    await this.edgesInput.fill(value);
  }

  async setStartNode(value) {
    await this.startNodeInput.fill(String(value));
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    // textContent returns null if empty; normalize to ''
    const txt = await this.output.textContent();
    return (txt === null) ? '' : txt.trim();
  }

  async waitForOutputChange(previous = '') {
    // wait for output to differ from previous value
    await this.page.waitForFunction(
      (selector, prev) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const text = (el.innerText || '').trim();
        return text !== prev;
      },
      {},
      '#output',
      previous
    );
    return this.getOutputText();
  }

  // Helpers to inspect collected errors
  getConsoleErrors() {
    return this.consoleErrors;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Breadth-First Search (BFS) Interactive Demo - FSM Tests', () => {
  // Create new page object for each test and ensure listeners reset
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will create BFSPage instances
  });

  test('S0_Idle: Initial render has page title and default inputs (Idle state)', async ({ page }) => {
    // Validate initial page state (Idle)
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Verify heading exists as evidence for Idle state
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Breadth-First Search (BFS) Interactive Demo');

    // Verify default input values match the HTML attributes
    await expect(bfs.nodesInput).toHaveValue('5');
    await expect(bfs.edgesInput).toHaveValue('0,1; 0,2; 1,3; 1,4; 2,5');
    await expect(bfs.startNodeInput).toHaveValue('0');

    // Output should be empty initially (Idle -> no result yet)
    const out = await bfs.getOutputText();
    expect(out).toBe('');

    // Ensure no unexpected runtime errors were raised during initial render
    expect(bfs.getConsoleErrors().length).toBe(0);
    expect(bfs.getPageErrors().length).toBe(0);
  });

  test.describe('Transitions and BFS execution', () => {
    test('Transition S0 -> S1 -> S2: Clicking Run BFS produces expected BFS traversal (default config)', async ({ page }) => {
      // This validates the RunBFS_Click event and subsequent BFS Completed state.
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Capture previous output (should be empty) and click Run
      const prev = await bfs.getOutputText();
      await bfs.clickRun();

      // Wait for output to change and verify the BFS result string (S2 evidence)
      const outputText = await bfs.waitForOutputChange(prev);
      expect(outputText).toBe('0 - 1 - 2 - 3 - 4');

      // Verify clicking the Run BFS button didn't generate console/page errors
      expect(bfs.getConsoleErrors().length).toBe(0);
      expect(bfs.getPageErrors().length).toBe(0);
    });

    test('Run BFS with nodes increased to include node 5: output includes node 5', async ({ page }) => {
      // Validate that changing inputs affects BFS result accordingly.
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Set nodes = 6 to allow edge "2,5" to be included
      await bfs.setNodes(6);
      // edges default already includes "2,5"
      await bfs.clickRun();

      // Wait and verify output now includes node 5 at the end
      const outputText = await bfs.waitForOutputChange('');
      expect(outputText).toBe('0 - 1 - 2 - 3 - 4 - 5');

      // No runtime errors expected
      expect(bfs.getConsoleErrors().length).toBe(0);
      expect(bfs.getPageErrors().length).toBe(0);
    });

    test('Multiple runs update output consistently', async ({ page }) => {
      // Validate repeated runs produce consistent output and UI updates
      const bfs = new BFSPage(page);
      await bfs.goto();

      // First run with defaults
      await bfs.clickRun();
      const first = await bfs.waitForOutputChange('');
      expect(first).toBe('0 - 1 - 2 - 3 - 4');

      // Change start node to 1 and run again
      await bfs.setStartNode(1);
      const prev = await bfs.getOutputText();
      await bfs.clickRun();
      const second = await bfs.waitForOutputChange(prev);
      // BFS from node 1 should produce: 1 - 0 - 3 - 4 - 2  (depending on graph adjacency)
      // Given adjacency built earlier: from 1 -> [0,3,4], 0 has [1,2], so traversal:
      // 1,0,3,4,2
      expect(second).toBe('1 - 0 - 3 - 4 - 2');

      // No runtime errors expected
      expect(bfs.getConsoleErrors().length).toBe(0);
      expect(bfs.getPageErrors().length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Out-of-bounds start node should produce a runtime TypeError (observed as a pageerror)', async ({ page }) => {
      // This test intentionally triggers an error by setting start node >= numNodes.
      // We must observe the natural TypeError thrown by the page and assert it occurred.
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Confirm default nodes = 5
      await expect(bfs.nodesInput).toHaveValue('5');

      // Set startNode to an out-of-bounds index (e.g., 10)
      await bfs.setStartNode(10);

      // Clear any previously collected errors to isolate this action
      bfs.consoleErrors = [];
      bfs.pageErrors = [];

      // Click Run and allow the page to naturally throw (do NOT patch or catch in page)
      await bfs.clickRun();

      // Wait briefly for any pageerror to be emitted
      await page.waitForTimeout(200);

      // There should be at least one page error captured
      const pageErrs = bfs.getPageErrors();
      expect(pageErrs.length).toBeGreaterThan(0);

      // At least one of the errors should be a TypeError (iteration over undefined / not iterable)
      const hasTypeError = pageErrs.some(err => {
        const nameMatches = err && err.name && err.name.toLowerCase().includes('typeerror');
        const msg = err && err.message && String(err.message).toLowerCase();
        // Look for typical substrings that indicate iterating undefined or not iterable
        const msgMatches = msg && (msg.includes('undefined') || msg.includes('not iterable') || msg.includes('cannot read') || msg.includes('is not iterable'));
        return nameMatches || msgMatches;
      });
      expect(hasTypeError).toBe(true);

      // Also ensure the #output either remains empty or contains the partial result produced before the error
      // We don't assert a concrete output value here because behavior can vary, only that runtime error was observed.
      const out = await bfs.getOutputText();
      expect(typeof out).toBe('string');

      // Console error messages might also be present
      const consoleErrs = bfs.getConsoleErrors();
      // If console errors exist, ensure they contain error messages
      if (consoleErrs.length > 0) {
        expect(consoleErrs.some(c => typeof c.text === 'string')).toBe(true);
      }
    });

    test('Malformed edges input does not crash the app (non-numeric entries are ignored)', async ({ page }) => {
      // Provide malformed edge entries like "foo,bar" and validate no crash occurs.
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Use a small graph where valid edge "1,2" exists and "foo,bar" should be ignored
      await bfs.setNodes(3);
      await bfs.setEdges('foo,bar; 1,2');
      await bfs.setStartNode(1);

      // Reset errors
      bfs.consoleErrors = [];
      bfs.pageErrors = [];

      await bfs.clickRun();

      // Wait for output change
      const output = await bfs.waitForOutputChange('');
      // With nodes=3 and edge 1-2, BFS from 1 should traverse 1 - 2 - 0 (0 has no connection, depends on adjacency)
      // Given our graph: edge 1-2 only, adjacency:
      // 0: []
      // 1: [2]
      // 2: [1]
      // BFS from 1 => 1,2
      expect(output).toBe('1 - 2');

      // Ensure no runtime errors were recorded for malformed entries
      expect(bfs.getPageErrors().length).toBe(0);
      expect(bfs.getConsoleErrors().length).toBe(0);
    });
  });

  test.describe('FSM evidence checks for entry/exit actions', () => {
    test('S0 evidence: page contains expected heading (renderPage() evidence)', async ({ page }) => {
      // Even though renderPage() is not implemented, the HTML contains the heading which serves as evidence.
      const bfs = new BFSPage(page);
      await bfs.goto();

      const heading = page.locator('h1');
      await expect(heading).toHaveText(/Breadth-First Search \(BFS\) Interactive Demo/);

      // No runtime errors on initial load
      expect(bfs.getPageErrors().length).toBe(0);
    });

    test('S1/S2 evidence: clicking Run BFS attaches onclick and updates output (runBFS() and displayResult())', async ({ page }) => {
      // Check that the run button exists and has an onclick handler (we can't inspect functions,
      // but invoking the button should run the BFS and update the output -> evidence of handler)
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Ensure run button is present
      await expect(bfs.runButton).toBeVisible();

      // Click to trigger S1_BFS_Running and S2_BFS_Completed
      await bfs.clickRun();

      // Confirm output updated (evidence of displayResult)
      const out = await bfs.waitForOutputChange('');
      expect(out.length).toBeGreaterThan(0);

      // Confirm no page errors occurred during normal run
      expect(bfs.getPageErrors().length).toBe(0);
    });
  });
});