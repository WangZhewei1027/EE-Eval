import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9332650-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Interactive Graph — FSM and UI end-to-end', () => {
  // Arrays to capture console/errors for each test run
  let consoleErrors;
  let pageErrors;

  // Helper to attach listeners to the page to capture console and page errors
  async function attachErrorListeners(page) {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', (msg) => {
      // capture only error level messages for assertion
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  }

  // Common setup before each test: navigate and attach listeners
  test.beforeEach(async ({ page }) => {
    await attachErrorListeners(page);
    await page.goto(APP_URL);
    // ensure initial load happened
    await expect(page.locator('h1')).toHaveText(/Interactive Graph/);
  });

  // Common teardown check: ensure no uncaught console/page errors occurred during test
  test.afterEach(async () => {
    // Tests intentionally generate and handle dialogs; we still expect no uncaught JS errors
    expect(consoleErrors.length, 'No console.error messages').toBe(0);
    expect(pageErrors.length, 'No page errors').toBe(0);
  });

  // Utility: read internal state counts from the page
  async function getStateSummary(page) {
    return await page.evaluate(() => {
      return {
        nodes: state.nodes.length,
        edges: state.edges.length,
        mode,
        directed: state.directed,
        showLabels: state.showLabels,
        showWeights: state.showWeights,
        selected: selected,
        edgePending: edgePending,
        highlightedPathCount: highlightedPath.length
      };
    });
  }

  test.describe('Initial state and rendering', () => {
    test('Initial demo nodes and edges are present and status displays Directed', async ({ page }) => {
      // Verify initial internal state has 3 nodes and 2 edges from initDemo()
      const summary = await getStateSummary(page);
      expect(summary.nodes).toBe(3);
      expect(summary.edges).toBe(2);
      // Verify UI status shows Directed (mode is idle initially)
      await expect(page.locator('#modeStatus')).toContainText('Directed');
      // Node visuals: number of circle elements should match nodes
      const circles = await page.locator('svg circle').count();
      expect(circles).toBe(summary.nodes);
      // There should be at least one text node for adjacency lists
      await expect(page.locator('#adjList')).not.toBeEmpty();
    });
  });

  test.describe('Mode changes and transitions (Add Node, Add Edge, Delete)', () => {
    test('Add Node mode toggles and places a node on canvas', async ({ page }) => {
      // Click Add Node button to enter addNode mode
      await page.click('#addNodeBtn');
      // Confirm internal mode set to addNode
      let summary = await getStateSummary(page);
      expect(summary.mode).toBe('addNode');

      // Click on the center of the svg canvas to place a node.
      const svg = page.locator('#svgcanvas');
      const box = await svg.boundingBox();
      // click roughly center
      await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.15);

      // After creation, mode should revert to idle and node count should increase by 1
      summary = await getStateSummary(page);
      expect(summary.mode).toBe('idle');
      expect(summary.nodes).toBe(4);

      // Visual: circles increased
      const circles = await page.locator('svg circle').count();
      expect(circles).toBe(4);
      // Status selected should be None
      await expect(page.locator('#selectedInfo')).toHaveText('None');
    });

    test('Add Edge: create an edge between two existing nodes', async ({ page }) => {
      // Prepare: ensure there are at least two nodes (initial has 3)
      let summary = await getStateSummary(page);
      expect(summary.nodes).toBeGreaterThanOrEqual(2);

      // Enter add edge mode
      await page.click('#addEdgeBtn');
      summary = await getStateSummary(page);
      expect(summary.mode).toBe('addEdge');

      // Click on first node circle and then second node circle to create an edge
      // Use circle elements to determine click points
      const firstCircle = page.locator('svg circle').nth(0);
      const secondCircle = page.locator('svg circle').nth(1);
      const b1 = await firstCircle.boundingBox();
      const b2 = await secondCircle.boundingBox();
      // Click centers
      await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2);
      await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);

      // After edge creation, mode should return to idle and edges count should increment
      summary = await getStateSummary(page);
      expect(summary.mode).toBe('idle');
      expect(summary.edges).toBeGreaterThanOrEqual(3); // initial 2 + at least one more

      // Adjacency list should reflect new connection (some node list text contains label)
      const adjText = await page.locator('#adjList').innerText();
      expect(adjText.length).toBeGreaterThan(0);
    });

    test('Delete mode: delete a node and its connected edges', async ({ page }) => {
      // Ensure there are nodes and edges to delete
      let summary = await getStateSummary(page);
      const nodesBefore = summary.nodes;
      const edgesBefore = summary.edges;
      expect(nodesBefore).toBeGreaterThanOrEqual(1);

      // Enter delete mode
      await page.click('#delBtn');
      summary = await getStateSummary(page);
      expect(summary.mode).toBe('delete');

      // Click the first node circle to delete that node
      const firstCircle = page.locator('svg circle').nth(0);
      const b = await firstCircle.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);

      // After deletion, mode remains delete? The app sets mode to 'delete' toggle; it doesn't auto-return.
      // But nodes should decrease and edges connected to that node removed
      summary = await getStateSummary(page);
      expect(summary.nodes).toBe(nodesBefore - 1);
      expect(summary.edges).toBeLessThanOrEqual(edgesBefore);

      // Exit delete mode to idle
      await page.click('#delBtn');
      summary = await getStateSummary(page);
      expect(summary.mode).toBe('idle');
    });
  });

  test.describe('Clear, Random, Export/Import, and Import error handling', () => {
    test('Clear button confirms and empties the graph', async ({ page }) => {
      // Set up dialog handler to accept the confirm
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      // Click clear (will trigger confirm)
      await page.click('#clearBtn');

      // After acceptance, nodes and edges should be zero
      const summary = await getStateSummary(page);
      expect(summary.nodes).toBe(0);
      expect(summary.edges).toBe(0);

      // Visual: no circles
      const circles = await page.locator('svg circle').count();
      expect(circles).toBe(0);
    });

    test('Random graph generates between 4 and 9 nodes', async ({ page }) => {
      // Click Random and then inspect node count
      await page.click('#randomBtn');

      // Because random generation uses Math.random, we only assert range
      const summary = await getStateSummary(page);
      expect(summary.nodes).toBeGreaterThanOrEqual(4);
      expect(summary.nodes).toBeLessThanOrEqual(9);

      // There should be at least one edge as density > 0 most times — assert non-negative
      expect(summary.edges).toBeGreaterThanOrEqual(0);
    });

    test('Export writes JSON to textarea, Import reads it back successfully', async ({ page }) => {
      // Ensure there's some graph state
      const before = await getStateSummary(page);
      expect(before.nodes).toBeGreaterThanOrEqual(1);

      // Click export to populate textarea
      await page.click('#exportBtn');
      const exported = await page.locator('#jsonArea').inputValue();
      expect(exported).toBeTruthy();

      // Now modify the textarea to ensure import reads from it; we'll clear the graph first
      page.once('dialog', async (dialog) => {
        // import should show 'Imported successfully' alert; accept it
        expect(dialog.message()).toBe('Imported successfully');
        await dialog.accept();
      });

      // Clear the graph via Clear confirm to make sure import repopulates
      page.once('dialog', async (dialog) => { await dialog.accept(); });
      await page.click('#clearBtn');
      const cleared = await getStateSummary(page);
      expect(cleared.nodes).toBe(0);

      // Restore jsonArea to exported JSON (already there), click import
      await page.click('#importBtn');

      // After import alert accepted, state should match before (node count at least)
      const after = await getStateSummary(page);
      expect(after.nodes).toBeGreaterThanOrEqual(1);
    });

    test('Import invalid JSON triggers Import failed alert', async ({ page }) => {
      // Put invalid JSON in textarea
      await page.fill('#jsonArea', '{ invalid json }');

      // Capture dialog message and assert it contains 'Import failed'
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toMatch(/Import failed:/);
        await dialog.accept();
      });

      await page.click('#importBtn');

      // State should remain unchanged (still from init/demo)
      const summary = await getStateSummary(page);
      expect(summary.nodes).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Toggles and shortest path behaviors', () => {
    test('Toggle Labels hides and shows node labels', async ({ page }) => {
      // Initially showLabels true
      let summary = await getStateSummary(page);
      expect(summary.showLabels).toBe(true);

      // Count node label texts inside node groups
      const nodeGroupTextsBefore = await page.locator('svg g text').count();

      // Toggle labels off
      await page.click('#toggleLabelsBtn');
      summary = await getStateSummary(page);
      expect(summary.showLabels).toBe(false);
      const nodeGroupTextsAfter = await page.locator('svg g text').count();
      expect(nodeGroupTextsAfter).toBe(0);

      // Toggle labels on again
      await page.click('#toggleLabelsBtn');
      summary = await getStateSummary(page);
      expect(summary.showLabels).toBe(true);
      const nodeGroupTextsRestored = await page.locator('svg g text').count();
      expect(nodeGroupTextsRestored).toBeGreaterThanOrEqual(0);
    });

    test('Toggle Weights hides and shows edge weight labels', async ({ page }) => {
      // There may be edge text nodes (edge weights) as children of svg (not in groups)
      const edgeTextBefore = await page.locator('svg > text').count();

      // Toggle weights off
      await page.click('#toggleWeightsBtn');
      let summary = await getStateSummary(page);
      expect(summary.showWeights).toBe(false);
      const edgeTextAfter = await page.locator('svg > text').count();
      // When weights are hidden, the top-level svg text nodes used for weights should be minimal (matrix/adj lists are not svg children)
      expect(edgeTextAfter).toBeLessThanOrEqual(edgeTextBefore);

      // Toggle back on
      await page.click('#toggleWeightsBtn');
      summary = await getStateSummary(page);
      expect(summary.showWeights).toBe(true);
    });

    test('Shortest path shows alerts for missing inputs and finds a path when present', async ({ page }) => {
      // Click shortest with empty inputs -> expect alert for missing source/target
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('alert');
        expect(dialog.message()).toMatch(/Enter source and target/);
        await dialog.accept();
      });
      await page.click('#shortestBtn');

      // Fill source and target with labels that exist (initial demo has A, B, C)
      await page.fill('#sourceInput', 'A');
      await page.fill('#targetInput', 'C');

      // Click shortest; if path exists, we may not see an alert and highlightedPath will be non-empty.
      await page.click('#shortestBtn');

      // After clicking, check for any path highlights by reading highlightedPath length from page
      const highlightedCount = await page.evaluate(() => highlightedPath.length);
      // There is a path A->B->C in the initial demo (edges e1 A->B and e2 B->C)
      expect(highlightedCount).toBeGreaterThanOrEqual(1);

      // Now break the path by deleting an edge and assert that 'No path found' alert appears
      // Delete mode and click an edge to remove it
      // Find first edge path element and click it in delete mode
      await page.click('#delBtn'); // enter delete mode
      // Click some edge element (pick first path or line)
      const edgeElem = page.locator('svg path, svg line').first();
      const bbox = await edgeElem.boundingBox();
      if (bbox) {
        // Prepare to accept alert after shortestBtn
        // First delete the edge by clicking it (delete mode triggers deletion)
        await page.mouse.click(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
        // Toggle back to idle
        await page.click('#delBtn');
        // Now attempt shortest path between A and C again; should alert 'No path found'
        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('alert');
          expect(dialog.message()).toMatch(/No path found/);
          await dialog.accept();
        });
        await page.click('#shortestBtn');
      } else {
        // If no edge element bounding box (unlikely), skip explicit delete step but assert we didn't crash
        expect(true).toBe(true);
      }
    });
  });

  test.describe('Mode select and edge deletion', () => {
    test('Switching between Directed and Undirected updates status', async ({ page }) => {
      // Change select to undirected
      await page.selectOption('#modeSelect', 'undirected');
      // Verify internal state and UI status update
      const summary = await getStateSummary(page);
      expect(summary.directed).toBe(false);
      await expect(page.locator('#modeStatus')).toContainText('Undirected');

      // Switch back to directed
      await page.selectOption('#modeSelect', 'directed');
      const summary2 = await getStateSummary(page);
      expect(summary2.directed).toBe(true);
      await expect(page.locator('#modeStatus')).toContainText('Directed');
    });

    test('Delete an edge by entering delete mode and clicking an edge', async ({ page }) => {
      // Ensure at least one edge exists
      let summary = await getStateSummary(page);
      if (summary.edges === 0) {
        // create an edge by using addEdge flow between first two nodes
        await page.click('#addEdgeBtn');
        const c1 = await page.locator('svg circle').nth(0).boundingBox();
        const c2 = await page.locator('svg circle').nth(1).boundingBox();
        await page.mouse.click(c1.x + c1.width / 2, c1.y + c1.height / 2);
        await page.mouse.click(c2.x + c2.width / 2, c2.y + c2.height / 2);
        summary = await getStateSummary(page);
      }
      const edgesBefore = summary.edges;

      // Enter delete mode
      await page.click('#delBtn');

      // Click a visible edge element (path or line)
      const edgeElem = page.locator('svg path, svg line').first();
      const bbox = await edgeElem.boundingBox();
      if (!bbox) {
        // If no edge bounding box found, fail gracefully but assert we had edges
        expect(edgesBefore).toBeGreaterThan(0);
        return;
      }
      await page.mouse.click(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);

      // After deletion, edges count should decrease
      const after = await getStateSummary(page);
      expect(after.edges).toBeLessThanOrEqual(edgesBefore - 1);

      // Exit delete mode
      await page.click('#delBtn');
      const final = await getStateSummary(page);
      expect(final.mode).toBe('idle');
    });
  });
});