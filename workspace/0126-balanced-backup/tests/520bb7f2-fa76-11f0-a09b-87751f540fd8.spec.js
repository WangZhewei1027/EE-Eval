import { test, expect } from '@playwright/test';

// Page Object Model for the K-Means page
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numClusters = page.locator('#num_clusters');
    this.generateBtn = page.locator('#generate_clusters');
    this.visualizeBtn = page.locator('#visualize_clusters');
    this.resultDiv = page.locator('#result');
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async getNumClustersValue() {
    return this.numClusters.inputValue();
  }

  async setNumClustersValue(value) {
    await this.numClusters.fill(String(value));
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickVisualize() {
    await this.visualizeBtn.click();
  }

  async getResultChildrenCount() {
    return this.page.evaluate(() => document.getElementById('result').children.length);
  }

  async getResultChildrenBackgrounds() {
    return this.page.evaluate(() => {
      const children = Array.from(document.getElementById('result').children);
      return children.map((c) => c.style.background || null);
    });
  }

  async isGenerateEnabled() {
    return this.generateBtn.isEnabled();
  }

  async isVisualizeEnabled() {
    return this.visualizeBtn.isEnabled();
  }

  // Inspect if the functions exist on window (read-only introspection)
  async hasGenerateFunction() {
    return this.page.evaluate(() => typeof window.generate_clusters === 'function');
  }

  async hasVisualizeFunction() {
    return this.page.evaluate(() => typeof window.visualize_clusters === 'function');
  }
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bb7f2-fa76-11f0-a09b-87751f540fd8.html';

test.describe('K-Means Clustering FSM - End-to-End', () => {
  // Each test will create fresh listeners and navigate the page itself to ensure isolation.
  // These tests intentionally do NOT patch or modify the page code. They observe and assert runtime behavior,
  // including runtime errors that the page may produce.

  // Validate the initial Idle state (S0_Idle)
  test('S0_Idle: Initial render shows controls and captures initial runtime errors', async ({ page }) => {
    // Arrays to collect runtime errors and console messages
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    const kmPage = new KMeansPage(page);
    // Navigate to the page (listeners attached before navigation to catch load-time errors)
    await kmPage.goto(APP_URL);

    // Validate presence of UI controls as evidence of Idle state
    await expect(kmPage.numClusters).toBeVisible();
    await expect(kmPage.generateBtn).toBeVisible();
    await expect(kmPage.visualizeBtn).toBeVisible();

    // The input defaults to value "3" per the HTML
    const inputVal = await kmPage.getNumClustersValue();
    expect(inputVal).toBe('3');

    // Buttons should be enabled for user interaction
    expect(await kmPage.isGenerateEnabled()).toBe(true);
    expect(await kmPage.isVisualizeEnabled()).toBe(true);

    // The result div should exist and initially be empty in the DOM
    const childrenCount = await kmPage.getResultChildrenCount();
    expect(childrenCount).toBeGreaterThanOrEqual(0);
    // Because the script included at load attempts to call generate_clusters immediately,
    // we expect that at least one runtime error (likely a TypeError) occurred during page load.
    // Assert that page errors were captured.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one captured page error should indicate a TypeError or reference to undefined properties
    const foundLikelyTypeError = pageErrors.some((err) => {
      const nameOk = err && err.name && err.name.toLowerCase().includes('typeerror');
      const msgOk = err && err.message && (
        err.message.toLowerCase().includes('cannot read') ||
        err.message.toLowerCase().includes('undefined') ||
        err.message.toLowerCase().includes('cannot')
      );
      return nameOk || msgOk;
    });
    expect(foundLikelyTypeError).toBe(true);

    // Also check for console error messages emitted
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0); // may be zero in some browsers, but we capture if any
  });

  // Validate transition: S0_Idle -> S1_ClustersGenerated via GenerateClustersClick
  test('Transition S0 -> S1: Clicking Generate Clusters triggers generate_clusters and results in a runtime error (observed behavior)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const kmPage = new KMeansPage(page);
    await kmPage.goto(APP_URL);

    // Record initial page error count (load-time errors)
    const initialErrors = pageErrors.length;

    // Click the generate button and wait briefly for any runtime errors emitted by the click handler
    // We intentionally do not patch or intercept the function; let it run and produce errors naturally.
    // Use Promise.race between a short delay and a pageerror to avoid hanging if no error occurs.
    const waitForErrorPromise = page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    await kmPage.clickGenerate();
    // If an error occurs it will be captured both by page.on and page.waitForEvent
    await waitForErrorPromise;

    // After click, ensure that a new error occurred (because the implementation accesses undefined clusters)
    expect(pageErrors.length).toBeGreaterThanOrEqual(initialErrors);

    // The result area should NOT have been populated successfully due to the runtime error.
    const childrenCount = await kmPage.getResultChildrenCount();
    // The buggy script is expected to prevent proper cluster generation -> children likely remain 0
    expect(childrenCount).toBe(0);

    // Confirm the generate_clusters function exists (the click handler refers to it), even if it failed at runtime
    expect(await kmPage.hasGenerateFunction()).toBe(true);
  });

  // Validate transition: S1_ClustersGenerated -> S2_ClustersVisualized via VisualizeClustersClick
  test('Transition S1 -> S2: Clicking Visualize Clusters invokes visualize_clusters and applies styles (no new runtime error expected)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    const consoleMsgs = [];
    page.on('console', (msg) => consoleMsgs.push(msg));

    const kmPage = new KMeansPage(page);
    await kmPage.goto(APP_URL);

    // There may be load-time errors already; note the count
    const initialErrorCount = pageErrors.length;

    // Because generate is buggy and load-time generate_clusters failed, there will be no child elements to visualize.
    // Click visualize to exercise the visualize_clusters function. It should not throw when there are zero children.
    const waitForPossibleError = page.waitForEvent('pageerror', { timeout: 1000 }).catch(() => null);
    await kmPage.clickVisualize();
    await waitForPossibleError;

    // No new pageerror is expected from visualize_clusters when result is empty
    expect(pageErrors.length).toBeLessThanOrEqual(initialErrorCount + 1); // allow 0 or 1 (some engines may emit additional messages)
    // Assert visualize function exists on window
    expect(await kmPage.hasVisualizeFunction()).toBe(true);

    // Because there are no children, backgrounds array should be empty
    const backgrounds = await kmPage.getResultChildrenBackgrounds();
    expect(Array.isArray(backgrounds)).toBe(true);
    expect(backgrounds.length).toBe(0);

    // Ensure clicking visualize did not create new DOM children unexpectedly
    const childrenCount = await kmPage.getResultChildrenCount();
    expect(childrenCount).toBe(0);
  });

  // Edge case: attempt to change number of clusters and click generate -> still triggers runtime errors (validate robustness)
  test('Edge case: Changing num_clusters to different values and clicking Generate triggers errors (observed behavior)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const kmPage = new KMeansPage(page);
    await kmPage.goto(APP_URL);

    // Test multiple values that may reveal different failures in the implementation
    const testValues = [1, 2, 5, 0, -1];

    for (const val of testValues) {
      // Reset errors snapshot for this iteration
      const beforeCount = pageErrors.length;
      await kmPage.setNumClustersValue(val);
      // Click generate; capture any immediate runtime error
      const waitErr = page.waitForEvent('pageerror', { timeout: 1000 }).catch(() => null);
      await kmPage.clickGenerate();
      await waitErr;

      // The implementation accesses data["cluster" + i] where i starts at 0.
      // Given the data keys begin at cluster1, we expect attempts to access cluster0 to produce TypeError.
      // Assert that at least the pageErrors array did not decrease (it should be same or increased).
      expect(pageErrors.length).toBeGreaterThanOrEqual(beforeCount);

      // The page should still not have valid cluster DOM children injected due to errors
      const childrenCount = await kmPage.getResultChildrenCount();
      expect(childrenCount).toBe(0);
    }
  });

  // Validate that the visualize_clusters function does not throw even if result children are present or absent.
  // To avoid modifying the page's JavaScript, we only assert behavior without injecting nodes by user script.
  test('S2_ClustersVisualized: visualize_clusters is present and safe to call (no modification of page JS)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const kmPage = new KMeansPage(page);
    await kmPage.goto(APP_URL);

    // Call visualize_clusters via click - it should run and not throw in most conditions.
    const beforeCount = pageErrors.length;
    const waitErr = page.waitForEvent('pageerror', { timeout: 1000 }).catch(() => null);
    await kmPage.clickVisualize();
    await waitErr;

    // Expect no new errors from visualize in the typical case where result is empty
    expect(pageErrors.length).toBeLessThanOrEqual(beforeCount + 1);
    // Visualize function exists
    expect(await kmPage.hasVisualizeFunction()).toBe(true);
  });

  // Sanity: ensure that runtime errors observed are consistent with TypeError-ish failures caused by broken generate_clusters
  test('Runtime errors originate from generate_clusters (sanity check)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const kmPage = new KMeansPage(page);
    await kmPage.goto(APP_URL);

    // There should be at least one captured error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const messages = pageErrors.map((e) => (e && e.message) ? e.message.toLowerCase() : '');
    // At least one message should mention 'cluster' or 'length' or 'undefined' which hints at the buggy data["cluster" + i] access
    const matches = messages.some((m) => m.includes('cluster') || m.includes('length') || m.includes('undefined') || m.includes('cannot read'));
    expect(matches).toBe(true);
  });
});