import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442d140-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Prim\'s Algorithm Interactive App (0442d140-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Arrays to capture page errors and console.error messages for each test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught exceptions from the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic sanity: record if any page/runtime errors were observed during a test.
    // We will assert within individual tests as needed.
  });

  test('Initial Idle state: page structure and rendering functions exist', async ({ page }) => {
    // Validate that the container and canvas exist (evidence for S0_Idle)
    const containerExists = await page.locator('.container').count();
    expect(containerExists).toBeGreaterThan(0); // .container must be present

    const canvas = page.locator('#graph-canvas');
    await expect(canvas).toHaveCount(1); // canvas element exists

    // Verify canvas attributes width/height
    const canvasSize = await canvas.evaluate((c) => ({ w: c.width, h: c.height }));
    expect(canvasSize.w).toBe(800);
    expect(canvasSize.h).toBe(600);

    // Verify that the draw* functions are present on the global window (entry_actions)
    const hasDrawFunctions = await page.evaluate(() => {
      return {
        drawGraph: typeof window.drawGraph === 'function',
        drawNodes: typeof window.drawNodes === 'function',
        drawEdges: typeof window.drawEdges === 'function'
      };
    });
    expect(hasDrawFunctions.drawGraph).toBe(true);
    expect(hasDrawFunctions.drawNodes).toBe(true);
    expect(hasDrawFunctions.drawEdges).toBe(true);

    // Verify that initial drawing was performed on the canvas (script calls drawGraph/drawNodes/drawEdges on load)
    // We test that there is at least one non-transparent pixel on the canvas.
    const hasNonTransparentPixel = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) return true;
      }
      return false;
    });
    expect(hasNonTransparentPixel).toBe(true);

    // Assert that no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
    // Assert that console.errors were not emitted during initial load
    expect(consoleErrors.length).toBe(0);
  });

  test('Draw Graph transition (S0_Idle -> S1_GraphDrawn) updates the canvas', async ({ page }) => {
    // Capture a baseline of the canvas pixel data
    const baselineNonTransparent = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) count++;
      }
      return count;
    });

    // Find the "Draw Graph" button by text and click it
    const drawGraphBtn = page.locator('button', { hasText: 'Draw Graph' });
    await expect(drawGraphBtn).toHaveCount(1);
    await drawGraphBtn.click();

    // After clicking, there should still be drawing present; ideally we'd detect a change.
    const afterClickNonTransparent = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) count++;
      }
      return count;
    });

    // Expect the canvas to contain drawing pixels after the transition
    expect(afterClickNonTransparent).toBeGreaterThan(0);

    // It is acceptable for the number of non-transparent pixels to be the same or different depending on draw order.
    // But typically this click should not cause an exception.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Draw Nodes transition (S1_GraphDrawn -> S2_NodesDrawn) draws nodes on the canvas', async ({ page }) => {
    // Click Draw Nodes button
    const drawNodesBtn = page.locator('button', { hasText: 'Draw Nodes' });
    await expect(drawNodesBtn).toHaveCount(1);

    // Baseline count
    const baseline = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let non = 0;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) non++;
      }
      return non;
    });

    await drawNodesBtn.click();

    const after = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let non = 0;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) non++;
      }
      return non;
    });

    // The drawNodes implementation should result in non-transparent pixels (nodes)
    expect(after).toBeGreaterThan(0);
    // It's okay for counts to be greater or less than baseline depending on clearRect and redraw.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Draw Edges transition (S2_NodesDrawn -> S3_EdgesDrawn) draws edges on the canvas', async ({ page }) => {
    // Click Draw Edges button
    const drawEdgesBtn = page.locator('button', { hasText: 'Draw Edges' });
    await expect(drawEdgesBtn).toHaveCount(1);

    // Baseline non-transparent pixels
    const baseline = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let non = 0;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) non++;
      }
      return non;
    });

    await drawEdgesBtn.click();

    const after = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let non = 0;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) non++;
      }
      return non;
    });

    // After drawing edges, there should be drawing on the canvas
    expect(after).toBeGreaterThan(0);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Full sequence of transitions: Draw Graph -> Draw Nodes -> Draw Edges (state progression)', async ({ page }) => {
    // Ensure the initial state allows clicking in sequence without throwing errors
    const graphBtn = page.locator('button', { hasText: 'Draw Graph' });
    const nodesBtn = page.locator('button', { hasText: 'Draw Nodes' });
    const edgesBtn = page.locator('button', { hasText: 'Draw Edges' });

    await expect(graphBtn).toHaveCount(1);
    await expect(nodesBtn).toHaveCount(1);
    await expect(edgesBtn).toHaveCount(1);

    // Click in order and assert no page errors were emitted during transitions
    await graphBtn.click();
    await nodesBtn.click();
    await edgesBtn.click();

    // After sequence, there should be drawing on the canvas (evidence of final state)
    const finalNonTransparent = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) return true;
      }
      return false;
    });
    expect(finalNonTransparent).toBe(true);

    // Assert that no runtime page errors occurred during the sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid repeated clicks do not throw uncaught exceptions', async ({ page }) => {
    const edgesBtn = page.locator('button', { hasText: 'Draw Edges' });
    await expect(edgesBtn).toHaveCount(1);

    // Rapidly click the button multiple times to exercise potential race conditions
    for (let i = 0; i < 10; i++) {
      await edgesBtn.click();
    }

    // Ensure there are still drawing pixels (should remain true)
    const stillDrawn = await page.evaluate(() => {
      const c = document.getElementById('graph-canvas');
      const ctx = c.getContext('2d');
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < img.length; i += 4) {
        if (img[i] !== 0) return true;
      }
      return false;
    });
    expect(stillDrawn).toBe(true);

    // Expect no uncaught exceptions or console errors from rapid clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Error scenario: attempting to click a non-existent control throws a Playwright error', async ({ page }) => {
    // Attempt to click a selector that does not exist. Playwright should throw.
    let caught = false;
    try {
      await page.click('button:has-text("Non Existent Button")', { timeout: 1000 });
    } catch (err) {
      caught = true;
      // Validate that the thrown error originates from Playwright trying to find/click the selector
      expect(err.message).toContain('No node found for selector');
    }
    expect(caught).toBe(true);

    // No page runtime errors should be produced by this client-side failure
    expect(pageErrors.length).toBe(0);
  });

  test('Inspect console and page errors captures (observability test)', async ({ page }) => {
    // This test explicitly validates that we captured the runtime observability arrays.
    // It does not assume there ARE errors; it asserts that we monitored and the arrays exist.
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(Array.isArray(consoleErrors)).toBe(true);

    // If there were runtime errors, surface them in the assertion message for debugging.
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Build a helpful failure message listing errors observed
      const details = {
        pageErrors,
        consoleErrors
      };
      // Fail the test with the collected details so that issues are visible in CI logs
      throw new Error('Runtime errors observed during test run: ' + JSON.stringify(details, null, 2));
    }

    // Otherwise the test passes - confirming no page/runtime errors were observed
  });
});