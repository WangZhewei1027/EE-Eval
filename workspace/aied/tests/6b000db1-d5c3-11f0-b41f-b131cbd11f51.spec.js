import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b000db1-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Graph Visualization - FSM states and transitions (Application ID: 6b000db1-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // Containers for captured console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for later assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application and wait for it to initialize
    await page.goto(APP_URL, { waitUntil: 'load' });
    // The app calls init on window.onload which generates an initial graph and updates UI.
    await page.waitForSelector('#graphInfo');
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: remove listeners to avoid leaks (Playwright handles page disposal but keep explicit)
    page.removeAllListeners && page.removeAllListeners('console');
    page.removeAllListeners && page.removeAllListeners('pageerror');
  });

  test.describe('Initial state (S0_Idle) and UI boot', () => {
    test('Idle: Directed button is active by default and initial graph generated', async ({ page }) => {
      // Validate entry action of Idle state: renderPage() equivalent -> initial UI is ready
      const directedBtn = page.locator('#directedBtn');
      const undirectedBtn = page.locator('#undirectedBtn');

      // Directed should have 'active' class by default (entry evidence)
      await expect(directedBtn).toHaveClass(/active/);

      // Undirected should NOT have active class initially
      const undirectedClass = await undirectedBtn.getAttribute('class');
      expect(undirectedClass === null || !undirectedClass.includes('active')).toBeTruthy();

      // The init() function generates a graph on load: vertices and edges should exist
      const graphState = await page.evaluate(() => {
        return { vertices: vertices.length, edges: edges.length, isDirected, selectedVertex: selectedVertex };
      });

      expect(graphState.vertices).toBeGreaterThanOrEqual(3); // per implementation: 3-10 vertices
      expect(graphState.edges).toBeGreaterThanOrEqual(0);
      expect(graphState.isDirected).toBe(true);
      // selectedVertex should be null initially
      expect(graphState.selectedVertex).toBeNull();
    });
  });

  test.describe('Graph type selection transitions (S1_GraphDirected, S2_GraphUndirected)', () => {
    test('Selecting Undirected Graph activates undirected button and updates state', async ({ page }) => {
      const directedBtn = page.locator('#directedBtn');
      const undirectedBtn = page.locator('#undirectedBtn');

      // Click undirected button (transition S0_Idle -> S2_GraphUndirected)
      await undirectedBtn.click();

      // Undirected should be active, directed should not
      await expect(undirectedBtn).toHaveClass(/active/);
      const directedClass = await directedBtn.getAttribute('class');
      expect(directedClass === null || !directedClass.includes('active')).toBeTruthy();

      // Evaluate isDirected flag in page
      const isDirected = await page.evaluate(() => isDirected);
      expect(isDirected).toBe(false);

      // Graph info should reflect 'Undirected'
      const graphInfoText = await page.locator('#graphInfo').textContent();
      expect(graphInfoText).toContain('Undirected');
    });

    test('Re-selecting Directed Graph activates directed button and updates state', async ({ page }) => {
      const directedBtn = page.locator('#directedBtn');
      const undirectedBtn = page.locator('#undirectedBtn');

      // First ensure undirected active, then click directed to go back (transition S0->S1)
      await undirectedBtn.click();
      await directedBtn.click();

      await expect(directedBtn).toHaveClass(/active/);
      const undirectedClass = await undirectedBtn.getAttribute('class');
      expect(undirectedClass === null || !undirectedClass.includes('active')).toBeTruthy();

      const isDirected = await page.evaluate(() => isDirected);
      expect(isDirected).toBe(true);

      const graphInfoText = await page.locator('#graphInfo').textContent();
      expect(graphInfoText).toContain('Directed');
    });
  });

  test.describe('Graph generation and clearing (S3_GraphGenerated -> S4_GraphCleared)', () => {
    test('Generate New Graph produces vertices and edges (from both directed and undirected states)', async ({ page }) => {
      const generateBtn = page.locator('#generateBtn');

      // Ensure we are in directed mode first
      await page.locator('#directedBtn').click();

      // Click generate (transition S1_GraphDirected -> S3_GraphGenerated)
      await generateBtn.click();

      // After generation, verify vertices and edges exist
      const stateAfterGen = await page.evaluate(() => ({ v: vertices.length, e: edges.length, isDirected }));
      expect(stateAfterGen.v).toBeGreaterThanOrEqual(3);
      expect(stateAfterGen.e).toBeGreaterThanOrEqual(0);
      expect(typeof stateAfterGen.isDirected).toBe('boolean');

      // Now switch to undirected and generate again (transition S2 -> S3)
      await page.locator('#undirectedBtn').click();
      await generateBtn.click();
      const stateAfterGenUndirected = await page.evaluate(() => ({ v: vertices.length, e: edges.length, isDirected }));
      expect(stateAfterGenUndirected.v).toBeGreaterThanOrEqual(3);
      expect(typeof stateAfterGenUndirected.isDirected).toBe('boolean');
      expect(stateAfterGenUndirected.isDirected).toBe(false);

      // Graph info should contain counts and density
      const graphInfoText = await page.locator('#graphInfo').textContent();
      expect(graphInfoText).toMatch(/Vertices:\s*\d+/);
      expect(graphInfoText).toMatch(/Edges:\s*\d+/);
      expect(graphInfoText).toMatch(/Density:\s*[0-9.]+/);
    });

    test('Clear Graph empties vertices and edges and updates UI (S3 -> S4)', async ({ page }) => {
      // Ensure there is a graph generated
      await page.locator('#generateBtn').click();

      // Click clear
      await page.locator('#clearBtn').click();

      // After clear, vertices and edges arrays should be empty
      const clearedState = await page.evaluate(() => ({ v: vertices.length, e: edges.length }));
      expect(clearedState.v).toBe(0);
      expect(clearedState.e).toBe(0);

      // Graph info should reflect 0 vertices
      const graphInfoText = await page.locator('#graphInfo').textContent();
      expect(graphInfoText).toContain('Vertices: 0');

      // Details panels should be hidden (no 'active' class)
      const vertexDetailsClass = await page.locator('#vertexDetails').getAttribute('class');
      const edgeDetailsClass = await page.locator('#edgeDetails').getAttribute('class');
      expect(!(vertexDetailsClass || '').includes('active')).toBeTruthy();
      expect(!(edgeDetailsClass || '').includes('active')).toBeTruthy();
    });
  });

  test.describe('Vertex selection (S5_VertexSelected) and canvas interactions', () => {
    test('Clicking on a vertex in the canvas selects it and shows details', async ({ page }) => {
      // Ensure a fresh graph to have predictable vertices array
      await page.locator('#generateBtn').click();

      // Wait for vertices to be available on the page's JS context
      const verticesCount = await page.evaluate(() => vertices.length);
      expect(verticesCount).toBeGreaterThanOrEqual(3);

      // Get the first vertex position and label
      const firstVertex = await page.evaluate(() => {
        return Object.assign({}, vertices[0]); // shallow copy to transfer
      });

      // Get canvas bounding box to compute click coordinates
      const canvasBox = await page.locator('#graphCanvas').boundingBox();
      expect(canvasBox).not.toBeNull();

      // Compute page coordinates to click: canvas top-left + vertex.x, vertex.y
      const clickX = canvasBox.x + firstVertex.x;
      const clickY = canvasBox.y + firstVertex.y;

      // Click exactly on the vertex coordinates
      await page.mouse.click(clickX, clickY);

      // After click, vertexDetails and edgeDetails should be visible ('.active' class)
      await expect(page.locator('#vertexDetails')).toHaveClass(/active/);
      await expect(page.locator('#edgeDetails')).toHaveClass(/active/);

      // Vertex details should contain the label of the selected vertex
      const vertexDetailsText = await page.locator('#vertexDetails').textContent();
      expect(vertexDetailsText).toContain(`Vertex ${firstVertex.label}`);

      // Ensure selectedVertex in page context matches the clicked vertex id
      const selected = await page.evaluate(() => selectedVertex && selectedVertex.id);
      expect(selected).toBe(firstVertex.id);
    });

    test('Clicking on empty canvas area clears selection (S5 -> S3)', async ({ page }) => {
      // Generate graph and select first vertex
      await page.locator('#generateBtn').click();
      const firstVertex = await page.evaluate(() => Object.assign({}, vertices[0]));
      const canvasBox = await page.locator('#graphCanvas').boundingBox();
      const vertexClickX = canvasBox.x + firstVertex.x;
      const vertexClickY = canvasBox.y + firstVertex.y;
      await page.mouse.click(vertexClickX, vertexClickY);

      // Confirm selection present
      await expect(page.locator('#vertexDetails')).toHaveClass(/active/);

      // Click on a location that is very likely empty (near canvas top-left margin)
      const emptyX = canvasBox.x + 10;
      const emptyY = canvasBox.y + 10;
      await page.mouse.click(emptyX, emptyY);

      // Now selection should be cleared
      const vertexDetailsClass = await page.locator('#vertexDetails').getAttribute('class');
      const edgeDetailsClass = await page.locator('#edgeDetails').getAttribute('class');
      expect(!(vertexDetailsClass || '').includes('active')).toBeTruthy();
      expect(!(edgeDetailsClass || '').includes('active')).toBeTruthy();

      // selectedVertex should be null in page context
      const selectedAfter = await page.evaluate(() => selectedVertex);
      expect(selectedAfter).toBeNull();
    });

    test('Clicking canvas when no vertices exist does not throw and keeps details hidden (edge case)', async ({ page }) => {
      // Clear the graph first to remove all vertices
      await page.locator('#clearBtn').click();

      // Ensure vertices array is empty
      const vCount = await page.evaluate(() => vertices.length);
      expect(vCount).toBe(0);

      // Click somewhere on the canvas
      const canvasBox = await page.locator('#graphCanvas').boundingBox();
      const x = canvasBox.x + 50;
      const y = canvasBox.y + 50;
      await page.mouse.click(x, y);

      // No details should be active and no exceptions should bubble as pageerror (captured separately)
      const vertexDetailsClass = await page.locator('#vertexDetails').getAttribute('class');
      const edgeDetailsClass = await page.locator('#edgeDetails').getAttribute('class');
      expect(!(vertexDetailsClass || '').includes('active')).toBeTruthy();
      expect(!(edgeDetailsClass || '').includes('active')).toBeTruthy();
    });
  });

  test.describe('Robustness and edge cases', () => {
    test('Rapidly toggling graph type and generating multiple times does not produce errors', async ({ page }) => {
      const directedBtn = page.locator('#directedBtn');
      const undirectedBtn = page.locator('#undirectedBtn');
      const generateBtn = page.locator('#generateBtn');

      // Rapid toggles
      for (let i = 0; i < 3; i++) {
        await directedBtn.click();
        await undirectedBtn.click();
      }

      // Rapidly generate graphs
      for (let i = 0; i < 5; i++) {
        await generateBtn.click();
      }

      // Ensure there are vertices after rapid generation
      const v = await page.evaluate(() => vertices.length);
      expect(v).toBeGreaterThanOrEqual(3);

      // Ensure no page-level errors were emitted during these operations
      expect(pageErrors.length).toBe(0);
    });

    test('Graph info density computation returns a finite number and is displayed', async ({ page }) => {
      await page.locator('#generateBtn').click();

      // Evaluate density from page context
      const density = await page.evaluate(() => calculateDensity());
      expect(Number.isFinite(density)).toBeTruthy();

      // Ensure displayed density matches format with numeric characters
      const graphInfoText = await page.locator('#graphInfo').textContent();
      expect(graphInfoText).toMatch(/Density:\s*[0-9.]+/);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No unexpected console.error or pageerrors were emitted during tests', async ({ page }) => {
      // At this point, prior operations have populated consoleMessages and pageErrors arrays.
      // Assert that there were no page errors (uncaught exceptions)
      expect(pageErrors.length).toBe(0);

      // Assert that there are no console messages with type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      if (consoleErrors.length > 0) {
        // If there are console errors, fail the test with details for debugging
        const combined = consoleErrors.map(e => e.text).join('\n---\n');
        throw new Error('Console errors detected:\n' + combined);
      }

      // Also assert no console messages include 'ReferenceError'/'TypeError'/'SyntaxError' texts
      const problematic = consoleMessages.filter(m =>
        /ReferenceError|TypeError|SyntaxError/.test(m.text)
      );
      expect(problematic.length).toBe(0);
    });

    test('If any runtime errors occur they are reported via pageerror or console.error (test ensures visibility)', async ({ page }) => {
      // This test simply verifies that our test harness captured errors (if any).
      // We do not inject or modify behavior; we only ensure that captured error arrays reflect reality.

      // Both arrays should be defined
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();

      // We assert no unexpected runtime errors occurred; if they did, the previous test would fail and surface them.
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });
});