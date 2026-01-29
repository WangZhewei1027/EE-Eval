import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed903ab3-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the K-Means visualization page
class KMeansPage {
  constructor(page) {
    this.page = page;
    this.playButton = page.locator('#playButton');
    this.clusters = page.locator('#clusters');
    this.dotLocator = this.clusters.locator('.dot');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Run K-Means button once
  async runKMeans() {
    await this.playButton.click();
  }

  // Click the Run K-Means button n times quickly
  async runKMeansTimes(n = 1) {
    for (let i = 0; i < n; i++) {
      await this.playButton.click();
    }
  }

  // Number of .dot elements in #clusters
  async dotCount() {
    return await this.dotLocator.count();
  }

  // Get inline style value (like '12%') for nth dot (0-based)
  async getDotInlineStyleValue(index, prop) {
    return await this.dotLocator.nth(index).evaluate((el, prop) => el.style[prop], prop);
  }

  // Get computed background-color for nth dot (returns rgb(...) or similar)
  async getDotComputedBackgroundColor(index) {
    return await this.dotLocator.nth(index).evaluate(el => getComputedStyle(el).backgroundColor);
  }

  // Get serialized clusters innerHTML
  async clustersHTML() {
    return await this.clusters.evaluate(el => el.innerHTML);
  }

  // Expose page-scoped variables (points, centroids) safely
  async getPointsLength() {
    return await this.page.evaluate(() => {
      // points is defined by the page script; return its length if present
      return typeof window.points !== 'undefined' ? window.points.length : null;
    });
  }

  async getCentroidsLength() {
    return await this.page.evaluate(() => {
      return typeof window.centroids !== 'undefined' ? window.centroids.length : null;
    });
  }
}

test.describe('K-Means Clustering Visualization - FSM tests', () => {
  // Containers to collect console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors to assert on them if needed
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown required beyond Playwright fixtures,
    // but we keep this hook to indicate structured setup/teardown.
  });

  test('Initial state (S0_Idle) renders correctly: play button present and clusters empty', async ({ page }) => {
    // This test validates the Idle state from the FSM:
    // - The "Run K-Means" button is present
    // - The #clusters container exists and initially has no .dot children
    // - No page errors occurred during initial render

    const app = new KMeansPage(page);

    // Play button should be visible and have the expected text
    await expect(app.playButton).toBeVisible();
    await expect(app.playButton).toHaveText('Run K-Means');

    // Clusters container should exist
    await expect(app.clusters).toBeVisible();

    // No dots initially
    expect(await app.dotCount()).toBe(0);

    // Assert that the page did not emit any page-level uncaught exceptions while loading
    expect(pageErrors.length).toBe(0);

    // Assert that there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Clustering on RunKMeans click creates points and centroids', async ({ page }) => {
    // This test validates the transition triggered by the RunKMeans event:
    // - Clicking the play button runs the clustering initialization functions
    // - Points and centroids are created in the page state (window.points, window.centroids)
    // - DOM updated: #clusters contains numPoints + numClusters .dot elements

    const app = new KMeansPage(page);

    // Click the Run K-Means button to trigger the transition
    await app.runKMeans();

    // Wait for dots to appear - expecting 103 (100 points + 3 centroids)
    // Use a short wait loop since DOM updates synchronously, but defensively allow some time.
    await page.waitForFunction(() => document.querySelectorAll('#clusters .dot').length > 0);

    const count = await app.dotCount();

    // Expect exactly 103 dots based on the implementation (numPoints = 100, numClusters = 3)
    expect(count).toBe(103);

    // Also assert that the page-scoped arrays were initialized
    expect(await app.getPointsLength()).toBe(100);
    expect(await app.getCentroidsLength()).toBe(3);

    // Verify that at least one point dot has a non-white color (points use HSL color)
    const firstDotBg = await app.getDotComputedBackgroundColor(0);
    expect(firstDotBg).not.toBe('rgb(255, 255, 255)');

    // Verify that centroid dots (last three) are white as per implementation
    const lastIndex = count - 1;
    const centroid1 = await app.getDotComputedBackgroundColor(lastIndex - 2);
    const centroid2 = await app.getDotComputedBackgroundColor(lastIndex - 1);
    const centroid3 = await app.getDotComputedBackgroundColor(lastIndex);

    expect(centroid1).toBe('rgb(255, 255, 255)');
    expect(centroid2).toBe('rgb(255, 255, 255)');
    expect(centroid3).toBe('rgb(255, 255, 255)');

    // Verify inline left/top style values are percentages and within 0-100%
    for (let i = 0; i < Math.min(5, count); i++) { // sample up to first 5 dots
      const left = await app.getDotInlineStyleValue(i, 'left');
      const top = await app.getDotInlineStyleValue(i, 'top');
      // Styles are set using percentage strings like '12.345678%'
      expect(typeof left).toBe('string');
      expect(left.endsWith('%')).toBe(true);
      expect(typeof top).toBe('string');
      expect(top.endsWith('%')).toBe(true);

      const leftVal = parseFloat(left.replace('%', ''));
      const topVal = parseFloat(top.replace('%', ''));
      expect(leftVal).toBeGreaterThanOrEqual(0);
      expect(leftVal).toBeLessThanOrEqual(100);
      expect(topVal).toBeGreaterThanOrEqual(0);
      expect(topVal).toBeLessThanOrEqual(100);
    }

    // Ensure no unexpected page errors occurred during the transition
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Running K-Means multiple times replaces the visualization (drawPoints clears previous)', async ({ page }) => {
    // This test validates exit/entry behaviors across repeated transitions:
    // - drawPoints clears previous dots (clustersDiv.innerHTML = '')
    // - Subsequent clicks replace the DOM rather than append
    // - No uncaught errors occur during repeated runs

    const app = new KMeansPage(page);

    // First run
    await app.runKMeans();
    await page.waitForFunction(() => document.querySelectorAll('#clusters .dot').length > 0);
    const firstHTML = await app.clustersHTML();
    const firstCount = await app.dotCount();
    expect(firstCount).toBe(103);
    expect(firstHTML.length).toBeGreaterThan(0);

    // Second run (should clear and re-draw)
    await app.runKMeans();
    await page.waitForFunction(() => document.querySelectorAll('#clusters .dot').length === 103);
    const secondHTML = await app.clustersHTML();
    const secondCount = await app.dotCount();

    // Counts should remain consistent
    expect(secondCount).toBe(103);

    // The innerHTML content should have changed (new DOM nodes), indicating replacement
    expect(secondHTML).not.toBe(firstHTML);

    // No page errors or console errors after repeated run
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: rapid double clicks do not cause uncaught page errors', async ({ page }) => {
    // This test simulates a rapid user action (double click) to ensure stability.
    // It asserts that no uncaught exceptions are emitted even under quick repeated interactions.

    const app = new KMeansPage(page);

    // Simulate rapid two clicks
    await Promise.all([
      app.playButton.click(),
      app.playButton.click()
    ]);

    // Wait for dots drawn
    await page.waitForFunction(() => document.querySelectorAll('#clusters .dot').length > 0);

    // Expect a valid number of dots (should be 103)
    expect(await app.dotCount()).toBe(103);

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Error scenario: referencing an undeclared identifier in page context throws a ReferenceError', async ({ page }) => {
    // The test intentionally causes a ReferenceError inside the page context by referencing
    // an undeclared variable. According to instructions, we must let ReferenceError happen
    // naturally and assert that it occurs (do not patch the runtime).
    //
    // This validates that page.evaluate will surface JS runtime errors back to the test.

    // Attempting to access an undeclared identifier throws in strict/non-strict mode in browsers
    const promise = page.evaluate(() => {
      // intentionally reference a completely undeclared identifier
      // This should trigger a ReferenceError in the page context and cause evaluate() to reject.
      return nonexistentGlobalIdentifierThatShouldNotExist; // eslint-disable-line no-undef
    });

    await expect(promise).rejects.toThrow(/is not defined|ReferenceError/);
  });

  test('Sanity check: DOM structure contains expected components as per FSM components list', async ({ page }) => {
    // Validate presence of the components described in the FSM extraction summary:
    // - #playButton exists and has text "Run K-Means"
    // - #clusters exists

    const app = new KMeansPage(page);

    await expect(app.playButton).toBeVisible();
    await expect(app.playButton).toHaveText('Run K-Means');
    await expect(app.clusters).toBeVisible();

    // No page errors emitted during this check
    expect(pageErrors.length).toBe(0);
  });
});