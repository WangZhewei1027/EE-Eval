import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/32501ee0-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('K-Means Clustering Demo (FSM validation) - 32501ee0-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Page-object like helper utilities for interacting with the page and reading state.
  class KMeansPage {
    constructor(page) {
      this.page = page;
    }

    async goto() {
      await this.page.goto(APP_URL);
      // Ensure canvas is present and script had a chance to run initializations.
      await this.page.waitForSelector('#canvas');
      // Give a short pause to let the inline script run (generatePoints, initializeCentroids, draw).
      await this.page.waitForTimeout(200);
    }

    async getCounts() {
      // Read core variables from the page context.
      return await this.page.evaluate(() => {
        // Return safe snapshots; if variables are missing, the expression will throw and that
        // will be surfaced as a page error which this test collects separately.
        return {
          pointsLen: (typeof points !== 'undefined' && points && points.length) ? points.length : null,
          centroidsLen: (typeof centroids !== 'undefined' && centroids && centroids.length) ? centroids.length : null,
          assignmentsLen: (typeof assignments !== 'undefined' && assignments && assignments.length) ? assignments.length : 0,
          iteration: (typeof iteration !== 'undefined') ? iteration : null,
          canvasWidth: document.getElementById('canvas') ? document.getElementById('canvas').width : null,
          canvasHeight: document.getElementById('canvas') ? document.getElementById('canvas').height : null
        };
      });
    }

    async startClustering() {
      await this.page.click('#start');
    }

    async getIteration() {
      return await this.page.evaluate(() => (typeof iteration !== 'undefined' ? iteration : null));
    }

    async getAssignmentsSample() {
      return await this.page.evaluate(() => {
        if (typeof assignments === 'undefined' || !assignments) return null;
        // Return first 10 assignment values for a quick sanity check
        return assignments.slice(0, 10);
      });
    }

    async getCentroidsSnapshot() {
      return await this.page.evaluate(() => {
        if (typeof centroids === 'undefined' || !centroids) return null;
        // Return centroids coordinates
        return centroids.map(c => ({ x: c.x, y: c.y }));
      });
    }

    async getCanvasDataUrl() {
      return await this.page.evaluate(() => {
        const c = document.getElementById('canvas');
        return c ? c.toDataURL() : null;
      });
    }
  }

  // Collect console errors and page errors for assertions across tests.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and filter error severity messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : null
          });
        }
      } catch (e) {
        consoleErrors.push({ text: `Failed to read console message: ${String(e)}` });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally; listeners are removed with the page.
  });

  test('Initial Idle state: points and centroids are generated and initial draw occurs', async ({ page }) => {
    // This test validates the S0_Idle state entry actions:
    // generatePoints(), initializeCentroids(), draw()
    // and that the DOM components exist (canvas, button).
    const app = new KMeansPage(page);
    await app.goto();

    // Verify DOM components exist
    const canvasHandle = await page.$('#canvas');
    const startButton = await page.$('#start');
    expect(canvasHandle).not.toBeNull();
    expect(startButton).not.toBeNull();

    // Verify canvas has expected dimensions from HTML attributes
    const counts = await app.getCounts();
    expect(counts.canvasWidth).toBe(800);
    expect(counts.canvasHeight).toBe(600);

    // Verify points and centroids were initialized as described by the FSM (expected_interactions)
    // The script declares numPoints = 100 and numClusters = 3; we expect pointsLen === 100, centroidsLen === 3
    expect(counts.pointsLen).toBe(100);
    expect(counts.centroidsLen).toBe(3);

    // The initial draw() is called during S0_Idle entry actions. iteration should remain 0 until clustering starts.
    expect(counts.iteration).toBe(0);

    // Ensure the canvas has pixel content by reading a data URL; it should be a non-empty image string.
    const dataUrl = await app.getCanvasDataUrl();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:image/png')).toBeTruthy();

    // Assert there are no uncaught page errors (ReferenceError/SyntaxError/TypeError) on initial load.
    // The application should run without throwing uncaught exceptions.
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console.error messages. If invalid CSS color or other runtime issues occurred,
    // they'd typically appear as console errors. We expect none.
    expect(consoleErrors.length).toBe(0);
  });

  test('Start button transition: S0_Idle -> S1_Clustering starts kMeans iterations', async ({ page }) => {
    // This test exercises the StartClustering event and validates the transition to the Clustering state.
    const app = new KMeansPage(page);
    await app.goto();

    // Click Start to trigger generatePoints(), initializeCentroids(), kMeans()
    await app.startClustering();

    // Immediately after click, kMeans runs once synchronously and increments iteration to 1.
    // Wait for a short time to let the handler execute.
    await page.waitForTimeout(200);

    let iteration = await app.getIteration();
    expect(iteration).toBeGreaterThanOrEqual(1);

    // After the first kMeans call, assignments should have been created and have length equal to the number of points.
    // Wait until assignments length is 100 (points reassigned).
    await page.waitForFunction(() => typeof assignments !== 'undefined' && assignments.length === 100, null, { timeout: 2000 });
    const countsAfterStart = await app.getCounts();
    expect(countsAfterStart.assignmentsLen).toBe(100);

    // Centroids should still be present and of expected length
    expect(countsAfterStart.centroidsLen).toBe(3);

    // The canvas should have been redrawn (verify data URL changed from before). We simply assert it's a valid image again.
    const dataUrl = await app.getCanvasDataUrl();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.length).toBeGreaterThan(100); // ensure non-trivial content

    // Validate that assignment values are in the expected range [0, numClusters-1]
    const sampleAssignments = await app.getAssignmentsSample();
    expect(Array.isArray(sampleAssignments)).toBeTruthy();
    sampleAssignments.forEach(a => {
      // assignments may be undefined in some rare race conditions; ensure values are integers in range
      expect(typeof a === 'number').toBeTruthy();
      expect(Number.isInteger(a)).toBeTruthy();
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(3);
    });

    // Verify that centroids coordinates are within canvas bounds
    const centroids = await app.getCentroidsSnapshot();
    expect(Array.isArray(centroids)).toBeTruthy();
    centroids.forEach(c => {
      expect(typeof c.x).toBe('number');
      expect(typeof c.y).toBe('number');
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(800);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(600);
    });

    // Allow the automatic iterations to continue once (kMeans uses setTimeout every 1s until iteration < 10).
    // Wait for iteration >= 2 to confirm the recurring ClusteringIteration transitions invoked assignClusters, updateCentroids, draw.
    await page.waitForFunction(() => (typeof iteration !== 'undefined' && iteration >= 2) || (typeof window.iteration !== 'undefined' && window.iteration >= 2), null, { timeout: 4000 });
    iteration = await app.getIteration();
    expect(iteration).toBeGreaterThanOrEqual(2);

    // Ensure no uncaught page errors during clustering iterations.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Start multiple times resets and restarts clustering (edge case)', async ({ page }) => {
    // Edge-case: rapid repeated clicks on the Start button should reset iteration and start kMeans anew.
    const app = new KMeansPage(page);
    await app.goto();

    // Click start twice quickly
    await app.startClustering();
    // Short pause then click again to mimic rapid user interaction
    await page.waitForTimeout(50);
    await app.startClustering();

    // The click handler sets iteration = 0 then calls kMeans(), so after second click iteration should be >= 1.
    // Wait for handler to execute
    await page.waitForTimeout(200);
    const iterationAfter = await app.getIteration();
    expect(iterationAfter).toBeGreaterThanOrEqual(1);

    // Confirm assignments were created again and are the expected length
    await page.waitForFunction(() => typeof assignments !== 'undefined' && assignments.length === 100, null, { timeout: 2000 });
    const counts = await app.getCounts();
    expect(counts.assignmentsLen).toBe(100);

    // No uncaught errors expected as a result of repeated clicks.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clustering robustness: centroids remain within canvas across iterations', async ({ page }) => {
    // This test exercises multiple clustering iterations to ensure centroids remain valid and draw() is repeatedly called.
    const app = new KMeansPage(page);
    await app.goto();

    await app.startClustering();

    // Wait until a few iterations complete (e.g., iteration >= 4) to observe centroid updates across iterations.
    await page.waitForFunction(() => typeof iteration !== 'undefined' && iteration >= 4, null, { timeout: 8000 });

    const iterationNow = await app.getIteration();
    expect(iterationNow).toBeGreaterThanOrEqual(4);

    const centroids = await app.getCentroidsSnapshot();
    expect(centroids).not.toBeNull();
    expect(centroids.length).toBe(3);

    // Each centroid should have valid numbers within bounds.
    centroids.forEach(c => {
      expect(Number.isFinite(c.x)).toBeTruthy();
      expect(Number.isFinite(c.y)).toBeTruthy();
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(800);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(600);
    });

    // Ensure there were no unsurfaced runtime errors during repeated iterations.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console and page errors (should be none)', async ({ page }) => {
    // This test explicitly demonstrates the observability requirement: we observe console logs and page errors.
    // The test asserts there are no uncaught ReferenceError, SyntaxError, or TypeError instances.
    const app = new KMeansPage(page);
    await app.goto();

    // No interactions; just assert initial load errors
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(Array.isArray(consoleErrors)).toBeTruthy();

    // If any page errors were captured, fail with contextual information to aid debugging.
    if (pageErrors.length > 0) {
      // Provide a useful failure message including the error stack/text.
      const messages = pageErrors.map(e => e && e.stack ? e.stack : String(e)).join('\n---\n');
      test.fail(true, `Unexpected page errors detected:\n${messages}`);
    }

    // If any console error messages were captured, fail with their text.
    if (consoleErrors.length > 0) {
      const texts = consoleErrors.map(e => e.text).join('\n---\n');
      test.fail(true, `Unexpected console.error messages detected:\n${texts}`);
    }

    // Final explicit assertions that there are zero errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, { timeout: 10000 });
});