import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dade3-fa73-11f0-a9d0-d7a1991987c6.html';

// Simple Page Object for the DFS visualization page
class DFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async startDFS() {
    await this.page.click("button[onclick='startDFS()']");
  }

  async getNodeIds() {
    return await this.page.$$eval('#graph .node', nodes => nodes.map(n => n.id));
  }

  async getNodeCount() {
    return await this.page.$$eval('#graph .node', nodes => nodes.length);
  }

  async getEdgeCount() {
    return await this.page.$$eval('#graph .edge', edges => edges.length);
  }

  async getNodeBackground(nodeId) {
    return await this.page.$eval(`#${nodeId}`, el => {
      // Return computed style background color (may be '' if not set)
      return window.getComputedStyle(el).backgroundColor || el.style.backgroundColor || '';
    });
  }

  async allNodesHighlightedCount() {
    return await this.page.$$eval('#graph .node', nodes =>
      nodes.filter(n => {
        const bg = window.getComputedStyle(n).backgroundColor;
        // lightgreen computed as rgb(144, 238, 144) in many browsers, but accept 'lightgreen' or rgb(...) variants
        return bg && (bg.includes('rgb') ? bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgba(0,0,0,0)' : bg.toLowerCase() === 'lightgreen');
      }).length
    );
  }

  async getVisitedSize() {
    // Access the page-scoped `visited` Set and return its size. Do not modify anything.
    return await this.page.evaluate(() => {
      try {
        return typeof visited !== 'undefined' ? visited.size : null;
      } catch (e) {
        return { error: e.message || String(e) };
      }
    });
  }
}

test.describe('DFS Visualization (FSM) - 324dade3-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Each test will create its own page via fixture injection

  test('Idle state: createGraphVisual runs on load and initial graph DOM is present', async ({ page }) => {
    // This test validates the initial (Idle) state entry action createGraphVisual()
    const dfs = new DFSPage(page);

    // Capture any page errors that occur during load
    const pageErrors = [];
    const onPageError = e => pageErrors.push(e);
    page.on('pageerror', onPageError);

    await dfs.goto();

    // Expect no uncaught page errors on load
    expect(pageErrors).toEqual([]);

    // Validate nodes A-F exist
    const nodeIds = await dfs.getNodeIds();
    // The graph as defined contains nodes: A,B,C,D,E,F (order may vary slightly based on iteration order)
    const expectedNodes = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const id of expectedNodes) {
      expect(nodeIds).toContain(id);
    }

    // Validate node count
    expect(await dfs.getNodeCount()).toBe(expectedNodes.length);

    // Validate edges count equals number of adjacency entries:
    // A->B, A->C, B->D, B->E, C->F, E->F => 6 edges
    const edgeCount = await dfs.getEdgeCount();
    expect(edgeCount).toBe(6);

    // Ensure nodes are not highlighted initially (no background lightgreen)
    const highlightedCount = await dfs.allNodesHighlightedCount();
    expect(highlightedCount).toBe(0);

    page.off('pageerror', onPageError);
  });

  test('StartDFS event triggers transition to DFS Started state and performs DFS highlighting in correct order', async ({ page }) => {
    // This test validates the StartDFS event, entry actions for DFS Started (visited.clear, createGraphVisual, setTimeout -> dfs('A')),
    // and observable behavior: console logs for node visits and nodes highlighted in DOM.
    const dfs1 = new DFSPage(page);

    // Arrays to capture console logs and page errors
    const nodeLogs = [];
    const pageErrors1 = [];

    // Listen to console messages
    const onConsole = msg => {
      // Only capture log-level messages emitted by the page
      if (msg.type() === 'log') {
        // Push the message text
        nodeLogs.push(msg.text());
      }
    };
    const onPageError1 = e => pageErrors.push(e);

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    await dfs.goto();

    // Ensure visited exists and is empty on load (Idle state's entry_actions may have created the graph)
    const visitedSizeOnLoad = await dfs.getVisitedSize();
    // visited should be a Set and initially empty
    expect(visitedSizeOnLoad).toBe(0);

    // Record time, click Start DFS, and assert DFS starts after ~1 second delay (setTimeout 1000 in startDFS)
    const t0 = Date.now();
    await dfs.startDFS();

    // Immediately after clicking, startDFS() calls visited.clear() synchronously and createGraphVisual()
    // Therefore visited should still be 0 at this moment (before the setTimeout executes)
    const visitedSizeImmediatelyAfterStart = await dfs.getVisitedSize();
    expect(visitedSizeImmediatelyAfterStart).toBe(0);

    // Wait for the first console log (visit of 'A'); set an upper bound to avoid waiting forever
    const firstLog = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        page.off('console', onConsole);
        reject(new Error('Timed out waiting for first console log from DFS'));
      }, 3000);

      const handler = msg => {
        if (msg.type() === 'log') {
          // resolve with the log text
          clearTimeout(timeout);
          page.off('console', handler);
          resolve(msg.text());
        }
      };
      page.on('console', handler);
    });

    const t1 = Date.now();
    const elapsed = t1 - t0;
    // The DFS begins after a 1000ms timeout in startDFS(); allow a small margin (>= 900ms)
    expect(elapsed).toBeGreaterThanOrEqual(900);

    // We expect the DFS traversal order to be: A, B, D, E, F, C
    const expectedOrder = ['A', 'B', 'D', 'E', 'F', 'C'];

    // Wait until all nodes are highlighted (background set to lightgreen by dfs)
    await page.waitForFunction(
      expectedCount => {
        const nodes = Array.from(document.querySelectorAll('#graph .node'));
        const highlighted = nodes.filter(n => {
          const bg1 = window.getComputedStyle(n).backgroundColor;
          // Accept rgb(...) or keyword match
          return bg && (bg.includes('rgb') ? bg !== 'rgba(0, 0, 0, 0)' : bg.toLowerCase() === 'lightgreen');
        });
        return highlighted.length === expectedCount;
      },
      expectedOrder.length,
      { timeout: 5000 }
    );

    // At this point all visit logs should have been emitted; filter nodeLogs to the single-letter nodes to avoid any other console noise
    const filteredNodeLogs = nodeLogs.filter(text => typeof text === 'string' && /^[A-F]$/.test(text));
    // The console log array may contain multiple other logs; ensure the sequence includes expectedOrder in order
    expect(filteredNodeLogs.join(',')).toContain(expectedOrder.join(','));

    // Confirm that all nodes are highlighted in the DOM
    const highlightedCountFinal = await dfs.allNodesHighlightedCount();
    expect(highlightedCountFinal).toBe(expectedOrder.length);

    // Confirm visited Set in page now contains all nodes (size 6)
    const visitedSizeAfterDFS = await dfs.getVisitedSize();
    expect(visitedSizeAfterDFS).toBe(expectedOrder.length);

    // No uncaught page errors should have occurred
    expect(pageErrors.length).toBe(0);

    // Clean up listeners
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  });

  test('Repeated StartDFS clicks reset visited and recreate visuals; multiple runs complete without errors', async ({ page }) => {
    // This test covers the transition when the user triggers StartDFS repeatedly (edge case).
    // It ensures startDFS clears visited, re-creates visuals, and a subsequent DFS run completes successfully.

    const dfs2 = new DFSPage(page);

    const nodeLogs1 = [];
    const pageErrors2 = [];
    const onConsole1 = msg => {
      if (msg.type() === 'log') nodeLogs.push(msg.text());
    };
    const onPageError2 = e => pageErrors.push(e);

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    await dfs.goto();

    // First run
    await dfs.startDFS();

    // Wait for traversal to finish by checking all nodes highlighted
    await page.waitForFunction(expectedCount => {
      const nodes1 = Array.from(document.querySelectorAll('#graph .node'));
      const highlighted1 = nodes.filter(n => {
        const bg2 = window.getComputedStyle(n).backgroundColor;
        return bg && (bg.includes('rgb') ? bg !== 'rgba(0, 0, 0, 0)' : bg.toLowerCase() === 'lightgreen');
      });
      return highlighted.length === expectedCount;
    }, 6, { timeout: 5000 });

    const visitedAfterFirst = await dfs.getVisitedSize();
    expect(visitedAfterFirst).toBe(6);

    // Prepare for second run: clear captured logs and trigger Start DFS again quickly (user clicks again)
    nodeLogs.length = 0;

    // Click Start DFS again (this should clear visited and recreate the graph visual immediately, then start DFS after 1s)
    const t01 = Date.now();
    await dfs.startDFS();

    // Immediately after starting, visited must be cleared (0) due to visited.clear() in startDFS entry actions
    const visitedImmediatelyAfterSecondStart = await dfs.getVisitedSize();
    expect(visitedImmediatelyAfterSecondStart).toBe(0);

    // Wait for the second traversal to finish similarly
    await page.waitForFunction(expectedCount => {
      const nodes2 = Array.from(document.querySelectorAll('#graph .node'));
      const highlighted2 = nodes.filter(n => {
        const bg3 = window.getComputedStyle(n).backgroundColor;
        return bg && (bg.includes('rgb') ? bg !== 'rgba(0, 0, 0, 0)' : bg.toLowerCase() === 'lightgreen');
      });
      return highlighted.length === expectedCount;
    }, 6, { timeout: 5000 });

    const t11 = Date.now();
    // Confirm that at least ~1 second elapsed before DFS started
    expect(t1 - t0).toBeGreaterThanOrEqual(900);

    // After the second run, visited should again be 6
    const visitedAfterSecond = await dfs.getVisitedSize();
    expect(visitedAfterSecond).toBe(6);

    // Ensure there were no uncaught page errors across both runs
    expect(pageErrors.length).toBe(0);

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  });

  test('Robustness: clicking Start DFS rapidly multiple times should not throw runtime errors', async ({ page }) => {
    // This test exercises error scenarios: rapid user interaction to ensure the implementation tolerates repeated clicks.
    const dfs3 = new DFSPage(page);

    const pageErrors3 = [];
    const onPageError3 = e => pageErrors.push(e);
    page.on('pageerror', onPageError);

    await dfs.goto();

    // Rapidly click the Start DFS button multiple times
    await Promise.all([
      dfs.startDFS(),
      dfs.startDFS(),
      dfs.startDFS()
    ]).catch(() => {
      // If the page.click promise rejects, let the test continue; we will assert errors via page.on('pageerror')
    });

    // Wait a reasonable time for traversals to settle
    await page.waitForTimeout(2500);

    // Check final visited size is 6 (the algorithm should complete at least one full traversal)
    const finalVisited = await dfs.getVisitedSize();
    expect(finalVisited).toBe(6);

    // Assert there were no uncaught runtime errors emitted to the page error event
    expect(pageErrors.length).toBe(0);

    page.off('pageerror', onPageError);
  });
});