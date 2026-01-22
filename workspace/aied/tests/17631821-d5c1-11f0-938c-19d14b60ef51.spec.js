import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17631821-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('Graph Visualization FSM - Application 17631821-d5c1-11f0-938c-19d14b60ef51', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and classify errors
    page.on('console', msg => {
      const type = msg.type(); // e.g., 'log', 'error', 'warning'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push({ type, text });
      }
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the app page exactly as-is (no modifications).
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // No teardown modifications to the page; we simply retain captured logs/errors for assertions in each test.
  });

  // Helper to get canvas dataURL
  const getCanvasDataURL = async (page) => {
    return page.evaluate(() => {
      const canvas = document.getElementById('graphCanvas');
      // Return data URL of the canvas for pixel-compare style checks
      return canvas.toDataURL();
    });
  };

  // Helper to sample a pixel RGBA at integer coordinates
  const getCanvasPixel = async (page, x, y) => {
    return page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('graphCanvas');
      const ctx = canvas.getContext('2d');
      // getImageData returns [r,g,b,a]
      const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      return { r: data[0], g: data[1], b: data[2], a: data[3] };
    }, { x, y });
  };

  test('Initial Idle state: page renders canvas and buttons (S0_Idle) and functions exist', async ({ page }) => {
    // Validate presence of canvas and buttons that evidence Idle state
    const canvas = page.locator('#graphCanvas');
    await expect(canvas).toHaveCount(1);

    const directedBtn = page.locator("button[onclick='drawDirectedGraph()']");
    const undirectedBtn = page.locator("button[onclick='drawUndirectedGraph()']");

    await expect(directedBtn).toHaveCount(1);
    await expect(undirectedBtn).toHaveCount(1);

    // Validate canvas attributes match the HTML evidence (width and height)
    const width = await page.evaluate(() => document.getElementById('graphCanvas').width);
    const height = await page.evaluate(() => document.getElementById('graphCanvas').height);
    expect(width).toBe(800);
    expect(height).toBe(600);

    // Ensure the expected functions exist on the window as part of the implementation evidence
    const drawDirectedType = await page.evaluate(() => typeof window.drawDirectedGraph);
    const drawUndirectedType = await page.evaluate(() => typeof window.drawUndirectedGraph);
    const drawGraphType = await page.evaluate(() => typeof window.drawGraph);
    expect(drawDirectedType).toBe('function');
    expect(drawUndirectedType).toBe('function');
    expect(drawGraphType).toBe('function');

    // Capture initial canvas dataURL to use in later comparisons
    const initialDataURL = await getCanvasDataURL(page);
    expect(typeof initialDataURL).toBe('string');
    // Expect no page errors on initial load
    expect(pageErrors.length).toBe(0);
    // No console 'error' messages on initial load
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: Draw Directed Graph (S0 -> S1) results in canvas update and node pixels change', async ({ page }) => {
    // Comment: This test validates the DrawDirectedGraph event triggers the directed graph rendering.
    const directedBtn = page.locator("button[onclick='drawDirectedGraph()']");
    // Take snapshot of canvas before click
    const before = await getCanvasDataURL(page);

    // Click the directed graph button to trigger drawDirectedGraph() -> drawGraph(directedEdges)
    await directedBtn.click();

    // Wait a short time for drawing operations to complete
    await page.waitForTimeout(100);

    const after = await getCanvasDataURL(page);
    // The canvas should have changed after drawing directed graph
    expect(after).not.toBe(before);

    // Pixel verification at node 0 coordinates (should be blue-filled circle)
    // Node 0 in HTML is at (100,100). We sample that pixel and expect a blue-ish color
    const pixelNode0 = await getCanvasPixel(page, 100, 100);
    // Blue fill color defined as '#007bff' => approx r=0,g=123,b=255. Allow tolerances.
    expect(pixelNode0.b).toBeGreaterThan(150); // strong blue channel
    expect(pixelNode0.g).toBeGreaterThan(50);  // some green channel
    // Ensure no page runtime errors occurred during the draw
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: Draw Undirected Graph (S0 -> S2) results in canvas update and differs from directed', async ({ page }) => {
    // Comment: This test validates the DrawUndirectedGraph event triggers the undirected graph rendering.
    const undirectedBtn = page.locator("button[onclick='drawUndirectedGraph()']");
    const directedBtn = page.locator("button[onclick='drawDirectedGraph()']");

    // Ensure canvas after directed draw for comparison
    await directedBtn.click();
    await page.waitForTimeout(100);
    const dataAfterDirected = await getCanvasDataURL(page);

    // Now click undirected button
    await undirectedBtn.click();
    await page.waitForTimeout(100);
    const dataAfterUndirected = await getCanvasDataURL(page);

    // The undirected drawing should change the canvas (and likely differ from directed)
    expect(dataAfterUndirected).not.toBe(dataAfterDirected);

    // Check pixel at a node that is part of the undirected edge loop (node 3 at 400,300)
    const pixelNode3 = await getCanvasPixel(page, 400, 300);
    // Node circles are blue-filled so expect blue-ish channel high
    expect(pixelNode3.b).toBeGreaterThan(150);

    // No unexpected runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Directed vs Undirected: arrowhead presence difference near target node (visual difference)', async ({ page }) => {
    // Comment: This test asserts that the directed graph draws arrowheads while the undirected graph does not, by comparing pixel samples.
    const directedBtn = page.locator("button[onclick='drawDirectedGraph()']");
    const undirectedBtn = page.locator("button[onclick='drawUndirectedGraph()']");

    // Draw directed graph first and sample pixel near node 2 (target of one directed edge)
    await directedBtn.click();
    await page.waitForTimeout(100);
    // Node 2 is at (200,300) in the HTML. Sample that pixel.
    const pixelDirectedAtNode2 = await getCanvasPixel(page, 200, 300);

    // Draw undirected graph and sample same pixel
    await undirectedBtn.click();
    await page.waitForTimeout(100);
    const pixelUndirectedAtNode2 = await getCanvasPixel(page, 200, 300);

    // The pixel values should differ if arrowhead for directed overlaps pixel and undirected does not.
    // We assert the difference in combined RGB sum as a simple metric.
    const sumRGBDirected = pixelDirectedAtNode2.r + pixelDirectedAtNode2.g + pixelDirectedAtNode2.b;
    const sumRGBUndirected = pixelUndirectedAtNode2.r + pixelUndirectedAtNode2.g + pixelUndirectedAtNode2.b;

    expect(sumRGBDirected).not.toBe(sumRGBUndirected);

    // Additionally, at least one of the samples should show a dark stroke (arrow/stroke color '#333' ~ 51,51,51)
    const isDirectedDark = (pixelDirectedAtNode2.r < 100 && pixelDirectedAtNode2.g < 100 && pixelDirectedAtNode2.b < 100);
    const isUndirectedDark = (pixelUndirectedAtNode2.r < 100 && pixelUndirectedAtNode2.g < 100 && pixelUndirectedAtNode2.b < 100);

    // At least one rendering should have dark pixel at that location (robust check)
    expect(isDirectedDark || isUndirectedDark).toBeTruthy();

    // No page errors produced
    expect(pageErrors.length).toBe(0);
  });

  test('Idempotence and repeated clicks: clicking same button twice yields consistent rendering', async ({ page }) => {
    // Comment: Validate that repeated invocation of the same transition produces consistent final state.
    const directedBtn = page.locator("button[onclick='drawDirectedGraph()']");

    await directedBtn.click();
    await page.waitForTimeout(100);
    const afterFirst = await getCanvasDataURL(page);

    // Click again
    await directedBtn.click();
    await page.waitForTimeout(100);
    const afterSecond = await getCanvasDataURL(page);

    // The canvas should be stable; the second click should produce the same rendering
    expect(afterSecond).toBe(afterFirst);

    // No console errors produced during repeated actions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking both buttons sequentially multiple times toggles canvas states without runtime errors', async ({ page }) => {
    // Comment: Repeatedly perform the two transitions to ensure the FSM transitions are robust and do not produce runtime exceptions.
    const directedBtn = page.locator("button[onclick='drawDirectedGraph()']");
    const undirectedBtn = page.locator("button[onclick='drawUndirectedGraph()']");

    // Sequence: directed -> undirected -> directed -> undirected
    await directedBtn.click();
    await page.waitForTimeout(80);
    const s1 = await getCanvasDataURL(page);

    await undirectedBtn.click();
    await page.waitForTimeout(80);
    const s2 = await getCanvasDataURL(page);

    await directedBtn.click();
    await page.waitForTimeout(80);
    const s3 = await getCanvasDataURL(page);

    await undirectedBtn.click();
    await page.waitForTimeout(80);
    const s4 = await getCanvasDataURL(page);

    // Ensure that states alternate and canvases vary appropriately.
    expect(s1).not.toBe(s2);
    expect(s2).not.toBe(s3);
    expect(s3).not.toBe(s4);

    // Ensure no runtime page errors or console errors occurred during rapid toggling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: console and page error collection behaves (assert collected logs and errors are as expected)', async ({ page }) => {
    // Comment: This test simply asserts that we have been capturing console messages and page errors,
    // and that for this healthy app there are no uncaught page errors or console error messages.
    // It also demonstrates that we do not artificially inject or change runtime behavior.

    // Perform a normal draw to potentially trigger any runtime logs
    await page.locator("button[onclick='drawDirectedGraph()']").click();
    await page.waitForTimeout(100);

    // We expect no unhandled page errors
    expect(pageErrors.length).toBe(0);

    // We expect no console messages of type 'error'
    expect(consoleErrors.length).toBe(0);

    // If there are other console messages (logs/warnings), they are captured in consoleMessages array.
    // Check that consoleMessages is an array and contains objects with type/text.
    expect(Array.isArray(consoleMessages)).toBe(true);
    for (const msg of consoleMessages) {
      expect(msg).toHaveProperty('type');
      expect(msg).toHaveProperty('text');
    }
  });

});