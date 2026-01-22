import { test, expect } from '@playwright/test';

test.describe('Graph Visualization FSM - d7b30212-d5c2-11f0-9651-0f1ae31ac260', () => {
  const URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b30212-d5c2-11f0-9651-0f1ae31ac260.html';

  // Helpers to interact with the canvas in page coordinates (relative to canvas top-left)
  async function canvasBox(page) {
    const box = await page.locator('#graphCanvas').boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    return box;
  }

  async function clickCanvasAt(page, x, y) {
    const box = await canvasBox(page);
    await page.mouse.click(box.x + x, box.y + y);
    // allow drawing to complete
    await page.waitForTimeout(60);
  }

  async function mouseDragCanvas(page, from, to, steps = 5) {
    const box = await canvasBox(page);
    const startX = box.x + from.x;
    const startY = box.y + from.y;
    const endX = box.x + to.x;
    const endY = box.y + to.y;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // small pause so mousedown handler can set draggingEdge
    await page.waitForTimeout(30);

    // intermediate moves
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = startX + (endX - startX) * t;
      const my = startY + (endY - startY) * t;
      await page.mouse.move(mx, my);
      await page.waitForTimeout(15);
    }

    await page.mouse.up();
    // allow drawGraph to finish
    await page.waitForTimeout(80);
  }

  // Get canvas PNG data URL for simple visual comparison
  async function canvasDataURL(page) {
    return await page.evaluate(() => {
      const canvas = document.getElementById('graphCanvas');
      return canvas.toDataURL();
    });
  }

  // Sample a pixel's RGBA at canvas-relative coordinates (x,y)
  async function sampleCanvasPixel(page, x, y) {
    return await page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('graphCanvas');
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(x, y, 1, 1).data;
      return Array.from(data); // [r,g,b,a]
    }, { x, y });
  }

  // Setup console and page error collectors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    page._collectedConsole = [];
    page._collectedPageErrors = [];

    page.on('console', msg => {
      page._collectedConsole.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      page._collectedPageErrors.push(err);
    });

    await page.goto(URL, { waitUntil: 'load' });
    // small wait to ensure initial drawGraph() executed
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Assert there were no unexpected page runtime errors
    // We capture and assert the absence of page errors to validate runtime stability.
    expect(page._collectedPageErrors.length).toBe(0);
    // Also assert no console messages of type 'error'
    const errorConsole = page._collectedConsole.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test.describe('State: S0_Idle (Initial / Idle state)', () => {
    test('Canvas and controls are present and initial draw executed', async ({ page }) => {
      // Verify primary components exist in the DOM
      await expect(page.locator('#graphCanvas')).toBeVisible();
      await expect(page.locator('#resetBtn')).toBeVisible();
      await expect(page.locator('input[name="graphType"][value="undirected"]')).toBeVisible();
      await expect(page.locator('input[name="graphType"][value="directed"]')).toBeVisible();

      // Capture initial canvas data URL to represent the Idle state's drawing
      const initialData = await canvasDataURL(page);
      expect(typeof initialData).toBe('string');
      expect(initialData.startsWith('data:image/png')).toBeTruthy();
    });
  });

  test.describe('Transition: S0_Idle -> S1_AddingNode (Click to add node)', () => {
    test('Clicking empty canvas adds a node (visual change in canvas)', async ({ page }) => {
      // Capture baseline
      const before = await canvasDataURL(page);

      // Click to add a node at (100,100)
      await clickCanvasAt(page, 100, 100);

      const after = await canvasDataURL(page);
      // Expect drawing changed after adding node
      expect(after).not.toBe(before);

      // Verify that the area around the click contains non-white pixels (the node stroke/label)
      // Sample a pixel slightly to the right where node stroke is likely
      const pixel = await sampleCanvasPixel(page, 100 + 18, 100); // near circumference
      // If stroke is present, at least one channel should be non-255 (non-white) or non-transparent
      const isNonWhite = pixel[3] !== 0 && (pixel[0] !== 255 || pixel[1] !== 255 || pixel[2] !== 255);
      expect(isNonWhite).toBeTruthy();
    });

    test('Clicking on existing node does not create overlapping node (edge case)', async ({ page }) => {
      // Add first node
      await clickCanvasAt(page, 150, 150);
      const afterFirst = await canvasDataURL(page);

      // Attempt to add another node very close to first (within 2*NODE_RADIUS = 40)
      await clickCanvasAt(page, 150 + 10, 150 + 5);

      const afterSecondAttempt = await canvasDataURL(page);
      // No new node should have been added; canvas should remain the same visually
      expect(afterSecondAttempt).toBe(afterFirst);
    });
  });

  test.describe('Transitions: S0_Idle -> S3_DraggingEdge -> S2_CreatingEdge', () => {
    test('Drag from one node to another creates an edge (undirected by default)', async ({ page }) => {
      // Add two nodes sufficiently apart
      await clickCanvasAt(page, 220, 120); // Node A
      await clickCanvasAt(page, 360, 120); // Node B

      const beforeEdge = await canvasDataURL(page);

      // Drag from Node A center to Node B center
      await mouseDragCanvas(page, { x: 220, y: 120 }, { x: 360, y: 120 });

      const afterEdge = await canvasDataURL(page);
      expect(afterEdge).not.toBe(beforeEdge);

      // Verify that midpoint between nodes has non-white pixels indicating an edge line
      const midpointX = Math.round((220 + 360) / 2);
      const midpointY = 120;
      const pixel = await sampleCanvasPixel(page, midpointX, midpointY);
      const isNonWhite = pixel[3] !== 0 && (pixel[0] !== 255 || pixel[1] !== 255 || pixel[2] !== 255);
      expect(isNonWhite).toBeTruthy();
    });

    test('Dragging and releasing on empty space does not create an edge (cancelled drag)', async ({ page }) => {
      // Add two nodes (we will try to drag from one to empty area)
      await clickCanvasAt(page, 80, 300); // Node A
      await clickCanvasAt(page, 200, 300); // Node B

      // Capture before attempting an invalid edge
      const before = await canvasDataURL(page);

      // Drag from node A to an empty spot (not over node B)
      await mouseDragCanvas(page, { x: 80, y: 300 }, { x: 300, y: 400 });

      // After releasing on empty space, no new edge should be present that modifies the canvas permanently
      const after = await canvasDataURL(page);
      // It's possible that temporary drag drawing occurred during drag, but final draw should be same as before if no edge added
      // Some implementations may slightly differ due to anti-aliasing; still we expect no new persistent edge between node A and 300,400
      // To be robust: check that the midpoint between the two nodes' centers still does not show a new line connecting node A to the empty point.
      // We'll assert the canvas remains visually similar to before (dataURL identical or very similar). Prefer exact equality given deterministic canvas drawing.
      expect(after).toBe(before);
    });

    test('Creating a self-loop by dragging from node to itself results in loop drawn', async ({ page }) => {
      // Add single node
      await clickCanvasAt(page, 420, 300);

      const before = await canvasDataURL(page);

      // mousedown and mouseup on same coordinates to create a self-loop
      const box = await canvasBox(page);
      const absX = box.x + 420;
      const absY = box.y + 300;
      await page.mouse.move(absX, absY);
      await page.mouse.down();
      await page.waitForTimeout(30);
      await page.mouse.up();
      await page.waitForTimeout(80);

      const after = await canvasDataURL(page);
      // Self-loop should alter the canvas (loop circle drawn)
      expect(after).not.toBe(before);

      // Sample pixel at a position where the self-loop is expected (top-right of node)
      const sampleX = 420 + 20 + 12; // node.x + NODE_RADIUS + loop offset
      const sampleY = 300 - 20 - 2;  // node.y - NODE_RADIUS + small offset
      const pixel = await sampleCanvasPixel(page, sampleX, sampleY);
      const isNonWhite = pixel[3] !== 0 && (pixel[0] !== 255 || pixel[1] !== 255 || pixel[2] !== 255);
      expect(isNonWhite).toBeTruthy();
    });
  });

  test.describe('Transition: S0_Idle (GraphTypeChange)', () => {
    test('Switching graph type to directed updates rendering (arrowheads instead of plain lines)', async ({ page }) => {
      // Ensure two nodes and an edge are present in undirected mode
      await clickCanvasAt(page, 80, 80); // Node 1
      await clickCanvasAt(page, 220, 80); // Node 2
      await mouseDragCanvas(page, { x: 80, y: 80 }, { x: 220, y: 80 }); // add undirected edge

      const undirectedData = await canvasDataURL(page);

      // Change to directed via radio button
      await page.locator('input[name="graphType"][value="directed"]').check();
      // wait for redraw
      await page.waitForTimeout(80);

      const directedData = await canvasDataURL(page);

      // Directed rendering should be visually different (arrowheads)
      expect(directedData).not.toBe(undirectedData);

      // Inspect a pixel near the target node's edge end where an arrowhead would be expected
      const arrowProbeX = 220 - 18; // near the endpoints where arrowhead may be drawn
      const arrowProbeY = 80;
      const pixel = await sampleCanvasPixel(page, arrowProbeX, arrowProbeY);
      const isNonWhite = pixel[3] !== 0 && (pixel[0] !== 255 || pixel[1] !== 255 || pixel[2] !== 255);
      expect(isNonWhite).toBeTruthy();
    });
  });

  test.describe('Transition: S0_Idle (ResetGraph)', () => {
    test('Reset button clears nodes and edges returning to initial idle drawing', async ({ page }) => {
      // Capture the initial image at idle
      const initial = await canvasDataURL(page);

      // Add nodes and an edge
      await clickCanvasAt(page, 100, 220);
      await clickCanvasAt(page, 220, 220);
      await mouseDragCanvas(page, { x: 100, y: 220 }, { x: 220, y: 220 });

      const modified = await canvasDataURL(page);
      expect(modified).not.toBe(initial);

      // Click reset
      await page.click('#resetBtn');
      await page.waitForTimeout(80);

      const afterReset = await canvasDataURL(page);
      // After reset, the canvas drawing should return to the initial idle appearance
      expect(afterReset).toBe(initial);
    });
  });

  test.describe('Comprehensive edge cases & FSM coverage', () => {
    test('Multiple sequential operations: add, drag, change type, reset produce expected DOM/visual results', async ({ page }) => {
      // Start fresh: reset to ensure consistent behaviour
      await page.click('#resetBtn');
      await page.waitForTimeout(60);
      const base = await canvasDataURL(page);

      // Add three nodes
      await clickCanvasAt(page, 120, 130);
      await clickCanvasAt(page, 260, 130);
      await clickCanvasAt(page, 200, 220);

      // Create two edges
      await mouseDragCanvas(page, { x: 120, y: 130 }, { x: 260, y: 130 });
      await mouseDragCanvas(page, { x: 260, y: 130 }, { x: 200, y: 220 });

      const withEdges = await canvasDataURL(page);
      expect(withEdges).not.toBe(base);

      // Change type to directed
      await page.locator('input[name="graphType"][value="directed"]').check();
      await page.waitForTimeout(60);
      const directed = await canvasDataURL(page);
      expect(directed).not.toBe(withEdges);

      // Reset and verify blank return
      await page.click('#resetBtn');
      await page.waitForTimeout(60);
      const afterReset = await canvasDataURL(page);
      expect(afterReset).toBe(base);
    });

    test('No unexpected runtime errors or console error messages during heavy interactions', async ({ page }) => {
      // Perform a series of fast interactions to exercise mouse handlers
      await page.click('#resetBtn');
      await page.waitForTimeout(20);

      // Rapidly add nodes across the canvas
      for (let i = 1; i <= 6; i++) {
        await clickCanvasAt(page, 50 + i * 80, 60 + (i % 2) * 60);
      }

      // Rapidly create edges between consecutive nodes
      const positions = [
        { x: 130, y: 60 },
        { x: 210, y: 120 },
        { x: 290, y: 60 },
        { x: 370, y: 120 }
      ];
      for (let i = 0; i < positions.length - 1; i++) {
        await mouseDragCanvas(page, positions[i], positions[i + 1], 3);
      }

      // Switch graph type twice
      await page.locator('input[name="graphType"][value="directed"]').check();
      await page.waitForTimeout(30);
      await page.locator('input[name="graphType"][value="undirected"]').check();
      await page.waitForTimeout(30);

      // At this point our beforeEach/afterEach assertions will verify no page errors and no console 'error' messages occurred.
      // Also do a final sanity check that canvas contains some drawing
      const data = await canvasDataURL(page);
      expect(data.startsWith('data:image/png')).toBeTruthy();
    });
  });
});