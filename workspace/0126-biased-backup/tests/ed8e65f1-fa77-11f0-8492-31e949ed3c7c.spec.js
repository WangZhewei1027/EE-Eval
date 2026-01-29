import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e65f1-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('NP-Completeness Visualized (FSM: Idle -> Animating)', () => {
  // Containers for console and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages and JS exceptions for assertion later
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page and ensure load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Helper: read the RGBA of the center pixel of the canvas
  async function getCanvasCenterPixel(page) {
    return await page.evaluate(() => {
      const canvas = document.getElementById('npCanvas');
      const ctx = canvas.getContext('2d');
      const x = Math.floor(canvas.width / 2);
      const y = Math.floor(canvas.height / 2);
      const data = ctx.getImageData(x, y, 1, 1).data;
      return Array.from(data); // [r, g, b, a]
    });
  }

  // Helper: get a full dataURL snapshot of the canvas
  async function getCanvasDataURL(page) {
    return await page.evaluate(() => {
      const canvas = document.getElementById('npCanvas');
      return canvas.toDataURL();
    });
  }

  test('Initial Idle state: DOM elements are present and canvas is not animated yet', async ({ page }) => {
    // Validate Start Animation button presence and accessibility
    const startButton = await page.locator('#startAnimation');
    await expect(startButton).toBeVisible();
    await expect(startButton).toHaveText('Start Animation');

    // Validate canvas exists and has dimensions
    const canvas = await page.locator('#npCanvas');
    await expect(canvas).toBeVisible();
    // Confirm canvas width/height properties are set on the element (script sets them)
    const dims = await page.evaluate(() => {
      const c = document.getElementById('npCanvas');
      return { width: c.width, height: c.height, clientWidth: c.clientWidth, clientHeight: c.clientHeight };
    });
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);

    // Read center pixel before animation starts - expected to be fully transparent (no drawing yet)
    const centerBefore = await getCanvasCenterPixel(page);
    // alpha channel should be 0 for an untouched canvas
    expect(centerBefore.length).toBe(4);
    expect(centerBefore[3]).toBe(0);

    // No runtime page errors should have occurred while loading Idle state
    expect(pageErrors.length).toBe(0);
    // No console 'error' messages emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('StartAnimation event causes transition to Animating and draw() runs -> canvas updates', async ({ page }) => {
    // Capture initial canvas snapshot for comparison
    const beforeDataURL = await getCanvasDataURL(page);
    const beforePixel = await getCanvasCenterPixel(page);

    // Trigger the StartAnimation event by clicking the button
    await page.click('#startAnimation');

    // Wait enough time for at least one animation frame to have run
    await page.waitForTimeout(400);

    // After animation started, the canvas should have been painted with the background color (#3b3f47)
    const afterPixel = await getCanvasCenterPixel(page);
    const afterDataURL = await getCanvasDataURL(page);

    // Ensure the canvas data changed after click
    expect(afterDataURL).not.toBe(beforeDataURL, 'Canvas snapshot should change after starting animation');

    // The background color '#3b3f47' corresponds to RGB (59,63,71) in hex.
    // After a draw() call the center pixel should no longer be transparent and should match the background fillRect.
    expect(afterPixel[3]).toBe(255); // opaque
    expect(afterPixel[0]).toBe(59);
    expect(afterPixel[1]).toBe(63);
    expect(afterPixel[2]).toBe(71);

    // Validate there are still no page-level JS exceptions (ReferenceError/SyntaxError/TypeError)
    expect(pageErrors.length).toBe(0);

    // Also assert no console.error messages were produced by the page runtime
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Multiple clicks do not break animation (edge case) and animation continues over time', async ({ page }) => {
    // Start animation
    await page.click('#startAnimation');

    // Let it run a bit
    await page.waitForTimeout(200);
    const pixel1 = await getCanvasCenterPixel(page);
    const dataURL1 = await getCanvasDataURL(page);

    // Click again while animation is active (should be a no-op; guard prevents double-start)
    await page.click('#startAnimation');

    // Wait some more frames and capture new snapshot
    await page.waitForTimeout(300);
    const pixel2 = await getCanvasCenterPixel(page);
    const dataURL2 = await getCanvasDataURL(page);

    // The canvas must continue to change over time as phase advances (hence snapshots differ)
    // We expect the dataURLs to differ over time (animation running)
    expect(dataURL2).not.toBe(dataURL1);

    // The center pixel should remain painted (opaque background) in both snapshots
    expect(pixel1[3]).toBe(255);
    expect(pixel2[3]).toBe(255);

    // There should be no JS exceptions raised by multiple clicks (no ReferenceError/SyntaxError/TypeError)
    expect(pageErrors.length).toBe(0);
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length).toBe(0);
  });

  test('Animation provides continuous visual feedback: center pixel changes between frames', async ({ page }) => {
    // Start animation
    await page.click('#startAnimation');

    // Take several samples over time to ensure animation is updating pixels
    const samples = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(150);
      samples.push(await getCanvasCenterPixel(page));
    }

    // Ensure we captured multiple samples
    expect(samples.length).toBe(4);

    // At least one adjacent pair should be different indicating movement/animation
    let changed = false;
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const cur = samples[i];
      if (prev[0] !== cur[0] || prev[1] !== cur[1] || prev[2] !== cur[2] || prev[3] !== cur[3]) {
        changed = true;
        break;
      }
    }
    expect(changed).toBeTruthy();

    // Confirm still no top-level JS exceptions
    expect(pageErrors.length).toBe(0);
  });

  test('Monitor for ReferenceError, SyntaxError, TypeError specifically (if any occur they surface in pageErrors)', async ({ page }) => {
    // No further interaction; just assert that none of the captured page errors are these types.
    // This test explicitly documents that we observe and fail if critical JS errors occur.
    const problematic = pageErrors.filter(err => {
      const name = err && err.name;
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    });
    expect(problematic.length).toBe(0);
  });
});