import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52083581-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Page Object for the Hash Map Demo application
 * Encapsulates interactions and common assertions for the canvas-based demo.
 */
class HashMapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for test assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the canvas is present before proceeding
    await this.page.waitForSelector('#hash-map');
  }

  // Click the canvas element at center coordinates
  async clickCanvas() {
    const box = await this.page.locator('#hash-map').boundingBox();
    if (!box) {
      throw new Error('Canvas bounding box not available');
    }
    // Click roughly in the middle of the canvas
    await this.page.mouse.click(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
  }

  // Call addPoint in page context
  async callAddPoint(x, y) {
    return this.page.evaluate(([x, y]) => {
      // intentionally call the function defined by the page script
      if (typeof addPoint !== 'function') {
        return { success: false, error: 'addPoint is not a function' };
      }
      try {
        addPoint(x, y);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }, [x, y]);
  }

  // Call removePoint in page context
  async callRemovePoint(x, y) {
    return this.page.evaluate(([x, y]) => {
      if (typeof removePoint !== 'function') {
        return { success: false, error: 'removePoint is not a function' };
      }
      try {
        removePoint(x, y);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }, [x, y]);
  }

  // Get the current points array length
  async getPointsLength() {
    return this.page.evaluate(() => {
      if (!Array.isArray(points)) return -1;
      return points.length;
    });
  }

  // Get current hashMap size
  async getHashMapSize() {
    return this.page.evaluate(() => {
      if (!(hashMap instanceof Map)) return -1;
      return hashMap.size;
    });
  }

  // Get value stored in hashMap for a key like "x,y"
  async getHashMapValue(x, y) {
    return this.page.evaluate(([x, y]) => {
      if (!(hashMap instanceof Map)) return null;
      return hashMap.get(`${x},${y}`) ?? null;
    }, [x, y]);
  }

  // Read a pixel RGBA value from the canvas at given coordinates
  async getCanvasPixel(x, y) {
    return this.page.evaluate(([x, y]) => {
      const canvas = document.getElementById('hash-map');
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof ctx.getImageData !== 'function') return null;
      // clamp coordinates
      const cx = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)));
      const cy = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)));
      try {
        const data = ctx.getImageData(cx, cy, 1, 1).data;
        return Array.from(data); // [r,g,b,a]
      } catch (e) {
        return { error: String(e) };
      }
    }, [x, y]);
  }

  // Expose collected console messages and page errors
  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Hash Map Demo (FSM Validation)', () => {
  // Reusable page object
  let mapPage;

  // Before each test navigate to the app and collect console/page errors
  test.beforeEach(async ({ page }) => {
    mapPage = new HashMapPage(page);
    await mapPage.goto();
  });

  // After each test, attach any console output for debugging if something fails.
  test.afterEach(async () => {
    // nothing to explicitly teardown; Playwright will close page context
  });

  test('Initial state (S0_Idle): drawMap() called and canvas has initial drawing', async () => {
    // This validates the S0_Idle entry action drawMap() was executed during page load.
    // We check that the canvas contains painted pixels where mapData circles were drawn.
    // Because the demo draws arcs at small coordinates (0..2), probe a few likely pixels.
    // We expect at least one pixel to be non-transparent (alpha > 0).
    const probeCoords = [
      { x: 2, y: 2 },
      { x: 5, y: 5 },
      { x: 10, y: 10 }
    ];

    let nonTransparentFound = false;
    for (const coord of probeCoords) {
      const pixel = await mapPage.getCanvasPixel(coord.x, coord.y);
      // If the canvas API fails for any reason, record failure explicitly
      expect(pixel).not.toBeNull();
      if (Array.isArray(pixel) && pixel.length === 4) {
        const alpha = pixel[3];
        if (alpha > 0) nonTransparentFound = true;
      } else if (pixel && typeof pixel === 'object' && pixel.error) {
        // If getImageData threw due to security or other issues, include that info in assertion
        // but do not fail outright here; we still assert existence of canvas context earlier.
        // For robust behavior, ensure ctx exists
        const ctxExists = await mapPage.page.evaluate(() => {
          const c = document.getElementById('hash-map');
          return !!(c && c.getContext && c.getContext('2d'));
        });
        expect(ctxExists).toBeTruthy();
      }
    }

    // At least one non-transparent pixel should be present if drawMap painted something.
    expect(nonTransparentFound).toBeTruthy();
  });

  test('Initial data structures: points array empty and hashMap empty', async () => {
    // Validate that on load the data structures representing the FSM state are in Idle defaults
    const pointsLength = await mapPage.getPointsLength();
    const mapSize = await mapPage.getHashMapSize();

    expect(pointsLength).toBeGreaterThanOrEqual(0);
    expect(mapSize).toBeGreaterThanOrEqual(0);

    // Specifically expect no added points initially
    expect(pointsLength).toBe(0);
    expect(mapSize).toBe(0);
  });

  test('User event: clicking canvas does NOT add a point due to implementation using .point class (observed behavior)', async () => {
    // This test verifies behavior of the "PointClick" event as implemented.
    // The implementation checks for e.target.classList.contains('point') which will be false,
    // so clicking the canvas should not add a point. This validates the actual transition behavior.
    const beforePoints = await mapPage.getPointsLength();
    const beforeMapSize = await mapPage.getHashMapSize();

    await mapPage.clickCanvas();

    // Allow any async handlers to run
    await mapPage.page.waitForTimeout(100);

    const afterPoints = await mapPage.getPointsLength();
    const afterMapSize = await mapPage.getHashMapSize();

    // Assert nothing changed because the click handler requires a .point class on target
    expect(afterPoints).toBe(beforePoints);
    expect(afterMapSize).toBe(beforeMapSize);

    // No uncaught page errors should have been produced by the click
    const pageErrors = mapPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Also assert there were no console errors/warnings (info messages may be absent)
    const consoleMsgs = mapPage.getConsoleMessages();
    const errorMsgs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorMsgs.length).toBe(0);
  });

  test('Transition S0 -> S1 (Point Added) by invoking addPoint(): points and hashMap update', async () => {
    // Because the click handler in the implementation does not actually add points,
    // we simulate the intended transition by calling addPoint(x, y) directly to validate S1 behavior.
    // This still uses functions defined by the page script and does not patch anything.
    const keyX = 10, keyY = 20;

    // Call addPoint in page context
    const addResult = await mapPage.callAddPoint(keyX, keyY);
    expect(addResult.success).toBeTruthy();

    // Validate that the points array and hashMap were updated as per FSM evidence
    const pointsLength1 = await mapPage.getPointsLength();
    const mapSize1 = await mapPage.getHashMapSize();
    const value = await mapPage.getHashMapValue(keyX, keyY);

    expect(pointsLength).toBeGreaterThanOrEqual(1);
    expect(mapSize).toBeGreaterThanOrEqual(1);
    expect(value).toBe(`Point ${pointsLength}`); // expected label from implementation

    // Confirm that adding a point did not produce uncaught page errors
    const pageErrors1 = mapPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1 -> S2 (Point Removed) by invoking removePoint(): point removed from arrays and hashMap', async () => {
    // Ensure there's a point to remove
    const keyX1 = 42, keyY = 24;
    await mapPage.callAddPoint(keyX, keyY);
    const sizeAfterAdd = await mapPage.getHashMapSize();
    expect(sizeAfterAdd).toBeGreaterThanOrEqual(1);

    // Call removePoint and verify removal
    const removeResult = await mapPage.callRemovePoint(keyX, keyY);
    expect(removeResult.success).toBeTruthy();

    // Validate removal: points length decreased or key absent in hashMap
    const valueAfterRemoval = await mapPage.getHashMapValue(keyX, keyY);
    const mapSizeAfter = await mapPage.getHashMapSize();

    expect(valueAfterRemoval).toBeNull();
    // mapSizeAfter should be less than or equal to previous size
    expect(mapSizeAfter).toBeGreaterThanOrEqual(0);

    // No unexpected page errors
    const pageErrors2 = mapPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: removePoint on non-existent point should be a no-op and not throw', async () => {
    // Attempt to remove a point that does not exist and ensure no exceptions occur and data unchanged
    const beforePoints1 = await mapPage.getPointsLength();
    const beforeMapSize1 = await mapPage.getHashMapSize();

    const removal = await mapPage.callRemovePoint(9999, 9999);
    expect(removal.success).toBeTruthy();

    const afterPoints1 = await mapPage.getPointsLength();
    const afterMapSize1 = await mapPage.getHashMapSize();

    // No state change expected
    expect(afterPoints).toBe(beforePoints);
    expect(afterMapSize).toBe(beforeMapSize);

    // And no page errors were produced
    const pageErrors3 = mapPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: verify functions drawMap, addPoint, removePoint are defined on the page', async () => {
    const functionsExist = await mapPage.page.evaluate(() => {
      return {
        drawMap: typeof drawMap === 'function',
        addPoint: typeof addPoint === 'function',
        removePoint: typeof removePoint === 'function'
      };
    });
    expect(functionsExist.drawMap).toBeTruthy();
    expect(functionsExist.addPoint).toBeTruthy();
    expect(functionsExist.removePoint).toBeTruthy();
  });

  test('Collect and assert console / page error state (observational): no uncaught exceptions on load and interactions', async () => {
    // Click canvas and perform a safe function call, then assert no page errors were captured.
    await mapPage.clickCanvas();
    await mapPage.callAddPoint(1, 1);
    await mapPage.callRemovePoint(1, 1);

    // Ensure there were no uncaught page errors recorded during these operations
    const pageErrors4 = mapPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Report any console messages of type 'error' as a failing condition
    const consoleErrors = mapPage.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});