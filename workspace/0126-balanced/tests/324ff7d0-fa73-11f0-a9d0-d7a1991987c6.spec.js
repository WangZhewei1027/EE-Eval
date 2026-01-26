import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ff7d0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Linear Regression Demo page
class RegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.calculateButtonSelector = "button[onclick='performLinearRegression()']";
    this.canvasSelector = '#regressionCanvas';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main elements to be present
    await this.page.waitForSelector(this.calculateButtonSelector, { state: 'visible' });
    await this.page.waitForSelector(this.canvasSelector, { state: 'attached' });
  }

  async clickCalculate() {
    await this.page.click(this.calculateButtonSelector);
  }

  // Return RGBA array for a single canvas pixel
  async getCanvasPixel(x, y) {
    return await this.page.evaluate(
      ({ selector, x, y }) => {
        const canvas = document.querySelector(selector);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        return [imageData[0], imageData[1], imageData[2], imageData[3]];
      },
      { selector: this.canvasSelector, x, y }
    );
  }

  // Search a small square area around (x,y) for any non-transparent pixel and return its rgba and coords
  async findNonTransparentInArea(x, y, radius = 3) {
    return await this.page.evaluate(
      ({ selector, x, y, radius }) => {
        const canvas = document.querySelector(selector);
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const sx = Math.round(x + dx);
            const sy = Math.round(y + dy);
            if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
            const d = ctx.getImageData(sx, sy, 1, 1).data;
            if (d[3] !== 0) {
              return { r: d[0], g: d[1], b: d[2], a: d[3], x: sx, y: sy };
            }
          }
        }
        return null;
      },
      { selector: this.canvasSelector, x, y, radius }
    );
  }

  // Convenience: compute canvas coords for an (x,y) data point based on page's drawing logic
  // Uses same transformation as app: canvasX = x*80 + 40; canvasY = canvas.height - (y*40 + 40)
  async dataPointToCanvasCoords(pointX, pointY) {
    const canvasSize = await this.page.evaluate(selector => {
      const c = document.querySelector(selector);
      return { width: c.width, height: c.height };
    }, this.canvasSelector);
    const cx = Math.round(pointX * 80 + 40);
    const cy = Math.round(canvasSize.height - (pointY * 40 + 40));
    return { cx, cy };
  }

  // Retrieve the global dataPoints from the page
  async getDataPoints() {
    return await this.page.evaluate(() => {
      return window.dataPoints ? window.dataPoints : null;
    });
  }

  // Compute expected line y values using dataPoints and linear regression formula in test context
  async computeExpectedRegressionCoefficients() {
    return await this.page.evaluate(() => {
      // replicate same logic used by the page
      const dp = window.dataPoints;
      if (!dp) return null;
      const n = dp.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      dp.forEach(point => {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
      });
      const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const b = (sumY - m * sumX) / n;
      return { m, b };
    });
  }
}

// Group related tests
test.describe('Linear Regression Demo (FSM states & transitions)', () => {
  // Capture console and page errors for assertions
  let consoleErrors;
  let pageErrors;

  // Use Playwright's page fixture
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages and page errors
    page.on('console', msg => {
      // collect only console errors for diagnostics
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test initial Idle state (S0_Idle)
  test('S0_Idle: Page loads - button and canvas render, functions exist', async ({ page }) => {
    const app = new RegressionPage(page);
    // Navigate to the page
    await app.goto();

    // Validate components from FSM: button is present and has correct text
    const buttonText = await page.textContent(app.calculateButtonSelector);
    expect(buttonText).toBe('Calculate Linear Regression');

    // Canvas is present and has expected dimensions from FSM
    const canvasSize = await page.evaluate(selector => {
      const c = document.querySelector(selector);
      return { width: c.width, height: c.height };
    }, app.canvasSelector);
    expect(canvasSize.width).toBe(600);
    expect(canvasSize.height).toBe(400);

    // Confirm the functions referenced in FSM exist on the global window
    const hasPerform = await page.evaluate(() => typeof window.performLinearRegression === 'function');
    const hasDraw = await page.evaluate(() => typeof window.drawChart === 'function');
    expect(hasPerform).toBe(true);
    expect(hasDraw).toBe(true);

    // Sample a pixel where no drawing is expected before any action.
    // Choose a point inside where a data point will be drawn later (point 1,2 => canvas coords 120,280)
    const { cx, cy } = await app.dataPointToCanvasCoords(1, 2);
    const beforePixel = await app.getCanvasPixel(cx, cy);
    // Before drawing, pixel might be transparent (alpha 0) or background. We assert it's not already a fully opaque blue/red.
    // This verifies we are in the Idle state (no regression drawn yet).
    const [r, g, b, a] = beforePixel;
    const isAlreadyBlue = r === 0 && g === 0 && b === 255 && a !== 0;
    const isAlreadyRed = r === 255 && g === 0 && b === 0 && a !== 0;
    expect(isAlreadyBlue || isAlreadyRed).toBe(false);

    // Ensure no runtime page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition: clicking the button triggers regression calculation and drawing (S0 -> S1)
  test('CalculateLinearRegression event transitions to S1_RegressionCalculated and draws chart', async ({ page }) => {
    const app = new RegressionPage(page);
    await app.goto();

    // Pre-capture pixel at one of the data point locations
    const dataPoints = await app.getDataPoints();
    expect(Array.isArray(dataPoints)).toBe(true);
    // Pick first point for verification
    const first = dataPoints[0];
    const coords = await app.dataPointToCanvasCoords(first.x, first.y);

    const before = await app.findNonTransparentInArea(coords.cx, coords.cy, 3);
    // There should be no non-transparent pixel at the target before drawing (Idle)
    expect(before).toBeNull();

    // Trigger the FSM event by clicking the button
    await app.clickCalculate();

    // Give the page some time to draw on the canvas (drawing is synchronous here but give a tick in case of repaint)
    await page.waitForTimeout(100);

    // After clicking, verify that at or near the expected data point location a non-transparent pixel exists (blue point)
    const foundBlue = await app.findNonTransparentInArea(coords.cx, coords.cy, 4);
    expect(foundBlue).not.toBeNull();
    // Expect blue-ish color (blue data points set with ctx.fillStyle = 'blue' => rgb(0,0,255) usually)
    expect(foundBlue.r).toBeGreaterThanOrEqual(0);
    expect(foundBlue.b).toBeGreaterThanOrEqual(100); // blue channel should be dominant
    // Also ensure alpha is not zero
    expect(foundBlue.a).toBeGreaterThan(0);

    // Verify regression line (red) appears roughly along expected x positions: sample two x locations for line presence
    const { m, b } = await app.computeExpectedRegressionCoefficients();
    expect(typeof m).toBe('number');
    expect(typeof b).toBe('number');

    // Evaluate two points on the regression line in data-space and map to canvas-space to look for red pixels
    const sampleXData = [0, 7]; // matches drawing code using x0=0 and x1=7
    let redFound = false;
    for (const sx of sampleXData) {
      const sy = m * sx + b;
      const { cx, cy } = await app.dataPointToCanvasCoords(sx, sy);
      const found = await app.findNonTransparentInArea(cx, cy, 4);
      if (found) {
        // red line should create red-ish pixels (r channel high)
        if (found.r >= 150 && found.g <= 100 && found.b <= 100) {
          redFound = true;
          break;
        }
      }
    }
    expect(redFound).toBe(true);

    // Ensure that clicking produced no new page errors or console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: clicking the button multiple times should not throw and should redraw deterministically
  test('Multiple clicks do not produce runtime errors and canvas updates are consistent', async ({ page }) => {
    const app = new RegressionPage(page);
    await app.goto();

    // Click multiple times in quick succession
    await app.clickCalculate();
    await page.waitForTimeout(50);
    await app.clickCalculate();
    await page.waitForTimeout(50);
    await app.clickCalculate();

    // Allow time for last draw to complete
    await page.waitForTimeout(150);

    // Check that there were no page errors emitted during rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Verify that the canvas still contains expected visuals: at least one of the data points should be visible and at least one red line pixel visible
    const dataPoints = await app.getDataPoints();
    expect(dataPoints.length).toBeGreaterThan(0);

    // Check any data point for presence
    let anyPointVisible = false;
    for (const p of dataPoints) {
      const { cx, cy } = await app.dataPointToCanvasCoords(p.x, p.y);
      const found = await app.findNonTransparentInArea(cx, cy, 4);
      if (found && found.b >= 100) { // blue-ish detection
        anyPointVisible = true;
        break;
      }
    }
    expect(anyPointVisible).toBe(true);

    // Check for red line presence somewhere on canvas: scan a few sample x data coords
    const { m, b } = await app.computeExpectedRegressionCoefficients();
    const sampleX = [0, 2, 4, 6, 7];
    let redDetected = false;
    for (const sx of sampleX) {
      const sy = m * sx + b;
      const { cx, cy } = await app.dataPointToCanvasCoords(sx, sy);
      const found = await app.findNonTransparentInArea(cx, cy, 4);
      if (found && found.r >= 150 && found.g <= 100 && found.b <= 100) {
        redDetected = true;
        break;
      }
    }
    expect(redDetected).toBe(true);
  });

  // Additional validation: verify that the onEnter concrete actions implied by FSM executed
  test('FSM onEnter/onExit actions: renderPage (entry) and drawChart triggered on transition', async ({ page }) => {
    const app = new RegressionPage(page);

    // Navigate to page
    await app.goto();

    // The FSM S0 entry action mentions renderPage(), but the provided HTML/JS doesn't expose a renderPage function.
    // We must NOT modify or patch the environment. Instead, assert presence/absence as observed.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    // The HTML does not define renderPage; we assert that it is not defined (document as-is).
    expect(hasRenderPage).toBe(false);

    // However, drawChart should exist (per evidence) and must be called when transition happens.
    const hasDrawChart = await page.evaluate(() => typeof window.drawChart === 'function');
    expect(hasDrawChart).toBe(true);

    // Spy on drawChart invocation by monkey-patching is forbidden by instructions.
    // Therefore, infer drawChart was executed by observing canvas changes after clicking the calculate button.
    const firstPoint = (await app.getDataPoints())[0];
    const { cx, cy } = await app.dataPointToCanvasCoords(firstPoint.x, firstPoint.y);
    const before = await app.findNonTransparentInArea(cx, cy, 3);
    expect(before).toBeNull();

    // Trigger the transition
    await app.clickCalculate();
    await page.waitForTimeout(100);

    // After transition, drawing should have occurred (drawChart entry action)
    const after = await app.findNonTransparentInArea(cx, cy, 4);
    expect(after).not.toBeNull();

    // Ensure no runtime exceptions were thrown during this process
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});