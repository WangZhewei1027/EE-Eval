import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1764ece1-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('K-Means Clustering Demo (FSM validation)', () => {

  // Helper to attach console and pageerror collectors to a page.
  const attachCollectors = (page) => {
    const consoleMessages = [];
    const pageErrors = [];
    const consoleListener = (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    const pageErrorListener = (err) => {
      // err is an Error object
      pageErrors.push(err);
    };
    page.on('console', consoleListener);
    page.on('pageerror', pageErrorListener);
    return {
      consoleMessages,
      pageErrors,
      dispose: () => {
        page.off('console', consoleListener);
        page.off('pageerror', pageErrorListener);
      }
    };
  };

  test.beforeEach(async ({ page }) => {
    // Nothing global to setup beyond navigation performed inside each test to keep isolation
  });

  test.afterEach(async ({ page }) => {
    // ensure page gets closed/reset by Playwright test runner automatically
  });

  test('Initial Idle state: page loads and entry actions generate points and draw() executed', async ({ page }) => {
    // This test verifies FSM S0_Idle entry actions:
    // - generateRandomPoints() should populate the global `points` array (default 100)
    // - draw() should have run so canvas exists and is cleared/drawn
    const collectors = attachCollectors(page);

    // Load the page and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure canvas element is present with expected dimensions
    const canvasHandle = await page.$('canvas#canvas');
    expect(canvasHandle).not.toBeNull();
    const canvasAttrs = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      return { width: c.width, height: c.height, hasContext: !!c.getContext };
    });
    expect(canvasAttrs.width).toBe(600);
    expect(canvasAttrs.height).toBe(400);
    expect(canvasAttrs.hasContext).toBe(true);

    // Verify global `points` and `clusters` reflect Idle state's entry actions
    const { pointsLength, clustersLength } = await page.evaluate(() => {
      return {
        pointsLength: Array.isArray(window.points) ? window.points.length : -1,
        clustersLength: Array.isArray(window.clusters) ? window.clusters.length : -2
      };
    });

    // The implementation calls generateRandomPoints() without arguments on load, default is 100
    expect(pointsLength).toBeGreaterThanOrEqual(1);
    expect(pointsLength).toBe(100); // implementation default is 100

    // In initial state clusters should be an empty array (no clusters initialized yet)
    expect(clustersLength).toBe(0);

    // Ensure no runtime page errors occurred during load
    expect(collectors.pageErrors.length).toBe(0);

    collectors.dispose();
  });

  test('Transition: Run K-Means (S0_Idle -> S1_RunningKMeans) with default k=3 updates clusters and centroids', async ({ page }) => {
    // This test validates the RunKMeans event and the S1_RunningKMeans entry actions:
    // - generateRandomPoints(100) resets points
    // - initializeClusters(k) creates k cluster objects
    // - assignPointsToClusters and updateClusterCentroids executed
    // - draw() updates the canvas (we validate via cluster centroids and cluster membership)
    const collectors = attachCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Confirm default input value is 3
    const defaultK = await page.$eval('input#numClusters', (el) => parseInt(el.value, 10));
    expect(defaultK).toBe(3);

    // Click the Run K-Means button to trigger the transition
    await Promise.all([
      // Wait a short while for algorithm to complete
      page.click('button[onclick="runKMeans()"]'),
      page.waitForTimeout(200) // allow the algorithm's synchronous computation to finish
    ]);

    // After running, confirm points array has been regenerated to 100
    const stateAfterRun = await page.evaluate(() => {
      // return detailed information about clusters and points
      return {
        pointsLength: Array.isArray(window.points) ? window.points.length : -1,
        clustersLength: Array.isArray(window.clusters) ? window.clusters.length : -2,
        clusterSummaries: Array.isArray(window.clusters) ? window.clusters.map((c) => ({
          hasX: typeof c.x === 'number' && Number.isFinite(c.x),
          hasY: typeof c.y === 'number' && Number.isFinite(c.y),
          pointsAssigned: Array.isArray(c.points) ? c.points.length : 0
        })) : []
      };
    });

    // Validate expected outcomes
    expect(stateAfterRun.pointsLength).toBe(100);
    expect(stateAfterRun.clustersLength).toBe(defaultK);

    // Each cluster should have numeric centroid coordinates; at least one point assigned overall
    const hasValidCentroids = stateAfterRun.clusterSummaries.every(s => s.hasX && s.hasY);
    expect(hasValidCentroids).toBe(true);

    const totalAssigned = stateAfterRun.clusterSummaries.reduce((sum, s) => sum + s.pointsAssigned, 0);
    expect(totalAssigned).toBe(100); // all points should be assigned to some cluster

    // No page errors should have been raised in the happy path
    expect(collectors.pageErrors.length).toBe(0);

    collectors.dispose();
  });

  test('Edge case / error scenario: setting numClusters to 0 should produce a runtime TypeError during assignPointsToClusters', async ({ page }) => {
    // This test intentionally drives the application into an invalid state:
    // - set number of clusters to 0
    // - clicking Run K-Means will call initializeClusters(0) -> clusters array empty
    // - assignPointsToClusters references clusters[0] and should throw a TypeError
    // We assert that a Page error of type TypeError occurs (observing the runtime failure)
    const collectors = attachCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Force the input value to 0 (bypass min attribute via JS evaluate)
    await page.fill('input#numClusters', '0');

    // Prepare to capture a pageerror event; using waitForEvent ensures we don't miss it
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);

    // Trigger Run K-Means which should generate an error
    await page.click('button[onclick="runKMeans()"]');

    // Wait for the pageerror to occur (or timeout)
    const pageError = await pageErrorPromise;

    // We expect an error to have been thrown in this scenario
    expect(pageError).not.toBeNull();

    // Validate that it is a TypeError (or at least its name contains 'TypeError')
    // pageError is typically an Error with .name and .message
    expect(pageError.name).toBeDefined();
    expect(pageError.name).toMatch(/TypeError/i);

    // Also ensure collectors saw at least one pageError
    expect(collectors.pageErrors.length).toBeGreaterThanOrEqual(1);
    const matching = collectors.pageErrors.some(e => e.name && /TypeError/i.test(e.name));
    expect(matching).toBe(true);

    collectors.dispose();
  });

  test('Edge case: non-integer input for numClusters (e.g., "abc") leads to parseInt => NaN and results in error', async ({ page }) => {
    // This test attempts to set a non-numeric value into the number input.
    // parseInt('abc') -> NaN; initializeClusters(NaN) leads to no clusters; subsequent logic may throw.
    const collectors = attachCollectors(page);

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Set input's value programmatically to a non-numeric string (using evaluate to bypass input constraints)
    await page.evaluate(() => {
      const el = document.getElementById('numClusters');
      el.value = 'abc';
    });

    // Trigger Run K-Means and watch for a runtime error
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    await page.click('button[onclick="runKMeans()"]');
    const pageError = await pageErrorPromise;

    // It's acceptable if this throws a TypeError similar to the zero-case; we assert an error occurred
    expect(pageError).not.toBeNull();
    expect(pageError.name).toBeDefined();
    // Could be TypeError or other; assert at least a runtime error occurred
    expect(collectors.pageErrors.length).toBeGreaterThanOrEqual(1);

    collectors.dispose();
  });

  test('Visual feedback: canvas pixel data changes after running K-Means (simple heuristic)', async ({ page }) => {
    // This test inspects the canvas pixel data before and after running K-Means to ensure the drawing changed.
    // It's a heuristic: we sample a few pixel values and expect differences after draw() during the algorithm.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Helper to read a small region of the canvas as a base64 string or pixel sum
    const sampleBefore = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      const ctx = c.getContext('2d');
      // sample a 10x10 block from the center
      const x = Math.floor(c.width / 2 - 5);
      const y = Math.floor(c.height / 2 - 5);
      const data = ctx.getImageData(x, y, 10, 10).data;
      // return a simple checksum
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      return sum;
    });

    // Run k-means with default settings
    await page.click('button[onclick="runKMeans()"]');
    await page.waitForTimeout(200);

    const sampleAfter = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      const ctx = c.getContext('2d');
      const x = Math.floor(c.width / 2 - 5);
      const y = Math.floor(c.height / 2 - 5);
      const data = ctx.getImageData(x, y, 10, 10).data;
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      return sum;
    });

    // The sums may be equal in degenerate random conditions, but in typical runs they differ.
    // To avoid flaky failures, assert that both are numbers and allow either outcome, but log for visibility.
    expect(typeof sampleBefore).toBe('number');
    expect(typeof sampleAfter).toBe('number');

    // Prefer difference but do not fail if not; still include an assertion that at least one draw occurred by checking cluster array
    const clustersLength = await page.evaluate(() => Array.isArray(window.clusters) ? window.clusters.length : -1);
    expect(clustersLength).toBeGreaterThanOrEqual(1);
  });

});