import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3cd1f1-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the K-Means demo page
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#canvas');
    this.button = page.locator('#kmeansButton');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the canvas at coordinates relative to the canvas's top-left
  async clickCanvasAt(x, y) {
    // Use bounding box to translate to viewport coordinates and click
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    const clickX = box.x + x;
    const clickY = box.y + y;
    await this.page.mouse.click(clickX, clickY);
  }

  async clickKMeansButton() {
    await this.button.click();
  }

  // Return the window.points array (cloned) from the page context
  async getPoints() {
    return await this.page.evaluate(() => {
      // Clone minimal properties to avoid circular references
      if (!window.points) return null;
      return window.points.map(p => ({ x: p.x, y: p.y, cluster: p.cluster }));
    });
  }

  async getPointsCount() {
    return await this.page.evaluate(() => (window.points ? window.points.length : 0));
  }

  // Return RGBA at integer canvas coordinates
  async getCanvasPixelRGBA(x, y) {
    return await this.page.evaluate(({ x, y }) => {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      // clamp coordinates within canvas
      const cx = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)));
      const data = ctx.getImageData(cx, cy, 1, 1).data;
      return [data[0], data[1], data[2], data[3]];
    }, { x, y });
  }
}

// Utility to compare color approximately (allow small tolerance)
function colorApproximatelyEqual(actualRGBA, expectedRGB, tolerance = 30) {
  if (!actualRGBA) return false;
  const [r, g, b] = actualRGBA;
  const [er, eg, eb] = expectedRGB;
  return Math.abs(r - er) <= tolerance && Math.abs(g - eg) <= tolerance && Math.abs(b - eb) <= tolerance;
}

test.describe('K-Means Clustering Visualization - FSM and UI tests', () => {
  let page;
  let pagenet;
  let kmeansPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context & page for each test to avoid state carryover
    const context = await browser.newContext();
    page = await context.newPage();
    kmeansPage = new KMeansPage(page);

    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to application
    await kmeansPage.goto();
  });

  test.afterEach(async () => {
    // Close page and context
    if (page) await page.close();
  });

  test('S0_Idle: Page loads with canvas and Run K-Means button present', async () => {
    // Validate presence of canvas and button - evidence of idle state
    await expect(kmeansPage.canvas).toBeVisible();
    await expect(kmeansPage.button).toBeVisible();

    // Verify canvas attributes match FSM evidence
    const width = await kmeansPage.page.evaluate(() => document.getElementById('canvas').width);
    const height = await kmeansPage.page.evaluate(() => document.getElementById('canvas').height);
    expect(width).toBe(800);
    expect(height).toBe(600);

    // Points should be empty initially (Idle state)
    const count = await kmeansPage.getPointsCount();
    expect(count).toBe(0);

    // Ensure no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Console may contain logs from third-party sources; assert there are no error-level console messages
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('S0 -> S1: Clicking canvas adds a point and draws it (PointsAdded)', async () => {
    // Comments: This test validates the transition from Idle to PointsAdded.
    // It clicks on the canvas (FSM event CanvasClick), asserts that a point is pushed
    // into the window.points array and that drawPoints() visually rendered the point.

    // Click at multiple distinct coordinates to add points
    const coords = [
      { x: 100, y: 120 },
      { x: 200, y: 150 },
      { x: 300, y: 200 }
    ];

    for (const c of coords) {
      await kmeansPage.clickCanvasAt(c.x, c.y);
      // Small wait to ensure drawing completed
      await kmeansPage.page.waitForTimeout(50);
    }

    // Validate points array length equals clicks
    const points = await kmeansPage.getPoints();
    expect(points).toHaveLength(coords.length);

    // Validate each stored point is near the clicked coordinate
    for (let i = 0; i < coords.length; i++) {
      const p = points[i];
      const expected = coords[i];
      // allow small float differences due to event/client rounding
      expect(Math.abs(p.x - expected.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(p.y - expected.y)).toBeLessThanOrEqual(2);

      // Verify visual evidence: check canvas pixel at the point coordinate is dark (black)
      const pixel = await kmeansPage.getCanvasPixelRGBA(Math.round(p.x), Math.round(p.y));
      // drawPoints uses ctx.fillStyle = 'black' for points => rgb roughly (0,0,0)
      const blackCheck = colorApproximatelyEqual(pixel, [0, 0, 0], 60);
      expect(blackCheck).toBeTruthy();
    }

    // No page errors or console.error during normal clicks
    expect(pageErrors.length).toBe(0);
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();
  });

  test('S1 -> S2: Clicking Run K-Means assigns clusters and draws clusters + centroids', async () => {
    // Comments: This test validates the KMeansButtonClick event and transition from PointsAdded to KMeansRunning.
    // It adds multiple points, runs kMeans, and verifies that each point received a cluster number
    // and that clusters were drawn (colors) and centroids (red) were drawn on the canvas.

    // Add a reasonable number of points in three spatial groups to encourage distinct clusters
    const group1 = [{ x: 80, y: 80 }, { x: 90, y: 95 }, { x: 110, y: 85 }];
    const group2 = [{ x: 400, y: 120 }, { x: 420, y: 150 }, { x: 380, y: 140 }];
    const group3 = [{ x: 200, y: 400 }, { x: 220, y: 420 }, { x: 180, y: 410 }];

    const all = [...group1, ...group2, ...group3];
    for (const c of all) {
      await kmeansPage.clickCanvasAt(c.x, c.y);
      await kmeansPage.page.waitForTimeout(30);
    }

    // Sanity: points added
    const beforeCount = await kmeansPage.getPointsCount();
    expect(beforeCount).toBe(all.length);

    // Click Run K-Means (event)
    await kmeansPage.clickKMeansButton();
    // Allow some time for algorithm and drawing to be performed
    await kmeansPage.page.waitForTimeout(300);

    // Retrieve points and ensure clusters assigned
    const points = await kmeansPage.getPoints();
    expect(points.length).toBe(all.length);

    // Every point should have a cluster property 0..2
    const clusterSet = new Set();
    for (const p of points) {
      expect(typeof p.cluster).toBe('number');
      expect(p.cluster).toBeGreaterThanOrEqual(0);
      expect(p.cluster).toBeLessThanOrEqual(2);
      clusterSet.add(p.cluster);
    }

    // Expect at least two clusters were used (likely all three, but accept at least 2)
    expect(clusterSet.size).toBeGreaterThanOrEqual(2);

    // Compute centroids from returned points to approximate where centroids should be drawn
    const k = 3;
    const centroids = Array.from({ length: k }, () => ({ x: 0, y: 0, count: 0 }));
    points.forEach(p => {
      centroids[p.cluster].x += p.x;
      centroids[p.cluster].y += p.y;
      centroids[p.cluster].count++;
    });
    const computedCentroids = centroids.map(c => {
      if (c.count > 0) return { x: c.x / c.count, y: c.y / c.count };
      // if a cluster got no points, centroid may have been randomized by app code; skip such clusters
      return null;
    }).filter(Boolean);

    // Verify that centroids (computed) correspond to visible red pixels on canvas
    // drawCentroids uses fillStyle = 'red' => rgb approx (255,0,0)
    for (const cent of computedCentroids) {
      const pixel = await kmeansPage.getCanvasPixelRGBA(Math.round(cent.x), Math.round(cent.y));
      const redCheck = colorApproximatelyEqual(pixel, [255, 0, 0], 100); // allow tolerance
      // If exact centroid pixel isn't red due to anti-aliasing, sample neighboring pixels too
      if (!redCheck) {
        // sample a small neighborhood
        let foundRed = false;
        for (let dx = -3; dx <= 3 && !foundRed; dx++) {
          for (let dy = -3; dy <= 3 && !foundRed; dy++) {
            const p = await kmeansPage.getCanvasPixelRGBA(Math.round(cent.x + dx), Math.round(cent.y + dy));
            if (colorApproximatelyEqual(p, [255, 0, 0], 100)) {
              foundRed = true;
            }
          }
        }
        expect(foundRed).toBeTruthy();
      } else {
        expect(redCheck).toBeTruthy();
      }
    }

    // Verify that points were re-drawn in cluster colors (blue, green, orange)
    // We will check a sample of points and ensure their pixel color matches one of the cluster colors.
    const clusterColors = {
      0: [0, 0, 255], // blue
      1: [0, 128, 0], // green (browser may interpret 'green' as rgb(0,128,0))
      2: [255, 165, 0] // orange (approx rgb(255,165,0))
    };

    // Sample up to 6 points across clusters
    const samplePoints = points.slice(0, Math.min(points.length, 6));
    for (const p of samplePoints) {
      const pixel = await kmeansPage.getCanvasPixelRGBA(Math.round(p.x), Math.round(p.y));
      // Accept if matches the assigned cluster color (with tolerance)
      const expectedRGB = clusterColors[p.cluster];
      const match = colorApproximatelyEqual(pixel, expectedRGB, 120); // large tolerance because color names map differently and anti-aliasing
      expect(match).toBeTruthy();
    }

    // Ensure no uncaught errors during K-Means run
    expect(pageErrors.length).toBe(0);
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();
  });

  test('Edge case: Clicking Run K-Means with no points should be a no-op and not throw', async () => {
    // Comments: Validate that invoking kMeans with zero points does not cause errors and does nothing.
    // Reset page is already fresh; ensure no points exist
    const count = await kmeansPage.getPointsCount();
    expect(count).toBe(0);

    // Click the button; should not throw and not create points
    await kmeansPage.clickKMeansButton();
    await kmeansPage.page.waitForTimeout(100);

    // Points still zero
    const afterCount = await kmeansPage.getPointsCount();
    expect(afterCount).toBe(0);

    // No page errors should have occurred
    expect(pageErrors.length).toBe(0);
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();
  });

  test('Robustness: Multiple rapid clicks add multiple points and remain stable', async () => {
    // Comments: Simulate rapid user interactions (many canvas clicks) to ensure stability.
    const clicks = 20;
    for (let i = 0; i < clicks; i++) {
      const x = 50 + (i * 10) % 700;
      const y = 50 + (i * 7) % 500;
      await kmeansPage.clickCanvasAt(x, y);
      // Very small delay to emulate fast user
      await kmeansPage.page.waitForTimeout(10);
    }

    const count = await kmeansPage.getPointsCount();
    expect(count).toBe(clicks);

    // Run kMeans to ensure algorithm handles many points without errors
    await kmeansPage.clickKMeansButton();
    await kmeansPage.page.waitForTimeout(300);

    // After run, ensure each point has cluster property
    const points = await kmeansPage.getPoints();
    for (const p of points) {
      expect(typeof p.cluster).toBe('number');
    }

    // No page errors
    expect(pageErrors.length).toBe(0);
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();
  });

  test('Observability: Capture console and page errors (if any) during user flows', async () => {
    // Comments: This test intentionally only reports the captured console messages and page errors.
    // It asserts that normal interactions do not produce runtime exceptions, but will surface any if they do.

    // Perform a simple flow
    await kmeansPage.clickCanvasAt(120, 130);
    await kmeansPage.clickCanvasAt(220, 230);
    await kmeansPage.clickKMeansButton();
    await kmeansPage.page.waitForTimeout(200);

    // Assert we captured console messages array (it may be empty)
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // If any page errors were captured, fail the test and include the first error in the message for debugging
    if (pageErrors.length > 0) {
      // Provide diagnostic info in assertion failure
      throw new Error('Page errors were detected: ' + pageErrors[0].toString());
    }

    // Also assert that no console.error level messages were produced
    const consoleErr = consoleMessages.find(m => m.type === 'error');
    if (consoleErr) {
      throw new Error('console.error messages were detected: ' + consoleErr.text);
    }
  });
});