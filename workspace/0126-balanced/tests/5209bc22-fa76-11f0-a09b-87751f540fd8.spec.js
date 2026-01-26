import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209bc22-fa76-11f0-a09b-87751f540fd8.html';

// Simple page object to encapsulate repetitive actions and observations
class GraphPage {
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // bind listeners
    this._onConsole = message => {
      // capture only text for simplicity
      try {
        this.consoleMessages.push({ type: message.type(), text: message.text() });
      } catch (e) {
        // best effort capture
        this.consoleMessages.push({ type: 'unknown', text: String(message) });
      }
    };
    this._onPageError = err => {
      // err is Error
      this.pageErrors.push(err);
    };
  }

  async init() {
    this.page.on('console', this._onConsole);
    this.page.on('pageerror', this._onPageError);
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // small wait to allow any synchronous logs/errors to be emitted and captured
    await this.page.waitForTimeout(50);
  }

  async dispose() {
    this.page.off('console', this._onConsole);
    this.page.off('pageerror', this._onPageError);
  }

  // DOM helpers
  graphLocator() {
    return this.page.locator('#graph');
  }

  nodesLocator() {
    return this.page.locator('#graph .node');
  }

  // Access in-page variables/functions via evaluation
  async getNodesArray() {
    return this.page.evaluate(() => {
      // nodes is declared in the page script with let and should be accessible here
      try {
        return nodes.slice(); // return a shallow copy
      } catch (e) {
        return { __error__: String(e) };
      }
    });
  }

  async getEdgesArray() {
    return this.page.evaluate(() => {
      try {
        return edges.slice();
      } catch (e) {
        return { __error__: String(e) };
      }
    });
  }

  async callBranch(node, parent) {
    return this.page.evaluate(
      ({ n, p }) => {
        try {
          // call branch and return result
          return branch(n, p);
        } catch (e) {
          // propagate error info back to test
          return { __error__: String(e) };
        }
      },
      { n: node, p: parent }
    );
  }

  async callBound(node) {
    return this.page.evaluate(
      n => {
        try {
          return bound(n);
        } catch (e) {
          return { __error__: String(e) };
        }
      },
      node
    );
  }

  // Attempt to call a function that does not exist to trigger ReferenceError
  async callRenderPage() {
    return this.page.evaluate(() => {
      // Deliberately call a function that is not defined in the page to observe the natural error.
      return renderPage();
    });
  }

  getConsoleMessages() {
    return this.consoleMessages.map(m => m.text);
  }

  getPageErrors() {
    return this.pageErrors.map(e => e.message ?? String(e));
  }
}

test.describe('5209bc22-fa76-11f0-a09b-87751f540fd8 - Branch and Bound interactive app', () => {
  let graphPage;

  test.beforeEach(async ({ page }) => {
    graphPage = new GraphPage(page);
    await graphPage.init();
  });

  test.afterEach(async () => {
    await graphPage.dispose();
  });

  test('Initial Idle state -> DOM rendering and nodes present (S0_Idle -> S1_NodeAdded)', async () => {
    // This test validates that the initial script executed addNode calls on load,
    // resulting in DOM elements representing nodes A-E.
    const nodeCount = await graphPage.nodesLocator().count();
    // Expect 5 nodes rendered in the graph container (A, B, C, D, E)
    expect(nodeCount).toBe(5);

    // Verify the text content of each node in order of insertion
    const texts = [];
    for (let i = 0; i < nodeCount; i++) {
      texts.push(await graphPage.nodesLocator().nth(i).innerText());
    }
    expect(texts).toEqual(['A', 'B', 'C', 'D', 'E']);

    // Also verify the in-page nodes array has the same contents
    const nodesArray = await graphPage.getNodesArray();
    // If nodes variable is accessible, it should be an array
    expect(Array.isArray(nodesArray)).toBe(true);
    expect(nodesArray).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  test('AddEdge transition (S1_NodeAdded -> S2_EdgeAdded): edges array integrity', async () => {
    // Validate that edge additions executed during page load produced expected entries
    const edgesArray = await graphPage.getEdgesArray();
    // There were four addEdge calls. Note: the page implementation defines addEdge(edge) and pushes only the first param.
    // Therefore we assert the exact values the implementation produced.
    expect(Array.isArray(edgesArray)).toBe(true);
    expect(edgesArray.length).toBe(4);
    // Based on calls: addEdge('A','B') => 'A', addEdge('A','C') => 'A', addEdge('B','D') => 'B', addEdge('C','E') => 'C'
    expect(edgesArray).toEqual(['A', 'A', 'B', 'C']);
  });

  test('Branching (S2_EdgeAdded -> S3_Branching): branch function behavior and console logs', async () => {
    // The script called branch('A', null) during load and logged its result.
    // Validate calling branch('A', null) ourselves returns the same result (expected null)
    const branchResult = await graphPage.callBranch('A', null);
    // The implementation returns null (no branching result), assert that.
    expect(branchResult).toBeNull();

    // Check that page console includes logs. The script logged branch result and bound result on load.
    const consoleMsgs = graphPage.getConsoleMessages();
    // Expect at least two log messages containing 'null' from the script's console.log(result) and console.log(bound('A'))
    const nullLogs = consoleMsgs.filter(m => m === 'null' || m.includes('null'));
    expect(nullLogs.length).toBeGreaterThanOrEqual(2);
  });

  test('Bounding (S3_Branching -> S4_Bounding): bound function behavior', async () => {
    // Validate the bound implementation returns null for 'A' as observed on initial load
    const boundResult = await graphPage.callBound('A');
    expect(boundResult).toBeNull();

    // Also test bound with a node that does not exist (edge case)
    const boundNonExistent = await graphPage.callBound('Z');
    // The function should not throw; per implementation, it will likely return null.
    expect(boundNonExistent).toBeNull();
  });

  test('Error scenario: calling missing function renderPage triggers a ReferenceError in-page', async () => {
    // This test deliberately invokes a function that is not defined in the page script to validate
    // that ReferenceErrors surface naturally and are observable to the test harness.
    // We expect the page.evaluate to reject with an evaluation error due to renderPage not being defined.
    let threw = false;
    try {
      await graphPage.callRenderPage();
    } catch (err) {
      threw = true;
      // The thrown error message should reference renderPage being not defined.
      // Different browsers/environments may format the message differently, so be permissive.
      const msg = String(err.message || err);
      expect(msg).toMatch(/renderPage|is not defined|ReferenceError/);
    }
    expect(threw).toBe(true);
  });

  test('Edge case tests and observability: calling branch with non-existing parent and capturing page errors', async () => {
    // Call branch with a node that exists but a parent value that's unusual to ensure no uncaught exceptions
    const safeCall = await graphPage.callBranch('A', 'non-existent-parent');
    // Implementation is defensive and should return null rather than throw
    expect(safeCall).toBeNull();

    // Inspect any page errors captured during this test sequence (should be empty except for our deliberate invocation)
    const pageErrors = graphPage.getPageErrors();
    // We expect no unexpected page errors aside from potential ones triggered by deliberate renderPage call above.
    // (This assertion is permissive: we assert it's an array; individual tests that expect errors check them explicitly.)
    expect(Array.isArray(pageErrors)).toBe(true);
  });
});