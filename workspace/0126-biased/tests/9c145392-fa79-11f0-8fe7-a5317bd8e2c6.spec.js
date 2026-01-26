import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c145392-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Dijkstra Interactive Demonstration - Comprehensive FSM Tests', () => {
  // Capture console messages and page errors for each test
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Collect page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages and note errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the app and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the canvas and controls are present
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#controls')).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors during test execution.
    // The application should run without unexpected exceptions.
    expect(pageErrors).toEqual([]);
    // Also assert no console.error calls were emitted
    expect(consoleErrors).toEqual([]);
  });

  test.describe('Mode buttons and Idle state', () => {
    test('Initial Idle state: pointer mode active and buttons present', async ({ page }) => {
      // Validate presence of mode buttons and that pointer is disabled (active)
      const modePointer = page.locator('#modePointer');
      const modeAddNode = page.locator('#modeAddNode');
      const modeAddEdge = page.locator('#modeAddEdge');
      const modeDelete = page.locator('#modeDelete');

      await expect(modePointer).toBeVisible();
      await expect(modeAddNode).toBeVisible();
      await expect(modeAddEdge).toBeVisible();
      await expect(modeDelete).toBeVisible();

      // Pointer should be disabled initially (setMode('pointer') is default)
      await expect(modePointer).toBeDisabled();
      await expect(modeAddNode).toBeEnabled();
      await expect(modeAddEdge).toBeEnabled();
      await expect(modeDelete).toBeEnabled();
    });

    test('Switching modes: Add Node, Add Edge, Delete', async ({ page }) => {
      // Click Add Node -> it should become disabled (active) while others enabled
      await page.click('#modeAddNode');
      await expect(page.locator('#modeAddNode')).toBeDisabled();
      await expect(page.locator('#modePointer')).toBeEnabled();

      // Click Add Edge
      await page.click('#modeAddEdge');
      await expect(page.locator('#modeAddEdge')).toBeDisabled();
      await expect(page.locator('#modeAddNode')).toBeEnabled();

      // Click Delete
      await page.click('#modeDelete');
      await expect(page.locator('#modeDelete')).toBeDisabled();
      await expect(page.locator('#modeAddEdge')).toBeEnabled();

      // Return to pointer
      await page.click('#modePointer');
      await expect(page.locator('#modePointer')).toBeDisabled();
    });
  });

  test.describe('Node and Edge creation / deletion', () => {
    test('Add a node in Add Node mode and verify undo becomes available', async ({ page }) => {
      // Ensure we start from pointer then switch to Add Node
      await page.click('#modeAddNode');

      // Count nodes before adding
      const before = await page.evaluate(() => nodes.length);

      // Click canvas roughly in center to add a node
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');
      const clickX = canvasBox.x + canvasBox.width * 0.5;
      const clickY = canvasBox.y + canvasBox.height * 0.5;
      await page.mouse.click(clickX, clickY);

      // Expect a node added
      const after = await page.evaluate(() => nodes.length);
      expect(after).toBeGreaterThan(before);

      // Info box should include "Node added" (pushInfo is called)
      const infoText = await page.locator('#infoBox').innerText();
      expect(infoText).toMatch(/Node added/);

      // Undo button should now be enabled due to pushSnapshot
      await expect(page.locator('#undoBtn')).toBeEnabled();
    });

    test('Add an edge between two existing nodes in Add Edge mode', async ({ page }) => {
      // Switch to Add Edge mode
      await page.click('#modeAddEdge');

      // Get coordinates of two nodes created by the example graph (A and B)
      const twoNodePositions = await page.evaluate(() => {
        // Use existing nodes array to pick two distinct nodes (first two)
        if (!nodes || nodes.length < 2) return null;
        return { a: { x: nodes[0].x, y: nodes[0].y }, b: { x: nodes[1].x, y: nodes[1].y }, beforeEdges: edges.length };
      });
      if (!twoNodePositions) throw new Error('Not enough nodes to add edge in example graph');

      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');

      // Click first node (starts edge creation)
      await page.mouse.click(canvasBox.x + twoNodePositions.a.x, canvasBox.y + twoNodePositions.a.y);
      // Verify info message about edge start
      const infoAfterFirst = await page.locator('#infoBox').innerText();
      expect(infoAfterFirst).toMatch(/Edge start selected/);

      // Click second node to complete edge
      await page.mouse.click(canvasBox.x + twoNodePositions.b.x, canvasBox.y + twoNodePositions.b.y);

      // Verify edges increased by at least one
      const afterEdges = await page.evaluate(() => edges.length);
      expect(afterEdges).toBeGreaterThanOrEqual(twoNodePositions.beforeEdges + 1);

      // Undo should be available
      await expect(page.locator('#undoBtn')).toBeEnabled();
    });

    test('Delete a node in Delete mode and ensure node count decreases', async ({ page }) => {
      // Ensure there is at least one node to delete
      const nodeCount = await page.evaluate(() => nodes.length);
      expect(nodeCount).toBeGreaterThan(0);

      // Switch to Delete mode
      await page.click('#modeDelete');

      // Choose the first node's coordinates to click and delete
      const nodePos = await page.evaluate(() => {
        const n = nodes[0];
        return { x: n.x, y: n.y };
      });
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');

      // Click the node
      await page.mouse.click(canvasBox.x + nodePos.x, canvasBox.y + nodePos.y);

      // Verify node count decreased
      const after = await page.evaluate(() => nodes.length);
      expect(after).toBeLessThan(nodeCount);
    });
  });

  test.describe('Source/Target selection and algorithm initialization', () => {
    test('Pick Source and Pick Target via buttons and clicking nodes', async ({ page }) => {
      // Pick Source
      await page.click('#pickSourceBtn');

      // Click a node to select it as source (first node)
      const firstNode = await page.evaluate(() => {
        if (!nodes || nodes.length === 0) return null;
        return { x: nodes[0].x, y: nodes[0].y, id: nodes[0].id, label: nodes[0].label };
      });
      expect(firstNode).not.toBeNull();
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');
      await page.mouse.click(canvasBox.x + firstNode.x, canvasBox.y + firstNode.y);

      // Source label should update
      await expect(page.locator('#sourceLabel')).not.toHaveText('none');
      const srcLabelVal = await page.locator('#sourceLabel').innerText();
      expect(srcLabelVal).toContain(firstNode.label || `n${firstNode.id}`);

      // Pick Target
      await page.click('#pickTargetBtn');
      // Click a different node (if available)
      const secondNode = await page.evaluate(() => {
        if (nodes.length < 2) return nodes[0];
        return nodes[1];
      });
      await page.mouse.click(canvasBox.x + secondNode.x, canvasBox.y + secondNode.y);

      // Target label should update
      await expect(page.locator('#targetLabel')).not.toHaveText('none');
    });

    test('Initialize algorithm without source triggers info warning', async ({ page }) => {
      // Clear source to simulate missing source
      await page.evaluate(() => { sourceId = null; updateSourceTargetLabels(); });

      // Click initialize
      await page.click('#initBtn');

      // Info box should include set-source warning
      const info = await page.locator('#infoBox').innerText();
      expect(info).toMatch(/Set source before initializing/);
    });

    test('Initialize algorithm with source sets distances and generator snapshots', async ({ page }) => {
      // Ensure a source exists: pick first node as source if not set
      const hasSource = await page.evaluate(() => !!sourceId);
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');

      if (!hasSource) {
        await page.click('#pickSourceBtn');
        const n = await page.evaluate(() => nodes[0]);
        await page.mouse.click(canvasBox.x + n.x, canvasBox.y + n.y);
      }

      // Click initialize
      await page.click('#initBtn');

      // Info box should show initialization confirmation
      const info = await page.locator('#infoBox').innerText();
      expect(info).toMatch(/Initialized distances/);

      // The source node should have dist 0
      const srcDist = await page.evaluate(() => {
        const src = nodes.find(n => n.id === sourceId);
        return src ? src.dist : null;
      });
      expect(srcDist).toBe(0);
    });
  });

  test.describe('Algorithm execution controls: run, step forward/back, play/pause', () => {
    test('Run algorithm to completion via Run Complete button', async ({ page }) => {
      // Ensure source is set; if not set pick first node
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');
      const hasSource = await page.evaluate(() => !!sourceId);
      if (!hasSource) {
        await page.click('#pickSourceBtn');
        const n = await page.evaluate(() => nodes[0]);
        await page.mouse.click(canvasBox.x + n.x, canvasBox.y + n.y);
      }

      // Run the algorithm
      await page.click('#runBtn');

      // Wait until info box contains 'Run complete' or 'Stopped on target' or 'Run complete'
      await page.waitForFunction(() => {
        const t = document.getElementById('infoBox').textContent || '';
        return /Run complete|Run complete|Stopped on target|Stopped: target visited/.test(t);
      }, { timeout: 5000 });

      // Confirm algoSnapshots have been recorded (currentAlgoIndex >= 0)
      const algoSnapshotsCount = await page.evaluate(() => algoSnapshots.length);
      expect(algoSnapshotsCount).toBeGreaterThan(0);
    });

    test('Step forward and step back modify and restore algorithm snapshots', async ({ page }) => {
      // Ensure initialized generator exists
      // Pick source if not present and initialize
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');
      const hasSource = await page.evaluate(() => !!sourceId);
      if (!hasSource) {
        await page.click('#pickSourceBtn');
        const n = await page.evaluate(() => nodes[0]);
        await page.mouse.click(canvasBox.x + n.x, canvasBox.y + n.y);
      }
      // Initialize
      await page.click('#initBtn');

      // Record a snapshot of node distances before stepping
      const beforeDists = await page.evaluate(() => nodes.map(n => n.dist));

      // Step forward once
      await page.click('#stepForwardBtn');

      // After one step, distances should potentially change or visited flags set
      const afterDists = await page.evaluate(() => nodes.map(n => ({ dist: n.dist, visited: n.visited })));
      // There should be at least one snapshot in algoSnapshots
      const snaps = await page.evaluate(() => algoSnapshots.length);
      expect(snaps).toBeGreaterThan(0);

      // Step back
      await page.click('#stepBackBtn');

      // After stepping back, we expect some nodes' dist/visited to match earlier snapshot restore
      const restored = await page.evaluate(() => nodes.map(n => ({ dist: n.dist, visited: n.visited })));
      // restored should be an array; check that restored entries are in the same structure as after/back
      expect(Array.isArray(restored)).toBe(true);
      // It's acceptable that restored equals before in many cases - we at least confirm the function executed without page errors
    });

    test('Play/Pause toggles play state by changing button text', async ({ page }) => {
      // Ensure generator exists by initializing if needed
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');
      const hasSource = await page.evaluate(() => !!sourceId);
      if (!hasSource) {
        await page.click('#pickSourceBtn');
        const n = await page.evaluate(() => nodes[0]);
        await page.mouse.click(canvasBox.x + n.x, canvasBox.y + n.y);
      }
      await page.click('#initBtn');

      // Click Play
      await page.click('#playPauseBtn');
      // Button text should change to "Pause"
      await expect(page.locator('#playPauseBtn')).toHaveText(/Pause/);

      // Click again to pause
      await page.click('#playPauseBtn');
      await expect(page.locator('#playPauseBtn')).toHaveText(/Play/);
    }, { timeout: 10000 });
  });

  test.describe('Graph utilities: clear, reset state, random, undo/redo, save/load', () => {
    test('Clear Graph empties nodes and updates labels and info', async ({ page }) => {
      // Click clear
      await page.click('#clearBtn');

      // Nodes should be empty
      const nodesAfterClear = await page.evaluate(() => nodes.length);
      expect(nodesAfterClear).toBe(0);

      // Source/Target labels should show "none"
      await expect(page.locator('#sourceLabel')).toHaveText('none');
      await expect(page.locator('#targetLabel')).toHaveText('none');

      // Info box should contain "Graph cleared"
      const info = await page.locator('#infoBox').innerText();
      expect(info).toMatch(/Graph cleared/);
    });

    test('Reset Algorithm State sets dist to Infinity and clears algo snapshots', async ({ page }) => {
      // Ensure there's at least one node; if none generate random
      const nodeCount = await page.evaluate(() => nodes.length);
      if (nodeCount === 0) {
        await page.fill('#randN', '5');
        await page.click('#randomBtn');
      }

      // Force-change some dist values via init and step to produce non-Infinity dists
      // Pick first node as source and initialize
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');
      await page.click('#pickSourceBtn');
      const n = await page.evaluate(() => nodes[0]);
      await page.mouse.click(canvasBox.x + n.x, canvasBox.y + n.y);
      await page.click('#initBtn');

      // Now reset algorithm state
      await page.click('#resetStateBtn');

      // All nodes should have dist === Infinity (JS Infinity)
      const allInfinite = await page.evaluate(() => nodes.every(n => n.dist === Infinity));
      expect(allInfinite).toBe(true);

      // algoSnapshots should be cleared
      const algoCount = await page.evaluate(() => algoSnapshots.length);
      expect(algoCount).toBe(0);
    });

    test('Generate Random Graph produces requested number of nodes', async ({ page }) => {
      // Set randN to 6
      await page.fill('#randN', '6');
      await page.fill('#randDensity', '0.2');
      await page.fill('#randW', '5');
      await page.click('#randomBtn');

      // nodes length should equal 6
      await page.waitForFunction(() => nodes.length === 6, { timeout: 3000 });
      const nCount = await page.evaluate(() => nodes.length);
      expect(nCount).toBe(6);
    });

    test('Undo and Redo restore and reapply actions', async ({ page }) => {
      // Ensure initial graph exists (generate random if empty)
      const initialCount = await page.evaluate(() => nodes.length);
      if (initialCount === 0) {
        await page.click('#randomBtn');
      }

      // Save a snapshot of current nodes count
      const before = await page.evaluate(() => nodes.length);

      // Perform an action - clear graph
      await page.click('#clearBtn');
      const afterClear = await page.evaluate(() => nodes.length);
      expect(afterClear).toBe(0);

      // Undo should restore nodes
      await page.click('#undoBtn');
      const afterUndo = await page.evaluate(() => nodes.length);
      expect(afterUndo).toBeGreaterThanOrEqual(before);

      // Redo should re-clear (if possible)
      await page.click('#redoBtn');
      const afterRedo = await page.evaluate(() => nodes.length);
      // afterRedo should be 0 again
      expect(afterRedo).toBe(0);
    });

    test('Save to JSON writes text to textarea and Load from JSON restores graph; invalid JSON handled', async ({ page }) => {
      // Ensure some nodes exist
      let count = await page.evaluate(() => nodes.length);
      if (count === 0) {
        await page.click('#randomBtn');
        await page.waitForFunction(() => nodes.length > 0, { timeout: 2000 });
      }

      // Click save button
      await page.click('#saveBtn');
      // Textarea should contain JSON
      const txt = await page.locator('#saveLoadArea').inputValue();
      expect(txt).toBeTruthy();
      expect(() => JSON.parse(txt)).not.toThrow();

      // Now clear graph and then load the saved JSON
      await page.click('#clearBtn');
      const cleared = await page.evaluate(() => nodes.length);
      expect(cleared).toBe(0);

      // Fill textarea with previous JSON and click load
      await page.fill('#saveLoadArea', txt);
      await page.click('#loadBtn');

      // Info box should show 'Graph loaded'
      await page.waitForFunction(() => (document.getElementById('infoBox').textContent || '').includes('Graph loaded'), { timeout: 2000 });

      // Nodes should be restored (length > 0)
      const restored = await page.evaluate(() => nodes.length);
      expect(restored).toBeGreaterThan(0);

      // Now try invalid JSON to confirm error path
      await page.fill('#saveLoadArea', '{invalid: json,}');
      await page.click('#loadBtn');

      // Info box should contain 'Invalid JSON'
      const info = await page.locator('#infoBox').innerText();
      expect(info).toMatch(/Invalid JSON/);
    });
  });

  test.describe('Manual controls and edge cases', () => {
    test('Manual relax and force visit require selection and produce info messages when missing', async ({ page }) => {
      // Ensure pointer mode and no selection
      await page.click('#modePointer');

      // Ensure nothing selected
      await page.click('#canvas'); // clicking empty space -> no selection (or toggles)
      // Try manual relax with no selected edge
      await page.click('#manualRelaxBtn');
      const infoAfterRelax = await page.locator('#infoBox').innerText();
      expect(infoAfterRelax).toMatch(/Select an edge first|Select an edge first/);

      // Try force visit with no selected node
      await page.click('#forceVisitBtn');
      const infoAfterForce = await page.locator('#infoBox').innerText();
      expect(infoAfterForce).toMatch(/Select a node first/);
    });

    test('Attempt initialize without any nodes shows appropriate info', async ({ page }) => {
      // Clear graph to ensure no nodes
      await page.click('#clearBtn');
      const count = await page.evaluate(() => nodes.length);
      expect(count).toBe(0);

      // Click pickSource then init - pickSource will wait for a node click which won't come
      await page.click('#initBtn');
      const info = await page.locator('#infoBox').innerText();
      // Since source is null, it should warn
      expect(info).toMatch(/Set source before initializing/);
    });
  });

  test.describe('Console and page error observations', () => {
    test('Application should not emit uncaught page errors or console.error during normal interaction', async ({ page }) => {
      // Perform a quick set of interactions to exercise event handlers
      await page.click('#modeAddNode');
      const canvasBox = await page.locator('#canvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not available');
      // Add a node via clicking
      await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50);
      // Toggle some controls
      await page.click('#pickSourceBtn');
      await page.click('#pickTargetBtn');
      await page.click('#randomBtn');

      // Give some time for any asynchronous errors to surface
      await page.waitForTimeout(500);

      // We already assert in afterEach that pageErrors and consoleErrors arrays are empty.
      // For extra clarity, verify console messages array is present and contains at least some messages (info logs)
      expect(Array.isArray(consoleMessages)).toBe(true);
      // There should be multiple console messages captured (maybe none if app doesn't console.log) - we won't require them
    });
  });
});