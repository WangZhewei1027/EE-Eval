import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1764ece0-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the KNN demo page
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#canvas');
    this.addButton = page.locator('#addPoint');
    this.classifyButton = page.locator('#startKNN');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the "Add Blue Point" button
  async clickAddPoint() {
    await this.addButton.click();
  }

  // Click the "Classify Red Point" button
  async clickClassifyButton() {
    await this.classifyButton.click();
  }

  // Return number of blue points in the canvas DOM
  async countBluePointsInDOM() {
    return await this.page.locator('#canvas .point.blue').count();
  }

  // Return number of red points in the canvas DOM
  async countRedPointsInDOM() {
    return await this.page.locator('#canvas .point.red').count();
  }

  // Return the in-memory points array from the page
  async getPointsArray() {
    return await this.page.evaluate(() => {
      // Access the points array exposed by the page script
      return Array.from(points || []);
    });
  }

  // Return the text content of the result paragraph
  async getResultText() {
    return await this.result.textContent();
  }

  // Helper to call knn in page context for deterministic checks
  async knnClassify(newPoint, k = 3) {
    return await this.page.evaluate(({ newPoint, k }) => {
      return knn(newPoint, k);
    }, { newPoint, k });
  }

  // Helper to create a point in the page context deterministically
  async createPointInPage(x, y, color) {
    await this.page.evaluate(({ x, y, color }) => {
      createPoint(x, y, color);
    }, { x, y, color });
  }

  // Clear the points array in-place (do not redefine points)
  async clearPoints() {
    await this.page.evaluate(() => {
      if (Array.isArray(points)) {
        points.length = 0;
        // also clear DOM points
        const canvas = document.getElementById('canvas');
        canvas.querySelectorAll('.point').forEach(el => el.remove());
        // clear result text
        const r = document.getElementById('result');
        if (r) r.textContent = '';
      }
    });
  }
}

test.describe('K-Nearest Neighbors (KNN) Demo - FSM and UI tests', () => {
  // arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      // capture text and type for easier assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions (page errors)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Safety: log any collected console messages to test output for debugging
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', JSON.stringify(consoleMessages, null, 2));
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors);
    }
  });

  test('S0_Idle: Page loads and initial UI elements are present (Idle state)', async ({ page }) => {
    // This test validates initial (Idle) state elements exist and that "renderPage" (mentioned in FSM entry actions)
    // is not implemented in the page code. We intentionally call it to assert a ReferenceError occurs as part of evidence checks.
    const knn = new KNNPage(page);
    await knn.goto();

    // Verify main components per FSM: buttons, canvas, result paragraph
    await expect(page.locator('#addPoint')).toBeVisible();
    await expect(page.locator('#startKNN')).toBeVisible();
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#result')).toBeVisible();

    // Check that the page-level points array exists and is an array (page script defines const points = [])
    const pointsArr = await knn.getPointsArray();
    expect(Array.isArray(pointsArr)).toBe(true);
    expect(pointsArr.length).toBe(0);

    // The FSM mentions an entry action "renderPage()". The implementation does NOT define this function.
    // We assert that calling renderPage in the page context results in a ReferenceError (evidence of missing function).
    const renderPageError = await page.evaluate(() => {
      try {
        // Intentionally call the expected function that does not exist
        // eslint-disable-next-line no-undef
        renderPage();
        return { threw: false };
      } catch (err) {
        // Return the error name and message to assert below
        return { threw: true, name: err && err.name, message: err && err.message };
      }
    });

    expect(renderPageError.threw).toBe(true);
    // Expect a ReferenceError (function not defined)
    expect(renderPageError.name).toBe('ReferenceError');

    // Ensure there were no uncaught page errors on initial load besides our intentional check
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_PointAdded: Clicking "Add Blue Point" adds a blue point to canvas', async ({ page }) => {
    // This test validates the "AddBluePoint" event/transition.
    // It asserts that after the click a DOM element is added and the in-memory points array grows.
    const knn = new KNNPage(page);
    await knn.goto();

    // Ensure starting state: no points
    await knn.clearPoints();
    expect((await knn.getPointsArray()).length).toBe(0);
    expect(await knn.countBluePointsInDOM()).toBe(0);

    // Click the Add Blue Point button
    await knn.clickAddPoint();

    // After clicking, expect at least one blue point in DOM and points array length >= 1
    await expect(page.locator('#canvas .point.blue')).toHaveCount(1);

    const pointsAfter = await knn.getPointsArray();
    expect(pointsAfter.length).toBeGreaterThanOrEqual(1);
    // The last pushed point should be blue
    expect(pointsAfter[pointsAfter.length - 1].color).toBe('blue');

    // The DOM element should have inline styles with left/top in px
    const blueEl = page.locator('#canvas .point.blue').first();
    const styleLeft = await blueEl.evaluate(node => node.style.left);
    const styleTop = await blueEl.evaluate(node => node.style.top);
    expect(styleLeft).toMatch(/px$/);
    expect(styleTop).toMatch(/px$/);

    // Ensure no unexpected page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S2_PointClassified: Clicking "Classify Red Point" adds red point and displays classification', async ({ page }) => {
    // This test validates the "ClassifyRedPoint" event/transition.
    // It asserts that clicking the button adds a red point to the canvas and that the result paragraph is updated.
    const knn = new KNNPage(page);
    await knn.goto();

    // Clear any existing points to ensure a known starting condition
    await knn.clearPoints();
    expect((await knn.getPointsArray()).length).toBe(0);

    // Click Classify Red Point button
    await knn.clickClassifyButton();

    // Expect a red point in the DOM and points array length >= 1
    await expect(page.locator('#canvas .point.red')).toHaveCount(1);
    const pts = await knn.getPointsArray();
    expect(pts.length).toBeGreaterThanOrEqual(1);
    expect(pts[pts.length - 1].color).toBe('red');

    // Expect the result paragraph to be updated with the classification sentence
    const resultText = await knn.getResultText();
    expect(resultText).toBeTruthy();
    expect(resultText).toMatch(/^The red point is classified as: (blue|red)$/);

    // The FSM's S2 evidence expects that document.getElementById('result').textContent is set to that string
    // Confirm exactly that the DOM node contains the expected substring
    const domResult = await page.locator('#result').textContent();
    expect(domResult).toContain('The red point is classified as:');

    // Ensure no uncaught page errors happened during this transition
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: knn() with empty dataset returns "red" (default behavior)', async ({ page }) => {
    // This test examines error-prone or edge-case behavior of knn when there are fewer than k neighbors.
    const knn = new KNNPage(page);
    await knn.goto();

    // Clear all points
    await knn.clearPoints();
    const pointsBefore = await knn.getPointsArray();
    expect(pointsBefore.length).toBe(0);

    // Call knn directly for a synthetic new point; expect stable deterministic behavior (page implementation returns 'red' in tie/empty)
    const classification = await knn.knnClassify({ x: 50, y: 50, color: 'red' }, 3);
    expect(typeof classification).toBe('string');
    // Based on implementation, when no neighbors exist colorCounts remain zeros, blue > red is false, so function returns 'red'
    expect(classification).toBe('red');

    // Also assert knn does not throw runtime errors when dataset is empty
    expect(pageErrors.length).toBe(0);
  });

  test('Deterministic classification: knn returns "blue" when nearest neighbors are blue', async ({ page }) => {
    // This test builds a deterministic scenario by creating known points via the exposed createPoint function,
    // and then calling knn() directly to verify classification logic.
    const knn = new KNNPage(page);
    await knn.goto();

    // Reset page state
    await knn.clearPoints();

    // Create two blue points very near (10,10) and (12,12) and one red far away
    await knn.createPointInPage(10, 10, 'blue');
    await knn.createPointInPage(12, 12, 'blue');
    await knn.createPointInPage(200, 200, 'red');

    const pointsNow = await knn.getPointsArray();
    expect(pointsNow.length).toBe(3);

    // Classify a new point near the blue cluster; expect 'blue'
    const classification = await knn.knnClassify({ x: 11, y: 11, color: 'red' }, 3);
    expect(classification).toBe('blue');

    // Ensure no page errors occurred during deterministic operations
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: calling an undefined function (undefinedFunction) throws ReferenceError', async ({ page }) => {
    // This test intentionally invokes a non-existent function to assert that ReferenceError is thrown and is observable.
    const knn = new KNNPage(page);
    await knn.goto();

    const errResult = await page.evaluate(() => {
      try {
        // eslint-disable-next-line no-undef
        undefinedFunction();
        return { threw: false };
      } catch (err) {
        return { threw: true, name: err && err.name, message: err && err.message };
      }
    });

    expect(errResult.threw).toBe(true);
    // ReferenceError is expected because undefinedFunction is not defined in the page
    expect(errResult.name).toBe('ReferenceError');

    // There should not be additional uncaught page errors beyond our intentional invocation
    expect(pageErrors.length).toBe(0);
  });
});