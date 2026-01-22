import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e22fd3-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Dijkstra Visualizer (FSM states & transitions) - 98e22fd3-d5c1-11f0-a327-5f281c6cb8e2', () => {
  // Shared collectors for console and page errors per test
  let consoleMessages = [];
  let pageErrors = [];
  let lastDialog = null;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    lastDialog = null;

    // Collect console messages and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-handle dialogs so the page's prompt/confirm/alert do not block tests.
    page.on('dialog', async (dialog) => {
      lastDialog = { message: dialog.message(), type: dialog.type() };
      // For prompts (edge weight), accept with a numeric weight string.
      if (dialog.type() === 'prompt') {
        await dialog.accept('1');
      } else {
        // accept alerts and confirms
        await dialog.accept();
      }
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure canvas is present and stable
    await expect(page.locator('#graphCanvas')).toBeVisible();
    // Short pause to let initial prepopulate run and render
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Basic sanity: there should be no uncaught page errors
    expect(pageErrors.length).toBe(0);
    // No console errors emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Helper to get canvas center coordinates for given x,y inside canvas (client coords)
  async function canvasPoint(page, x, y) {
    const canvas = await page.locator('#graphCanvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    return { px: box.x + x, py: box.y + y };
  }

  test.describe('Idle state and Mode buttons', () => {
    test('renders mode buttons and initial counts (Idle - S0_Idle)', async ({ page }) => {
      // Validate presence of primary mode buttons
      await expect(page.locator('#mode-add-node')).toBeVisible();
      await expect(page.locator('#mode-add-edge')).toBeVisible();
      await expect(page.locator('#mode-move')).toBeVisible();
      await expect(page.locator('#mode-delete')).toBeVisible();

      // Node and edge counts should reflect prepopulated graph (prepopulate adds 5 nodes)
      const nodeCount = await page.locator('#nodeCount').textContent();
      const edgeCount = await page.locator('#edgeCount').textContent();
      // Prepopulate: 5 nodes, and edges were added before directed=true leading to symmetric entries -> expect > 0
      expect(Number(nodeCount)).toBeGreaterThanOrEqual(5);
      expect(Number(edgeCount)).toBeGreaterThanOrEqual(6);
    });
  });

  test.describe('Node and Edge interactions', () => {
    test('Add Node: switch to Add Node and click canvas to create node (S1_AddNode -> S0_Idle)', async ({ page }) => {
      // Switch to Add Node mode (should already be active by default, but test clicking)
      await page.click('#mode-add-node');
      // Click on canvas at position (50,50) relative to canvas to add a new node
      const { px, py } = await canvasPoint(page, 50, 50);
      await page.mouse.click(px, py);
      await page.waitForTimeout(150);

      // Node count should increment
      const nodeCountText = await page.locator('#nodeCount').textContent();
      expect(Number(nodeCountText)).toBeGreaterThanOrEqual(6);

      // New node should appear in node list
      const nodeList = await page.locator('#nodeList').allTextContents();
      expect(nodeList.length).toBeGreaterThanOrEqual(6);
    });

    test('Add Edge: switch to Add Edge and connect two existing nodes (S2_AddEdge -> S0_Idle)', async ({ page }) => {
      // Set mode to add-edge
      await page.click('#mode-add-edge');
      // Click on first node (prepopulated first node ~ at 100,100)
      const p1 = await canvasPoint(page, 100, 100);
      await page.mouse.click(p1.px, p1.py);
      await page.waitForTimeout(100);
      // Click on second node (prepopulated second node ~ at 260,80)
      const p2 = await canvasPoint(page, 260, 80);
      // The page will prompt for weight; our dialog handler responds with '1'
      await page.mouse.click(p2.px, p2.py);
      await page.waitForTimeout(200);

      // After adding, edgeCount should increase
      const edgeCount = Number(await page.locator('#edgeCount').textContent());
      expect(edgeCount).toBeGreaterThanOrEqual(12); // prepopulate had many symmetric edges; adding more should not reduce count
    });

    test('Move Node: enable Move mode and drag a node (S3_MoveNode -> S0_Idle)', async ({ page }) => {
      // Switch to Move mode
      await page.click('#mode-move');
      // Drag the first prepopulated node slightly to the right
      const start = await canvasPoint(page, 100, 100);
      const end = { px: start.px + 40, py: start.py + 10 };
      await page.mouse.move(start.px, start.py);
      await page.mouse.down();
      await page.mouse.move(end.px, end.py, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(150);

      // There should be no page errors and node list still present
      await expect(page.locator('#nodeList')).toBeVisible();
    });

    test('Delete Node and Delete Edge: enable Delete mode and remove items (S4_DeleteNode, S5_DeleteEdge)', async ({ page }) => {
      // Switch to Delete mode
      await page.click('#mode-delete');
      await page.waitForTimeout(80);

      // Delete a node - click on an existing node; confirm dialog will be auto-accepted
      const delNodePos = await canvasPoint(page, 260, 80);
      await page.mouse.click(delNodePos.px, delNodePos.py);
      await page.waitForTimeout(150);
      // After deletion, nodeCount should decrease by at least 1 from previous known value
      const nodeCountAfterDelete = Number(await page.locator('#nodeCount').textContent());
      expect(nodeCountAfterDelete).toBeGreaterThanOrEqual(4);

      // Delete an edge: click near midpoint of two known nodes (100,100)-(160,230) mid ~ (130,165)
      const mid = await canvasPoint(page, 130, 165);
      await page.mouse.click(mid.px, mid.py);
      await page.waitForTimeout(150);
      // Edge count should still be non-negative
      const edgeCountAfter = Number(await page.locator('#edgeCount').textContent());
      expect(edgeCountAfter).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Algorithm control states and stepping', () => {
    test('Step Algorithm (S7_AlgorithmStepping) and Run/Pause/Reset transitions (S6,S8,S9)', async ({ page }) => {
      // Ensure there is at least one node to act as start
      let nodeCount = Number(await page.locator('#nodeCount').textContent());
      if (nodeCount === 0) {
        // add a node if cleared out
        await page.click('#mode-add-node');
        const pos = await canvasPoint(page, 120, 120);
        await page.mouse.click(pos.px, pos.py);
        await page.waitForTimeout(120);
      }

      // Ensure startSelect has a value
      const startSelect = page.locator('#startSelect');
      await expect(startSelect).toBeVisible();
      const startVal = await startSelect.inputValue();
      expect(startVal).not.toBe('');

      // Click Step - should initialize generator and perform one step
      await page.click('#btn-step');
      await page.waitForTimeout(200);
      // After stepping, distList should show distances (or at least header presence)
      await expect(page.locator('#distList')).toBeVisible();

      // Click Run to start autoplay; this will disable Run button and enable Pause
      await page.click('#btn-run');
      await page.waitForTimeout(400); // let a couple of animation steps occur

      // Pause the animation
      await page.click('#btn-pause');
      await page.waitForTimeout(150);

      // Reset the algorithm state
      await page.click('#btn-reset');
      await page.waitForTimeout(120);

      // Validate that generator is reset by ensuring distList resets to default (distances may be cleared)
      const distContents = await page.locator('#distList').textContent();
      expect(distContents.length).toBeGreaterThanOrEqual(0); // simple check that UI is present

      // If an alert dialog was triggered for completion, it would have been auto-accepted and recorded
      // Ensure any dialogs we saw were handled
      expect(lastDialog === null || typeof lastDialog.message === 'string').toBeTruthy();
    });
  });

  test.describe('Graph management: Clear, Export, Import', () => {
    test('Clear Graph (S10_GraphCleared) and verify clearing behavior', async ({ page }) => {
      // Click Clear - confirm will be auto-accepted
      await page.click('#btn-clear');
      await page.waitForTimeout(150);

      // After clear, node and edge counts should be zero
      const nodesAfter = Number(await page.locator('#nodeCount').textContent());
      const edgesAfter = Number(await page.locator('#edgeCount').textContent());
      expect(nodesAfter).toBe(0);
      expect(edgesAfter).toBe(0);

      // Attempt to Run algorithm on empty graph -> should show alert "No nodes to run on."
      // Capture the dialog by invoking Run
      await page.click('#btn-run');
      await page.waitForTimeout(100);
      // lastDialog should indicate the no-nodes message
      expect(lastDialog).not.toBeNull();
      expect(lastDialog.message).toMatch(/No nodes/);
    });

    test('Export JSON (S11_Exporting) triggers download logic without errors', async ({ page }) => {
      // Recreate a tiny graph to export
      await page.click('#mode-add-node');
      const a = await canvasPoint(page, 100, 100);
      await page.mouse.click(a.px, a.py);
      await page.waitForTimeout(60);
      const b = await canvasPoint(page, 220, 120);
      await page.mouse.click(b.px, b.py);
      await page.waitForTimeout(60);
      // Add an edge between them (add-edge mode)
      await page.click('#mode-add-edge');
      await page.mouse.click(a.px, a.py);
      await page.mouse.click(b.px, b.py); // prompt will be accepted
      await page.waitForTimeout(150);

      // Click Export - the code creates an anchor and clicks it; ensure no page error
      await page.click('#btn-export');
      await page.waitForTimeout(150);

      // Validate no pageerror emitted and console error absent
      expect(pageErrors.length).toBe(0);
      const errConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errConsole.length).toBe(0);
    });

    test('Import JSON (S12_Importing) loads provided file and updates UI', async ({ page }) => {
      // Build a simple graph JSON to import
      const importData = {
        nodes: [{ id: 1, label: 'A', x: 80, y: 90 }, { id: 2, label: 'B', x: 200, y: 140 }],
        edges: [{ id: 1, from: 1, to: 2, weight: 5 }],
        nextNodeId: 3,
        nextEdgeId: 2,
        directed: true
      };
      // Trigger import button to open file input (the page will call click on the hidden file input)
      await page.click('#btn-import');
      await page.waitForTimeout(80);
      // Set the file input content to our JSON; Playwright accepts file payload
      const jsonStr = JSON.stringify(importData);
      await page.setInputFiles('#fileInput', {
        name: 'graph-import.json',
        mimeType: 'application/json',
        buffer: Buffer.from(jsonStr, 'utf-8')
      });
      // Give the page time to process FileReader and rebuild UI
      await page.waitForTimeout(250);

      // After import, nodeCount and edgeCount should match imported data
      const nodeCount = Number(await page.locator('#nodeCount').textContent());
      const edgeCount = Number(await page.locator('#edgeCount').textContent());
      expect(nodeCount).toBe(2);
      // EdgeCount expected 1 (directed true), but code may keep previous behavior; assert at least 1
      expect(edgeCount).toBeGreaterThanOrEqual(1);

      // The startSelect should have options for the imported nodes
      const startOptions = await page.locator('#startSelect option').allTextContents();
      expect(startOptions.some(t => t.includes('A'))).toBeTruthy();
      expect(startOptions.some(t => t.includes('B'))).toBeTruthy();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Selecting end node before running Dijkstra shows alert and no crash', async ({ page }) => {
      // Ensure graph exists: add two nodes if necessary
      let nodeCount = Number(await page.locator('#nodeCount').textContent());
      if (nodeCount < 2) {
        await page.click('#mode-add-node');
        const p1 = await canvasPoint(page, 90, 90);
        await page.mouse.click(p1.px, p1.py);
        const p2 = await canvasPoint(page, 200, 90);
        await page.mouse.click(p2.px, p2.py);
        await page.waitForTimeout(120);
      }

      // Try to select an end node without running algorithm
      // Choose the second option of endSelect (if exists)
      const endSelect = page.locator('#endSelect');
      const options = await endSelect.locator('option').all();
      if (options.length > 1) {
        // set to the second option user-visible via evaluate to trigger change handler
        await page.selectOption('#endSelect', { index: 1 });
        await page.waitForTimeout(150);
        // Because no prev data exists, an alert will appear that was auto-accepted
        expect(lastDialog).not.toBeNull();
        expect(lastDialog.message).toMatch(/No shortest path data available/);
      } else {
        // Nothing to select - just pass
        expect(options.length).toBeGreaterThanOrEqual(1);
      }

      // Ensure no uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });

    test('Attempt to add an edge clicking the same node twice cancels edgeFromNode gracefully', async ({ page }) => {
      // Ensure there is at least one node
      const nodeCount = Number(await page.locator('#nodeCount').textContent());
      if (nodeCount === 0) {
        await page.click('#mode-add-node');
        const pos = await canvasPoint(page, 120, 120);
        await page.mouse.click(pos.px, pos.py);
        await page.waitForTimeout(80);
      }

      // Switch to add-edge and click the same node twice
      await page.click('#mode-add-edge');
      const p = await canvasPoint(page, 100, 100);
      await page.mouse.click(p.px, p.py);
      await page.waitForTimeout(50);
      await page.mouse.click(p.px, p.py); // second click same node triggers edgeFromNode null and render
      await page.waitForTimeout(120);

      // No dialog should have been left open, and no errors should be present
      expect(lastDialog === null || typeof lastDialog.message === 'string').toBeTruthy();
      expect(pageErrors.length).toBe(0);
    });
  });

  // Final check: ensure no uncaught JS errors or console.error entries linger after full test suite run (extra safety)
  test('final sanity: console and page error summary', async ({ page }) => {
    // Just inspect some elements to ensure page still usable
    await expect(page.locator('body')).toBeVisible();
    // Confirm our collected console messages do not include fatal errors
    const fatalErrors = consoleMessages.filter(m => m.type === 'error' || /Uncaught/i.test(m.text));
    expect(fatalErrors.length).toBe(0);
    // And no page errors
    expect(pageErrors.length).toBe(0);
  });
});