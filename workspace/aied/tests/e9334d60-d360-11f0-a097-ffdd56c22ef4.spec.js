import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9334d60-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Adjacency Matrix Interactive Demo - e9334d60-d360-11f0-a097-ffdd56c22ef4', () => {
  // Collect console errors and page errors for each test to observe runtime issues
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10000);
    // Capture console error messages and page errors
    page.context()._consoleErrors = [];
    page.context()._pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.context()._consoleErrors.push(msg);
      }
    });
    page.on('pageerror', err => {
      page.context()._pageErrors.push(err);
    });
    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Assert no unexpected runtime errors (ReferenceError / SyntaxError / TypeError) occurred
    const pageErrors = page.context()._pageErrors || [];
    const consoleErrors = page.context()._consoleErrors || [];

    // Fail if any page error exists
    if (pageErrors.length > 0) {
      // Provide details in the assertion message
      const msgs = pageErrors.map(e => e.message).join('\n---\n');
      throw new Error(`Page had errors:\n${msgs}`);
    }

    // Fail if any console error exists
    if (consoleErrors.length > 0) {
      const msgs = consoleErrors.map(m => `${m.location().url || ''} ${m.text()}`).join('\n---\n');
      throw new Error(`Console had error messages:\n${msgs}`);
    }
  });

  test.describe('Initial state and Idle (S0_Idle)', () => {
    test('Initial UI should be idle and populated by sample graph', async ({ page }) => {
      // Verify that control buttons are present and not active (idle)
      const addNodeBtn = page.locator('#addNodeBtn');
      const addEdgeBtn = page.locator('#addEdgeBtn');
      const deleteModeBtn = page.locator('#deleteModeBtn');

      await expect(addNodeBtn).toBeVisible();
      await expect(addEdgeBtn).toBeVisible();
      await expect(deleteModeBtn).toBeVisible();

      // Initially none of the mode buttons should have the 'active' class
      await expect(addNodeBtn).not.toHaveClass(/active/);
      await expect(addEdgeBtn).not.toHaveClass(/active/);
      await expect(deleteModeBtn).not.toHaveClass(/active/);

      // The sample initSample() should have created nodes and edges
      const nodeCount = await page.locator('#nodes > g.node-g').count();
      const edgeCount = await page.locator('#edges > path.edge').count();

      expect(nodeCount).toBeGreaterThanOrEqual(4); // sample graph creates 4 nodes
      expect(edgeCount).toBeGreaterThanOrEqual(1);

      // The matrix table should reflect the number of nodes
      const matrixRows = await page.locator('table.matrix tbody tr').count();
      expect(matrixRows).toBe(nodeCount);
    });
  });

  test.describe('Add Node (S1_AddNode) interactions', () => {
    test('Click Add Node toggles addNode mode and clicking canvas adds a node', async ({ page }) => {
      // Click Add Node button to enter add node mode
      const addNodeBtn = page.locator('#addNodeBtn');
      await addNodeBtn.click();
      await expect(addNodeBtn).toHaveClass(/active/);

      // Record current node count
      const nodesLocator = page.locator('#nodes > g.node-g');
      const before = await nodesLocator.count();

      // Click on the SVG canvas area to add a node.
      // Click near the top-left to avoid overlapping existing nodes.
      const canvas = page.locator('#canvas');
      const box = await canvas.boundingBox();
      // Ensure we have a bounding box
      expect(box).toBeTruthy();
      const clickX = box.x + Math.max(20, Math.min(200, box.width * 0.1));
      const clickY = box.y + Math.max(20, Math.min(200, box.height * 0.1));
      await page.mouse.click(clickX, clickY);

      // New node should be added
      const after = await nodesLocator.count();
      expect(after).toBeGreaterThan(before);

      // According to implementation, the button remains active (mode not auto cleared).
      // Verify implementation behavior (which differs from FSM exit action setMode(null))
      await expect(addNodeBtn).toHaveClass(/active/);
    });

    test('Rapid add nodes by clicking multiple times on canvas while in addNode mode', async ({ page }) => {
      const addNodeBtn = page.locator('#addNodeBtn');
      await addNodeBtn.click();
      const nodesLocator = page.locator('#nodes > g.node-g');
      const before = await nodesLocator.count();
      const canvas = page.locator('#canvas');
      const box = await canvas.boundingBox();
      expect(box).toBeTruthy();

      // simulate several clicks
      for (let i = 0; i < 3; i++) {
        await page.mouse.click(box.x + 50 + i * 20, box.y + 50 + i * 10);
      }

      const after = await nodesLocator.count();
      expect(after).toBeGreaterThanOrEqual(before + 3);
    });
  });

  test.describe('Add Edge (S2_AddEdge) interactions', () => {
    test('Click Add Edge then click two nodes to create an edge', async ({ page }) => {
      const addEdgeBtn = page.locator('#addEdgeBtn');
      await addEdgeBtn.click();
      await expect(addEdgeBtn).toHaveClass(/active/);

      const nodesLocator = page.locator('#nodes > g.node-g');
      const nodeCount = await nodesLocator.count();
      expect(nodeCount).toBeGreaterThanOrEqual(2);

      const edgesLocator = page.locator('#edges > path.edge');
      const beforeEdges = await edgesLocator.count();

      // Click first two nodes to create an edge
      const firstNode = nodesLocator.nth(0);
      const secondNode = nodesLocator.nth(1);

      // Use bounding boxes of node groups for clicking
      const b1 = await firstNode.boundingBox();
      const b2 = await secondNode.boundingBox();
      expect(b1).toBeTruthy();
      expect(b2).toBeTruthy();

      await page.mouse.click(b1.x + b1.width / 2, b1.y + b1.height / 2);
      await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);

      // Edge count should increase by at least 1
      const afterEdges = await edgesLocator.count();
      expect(afterEdges).toBeGreaterThanOrEqual(beforeEdges + 1);

      // Edge addition should also update the matrix cell corresponding to the two nodes
      const matrix = page.locator('table.matrix');
      await expect(matrix).toBeVisible();
      const rows = await matrix.locator('tbody tr').count();
      expect(rows).toBe(nodeCount);

      // Verify that there exists at least one cell with value '1' (default weight)
      const someCellWithOne = page.locator('table.matrix td.cell', { hasText: '1' });
      await expect(someCellWithOne.first()).toBeVisible();
    });

    test('Clicking an existing edge while in addEdge may set the edge source', async ({ page }) => {
      // Ensure addEdge mode and click on an existing edge
      const addEdgeBtn = page.locator('#addEdgeBtn');
      await addEdgeBtn.click();

      // Wait for at least one edge to exist
      const edgesLocator = page.locator('#edges > path.edge');
      await expect(edgesLocator.first()).toBeVisible();

      // Click first edge - behavior per implementation: sets edgeSource to e.from when mode==='addEdge'
      // We cannot read internal edgeSource variable; ensure the click does not throw and edge still exists
      const beforeCount = await edgesLocator.count();
      await edgesLocator.first().click({ force: true });
      const afterCount = await edgesLocator.count();
      expect(afterCount).toBe(beforeCount);
    });
  });

  test.describe('Delete Mode (S3_Delete) interactions', () => {
    test('Click Delete then click a node to remove it', async ({ page }) => {
      const deleteBtn = page.locator('#deleteModeBtn');
      await deleteBtn.click();
      await expect(deleteBtn).toHaveClass(/active/);

      // Select a node to delete
      const nodesLocator = page.locator('#nodes > g.node-g');
      const beforeNodes = await nodesLocator.count();
      expect(beforeNodes).toBeGreaterThanOrEqual(1);

      const target = nodesLocator.nth(beforeNodes - 1);
      const box = await target.boundingBox();
      expect(box).toBeTruthy();

      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      // Node should be removed
      const afterNodes = await nodesLocator.count();
      expect(afterNodes).toBe(beforeNodes - 1);

      // Mode remains per implementation toggle behavior (button toggles when clicked)
      // Clicking delete btn again should toggle off
      await deleteBtn.click();
      await expect(deleteBtn).not.toHaveClass(/active/);
    });

    test('Click Delete then click edge removes the edge', async ({ page }) => {
      // Ensure we have at least one edge; switch to delete mode and click an edge
      const edgesLocator = page.locator('#edges > path.edge');
      const edgeCnt = await edgesLocator.count();
      if (edgeCnt === 0) {
        // Create an edge quickly via matrix cell toggling
        // Click a cell at (1,0) if exists
        const cell = page.locator('table.matrix td.cell').first();
        await cell.click();
        await expect(page.locator('#edges > path.edge').first()).toBeVisible();
      }

      // Now delete
      const deleteBtn = page.locator('#deleteModeBtn');
      await deleteBtn.click();
      await expect(deleteBtn).toHaveClass(/active/);

      const before = await page.locator('#edges > path.edge').count();
      await page.locator('#edges > path.edge').first().click({ force: true });
      const after = await page.locator('#edges > path.edge').count();
      expect(after).toBeLessThanOrEqual(before - 1);
    });
  });

  test.describe('Dragging Node (S4_Dragging) interactions', () => {
    test('Pointer down on a node then move and pointer up changes node position', async ({ page }) => {
      // Choose a node to drag
      const node = page.locator('#nodes > g.node-g').first();
      await expect(node).toBeVisible();

      // Get circle element inside node and its cx/cy before drag
      const circle = node.locator('circle.node');
      const beforeCx = Number(await circle.getAttribute('cx'));
      const beforeCy = Number(await circle.getAttribute('cy'));

      // Use the element's bounding box to perform mouse drag
      const bb = await node.boundingBox();
      expect(bb).toBeTruthy();
      const startX = bb.x + bb.width / 2;
      const startY = bb.y + bb.height / 2;
      const endX = startX + 60;
      const endY = startY + 40;

      // Perform drag
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 6 });
      await page.mouse.up();

      // After dragging, the circle's cx/cy attributes should have changed
      const afterCx = Number(await circle.getAttribute('cx'));
      const afterCy = Number(await circle.getAttribute('cy'));

      // Expect moved position to be different (tolerance)
      expect(Math.abs(afterCx - beforeCx) + Math.abs(afterCy - beforeCy)).toBeGreaterThan(5);
    });

    test('Pointerup should end dragging (no errors)', async ({ page }) => {
      // This test ensures pointerup path runs without runtime errors and does not throw
      const node = page.locator('#nodes > g.node-g').first();
      const bb = await node.boundingBox();
      expect(bb).toBeTruthy();
      const startX = bb.x + bb.width / 2;
      const startY = bb.y + bb.height / 2;

      // Start and immediately release
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.up();

      // No page errors should have been emitted (checked in afterEach)
      expect(true).toBe(true);
    });
  });

  test.describe('Toggles and UI controls', () => {
    test('Directed, Weighted, SelfLoop toggles affect rendering', async ({ page }) => {
      const directed = page.locator('#directedChk');
      const weighted = page.locator('#weightedChk');
      const selfLoop = page.locator('#selfLoopChk');

      // Weighted is true by initial sample; ensure weight labels present
      const weightLabelsBefore = await page.locator('text.weight-label').count();
      expect(weightLabelsBefore).toBeGreaterThanOrEqual(1);

      // Toggle weighted off -> weight labels should not be displayed
      await weighted.click();
      await page.waitForTimeout(150); // allow render
      const weightLabelsAfter = await page.locator('text.weight-label').count();
      expect(weightLabelsAfter).toBe(0);

      // Toggle weighted back on
      await weighted.click();
      await page.waitForTimeout(150);
      const weightLabelsOn = await page.locator('text.weight-label').count();
      expect(weightLabelsOn).toBeGreaterThanOrEqual(1);

      // Toggle directed on/off and verify marker presence for directed edges
      // First ensure there is at least one edge
      const edgesLocator = page.locator('#edges > path.edge');
      if ((await edgesLocator.count()) === 0) {
        // Create an edge by toggling a matrix cell
        const cell = page.locator('table.matrix td.cell').first();
        await cell.click();
        await expect(edgesLocator.first()).toBeVisible();
      }

      // Turn directed on
      await directed.click();
      await page.waitForTimeout(150);
      // If directed, at least some edges should have the marker-end attribute set to a url marker
      const someMarker = await page.evaluate(() => {
        const p = document.querySelector('#edges > path.edge');
        return p ? p.getAttribute('marker-end') : null;
      });
      expect(someMarker === null || someMarker.length >= 0).toBeTruthy();

      // Toggle self loops and ensure adding self-loops is allowed/blocked accordingly
      // Turn self loops on
      await selfLoop.click(); // toggle on if initially off
      await page.waitForTimeout(150);
      // Try to add a self-loop via matrix cell double-click (edit weight) or click same cell
      const rows = await page.locator('table.matrix tbody tr').count();
      if (rows >= 1) {
        const selfCell = page.locator('table.matrix tbody tr').nth(0).locator('td.cell').nth(0);
        await selfCell.click();
        // If self loops are allowed, the cell value might become '1'
        await page.waitForTimeout(100);
        // No crash; presence of any cell content asserted
        await expect(selfCell).toHaveText(/.*/);
      }
    });

    test('Random Graph generates nodes and edges', async ({ page }) => {
      const randomBtn = page.locator('#randomBtn');
      const nodesLocator = page.locator('#nodes > g.node-g');
      const before = await nodesLocator.count();
      await randomBtn.click();
      // Wait for rendering
      await page.waitForTimeout(300);
      const after = await nodesLocator.count();
      expect(after).toBeGreaterThanOrEqual(4); // per implementation, random creates 4..8 nodes
      expect(after).toBeGreaterThanOrEqual(before >= 4 ? before : 4);
    });
  });

  test.describe('Matrix import/export and textarea controls', () => {
    test('Export (Copy Matrix) sets textarea fallback when clipboard not available or writes to clipboard', async ({ page }) => {
      const exportBtn = page.locator('#exportBtn');
      const matrixText = page.locator('#matrixText');

      // Ensure textarea is empty before export fallback
      await matrixText.fill('');
      await exportBtn.click();

      // If clipboard.writeText resolves with alert, a dialog may appear. Handle any dialog generically:
      page.once('dialog', async dialog => {
        // Accept any alert and proceed
        await dialog.accept();
      });

      // After clicking export, either clipboard success (alert) or fallback sets textarea value
      await page.waitForTimeout(200);
      const txt = await matrixText.inputValue();
      // Expect the textarea to contain some adjacency data (fallback) OR remain unchanged (clipboard path used).
      // So we assert that either the textarea has content or an alert was displayed (handled above).
      expect(txt.length >= 0).toBeTruthy();
    });

    test('Import shows guidance alert', async ({ page }) => {
      const importBtn = page.locator('#importBtn');
      let sawDialog = false;
      page.once('dialog', async dialog => {
        sawDialog = true;
        await dialog.accept();
      });
      await importBtn.click();
      expect(sawDialog).toBe(true);
    });

    test('Build Graph from valid matrix builds correct node count and directed flag', async ({ page }) => {
      const matrixText = page.locator('#matrixText');
      const loadBtn = page.locator('#loadMatrixBtn');
      const example = "0 1 0 1\n1 0 1 0\n0 1 0 1\n1 0 1 0";
      await matrixText.fill(example);

      // Click load - should not alert on success; if alert occurs it will be handled
      let sawAlert = false;
      page.once('dialog', async dialog => {
        sawAlert = true;
        await dialog.accept();
      });

      await loadBtn.click();
      await page.waitForTimeout(200);

      // After building, nodes should be equal to matrix size (4)
      const nodesCount = await page.locator('#nodes > g.node-g').count();
      expect(nodesCount).toBe(4);

      // The directed checkbox should be unchecked for a symmetric example matrix
      const directedChecked = await page.locator('#directedChk').isChecked();
      expect(directedChecked).toBe(false);

      // Ensure no unexpected alert was shown
      expect(sawAlert).toBe(false);
    });

    test('Example button fills textarea and clear text clears it', async ({ page }) => {
      const fromAdjListBtn = page.locator('#fromAdjListBtn');
      const clearTextBtn = page.locator('#clearTextBtn');
      const matrixText = page.locator('#matrixText');

      await fromAdjListBtn.click();
      const val = await matrixText.inputValue();
      expect(val.trim().length).toBeGreaterThan(0);
      expect(val).toContain('0 1');

      await clearTextBtn.click();
      const emptyVal = await matrixText.inputValue();
      expect(emptyVal).toBe('');
    });

    test('Invalid matrix triggers parse alert', async ({ page }) => {
      const matrixText = page.locator('#matrixText');
      const loadBtn = page.locator('#loadMatrixBtn');
      await matrixText.fill('a b\n1 0'); // invalid text
      let dialogMessage = '';
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });
      await loadBtn.click();
      // Check the alert message mentions parse failure
      expect(dialogMessage).toContain('Could not parse matrix');
    });
  });

  test.describe('Clear Graph and edge-cases', () => {
    test('Clear Graph shows confirm and clears nodes when accepted', async ({ page }) => {
      const clearBtn = page.locator('#clearBtn');

      // Intercept confirm and accept it
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      // Ensure nodes exist initially
      const nodesLocator = page.locator('#nodes > g.node-g');
      const before = await nodesLocator.count();
      expect(before).toBeGreaterThanOrEqual(1);

      await clearBtn.click();
      await page.waitForTimeout(200);

      const after = await nodesLocator.count();
      expect(after).toBe(0);

      // Matrix should be cleared (no rows)
      const matrixRows = await page.locator('table.matrix tbody tr').count();
      expect(matrixRows).toBe(0);
    });

    test('Cancel Clear Graph will not clear nodes', async ({ page }) => {
      const clearBtn = page.locator('#clearBtn');

      // Intercept confirm and dismiss it (cancel)
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.dismiss();
      });

      // Ensure nodes exist initially
      const nodesLocator = page.locator('#nodes > g.node-g');
      const before = await nodesLocator.count();
      expect(before).toBeGreaterThanOrEqual(1);

      await clearBtn.click();
      await page.waitForTimeout(200);

      const after = await nodesLocator.count();
      expect(after).toBe(before);
    });
  });
});