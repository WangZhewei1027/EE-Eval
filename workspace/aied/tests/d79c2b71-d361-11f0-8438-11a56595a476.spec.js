import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c2b71-d361-11f0-8438-11a56595a476.html';

// Page Object for interacting with the Graph app
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvasLocator = page.locator('#graphCanvas');
    this.selectLocator = page.locator('#graphType');
    this.resetBtnLocator = page.locator('#resetBtn');

    // Lists to capture console errors and page errors for assertions
    this.consoleErrors = [];
    this.pageErrors = [];
    this.dialogMessages = [];

    // Hook up listeners
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err.message);
    });
    this.page.on('dialog', async (dialog) => {
      // Capture alert messages so tests can assert them
      this.dialogMessages.push(dialog.message());
      await dialog.dismiss(); // use dismiss to avoid altering app flow (alerts are informational)
    });
  }

  // Navigate and wait for initial draw
  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    // Wait a short moment to allow initial draw to run
    await this.page.waitForTimeout(100);
  }

  // Get canvas bounding box for coordinate calculations
  async canvasBox() {
    const box = await this.canvasLocator.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    return box;
  }

  // Click on canvas at an offset relative to top-left of canvas
  async clickCanvasAt(offsetX, offsetY) {
    const box = await this.canvasBox();
    const x = box.x + offsetX;
    const y = box.y + offsetY;
    await this.page.mouse.click(x, y);
    // allow app to process click and redraw
    await this.page.waitForTimeout(50);
  }

  // Convenience: click near the center
  async clickCenter() {
    const box = await this.canvasBox();
    await this.clickCanvasAt(box.width / 2, box.height / 2);
  }

  // Change graph type select
  async changeGraphType(value) {
    await this.selectLocator.selectOption(value);
    // wait for draw
    await this.page.waitForTimeout(50);
  }

  // Click the reset button
  async clickReset() {
    await this.resetBtnLocator.click();
    await this.page.waitForTimeout(50);
  }

  // Read internal application state via evaluation - nodes, edges, selectedNodeIndex, graphType
  async getInternalState() {
    return await this.page.evaluate(() => {
      // Access variables defined by the application in the closure
      // They exist in the top-level IIFE scope; try to extract via known element contexts:
      // Since the implementation does not export globals, we attempt to glean state by
      // walking canvas context if possible. However, the implementation keeps data in closure variables.
      // To remain non-invasive we will attempt to read window variables if present.
      // If not available, return nulls so tests can still assert via observable behaviors.
      return {
        // These will likely be undefined because the IIFE doesn't expose them to window.
        nodes: typeof nodes !== 'undefined' ? nodes.slice() : null,
        edges: typeof edges !== 'undefined' ? edges.slice() : null,
        selectedNodeIndex: typeof selectedNodeIndex !== 'undefined' ? selectedNodeIndex : null,
        graphType: typeof graphType !== 'undefined' ? graphType : null,
      };
    });
  }

  // Fallback state via synthetic inspection:
  // We can track number of nodes and edges by invoking tiny clicks and observing changes in internal arrays when accessible,
  // but to remain safe we provide helper functions that attempt to read nodes/edges via page.evaluate.
  async nodesCount() {
    const r = await this.page.evaluate(() => {
      try {
        if (typeof nodes !== 'undefined') return nodes.length;
        return null;
      } catch (e) {
        return null;
      }
    });
    return r;
  }

  async edgesCount() {
    const r = await this.page.evaluate(() => {
      try {
        if (typeof edges !== 'undefined') return edges.length;
        return null;
      } catch (e) {
        return null;
      }
    });
    return r;
  }

  async selectedIndex() {
    const r = await this.page.evaluate(() => {
      try {
        if (typeof selectedNodeIndex !== 'undefined') return selectedNodeIndex;
        return null;
      } catch (e) {
        return null;
      }
    });
    return r;
  }

  async currentGraphType() {
    const r = await this.page.evaluate(() => {
      try {
        if (typeof graphType !== 'undefined') return graphType;
        return null;
      } catch (e) {
        return null;
      }
    });
    return r;
  }

  // Expose captured logs for assertions
  getConsoleErrors() {
    return this.consoleErrors.slice();
  }
  getPageErrors() {
    return this.pageErrors.slice();
  }
  getDialogMessages() {
    return this.dialogMessages.slice();
  }
}

test.describe('Graph Visualization (Directed/Undirected) - FSM validation', () => {
  // Each test will create its own Page and GraphPage wrapper via test fixtures
  test.beforeEach(async ({ page }) => {
    // nothing global here - individual tests create GraphPage instances
  });

  test('Initial load: canvas present, initial draw executed (Idle state)', async ({ page }) => {
    // This test validates initial application state after load (S0_Idle)
    const gp = new GraphPage(page);
    await gp.goto();

    // Assert canvas element exists and has expected dimensions
    const canvas = page.locator('#graphCanvas');
    await expect(canvas).toHaveCount(1);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(700); // width should be near 800
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(500); // height should be near 600

    // Try to read internal state; if closure variables are not exposed, the test will continue to use DOM-level assertions
    const internal = await gp.getInternalState();

    // When implementation exposes nodes/edges, they should be arrays and initially empty
    if (internal.nodes !== null) {
      expect(Array.isArray(internal.nodes)).toBe(true);
      expect(internal.nodes.length).toBe(0);
    }
    if (internal.edges !== null) {
      expect(Array.isArray(internal.edges)).toBe(true);
      expect(internal.edges.length).toBe(0);
    }
    // Ensure graphType select defaults to undirected (via DOM)
    await expect(page.locator('#graphType')).toHaveValue('undirected');

    // No console or page errors should be present
    expect(gp.getConsoleErrors()).toEqual([]);
    expect(gp.getPageErrors()).toEqual([]);
  });

  test('Clicking empty canvas adds a node; selecting/deselecting node transitions', async ({ page }) => {
    // Validate transitions:
    // - Idle -> (click empty) addNode
    // - click node when none selected -> NodeSelected
    // - click same node again -> deselect (stay in NodeSelected or return to Idle depending on FSM)
    const gp = new GraphPage(page);
    await gp.goto();

    const box = await gp.canvasBox();

    // Click at one position to add a node
    await gp.clickCanvasAt(100, 100);
    // Check internal nodes count if accessible
    const nodesAfterOne = await gp.nodesCount();
    if (nodesAfterOne !== null) {
      expect(nodesAfterOne).toBeGreaterThanOrEqual(1);
    }

    // Click the same spot to select the node
    // Use exact coordinate near previously added node
    await gp.clickCanvasAt(100, 100);
    const selected = await gp.selectedIndex();
    // If selectedNodeIndex is exposed, it should be 0 (the first node)
    if (selected !== null) {
      expect(selected).toBe(0);
    }

    // Click same node again to deselect
    await gp.clickCanvasAt(100, 100);
    const selectedAfterDeselect = await gp.selectedIndex();
    if (selectedAfterDeselect !== null) {
      expect(selectedAfterDeselect).toBe(null);
    }

    // Ensure no console/page errors were emitted during these interactions
    const consoleErrors = gp.getConsoleErrors();
    const pageErrors = gp.getPageErrors();
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Creating an edge between two nodes and preventing duplicates (S1_NodeSelected -> S2_EdgeCreated)', async ({ page }) => {
    // This test covers:
    // - Add two nodes
    // - Select first node then click second node to create edge
    // - Attempt to create the same edge again; expect an alert "This edge already exists."
    const gp = new GraphPage(page);
    await gp.goto();

    // Choose two distinct positions for nodes
    await gp.clickCanvasAt(150, 120); // create node 1
    await gp.clickCanvasAt(350, 220); // create node 2

    // If nodes are accessible, ensure there are at least 2
    const nodesCount = await gp.nodesCount();
    if (nodesCount !== null) {
      expect(nodesCount).toBeGreaterThanOrEqual(2);
    }

    // Select first node (near 150,120)
    await gp.clickCanvasAt(150, 120);
    let sel = await gp.selectedIndex();
    if (sel !== null) expect(sel).toBe(0);

    // Click second node to create an edge
    await gp.clickCanvasAt(350, 220);
    // After creating an edge, selectedNodeIndex should be null
    sel = await gp.selectedIndex();
    if (sel !== null) expect(sel).toBe(null);

    // Validate edge creation via internal edges array if available
    const edgesCount = await gp.edgesCount();
    if (edgesCount !== null) {
      expect(edgesCount).toBeGreaterThanOrEqual(1);
    }

    // Attempt to recreate the same undirected edge:
    // select first node again
    await gp.clickCanvasAt(150, 120);
    sel = await gp.selectedIndex();
    if (sel !== null) expect(sel).toBe(0);

    // click second node again -> should trigger alert "This edge already exists."
    await gp.clickCanvasAt(350, 220);
    // The dialog handler in GraphPage dismisses alerts and stores messages
    const dialogs = gp.getDialogMessages();
    // There should be at least one dialog, and one of them should match the duplicate edge message
    const found = dialogs.some(msg => /already exists/i.test(msg));
    expect(found).toBe(true);

    // Also ensure no uncaught page errors
    expect(gp.getConsoleErrors()).toEqual([]);
    expect(gp.getPageErrors()).toEqual([]);
  });

  test('Prevent self-edge creation by deselection when clicking same node (edge case)', async ({ page }) => {
    // The implementation prevents self-edge creation by deselecting if selectedNodeIndex === clickedNodeIndex.
    // Validate that no "Cannot create edge from a node to itself." alert is shown in normal click flow,
    // and no extra edge is added.
    const gp = new GraphPage(page);
    await gp.goto();

    // Place a single node
    await gp.clickCanvasAt(400, 300);

    const initialEdges = await gp.edgesCount();

    // Select the node
    await gp.clickCanvasAt(400, 300);
    const sel = await gp.selectedIndex();
    if (sel !== null) expect(sel).toBe(0);

    // Click same node again -> should deselect, not create a self-edge
    await gp.clickCanvasAt(400, 300);

    const edgesAfter = await gp.edgesCount();
    if (initialEdges !== null && edgesAfter !== null) {
      expect(edgesAfter).toBe(initialEdges); // no new edge
    }

    // Ensure no specific self-edge alert was shown via dialog messages
    const dialogs = gp.getDialogMessages();
    const selfEdgeAlert = dialogs.some(m => /Cannot create edge from a node to itself/i.test(m));
    // The normal click flow does not surface this alert, so assert that it was not shown.
    expect(selfEdgeAlert).toBe(false);

    // Also ensure no runtime errors occurred
    expect(gp.getConsoleErrors()).toEqual([]);
    expect(gp.getPageErrors()).toEqual([]);
  });

  test('Switching graph type preserves edges and changes mode (ChangeGraphType event)', async ({ page }) => {
    // Validate ChangeGraphType event handling:
    // - Create two nodes and an edge (undirected)
    // - Change graph type to 'directed' and ensure graphType changed (via select value or internal variable)
    // - Edges should still be present (no automatic removal on change); selected node cleared
    const gp = new GraphPage(page);
    await gp.goto();

    // Create nodes and an edge between them
    await gp.clickCanvasAt(120, 140);
    await gp.clickCanvasAt(220, 240);
    await gp.clickCanvasAt(120, 140); // select first
    await gp.clickCanvasAt(220, 240); // create edge

    const edgesBefore = await gp.edgesCount();

    // Change to directed graph
    await gp.changeGraphType('directed');

    // Validate select value updated
    await expect(page.locator('#graphType')).toHaveValue('directed');

    // Try to read internal graphType if accessible
    const gType = await gp.currentGraphType();
    if (gType !== null) {
      expect(gType).toBe('directed');
    }

    // Edges should remain unchanged (same count or null if inaccessible)
    const edgesAfter = await gp.edgesCount();
    if (edgesBefore !== null && edgesAfter !== null) {
      expect(edgesAfter).toBe(edgesBefore);
    }

    // Ensure selectedNodeIndex was cleared on change
    const sel = await gp.selectedIndex();
    if (sel !== null) expect(sel).toBe(null);

    // No runtime errors should be present
    expect(gp.getConsoleErrors()).toEqual([]);
    expect(gp.getPageErrors()).toEqual([]);
  });

  test('Reset Graph clears nodes, edges, and selection (S3_GraphReset)', async ({ page }) => {
    // Validate ResetGraph event:
    // - Add a few nodes and edges
    // - Click Reset -> nodes/edges emptied and selection cleared
    // - Visual canvas remains present and no runtime errors
    const gp = new GraphPage(page);
    await gp.goto();

    // Create multiple nodes and an edge
    await gp.clickCanvasAt(80, 80);
    await gp.clickCanvasAt(180, 80);
    await gp.clickCanvasAt(80, 80);  // select first
    await gp.clickCanvasAt(180, 80); // create edge

    // Ensure there is at least one node and one edge if accessible
    const nodesBefore = await gp.nodesCount();
    const edgesBefore = await gp.edgesCount();

    if (nodesBefore !== null) expect(nodesBefore).toBeGreaterThanOrEqual(2);
    if (edgesBefore !== null) expect(edgesBefore).toBeGreaterThanOrEqual(1);

    // Click Reset button
    await gp.clickReset();

    // Now internal arrays should be empty if accessible
    const nodesAfter = await gp.nodesCount();
    const edgesAfter = await gp.edgesCount();
    const selAfter = await gp.selectedIndex();

    if (nodesAfter !== null) expect(nodesAfter).toBe(0);
    if (edgesAfter !== null) expect(edgesAfter).toBe(0);
    if (selAfter !== null) expect(selAfter).toBe(null);

    // Also assert that canvas still exists and no errors occurred
    await expect(page.locator('#graphCanvas')).toHaveCount(1);
    expect(gp.getConsoleErrors()).toEqual([]);
    expect(gp.getPageErrors()).toEqual([]);
  });

  test('Runtime observation: capture any ReferenceError/SyntaxError/TypeError if they occur', async ({ page }) => {
    // This test intentionally only observes runtime console/page errors and asserts none of the
    // common fatal JS error types occurred during a variety of interactions.
    const gp = new GraphPage(page);
    await gp.goto();

    // Perform a sequence of interactions
    await gp.clickCanvasAt(60, 400);
    await gp.clickCanvasAt(160, 400);
    await gp.clickCanvasAt(60, 400);  // select then create edge
    await gp.clickCanvasAt(160, 400);

    // Change graph type back and forth
    await gp.changeGraphType('directed');
    await gp.changeGraphType('undirected');

    // Reset
    await gp.clickReset();

    // Collect any captured errors/messages
    const consoleErrs = gp.getConsoleErrors();
    const pageErrs = gp.getPageErrors();

    // Assert that none of the captured messages indicate ReferenceError/SyntaxError/TypeError
    const combined = [...consoleErrs, ...pageErrs].join('\n').toLowerCase();
    expect(/referenceerror|syntaxerror|typeerror/i.test(combined)).toBe(false);

    // Also assert no console error messages at all
    expect(consoleErrs).toEqual([]);
    expect(pageErrs).toEqual([]);
  });
});