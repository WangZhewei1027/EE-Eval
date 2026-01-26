import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d2d75-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the graph application
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the app URL and attach listeners for console/page errors
  async gotoAndCaptureLogs(capture) {
    // capture: { consoleMessages: [], pageErrors: [] }
    this.page.on('console', msg => {
      // store all console messages (type, text)
      capture.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', err => {
      // store page errors (uncaught exceptions)
      capture.pageErrors.push(err);
    });
    await this.page.goto(APP_URL);
  }

  // Click the Draw Graph button
  async clickDrawGraph() {
    await this.page.click('#draw-graph');
  }

  // Get counts of nodes and edges currently in the container
  async getRenderedCounts() {
    return this.page.evaluate(() => {
      const container = document.getElementById('graph-container');
      const nodes = container.querySelectorAll('.node');
      const edges = container.querySelectorAll('.edge');
      return { nodes: nodes.length, edges: edges.length };
    });
  }

  // Get text contents of rendered nodes in order
  async getNodeTexts() {
    return this.page.evaluate(() => {
      const container = document.getElementById('graph-container');
      return Array.from(container.querySelectorAll('.node')).map(n => n.textContent.trim());
    });
  }

  // Get positions (left, top) for each rendered node as numbers
  async getNodePositions() {
    return this.page.evaluate(() => {
      const container = document.getElementById('graph-container');
      return Array.from(container.querySelectorAll('.node')).map(n => {
        const left = parseFloat(n.style.left || window.getComputedStyle(n).left || '0');
        const top = parseFloat(n.style.top || window.getComputedStyle(n).top || '0');
        return { left, top, text: n.textContent.trim() };
      });
    });
  }

  // Get width and transform of each edge
  async getEdgeStyles() {
    return this.page.evaluate(() => {
      const container = document.getElementById('graph-container');
      return Array.from(container.querySelectorAll('.edge')).map(e => {
        return {
          width: parseFloat(e.style.width || '0'),
          transform: e.style.transform || '',
          transformOrigin: e.style.transformOrigin || ''
        };
      });
    });
  }

  // Access the global nodes/edges arrays defined by the app script
  async getModelNodesEdges() {
    return this.page.evaluate(() => {
      // nodes and edges are global constants in the page script
      return { nodes: window.nodes, edges: window.edges };
    });
  }

  // Check whether draw button exists and is visible
  async isDrawButtonVisible() {
    return this.page.isVisible('#draw-graph');
  }

  // Check whether graph container exists
  async isGraphContainerPresent() {
    return this.page.$('#graph-container').then(el => !!el);
  }
}

test.describe('Undirected Graph Visualization (FSM: S0_Idle -> S1_GraphDrawn)', () => {
  // Capture console and page errors for each test
  let capture;

  test.beforeEach(async ({ page }) => {
    capture = { consoleMessages: [], pageErrors: [] };
    const gp = new GraphPage(page);
    await gp.gotoAndCaptureLogs(capture);
  });

  test.afterEach(async ({ page }) => {
    // Ensure we detach listeners to avoid leakage between tests
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle: initial render shows Draw Graph button and empty graph container', async ({ page }) => {
    const gp = new GraphPage(page);

    // Validate Draw Graph button presence (evidence of S0_Idle)
    const buttonVisible = await gp.isDrawButtonVisible();
    expect(buttonVisible).toBe(true);

    // Validate graph container is present
    const containerPresent = await gp.isGraphContainerPresent();
    expect(containerPresent).toBe(true);

    // container should be empty of .node and .edge elements initially
    const counts = await gp.getRenderedCounts();
    expect(counts.nodes).toBe(0);
    expect(counts.edges).toBe(0);

    // Validate that no uncaught page errors occurred during initial render
    // (Observing console and page errors as required)
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(capture.pageErrors.length).toBe(0);
  });

  test('DrawGraphClick event: clicking button transitions to S1_GraphDrawn (nodes and edges rendered)', async ({ page }) => {
    const gp = new GraphPage(page);

    // Click the Draw Graph button (this should call createGraph)
    await gp.clickDrawGraph();

    // Wait for nodes to be added - expecting the known number from the model
    const model = await gp.getModelNodesEdges();
    expect(model.nodes).toBeTruthy();
    expect(model.edges).toBeTruthy();
    const expectedNodeCount = model.nodes.length;
    const expectedEdgeCount = model.edges.length;

    // Poll until counts match expected (small timeout default)
    await page.waitForFunction(
      (expectedNodes, expectedEdges) => {
        const container = document.getElementById('graph-container');
        if (!container) return false;
        const nodes = container.querySelectorAll('.node');
        const edges = container.querySelectorAll('.edge');
        return nodes.length === expectedNodes && edges.length === expectedEdges;
      },
      expectedNodeCount,
      expectedEdgeCount
    );

    const counts = await gp.getRenderedCounts();
    expect(counts.nodes).toBe(expectedNodeCount);
    expect(counts.edges).toBe(expectedEdgeCount);

    // Nodes should display their id text content matching the model order (S1 evidence)
    const nodeTexts = await gp.getNodeTexts();
    // Model nodes have numeric ids; convert to string for comparison
    const expectedTexts = model.nodes.map(n => String(n.id));
    expect(nodeTexts).toEqual(expectedTexts);

    // Verify edge widths approximate the distances between node coordinates
    const nodePositions = await gp.getNodePositions();
    const edgeStyles = await gp.getEdgeStyles();

    // Build a map from node id to position to compute expected distances
    const posMap = {};
    nodePositions.forEach(np => {
      // The node text is the id (string)
      posMap[np.text] = { x: np.left, y: np.top };
    });

    // For each model edge, compute expected length and compare to rendered width
    for (let i = 0; i < model.edges.length; i++) {
      const edgeModel = model.edges[i];
      const from = String(edgeModel.from);
      const to = String(edgeModel.to);
      const fromPos = posMap[from];
      const toPos = posMap[to];
      // Ensure positions exist
      expect(fromPos).toBeTruthy();
      expect(toPos).toBeTruthy();

      const dx = toPos.x - fromPos.x;
      const dy = toPos.y - fromPos.y;
      const expectedLength = Math.hypot(dx, dy);

      // Rendered width
      const renderedWidth = edgeStyles[i].width;

      // Allow small pixel tolerance (edges may be fractional)
      const tolerance = 1.5; // px
      expect(Math.abs(renderedWidth - expectedLength)).toBeLessThanOrEqual(tolerance);
    }

    // Final assertion: no console errors or uncaught page errors occurred during drawing
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(capture.pageErrors.length).toBe(0);
  });

  test('Idempotency and exit/enter behavior: clicking Draw Graph multiple times replaces previous graph (no duplication)', async ({ page }) => {
    const gp = new GraphPage(page);

    // First click
    await gp.clickDrawGraph();
    const model = await gp.getModelNodesEdges();
    const expectedNodeCount = model.nodes.length;
    const expectedEdgeCount = model.edges.length;

    await page.waitForFunction(
      (expectedNodes, expectedEdges) => {
        const container = document.getElementById('graph-container');
        const nodes = container.querySelectorAll('.node');
        const edges = container.querySelectorAll('.edge');
        return nodes.length === expectedNodes && edges.length === expectedEdges;
      },
      expectedNodeCount,
      expectedEdgeCount
    );

    // Capture node ids after first draw
    const firstNodes = await gp.getNodeTexts();
    expect(firstNodes.length).toBe(expectedNodeCount);

    // Second click should clear and redraw (createGraph uses container.innerHTML = '')
    await gp.clickDrawGraph();

    // Wait again for the same counts (ensures redraw finished)
    await page.waitForFunction(
      (expectedNodes, expectedEdges) => {
        const container = document.getElementById('graph-container');
        const nodes = container.querySelectorAll('.node');
        const edges = container.querySelectorAll('.edge');
        return nodes.length === expectedNodes && edges.length === expectedEdges;
      },
      expectedNodeCount,
      expectedEdgeCount
    );

    const secondNodes = await gp.getNodeTexts();
    expect(secondNodes.length).toBe(expectedNodeCount);

    // Ensure that counts did not double (no 2x duplication)
    expect(secondNodes.length).toBe(firstNodes.length);

    // Ensure rendered nodes match the model ids (consistency)
    const expectedTexts = model.nodes.map(n => String(n.id));
    expect(secondNodes).toEqual(expectedTexts);

    // No console/page errors during repeated draws
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(capture.pageErrors.length).toBe(0);
  });

  test('Visual attributes: nodes have .node class, are visible and interactive (hover style not asserted visually)', async ({ page }) => {
    const gp = new GraphPage(page);

    // Draw the graph
    await gp.clickDrawGraph();

    const model = await gp.getModelNodesEdges();
    await page.waitForFunction((count) => {
      const c = document.getElementById('graph-container');
      return c.querySelectorAll('.node').length === count;
    }, model.nodes.length);

    // Check each node element has the .node class and is visible
    const nodesHandle = await page.$$('#graph-container .node');
    expect(nodesHandle.length).toBe(model.nodes.length);

    for (const handle of nodesHandle) {
      const className = await handle.getAttribute('class');
      expect(className.split(' ').includes('node')).toBe(true);

      // The nodes should be within the container and visible
      expect(await handle.isVisible()).toBe(true);

      // Node text should be a number string
      const text = (await handle.textContent())?.trim();
      expect(/^\d+$/.test(text || '')).toBe(true);
    }

    // No console/page errors during visual checks
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(capture.pageErrors.length).toBe(0);
  });

  test('Edge cases: page should not throw uncaught exceptions on load or user interactions (observe and assert)', async ({ page }) => {
    const gp = new GraphPage(page);

    // Perform several interactions: click, click again, query DOM extensively
    await gp.clickDrawGraph();
    await gp.clickDrawGraph();
    await gp.clickDrawGraph();

    // Access the model multiple times and read DOM properties to surface potential runtime errors
    for (let i = 0; i < 3; i++) {
      const model = await gp.getModelNodesEdges();
      // Ensure model arrays are arrays and have expected minimum lengths
      expect(Array.isArray(model.nodes)).toBe(true);
      expect(Array.isArray(model.edges)).toBe(true);
      expect(model.nodes.length).toBeGreaterThanOrEqual(1);
      expect(model.edges.length).toBeGreaterThanOrEqual(1);

      // Read node and edge styles
      const positions = await gp.getNodePositions();
      const edges = await gp.getEdgeStyles();
      expect(positions.length).toBe(model.nodes.length);
      expect(edges.length).toBe(model.edges.length);
    }

    // Now assert there were no uncaught exceptions or console.error messages captured
    // If the application had ReferenceError/SyntaxError/TypeError, they would have been captured as pageErrors or console errors.
    const consoleErrors = capture.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // pageErrors array contains uncaught exceptions thrown on the page
    expect(capture.pageErrors.length).toBe(0);
  });
});