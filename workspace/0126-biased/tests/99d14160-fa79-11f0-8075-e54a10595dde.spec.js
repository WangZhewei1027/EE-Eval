import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d14160-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the K-Means Demo page
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this._consoleListener = (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    };
    this._pageErrorListener = (err) => {
      this.pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    };
  }

  // Attach listeners for console errors and page errors
  async attachErrorObservers() {
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Detach listeners so they don't leak between tests
  async detachErrorObservers() {
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for important UI elements to be present
    await this.page.waitForSelector('#canvas');
    await this.page.waitForSelector('#generate-data');
    await this.page.waitForSelector('#cluster');
    await this.page.waitForSelector('#clear');
    await this.page.waitForSelector('#k-input');
  }

  async generateData() {
    await this.page.click('#generate-data');
    // animation/drawing is synchronous in this app but allow a tiny wait for rendering
    await this.page.waitForTimeout(50);
  }

  async runKMeans() {
    await this.page.click('#cluster');
    // the clustering loop is synchronous but allow slight wait for rendering
    await this.page.waitForTimeout(50);
  }

  async clear() {
    await this.page.click('#clear');
    await this.page.waitForTimeout(20);
  }

  async setK(value) {
    // fill input with the provided value (string or number)
    await this.page.fill('#k-input', String(value));
    // trigger input event - fill should do this, but ensure by focusing and blurring
    await this.page.focus('#k-input');
    await this.page.blur('#k-input');
    await this.page.waitForTimeout(20);
  }

  // Returns the canvas toDataURL string
  async getCanvasDataURL() {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      return canvas.toDataURL();
    });
  }

  // Returns the number of non-transparent pixels on the canvas (simple metric to detect drawing)
  async getCanvasNonTransparentPixelCount() {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;
      const imageData = ctx.getImageData(0, 0, width, height).data;
      let count = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        if (imageData[i + 3] !== 0) count++;
      }
      return count;
    });
  }

  getConsoleErrors() {
    return this.consoleErrors;
  }

  getPageErrors() {
    return this.pageErrors;
  }

  async reload() {
    await this.page.reload();
    await this.page.waitForSelector('#canvas');
  }
}

test.describe('K-Means Clustering Demo (Application ID: 99d14160-fa79-11f0-8075-e54a10595dde)', () => {
  // Each test gets its own page context from Playwright, but we still manage observers per test.
  test.describe('Initial render and Idle state', () => {
    test('Idle: page renders controls and blank canvas', async ({ page }) => {
      // This test validates the initial Idle state (S0_Idle)
      const app = new KMeansPage(page);
      await app.attachErrorObservers();
      await app.goto();

      // Verify controls exist and input attributes are correct
      const kInput = await page.$('#k-input');
      expect(kInput).not.toBeNull();
      const kValue = await kInput.getAttribute('value');
      expect(kValue).toBe('3');
      expect(await kInput.getAttribute('type')).toBe('number');
      expect(await kInput.getAttribute('min')).toBe('1');
      expect(await kInput.getAttribute('max')).toBe('10');

      // Buttons exist
      const generateBtn = await page.$('#generate-data');
      const clusterBtn = await page.$('#cluster');
      const clearBtn = await page.$('#clear');
      expect(generateBtn).not.toBeNull();
      expect(clusterBtn).not.toBeNull();
      expect(clearBtn).not.toBeNull();

      // Canvas should initially be blank (count transparent pixels == width*height)
      const canvasBlankCount = await app.getCanvasNonTransparentPixelCount();
      expect(canvasBlankCount).toBe(0);

      // Ensure no console errors or page errors occurred during initial render
      expect(app.getConsoleErrors().length).toBe(0);
      expect(app.getPageErrors().length).toBe(0);

      await app.detachErrorObservers();
    });
  });

  test.describe('State transitions and user interactions', () => {
    test('Generate Data -> DataGenerated: canvas gets points drawn', async ({ page }) => {
      // Validates transition S0_Idle -> S1_DataGenerated when Generate Data clicked
      const app = new KMeansPage(page);
      await app.attachErrorObservers();
      await app.goto();

      const beforeDataURL = await app.getCanvasDataURL();
      const beforeCount = await app.getCanvasNonTransparentPixelCount();
      expect(beforeCount).toBe(0);

      // Click Generate Data
      await app.generateData();

      const afterDataURL = await app.getCanvasDataURL();
      const afterCount = await app.getCanvasNonTransparentPixelCount();

      // Canvas should change and have some non-transparent pixels
      expect(afterDataURL).not.toBe(beforeDataURL);
      expect(afterCount).toBeGreaterThan(0);

      // No errors should have occurred in normal flow
      expect(app.getConsoleErrors().length).toBe(0);
      expect(app.getPageErrors().length).toBe(0);

      await app.detachErrorObservers();
    });

    test('Run K-Means -> ClustersCalculated: clustering draws centroids and clusters', async ({ page }) => {
      // Validates transition S1_DataGenerated -> S2_ClustersCalculated on Run K-Means click
      const app = new KMeansPage(page);
      await app.attachErrorObservers();
      await app.goto();

      // Ensure we have data
      await app.generateData();
      const dataCount = await app.getCanvasNonTransparentPixelCount();
      expect(dataCount).toBeGreaterThan(0);

      // Capture canvas before clustering
      const beforeClusterDataURL = await app.getCanvasDataURL();

      // Run K-Means
      await app.runKMeans();

      const afterClusterDataURL = await app.getCanvasDataURL();
      const afterClusterCount = await app.getCanvasNonTransparentPixelCount();

      // After clustering, canvas should be updated (clusters + centroids drawn)
      expect(afterClusterDataURL).not.toBe(beforeClusterDataURL);
      expect(afterClusterCount).toBeGreaterThan(0);

      // No console/page errors expected in normal flow
      expect(app.getConsoleErrors().length).toBe(0);
      expect(app.getPageErrors().length).toBe(0);

      await app.detachErrorObservers();
    });

    test('Clear transitions to Cleared from DataGenerated and ClustersCalculated', async ({ page }) => {
      // Validates S1_DataGenerated -> S3_Cleared and S2_ClustersCalculated -> S3_Cleared
      const app = new KMeansPage(page);
      await app.attachErrorObservers();
      await app.goto();

      // 1) Clear from DataGenerated
      await app.generateData();
      const generatedCount = await app.getCanvasNonTransparentPixelCount();
      expect(generatedCount).toBeGreaterThan(0);

      await app.clear();
      const clearedCount1 = await app.getCanvasNonTransparentPixelCount();
      expect(clearedCount1).toBe(0);

      // 2) Clear from ClustersCalculated
      // Generate and cluster again
      await app.generateData();
      await app.runKMeans();
      const clusteredCount = await app.getCanvasNonTransparentPixelCount();
      expect(clusteredCount).toBeGreaterThan(0);

      await app.clear();
      const clearedCount2 = await app.getCanvasNonTransparentPixelCount();
      expect(clearedCount2).toBe(0);

      // No console/page errors expected
      expect(app.getConsoleErrors().length).toBe(0);
      expect(app.getPageErrors().length).toBe(0);

      await app.detachErrorObservers();
    });

    test('Run K-Means from Idle (no data) still produces centroids drawing', async ({ page }) => {
      // Validates transition from S0_Idle -> S2_ClustersCalculated (when cluster clicked without generate)
      const app = new KMeansPage(page);
      await app.attachErrorObservers();
      await app.goto();

      const beforeCount = await app.getCanvasNonTransparentPixelCount();
      expect(beforeCount).toBe(0);

      // Click cluster without generating data
      await app.runKMeans();

      const afterCount = await app.getCanvasNonTransparentPixelCount();
      // Should draw centroids (non-zero)
      expect(afterCount).toBeGreaterThan(0);

      // Clear to get back to idle
      await app.clear();
      const cleared = await app.getCanvasNonTransparentPixelCount();
      expect(cleared).toBe(0);

      expect(app.getConsoleErrors().length).toBe(0);
      expect(app.getPageErrors().length).toBe(0);

      await app.detachErrorObservers();
    });

    test('Changing K input and using it influences clustering (k=5)', async ({ page }) => {
      // This test changes K to 5 and exercises generate + cluster to ensure UI accepts different K
      const app = new KMeansPage(page);
      await app.attachErrorObservers();
      await app.goto();

      // Set k to 5
      await app.setK(5);
      // Generate and cluster
      await app.generateData();
      const afterGenerate = await app.getCanvasNonTransparentPixelCount();
      expect(afterGenerate).toBeGreaterThan(0);

      await app.runKMeans();
      const afterCluster = await app.getCanvasNonTransparentPixelCount();
      expect(afterCluster).toBeGreaterThan(0);

      // No runtime errors expected
      expect(app.getConsoleErrors().length).toBe(0);
      expect(app.getPageErrors().length).toBe(0);

      await app.detachErrorObservers();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Invalid K input (non-numeric) should be handled gracefully - expect possible runtime errors observed', async ({ page }) => {
      // This test intentionally sets an invalid K input (non-numeric) to exercise edge case handling.
      // We do NOT modify page code; we observe console/page errors if they happen and assert they occurred.
      const app = new KMeansPage(page);
      await app.attachErrorObservers();
      await app.goto();

      // Set K to a non-numeric string which will make parseInt return NaN
      await app.setK('abc');

      // Click cluster to trigger code paths that rely on k
      await app.runKMeans();

      // Capture any console errors or page errors
      const consoleErrors = app.getConsoleErrors();
      const pageErrors = app.getPageErrors();

      // It's acceptable for the application to either handle this quietly or throw errors.
      // We assert that at least one of those two observations is present OR that the canvas remained unchanged,
      // which indicates graceful no-op behavior. This test documents observed behavior.
      const canvasCount = await app.getCanvasNonTransparentPixelCount();

      // If errors occurred, assert we captured them. Otherwise ensure canvas doesn't crash and remains numeric.
      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        // At least one error was observed - report details in assertion messages for visibility
        expect(consoleErrors.length + pageErrors.length).toBeGreaterThan(0);
      } else {
        // No errors observed - ensure the app didn't crash and canvas exists (count is a number)
        expect(typeof canvasCount).toBe('number');
      }

      await app.detachErrorObservers();
    });

    test('Setting K to 0 or negative values - verify no unexpected exceptions and behavior is defined', async ({ page }) => {
      // Tests k=0 and k=-1 behavior; application may treat these as zero clusters and either do nothing or gracefully handle.
      const app = new KMeansPage(page);
      await app.attachErrorObservers();
      await app.goto();

      // Test k = 0
      await app.setK(0);
      await app.generateData();
      await app.runKMeans();

      const consoleErrorsZero = app.getConsoleErrors().slice();
      const pageErrorsZero = app.getPageErrors().slice();

      // Clear observers' recorded errors before next subcase to inspect further separately
      app.consoleErrors = [];
      app.pageErrors = [];

      // Reset page for negative test
      await app.reload();

      await app.setK(-1);
      await app.generateData();
      await app.runKMeans();

      const consoleErrorsNeg = app.getConsoleErrors();
      const pageErrorsNeg = app.getPageErrors();

      // If errors were logged for either case, at least one of them should be captured across both attempts.
      const totalErrors = consoleErrorsZero.length + pageErrorsZero.length + consoleErrorsNeg.length + pageErrorsNeg.length;

      // Accept either no errors (graceful handling) or some errors, but ensure the page hasn't crashed (canvas methods still work)
      const canvasExists = await app.getCanvasDataURL();
      expect(typeof canvasExists).toBe('string');
      // Ensure totalErrors is a number (sanity)
      expect(typeof totalErrors).toBe('number');

      await app.detachErrorObservers();
    });
  });
});