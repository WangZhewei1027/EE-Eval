import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b0d911-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Helper Page Object for the Graph page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#graphCanvas');
    this.info = page.locator('#info');
    this.showAdjButton = page.locator('#showAdjacency');
    this.graphRepresentation = page.locator('#graphRepresentation');
  }

  async goto() {
    await this.page.goto(BASE, { waitUntil: 'load' });
    // wait until canvas and info are present and initial updateInfo was called
    await expect(this.canvas).toBeVisible();
    await expect(this.info).toHaveText(/Click a node to see its outgoing edges\./);
  }

  // Click at canvas-local coordinates
  async clickCanvasAt(x, y) {
    await this.canvas.click({ position: { x, y } });
    // small wait for redraw/updateInfo to run
    await this.page.waitForTimeout(100);
  }

  async clickShowAdjacency() {
    await this.showAdjButton.click();
    await this.page.waitForTimeout(50);
  }

  async getInfoText() {
    return (await this.info.textContent()) ?? '';
  }

  async getGraphRepresentationText() {
    return (await this.graphRepresentation.textContent()) ?? '';
  }

  // Return [r,g,b,a] for pixel at canvas coordinates (cx, cy)
  async getCanvasPixelRGBA(cx, cy) {
    return await this.page.evaluate(({ cx, cy }) => {
      const canvas = document.getElementById('graphCanvas');
      const ctx = canvas.getContext('2d');
      // getImageData accepts integer coords; clamp to valid ints within canvas bounds
      const x = Math.max(0, Math.min(Math.floor(cx), canvas.width - 1));
      const y = Math.max(0, Math.min(Math.floor(cy), canvas.height - 1));
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    }, { cx, cy });
  }
}

// Utility: compute simple color distance between two RGBA arrays
function colorDistRGBA(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2 +
    (a[3] - b[3]) ** 2
  );
}

test.describe('Directed Graph Demonstration - FSM validation', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console error messages
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If errors were captured, include them in the test output for debugging.
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((ce, i) => {
        testInfo.attach(`consoleError-${i}`, { body: JSON.stringify(ce), contentType: 'application/json' });
      });
    }
    if (pageErrors.length > 0) {
      pageErrors.forEach((pe, i) => {
        testInfo.attach(`pageError-${i}`, { body: String(pe), contentType: 'text/plain' });
      });
    }
    // Make a soft assertion at the end of each test that no uncaught console/page errors occurred.
    expect(consoleErrors.length, `Expected no console.error messages`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors`).toBe(0);
  });

  test('Initial state S0_Idle: canvas drawn and info shows initial message', async ({ page }) => {
    // Validate initial state S0_Idle: drawGraph() and updateInfo(null) executed
    const gp = new GraphPage(page);
    await gp.goto();

    // Validate #info contains the initial prompt message
    const infoText = await gp.getInfoText();
    expect(infoText.trim()).toBe('Click a node to see its outgoing edges.');

    // Graph representation is empty initially
    const repr = await gp.getGraphRepresentationText();
    expect(repr.trim()).toBe('');

    // Sanity check: sample pixel at a node center (A: 120,100) should be the default node color
    // Default node color in implementation: "#69a3f3" (~ rgb(105,163,243))
    const pixelA = await gp.getCanvasPixelRGBA(120, 100);
    // Ensure pixel is roughly blue-ish (R < 150, G > 100, B > 150)
    expect(pixelA[0]).toBeLessThan(150);
    expect(pixelA[1]).toBeGreaterThan(100);
    expect(pixelA[2]).toBeGreaterThan(150);
  });

  test('ShowAdjacency event: clicking button displays adjacency list (S0_Idle -> S0_Idle)', async ({ page }) => {
    // Validate clicking #showAdjacency displays adjacency list text in <pre>
    const gp = new GraphPage(page);
    await gp.goto();

    // Click the button to show adjacency list
    await gp.clickShowAdjacency();

    const text = await gp.getGraphRepresentationText();
    // It should start with the expected header
    expect(text).toContain('Adjacency List (Directed Graph):');

    // Check that nodes A-F appear with arrows and expected neighbors
    expect(text).toContain('A → B, D');
    expect(text).toContain('B → C, E');
    expect(text).toContain('C → F');
    expect(text).toContain('D → E');
    expect(text).toContain('E → F');
    expect(text).toContain('F → C');

    // Ensure clicking the adjacency button did not change the info text (still idle)
    const infoText = await gp.getInfoText();
    expect(infoText.trim()).toBe('Click a node to see its outgoing edges.');
  });

  test('CanvasClick on a node selects it and highlights outgoing edges (S0_Idle -> S1_NodeHighlighted)', async ({ page }) => {
    // Validate clicking on node A triggers Node Highlighted state:
    // - drawGraph(clickedNode.id) should change node color and outgoing edges color
    // - updateInfo(clickedNode.id) should update info text
    const gp = new GraphPage(page);
    await gp.goto();

    // Click node A at known canvas coordinates (120, 100)
    await gp.clickCanvasAt(120, 100);

    // Validate info updated for node A (A has edges to B and D)
    const infoText = await gp.getInfoText();
    expect(infoText).toBe('Node A has edges to: B, D.');

    // Validate the pixel at node A center changed to highlighted color "#2c7be5" (~ rgb(44,123,229))
    const pixelA = await gp.getCanvasPixelRGBA(120, 100);
    const highlightedRGB = [44, 123, 229, 255];
    const dist = colorDistRGBA(pixelA, highlightedRGB);
    // Use tolerant threshold to account for anti-aliasing
    expect(dist).toBeLessThan(60);

    // Validate an arrow pixel along the edge from A->B is more red (highlight uses "#e63946" ~ rgb(230,57,70))
    // Sample midpoint between A(120,100) and B(320,80) -> ~ (220,90)
    const edgeMid = await gp.getCanvasPixelRGBA(220, 90);
    const redArrowRGB = [230, 57, 70, 255];
    const distEdge = colorDistRGBA(edgeMid, redArrowRGB);
    // Arrow may be anti-aliased; red channel should be dominant compared to blue/green
    expect(edgeMid[0]).toBeGreaterThan(edgeMid[1]);
    expect(edgeMid[0]).toBeGreaterThan(edgeMid[2]);
    // And distance to expected red shouldn't be extremely large
    expect(distEdge).toBeLessThan(160);
  });

  test('Click outside of any node resets to Idle (S1_NodeHighlighted -> S0_Idle)', async ({ page }) => {
    // Validate clicking on empty canvas area causes drawGraph(null) and updateInfo(null)
    const gp = new GraphPage(page);
    await gp.goto();

    // First click a node to ensure we are in highlighted state
    await gp.clickCanvasAt(120, 100);
    expect(await gp.getInfoText()).toContain('Node A has edges to');

    // Now click an empty area - choose top-left corner inside canvas that's not a node (10,10)
    await gp.clickCanvasAt(10, 10);

    // Info should revert to initial idle message
    const infoText = await gp.getInfoText();
    expect(infoText.trim()).toBe('Click a node to see its outgoing edges.');

    // Pixel at node A center should revert to the default node color (~ rgb(105,163,243))
    const pixelA = await gp.getCanvasPixelRGBA(120, 100);
    const defaultRGB = [105, 163, 243, 255];
    const distDefault = colorDistRGBA(pixelA, defaultRGB);
    expect(distDefault).toBeLessThan(80); // tolerant threshold for anti-aliasing
  });

  test('Multiple canvas clicks: selecting different nodes updates info and highlights accordingly', async ({ page }) => {
    // Validate transitions: S0 -> S1 (A), S1 -> S1 (B), S1 -> S0 (click empty)
    const gp = new GraphPage(page);
    await gp.goto();

    // Click node B at (320, 80)
    await gp.clickCanvasAt(320, 80);
    expect(await gp.getInfoText()).toBe('Node B has edges to: C, E.');

    // Click node C at (500, 100) while B is highlighted to transition to new highlighted node
    await gp.clickCanvasAt(500, 100);
    expect(await gp.getInfoText()).toBe('Node C has edges to: F.');

    // Ensure pixel at C center approximates highlight color
    const pixelC = await gp.getCanvasPixelRGBA(500, 100);
    const highlightedRGB = [44, 123, 229, 255];
    expect(colorDistRGBA(pixelC, highlightedRGB)).toBeLessThan(60);

    // Click empty area to reset
    await gp.clickCanvasAt(650, 10);
    expect(await gp.getInfoText()).toBe('Click a node to see its outgoing edges.');
  });

  test('Edge cases: clicking near but outside node boundary should not select node', async ({ page }) => {
    // Validate that clicks just outside the node radius do not select node
    const gp = new GraphPage(page);
    await gp.goto();

    // Click just outside node A's radius. Node A at (120,100), radius 20.
    // Click at distance ~22 from center: e.g., (120 + 22, 100)
    await gp.clickCanvasAt(142, 100);

    // Should still be idle (no node selected)
    const infoText = await gp.getInfoText();
    expect(infoText.trim()).toBe('Click a node to see its outgoing edges.');

    // Pixel at (142,100) should not be the highlight color, likely background or edge color
    const sample = await gp.getCanvasPixelRGBA(142, 100);
    // Ensure it's not strongly matching the highlighted node color
    const highlightedRGB = [44, 123, 229, 255];
    expect(colorDistRGBA(sample, highlightedRGB)).toBeGreaterThan(80);
  });

  test('No uncaught exceptions or console.error messages were produced during interactions', async ({ page }) => {
    // This test exercises several interactions and then asserts no console errors or page errors were recorded.
    const gp = new GraphPage(page);
    await gp.goto();

    // Perform a set of interactions
    await gp.clickShowAdjacency();
    await gp.clickCanvasAt(120, 100);
    await gp.clickCanvasAt(320, 80);
    await gp.clickCanvasAt(10, 10);

    // After interactions, the afterEach hook will assert that consoleErrors and pageErrors are empty.
    // Here we also assert that the adjacency pre contains expected header to ensure it executed.
    const adjText = await gp.getGraphRepresentationText();
    expect(adjText).toContain('Adjacency List (Directed Graph):');
  });
});