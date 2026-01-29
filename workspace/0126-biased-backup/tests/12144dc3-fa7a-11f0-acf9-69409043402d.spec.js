import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12144dc3-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page object for interacting with the Bellman-Ford demo page.
 * Encapsulates common UI operations to keep tests readable.
 */
class BellmanFordPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.vertexCountInput = page.locator('#vertex-count');
    this.setVertexCountBtn = page.locator('#set-vertex-count');
    this.edgeFromInput = page.locator('#edge-from');
    this.edgeToInput = page.locator('#edge-to');
    this.edgeWeightInput = page.locator('#edge-weight');
    this.addEdgeBtn = page.locator('#add-edge');
    this.removeEdgeBtn = page.locator('#remove-edge');
    this.sourceVertexInput = page.locator('#source-vertex');
    this.setSourceBtn = page.locator('#set-source');
    this.resetAlgorithmBtn = page.locator('#reset-algorithm');
    this.stepForwardBtn = page.locator('#step-forward');
    this.stepBackwardBtn = page.locator('#step-backward');
    this.runToEndBtn = page.locator('#run-to-end');
    this.importExportArea = page.locator('#import-export-area');
    this.importGraphBtn = page.locator('#import-graph');
    this.exportGraphBtn = page.locator('#export-graph');
    this.clearGraphBtn = page.locator('#clear-graph');

    // Displays
    this.graphArea = page.locator('#graph-area');
    this.stepInfoArea = page.locator('#step-info');
    this.outputArea = page.locator('#output');
    this.distanceTableContainer = page.locator('#distance-table-container');
  }

  // Navigation
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial render - graph area should be present
    await expect(this.graphArea).toBeVisible();
  }

  // Actions
  async setVertices(n) {
    await this.vertexCountInput.fill(String(n));
    await this.setVertexCountBtn.click();
  }

  async addEdge(f, t, w) {
    await this.edgeFromInput.fill(String(f));
    await this.edgeToInput.fill(String(t));
    await this.edgeWeightInput.fill(String(w));
    await this.addEdgeBtn.click();
  }

  async removeEdge(f, t) {
    await this.edgeFromInput.fill(String(f));
    await this.edgeToInput.fill(String(t));
    await this.removeEdgeBtn.click();
  }

  async setSource(s) {
    await this.sourceVertexInput.fill(String(s));
    await this.setSourceBtn.click();
  }

  async resetAlgorithm() {
    await this.resetAlgorithmBtn.click();
  }

  async stepForward() {
    await this.stepForwardBtn.click();
  }

  async stepBackward() {
    await this.stepBackwardBtn.click();
  }

  async runToEnd() {
    await this.runToEndBtn.click();
  }

  async importGraph(jsonText) {
    await this.importExportArea.fill(jsonText);
    await this.importGraphBtn.click();
  }

  async exportGraph() {
    await this.exportGraphBtn.click();
    // export writes into textarea
    return await this.importExportArea.inputValue();
  }

  async clearGraph() {
    await this.clearGraphBtn.click();
  }

  // Queries
  async graphText() {
    return (await this.graphArea.textContent())?.trim() ?? '';
  }

  async stepInfoText() {
    return (await this.stepInfoArea.textContent())?.trim() ?? '';
  }

  async outputText() {
    return (await this.outputArea.textContent())?.trim() ?? '';
  }

  async distanceTableRows() {
    // Return array of row texts (skip header)
    const rows = this.distanceTableContainer.locator('table#distance-table tr');
    const count = await rows.count();
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push((await rows.nth(i).textContent())?.trim() ?? '');
    }
    return results;
  }

  async isStepForwardEnabled() {
    return !(await this.stepForwardBtn.getAttribute('disabled'));
  }

  async isStepBackwardEnabled() {
    return !(await this.stepBackwardBtn.getAttribute('disabled'));
  }

  async isRunToEndEnabled() {
    return !(await this.runToEndBtn.getAttribute('disabled'));
  }
}

test.describe('Bellman-Ford Algorithm Interactive Demo - FSM and UI', () => {
  // Capture console errors and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors)
    page.on('console', (msg) => {
      // We collect text and type for debugging and assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      // pageerror yields Error object; capture its name and message
      pageErrors.push({ name: err.name, message: err.message });
    });

    // Navigate to app
    const app = new BellmanFordPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: assert there were no uncaught page errors of critical JS types.
    // We allow tests to inspect pageErrors if needed. Fail if obvious critical runtime errors occurred.
    const criticalErrors = pageErrors.filter(e => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
    expect(criticalErrors.length, `No critical runtime errors should be thrown. Collected: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.describe('Initial state and S0 -> S1 (SetVertices / initialization)', () => {
    test('Initial render shows default vertex count and empty graph (Idle -> GraphInitialized)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Verify default input value is 5 (from HTML)
      await expect(app.vertexCountInput).toHaveValue('5');

      // The initializeGraph() is called on load; graph should show "(No edges)"
      await expect(app.graphArea).toHaveText('(No edges)');

      // Distance table should exist and show vertex 0 distance 0 (source default)
      const rows = await app.distanceTableRows();
      // row 0 is header; ensure header exists and number of rows equals vertexCount+1
      expect(rows[0]).toContain('Vertex');
      expect(rows.length).toBe(6); // header + 5 vertices

      // Check that vertex 0 has distance 0 in the table (row index 1)
      expect(rows[1]).toContain('0');
      expect(rows[1]).toContain('0'); // distance '0' should appear

      // Step info should mention "Before any relaxations"
      const stepInfo = await app.stepInfoText();
      expect(stepInfo).toContain('Before any relaxations');

      // Output should have the last message from initialization: "Number of vertices set to ..."
      // On initial load initializeGraph called but showMessage invoked from initializeGraph only via setVertexCountBtn; initial init calls updateAllDisplays but no showMessage
      // So we do not assert a specific message here, but the output area should be present and not throw errors when read.
      await expect(app.outputArea).toBeVisible();
    });
  });

  test.describe('Graph editing transitions (AddEdge, RemoveEdge, ClearGraph, Export/Import)', () => {
    test('Add edge updates graph and enables stepping controls (S1 -> S2)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Set vertices to 4 to have deterministic totalSteps = (4-1)*1 = 3 after adding one edge
      await app.setVertices(4);
      expect(await app.outputText()).toContain('Number of vertices set to 4.');

      // Add an edge 0 -> 1 weight 2
      await app.addEdge(0, 1, 2);
      expect(await app.outputText()).toContain('Edge added or updated.');

      // Graph area should display the edge
      expect(await app.graphText()).toContain('0 -> 1 (w=2)');

      // Step controls should be enabled (totalSteps > 0 and source valid)
      expect(await app.isStepForwardEnabled()).toBe(true);
      expect(await app.isRunToEndEnabled()).toBe(true);
      // Backward should be disabled until a step is taken
      expect(await app.isStepBackwardEnabled()).toBe(false);
    });

    test('Remove edge removes it and disables stepping (S1 -> S2)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Ensure graph has an edge first
      await app.setVertices(3);
      await app.addEdge(0, 1, 5);
      expect((await app.graphText())).toContain('0 -> 1');

      // Remove it
      await app.removeEdge(0, 1);
      expect(await app.outputText()).toContain('Edge removed.');

      // Graph area should indicate no edges
      expect(await app.graphText()).toBe('(No edges)');

      // Step controls disabled
      expect(await app.isStepForwardEnabled()).toBe(false);
      expect(await app.isRunToEndEnabled()).toBe(false);
    });

    test('Export writes JSON and Import restores graph (S1 transitions)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Build a small graph and export
      await app.setVertices(3);
      await app.addEdge(0, 1, 2);
      await app.addEdge(1, 2, 3);
      expect(await app.graphText()).toContain('0 -> 1');
      await app.setSource(0);

      const exported = await app.exportGraph();
      expect(exported).toContain('"vertexCount"');
      expect(exported).toContain('"edges"');

      // Clear graph then import exported JSON
      await app.clearGraph();
      expect(await app.outputText()).toContain('Graph cleared.');
      // After clear, graph area should show "(No vertices)"
      expect(await app.graphText()).toBe('(No vertices)');

      // Import using the exported JSON
      await app.importGraph(exported);
      expect(await app.outputText()).toContain('Graph imported successfully.');
      // Graph area should now show edges again
      const g = await app.graphText();
      expect(g).toContain('0 -> 1');
      expect(g).toContain('1 -> 2');
    });

    test('Import invalid JSON shows error (edge case)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Put invalid JSON and attempt to import
      await app.importGraph('{ invalid json }');
      expect(await app.outputText()).toContain('Import failed: invalid JSON.');
    });
  });

  test.describe('Algorithm controls and stepping (S2 -> S3 -> S4)', () => {
    test('Set source updates distances and enables stepping', async ({ page }) => {
      const app = new BellmanFordPage(page);

      await app.setVertices(4);
      // Add an edge so stepping is meaningful
      await app.addEdge(0, 1, 10);
      // Set source to vertex 2
      await app.setSource(2);
      expect(await app.outputText()).toContain('Source vertex set.');

      // Distance table should show vertex 2 with distance 0
      const rows = await app.distanceTableRows();
      // header + 4 rows = 5
      expect(rows.length).toBe(5);
      // Find row that starts with '2' (the third data row)
      const rowIndex = 1 + 2; // header is index 0, vertex 0 => index1, vertex1=>2, vertex2=>3
      expect(rows[rowIndex]).toContain('2');
      expect(rows[rowIndex]).toContain('0');
      // Stepping enabled because edges exist
      expect(await app.isStepForwardEnabled()).toBe(true);
    });

    test('Step forward relaxes edges and step backward undoes (S2 -> S3 -> S3)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Build graph:
      // vertices = 3
      // edges: 0->1 (5), 1->2 (-2), 0->2 (10)
      await app.setVertices(3);
      await app.addEdge(0, 1, 5);
      await app.addEdge(1, 2, -2);
      await app.addEdge(0, 2, 10);
      // Ensure source is 0
      await app.setSource(0);
      expect(await app.outputText()).toContain('Source vertex set.');

      // Run a single step forward and check that a relaxation occurs for first edge (0->1)
      await app.stepForward();
      // After first relaxation, distance to 1 should be 5
      let rows = await app.distanceTableRows();
      // rows: header + 3 vertices = 4 rows; vertex 1 row at index 2
      expect(rows[2]).toContain('1');
      expect(rows[2]).toContain('5');

      // Step forward again to relax edge 1->2 (which should set distance 2 (5 + -2))
      await app.stepForward();
      rows = await app.distanceTableRows();
      expect(rows[3]).toContain('2');
      // distance 2 should be 3? Wait compute: distance[1]=5 then 5 + (-2) = 3
      expect(rows[3]).toContain('3');

      // Now step backward undoes the last relaxation: distance to 2 should revert to Infinity or previous
      await app.stepBackward();
      rows = await app.distanceTableRows();
      // Vertex 2 distance should again be Infinity displayed as '∞'
      expect(rows[3]).toContain('∞');

      // After stepping backward once, step backward might still be enabled until we reach initial state
      // Step backward again should undo the first relaxation and make vertex 1 distance '∞'
      await app.stepBackward();
      rows = await app.distanceTableRows();
      expect(rows[2]).toContain('∞');
    });

    test('Run to end completes algorithm and detects no negative cycles (S3 -> S4)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Build a simple graph with no negative cycle
      await app.setVertices(3);
      await app.addEdge(0, 1, 5);
      await app.addEdge(1, 2, 2);
      await app.setSource(0);

      // Run to end
      await app.runToEnd();

      // After running to end, forward/run buttons should be disabled
      expect(await app.isStepForwardEnabled()).toBe(false);
      expect(await app.isRunToEndEnabled()).toBe(false);

      // Output should indicate completion without negative cycles
      const out = await app.outputText();
      expect(out).toContain('Algorithm completed without detecting negative weight cycles');
    });

    test('Run to end detects negative cycle when present', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Create a negative cycle reachable from source:
      // vertices = 3
      // edges: 0->1 (1), 1->2 (-2), 2->0 (0) -> sum = -1 across cycle so negative
      await app.setVertices(3);
      await app.addEdge(0, 1, 1);
      await app.addEdge(1, 2, -2);
      await app.addEdge(2, 0, 0);
      await app.setSource(0);

      await app.runToEnd();

      // Output should warn about negative weight cycle
      expect(await app.outputText()).toContain('Warning: Negative weight cycle detected');
    });

    test('Reset algorithm restores initial distances (S1 -> S2)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      await app.setVertices(3);
      await app.addEdge(0, 1, 7);
      await app.setSource(0);

      // Take a step to change distances
      await app.stepForward();
      let rows = await app.distanceTableRows();
      expect(rows[2]).toContain('7'); // vertex 1 distance 7

      // Reset algorithm
      await app.resetAlgorithm();
      expect(await app.outputText()).toContain('Algorithm reset to initial state.');

      // After reset, distances should be the initial distances (vertex 1 infinite again)
      rows = await app.distanceTableRows();
      expect(rows[2]).toContain('∞');
    });
  });

  test.describe('Validation and error scenarios', () => {
    test('Setting invalid vertex count shows error and does not initialize', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Enter invalid count (0)
      await app.vertexCountInput.fill('0');
      await app.setVertexCountBtn.click();

      // Should show invalid vertex count message
      expect(await app.outputText()).toContain('Invalid vertex count');

      // The vertex count input should still reflect the attempted value (browser doesn't prevent filling)
      // But graph should remain valid and not show "(No vertices)" (initial setup kept)
      expect(await app.graphText()).not.toBe('(No vertices)');
    });

    test('Adding edge with invalid vertices shows error', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Using an out-of-range vertex for current default vertexCount=5
      await app.edgeFromInput.fill('99');
      await app.edgeToInput.fill('100');
      await app.edgeWeightInput.fill('1');
      await app.addEdgeBtn.click();

      expect(await app.outputText()).toContain('Edge vertices must be between 0 and vertexCount-1.');
    });

    test('Adding edge with invalid weight shows error', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Use non-numeric weight via empty string which becomes NaN when coerced
      await app.edgeFromInput.fill('0');
      await app.edgeToInput.fill('1');
      await app.edgeWeightInput.fill('');
      await app.addEdgeBtn.click();

      expect(await app.outputText()).toContain('Edge weight must be a valid number.');
    });

    test('Import with improper fields shows appropriate errors (edge case)', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Provide JSON missing vertexCount
      await app.importGraph(JSON.stringify({ edges: [{ from: 0, to: 1, weight: 2 }], source: 0 }));
      expect(await app.outputText()).toContain('Import failed: invalid or missing vertexCount');

      // Provide JSON with non-array edges
      await app.importGraph(JSON.stringify({ vertexCount: 3, edges: "not-array", source: 0 }));
      expect(await app.outputText()).toContain('Import failed: edges should be an array');

      // Provide JSON with invalid source index
      await app.importGraph(JSON.stringify({ vertexCount: 3, edges: [], source: 99 }));
      expect(await app.outputText()).toContain('Import failed: invalid or missing source vertex');
    });
  });

  test.describe('Accessibility of UI and visual feedback', () => {
    test('Distance table renders Infinity as ∞ and numeric distances formatted', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Simple graph
      await app.setVertices(3);
      await app.addEdge(0, 1, 1);
      await app.setSource(0);

      // Before relaxations, distance to 2 should be Infinity (displayed as ∞)
      const rowsBefore = await app.distanceTableRows();
      expect(rowsBefore[3]).toContain('∞'); // vertex 2 row

      // After relaxing edges via runToEnd, values should be numeric (or remain ∞ if unreachable)
      await app.runToEnd();
      const rowsAfter = await app.distanceTableRows();
      // vertex 1 should have a numeric distance '1'
      expect(rowsAfter[2]).toContain('1');
    });

    test('Clearing graph resets inputs and displays message', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Make sure something is present then clear
      await app.setVertices(3);
      await app.addEdge(0, 1, 1);

      await app.clearGraph();
      expect(await app.outputText()).toContain('Graph cleared.');

      // graph area should indicate no vertices
      expect(await app.graphText()).toBe('(No vertices)');

      // Inputs should be empty strings after clear
      await expect(app.vertexCountInput).toHaveValue('');
      await expect(app.edgeFromInput).toHaveValue('');
      await expect(app.edgeToInput).toHaveValue('');
      await expect(app.sourceVertexInput).toHaveValue('');
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError observed during interactions', async ({ page }) => {
      const app = new BellmanFordPage(page);

      // Perform several interactions that exercise most code paths
      await app.setVertices(4);
      await app.addEdge(0, 1, 2);
      await app.addEdge(1, 2, 3);
      await app.addEdge(2, 3, -1);
      await app.setSource(0);
      await app.stepForward();
      await app.runToEnd();
      await app.exportGraph();
      await app.clearGraph();

      // After interactions, validate that the page did not emit critical runtime errors.
      // The actual collection happens in beforeEach/afterEach; here we only ensure UI remained responsive.
      await expect(app.graphArea).toBeVisible();
    });
  });
});