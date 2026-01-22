import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b4afc0-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the KNN demo page to encapsulate interactions and queries
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#plot');
    this.generateBtn = page.locator('#generateBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.kInput = page.locator('#k');
    this.numPointsInput = page.locator('#numPoints');
    this.infoDiv = page.locator('#info');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a little for the initial generateAndDraw to complete and render
    await this.page.waitForTimeout(100);
  }

  async getInfoText() {
    return (await this.infoDiv.textContent())?.trim() ?? '';
  }

  async getInfoHTML() {
    return await this.page.$eval('#info', el => el.innerHTML);
  }

  async clickGenerate() {
    await this.generateBtn.click();
    // allow the drawing & info update to complete
    await this.page.waitForTimeout(100);
  }

  async clickClear() {
    await this.clearBtn.click();
    await this.page.waitForTimeout(100);
  }

  // Click on canvas at specified coordinates (relative to canvas top-left)
  async clickCanvasAt(x, y) {
    await this.canvas.click({ position: { x, y } });
    await this.page.waitForTimeout(100);
  }

  // Get the canvas content as a data URL for visual-change comparisons
  async getCanvasDataURL() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('plot');
      try {
        return c.toDataURL();
      } catch (e) {
        return null;
      }
    });
  }

  // Change k input value and dispatch a change event (Playwright fill + blur triggers change)
  async changeK(value) {
    await this.kInput.fill(String(value));
    // blur to trigger change
    await this.kInput.evaluate((el) => el.dispatchEvent(new Event('change')));
    await this.page.waitForTimeout(100);
  }
}

test.describe('K-Nearest Neighbors (KNN) Demo - FSM validation', () => {
  let pageErrors;
  let consoleErrors;
  let knn;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console errors to assert later that nothing unexpected occurred
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    knn = new KNNPage(page);
    await knn.goto();
  });

  test.afterEach(async () => {
    // Assert that no runtime page errors or console.error messages were emitted during the test.
    // This ensures the page ran cleanly in the browser environment.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(m => m.text()).join('\n')}`).toBe(0);
  });

  test('Initial state (S0_Idle): generateAndDraw() called on load and initial info displayed', async () => {
    // This test validates the S0_Idle entry action generateAndDraw() executed on load.
    // We expect the info area to contain the initial prompt and the canvas to have rendered content.

    const infoText = await knn.getInfoText();
    // Based on implementation displayInfo(null, null) sets this exact prompt
    expect(infoText).toContain('Click inside the plot area to classify a new point.');

    // Canvas should have some drawn content; toDataURL should return a non-empty string
    const dataURL = await knn.getCanvasDataURL();
    expect(typeof dataURL).toBe('string');
    expect(dataURL.length).toBeGreaterThan(100); // arbitrary minimal size to ensure drawing exists
  });

  test('Transition GenerateNewDataset (S0_Idle -> S1_TestPointSet): clicking generate updates plot and info', async () => {
    // Validate that clicking the Generate New Dataset button redraws the plot (plot dataURL changes)
    // and the info remains in the "no test point" state.

    const beforeDataURL = await knn.getCanvasDataURL();
    expect(beforeDataURL).toBeTruthy();

    // Click generate to trigger generateAndDraw()
    await knn.clickGenerate();

    const afterDataURL = await knn.getCanvasDataURL();
    expect(afterDataURL).toBeTruthy();

    // It's extremely unlikely the two images are identical given random clustering; assert they differ
    expect(afterDataURL).not.toBe(beforeDataURL);

    const infoText = await knn.getInfoText();
    expect(infoText).toContain('Click inside the plot area to classify a new point.');
  });

  test('Transition CanvasClick (S1_TestPointSet -> S1_TestPointSet): clicking inside plot classifies a new point and updates info', async () => {
    // Click at the canvas center which is inside the plotting area.
    // Validate that a test point is created, drawPlot adds it visually and displayInfo shows classification details.

    // Coordinates: canvas is 500x500 with padding 40: center (250,250) is safely inside plotting area
    const beforeDataURL = await knn.getCanvasDataURL();

    await knn.clickCanvasAt(250, 250);

    const infoHTML = await knn.getInfoHTML();
    // After classification, info should include Test Point and Predicted Class and Nearest Neighbors table
    expect(infoHTML).toMatch(/Test Point:/);
    expect(infoHTML).toMatch(/Predicted Class:/);
    expect(infoHTML).toMatch(/Nearest Neighbors/i);
    expect(infoHTML).toMatch(/<table/);

    const afterDataURL = await knn.getCanvasDataURL();
    expect(afterDataURL).toBeTruthy();
    // Canvas should have changed to include the test point overlay; assert changed
    expect(afterDataURL).not.toBe(beforeDataURL);
  });

  test('Transition KInputChange (S1_TestPointSet -> S1_TestPointSet): changing k re-classifies existing test point', async () => {
    // First create a test point by clicking inside the plot
    await knn.clickCanvasAt(260, 260);

    // Ensure info currently shows a k value (default 3)
    let infoHTML = await knn.getInfoHTML();
    expect(infoHTML).toMatch(/<strong>k:<\/strong>\s*3/);

    // Change k to a new value and dispatch change - the app should re-classify and update info
    await knn.changeK(7);

    infoHTML = await knn.getInfoHTML();
    // Info should now display the updated k value
    expect(infoHTML).toMatch(/<strong>k:<\/strong>\s*7/);

    // It should still show Predicted Class and Nearest Neighbors after reclassification
    expect(infoHTML).toMatch(/Predicted Class:/);
    expect(infoHTML).toMatch(/Nearest Neighbors/i);
  });

  test('Transition ClearTestPoint (S1_TestPointSet -> S0_Idle): clear button removes test point and resets info', async () => {
    // Create a test point first
    await knn.clickCanvasAt(240, 260);

    // Ensure info shows classification details
    let infoText = await knn.getInfoText();
    expect(infoText).toContain('Predicted Class');

    // Click clear to remove testPoint
    const beforeClearDataURL = await knn.getCanvasDataURL();
    await knn.clickClear();

    // After clearing, info should return to initial prompt
    infoText = await knn.getInfoText();
    expect(infoText).toContain('Click inside the plot area to classify a new point.');

    // Canvas should have been redrawn (test point removed) - image may differ
    const afterClearDataURL = await knn.getCanvasDataURL();
    expect(afterClearDataURL).toBeTruthy();
    // It's possible but unlikely that the data URLs are identical; we accept either, but ensure no errors occurred.
    // To be more deterministic we at least ensure toDataURL returned successfully.
    expect(afterClearDataURL.length).toBeGreaterThan(100);
  });

  test('Edge case: clicking outside the plotting area does not classify and does not change info', async () => {
    // Record info before clicking outside plotting area
    const beforeInfo = await knn.getInfoHTML();

    // Click near top-left corner of canvas (10,10) which lies in the canvas border area outside padding
    await knn.clickCanvasAt(10, 10);

    // Info should remain unchanged since click is outside plotting area and should be ignored
    const afterInfo = await knn.getInfoHTML();
    expect(afterInfo).toBe(beforeInfo);
  });

  test('Edge case: changing k when no test point present should not throw and info remains initial prompt', async () => {
    // Ensure no test point by clicking clear first
    await knn.clickClear();

    const beforeInfo = await knn.getInfoText();

    // Change k value - when there is no test point the change handler should do nothing (no errors)
    await knn.changeK(5);

    const afterInfo = await knn.getInfoText();
    // Info should still be the initial prompt
    expect(afterInfo).toBe(beforeInfo);
  });

  test('Sanity: the legend and control elements are present and accessible', async () => {
    // Verify presence and basic accessibility of interactive controls
    const generateVisible = await knn.generateBtn.isVisible();
    const clearVisible = await knn.clearBtn.isVisible();
    const kValue = await knn.kInput.inputValue();
    const numPointsValue = await knn.numPointsInput.inputValue();

    expect(generateVisible).toBe(true);
    expect(clearVisible).toBe(true);
    expect(Number(kValue)).toBeGreaterThanOrEqual(1);
    expect(Number(numPointsValue)).toBeGreaterThanOrEqual(5);
  });
});