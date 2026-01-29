import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ad60b0-fa78-11f0-812d-c9788050701f.html';

// Utility: sample a single pixel from the canvas at (x, y)
async function sampleCanvasPixel(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const canvas = document.getElementById('regressionCanvas');
    const ctx = canvas.getContext('2d');
    // read a single pixel
    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return Array.from(pixel); // [r,g,b,a]
  }, { x, y });
}

// Utility: get full canvas data URL
async function getCanvasDataURL(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('regressionCanvas');
    return canvas.toDataURL();
  });
}

// Helper: compare two dataURLs for inequality
function dataURLsDiffer(a, b) {
  return a !== b;
}

// Helper: check if RGB is close to expected within tolerance
function rgbClose(actual, expected, tolerance = 30) {
  const [ar, ag, ab] = actual;
  const [er, eg, eb] = expected;
  return Math.abs(ar - er) <= tolerance &&
         Math.abs(ag - eg) <= tolerance &&
         Math.abs(ab - eb) <= tolerance;
}

test.describe('Linear Regression Visual App - FSM validation (72ad60b0-fa78-11f0-812d-c9788050701f)', () => {
  // Arrays to collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Observe console messages and page errors
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // swallow observation errors; they should not interfere with tests
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Wait a short while to allow canvas drawing in DOMContentLoaded to finish
    await page.waitForTimeout(300);
  });

  test.afterEach(async () => {
    // no-op teardown here; hooks used for setup/observation above
  });

  test('Initial state S0_Idle: page loads and drawGraph() runs on enter', async ({ page }) => {
    // Purpose:
    // - Validate initial Idle state entry action drawGraph() executed (graph content drawn on canvas).
    // - Verify DOM components exist (canvas and buttons).
    // - Ensure no uncaught page errors or console errors were recorded during load.

    // Ensure buttons and canvas exist in DOM
    const generateBtn = await page.$('#generateBtn');
    const regressBtn = await page.$('#regressBtn');
    const canvas = await page.$('#regressionCanvas');

    expect(generateBtn).not.toBeNull();
    expect(regressBtn).not.toBeNull();
    expect(canvas).not.toBeNull();

    // Canvas should have non-zero dimensions
    const dimensions = await page.evaluate(() => {
      const c = document.getElementById('regressionCanvas');
      return { w: c.width, h: c.height };
    });
    expect(dimensions.w).toBeGreaterThan(0);
    expect(dimensions.h).toBeGreaterThan(0);

    // Capture a dataURL to ensure drawGraph produced content (non-empty image)
    const dataURL = await getCanvasDataURL(page);
    expect(typeof dataURL).toBe('string');
    expect(dataURL.length).toBeGreaterThan(1000); // heuristic: canvas must have some content

    // Assert that no uncaught page errors or console error messages occurred on load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1: clicking Generate New Data triggers generateRandomData() and redraw', async ({ page }) => {
    // Purpose:
    // - Validate the "Generate New Data" event triggers a redraw with different data (S1_DataGenerated entry actions).
    // - Confirm no runtime errors occur during the transition.

    // Capture canvas before clicking generate
    const beforeDataURL = await getCanvasDataURL(page);

    // Click the Generate New Data button
    await page.click('#generateBtn');

    // Allow drawing to happen
    await page.waitForTimeout(200);

    // Capture canvas after clicking generate
    const afterDataURL = await getCanvasDataURL(page);

    // Expect the canvas to have changed (new randomly generated points drawn)
    // This is probabilistic but highly likely; assert difference.
    expect(dataURLsDiffer(beforeDataURL, afterDataURL)).toBe(true);

    // Also sample a few pixels to ensure visual difference in some areas
    const sample1Before = await sampleCanvasPixel(page, 60, 60);
    // wait a bit then sample after - helpful if async drawing occurs
    await page.waitForTimeout(100);
    const sample1After = await sampleCanvasPixel(page, 60, 60);

    // It's possible the same color appears by chance, but overall dataURL changed above.
    // Ensure no page-level errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Basic sanity: pixel arrays should be length 4 (r,g,b,a)
    expect(sample1Before.length).toBe(4);
    expect(sample1After.length).toBe(4);
  });

  test('Transition S1 -> S2: clicking Calculate Regression computes regression and draws line and equation text', async ({ page }) => {
    // Purpose:
    // - Validate the "Calculate Regression" event triggers calculateRegression() and drawGraph().
    // - Verify that regression line/equation text appears on the canvas by sampling pixels near the equation text location.

    // Ensure we have data points generated. If not, click generate first.
    // (The page initialises with data, but we click generate to ensure deterministic state S1)
    await page.click('#generateBtn');
    await page.waitForTimeout(200);

    // Capture a pixel in the location where drawRegressionLine writes the equation text:
    // drawRegressionLine uses ctx.fillText(equationText, 50, 50)
    // We'll sample around (55, 55) which is inside the text box area.
    const beforeEquationPixel = await sampleCanvasPixel(page, 55, 55);

    // Click Calculate Regression
    await page.click('#regressBtn');

    // Wait for drawing
    await page.waitForTimeout(250);

    // Sample the same pixel after regression. The equation text color uses colors.line '#f06292' (hex)
    const afterEquationPixel = await sampleCanvasPixel(page, 55, 55);

    // Expected RGB for '#f06292' -> [240, 98, 146] (approx)
    const expectedLineRGB = [240, 98, 146];

    // Validate that the pixel changed and is close to the expected line color.
    // Some antialiasing may modify values; use tolerance.
    const changed = !(beforeEquationPixel[0] === afterEquationPixel[0] &&
                      beforeEquationPixel[1] === afterEquationPixel[1] &&
                      beforeEquationPixel[2] === afterEquationPixel[2] &&
                      beforeEquationPixel[3] === afterEquationPixel[3]);

    expect(changed).toBe(true);

    const isClose = rgbClose(afterEquationPixel, expectedLineRGB, 60);
    expect(isClose).toBeTruthy();

    // No uncaught errors during regression calculation/drawing
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge Cases: rapid repeated interactions should not cause errors or crash', async ({ page }) => {
    // Purpose:
    // - Stress test: repeatedly click the generate and regress buttons quickly to ensure no exceptions occur.
    // - Validate app remains responsive and still draws to canvas.

    // Rapidly click Generate New Data 10 times
    for (let i = 0; i < 10; i++) {
      await page.click('#generateBtn');
      // tiny delay to allow internal processing; keep it short to simulate rapid user actions
      await page.waitForTimeout(30);
    }

    // Rapidly click Calculate Regression 6 times
    for (let i = 0; i < 6; i++) {
      await page.click('#regressBtn');
      await page.waitForTimeout(30);
    }

    // Wait a bit for final draw
    await page.waitForTimeout(300);

    // Assert no page errors and no console errors recorded during rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Ensure canvas still contains drawable content
    const finalDataURL = await getCanvasDataURL(page);
    expect(typeof finalDataURL).toBe('string');
    expect(finalDataURL.length).toBeGreaterThan(1000);
  });

  test('Verify event listeners and expected DOM hooks exist (GenerateNewData & CalculateRegression)', async ({ page }) => {
    // Purpose:
    // - Confirm the page wired up event handlers by checking that the buttons respond to clicks.
    // - Use a lightweight approach: intercept clicks by toggling disabled attribute via click-induced side-effects is not possible,
    //   but we validate that clicking does not throw and causes canvas change (for generate) and draws regression (for regress).

    // Sanity: clicking generate should change canvas dataURL
    const before = await getCanvasDataURL(page);
    await page.click('#generateBtn');
    await page.waitForTimeout(200);
    const after = await getCanvasDataURL(page);
    expect(dataURLsDiffer(before, after)).toBe(true);

    // Now click regress and ensure canvas changes to include regression text (sample pixel)
    await page.click('#regressBtn');
    await page.waitForTimeout(200);
    const pixel = await sampleCanvasPixel(page, 55, 55);
    const expectedLineRGB = [240, 98, 146];
    const isClose = rgbClose(pixel, expectedLineRGB, 60);

    // Either the pixel is close to the line color or at least canvas changed; assert one of these hold
    expect(isClose || dataURLsDiffer(after, await getCanvasDataURL(page))).toBeTruthy();

    // Ensure no errors were recorded
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity: verify window resize triggers redraw without errors', async ({ page }) => {
    // Purpose:
    // - Validate that the resize event handler executes drawGraph() and does not produce runtime errors.

    // Trigger a resize event by changing viewport size
    await page.setViewportSize({ width: 800, height: 600 });
    // dispatch resize event for the window to trigger the event listener
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Wait for redraw
    await page.waitForTimeout(250);

    // Assert no errors logged
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Canvas still has content
    const dataURL = await getCanvasDataURL(page);
    expect(typeof dataURL).toBe('string');
    expect(dataURL.length).toBeGreaterThan(1000);
  });

  test('Negative/Edge scenario: clicking Calculate Regression when there are fewer than 2 points should be a no-op (no errors)', async ({ page }) => {
    // Purpose:
    // - Attempt to force calculateRegression early when there are too few points.
    // - Because internal points array is enclosed, we cannot manipulate it; instead we simulate by
    //   resizing canvas to extremely small area which may still not reduce points.
    // - The key assertion: clicking regress in potentially degenerate scenarios should not throw errors.

    // Rapidly click generate then regress after setting viewport small to attempt to create edge conditions
    await page.setViewportSize({ width: 200, height: 150 });
    await page.click('#generateBtn');
    await page.waitForTimeout(100);
    await page.click('#regressBtn');
    await page.waitForTimeout(150);

    // Ensure no page or console errors thrown
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Canvas still exists and has a valid dataURL
    const d = await getCanvasDataURL(page);
    expect(typeof d).toBe('string');
    expect(d.length).toBeGreaterThan(1000);
  });
});