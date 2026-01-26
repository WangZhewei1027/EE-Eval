import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e48f1-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the K-Means page to keep tests organized
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generate = '#generate_button';
    this.reset = '#reset_button';
    this.cluster = '#cluster_button';
    this.visualize = '#visualize_button';
    this.save = '#save_button';
    this.numClusters = '#num_clusters';
    this.maxIterations = '#max_iterations';
    this.cluster1 = '#cluster1';
    this.cluster2 = '#cluster2';
    this.cluster3 = '#cluster3';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async getInputValue(selector) {
    return this.page.locator(selector).inputValue();
  }

  async getInnerHTML(selector) {
    return this.page.locator(selector).innerHTML();
  }

  // Click a button and capture a pageerror that occurs as a result.
  // Returns the Error object if it occurred (resolved from page.waitForEvent).
  async clickAndWaitForPageError(buttonSelector, timeout = 3000) {
    // Start waiting for the pageerror event before clicking to ensure capture
    const errorPromise = this.page.waitForEvent('pageerror', { timeout });
    await this.page.click(buttonSelector);
    const error = await errorPromise;
    return error;
  }

  // Click a button but assert no pageerror occurs within a short window
  async clickAndAssertNoPageError(buttonSelector, observeForMs = 500) {
    const errors = [];
    const handler = (e) => errors.push(e);
    this.page.on('pageerror', handler);
    await this.page.click(buttonSelector);
    // small pause to let any synchronous or near-synchronous errors surface
    await this.page.waitForTimeout(observeForMs);
    this.page.removeListener('pageerror', handler);
    return errors;
  }
}

test.describe('K-Means Clustering interactive app - FSM behavior and error observation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate fresh for each test to isolate errors and state
    const km = new KMeansPage(page);
    await km.goto();
  });

  test('Initial Idle state: page renders expected controls and inputs (S0_Idle)', async ({ page }) => {
    // Validate page initial elements, inputs and cluster containers are present and empty
    const km = new KMeansPage(page);

    // Inputs should exist with default values from HTML
    await expect(page.locator(km.numClusters)).toHaveCount(1);
    await expect(page.locator(km.maxIterations)).toHaveCount(1);
    const numClustersVal = await km.getInputValue(km.numClusters);
    const maxIterationsVal = await km.getInputValue(km.maxIterations);
    expect(numClustersVal).toBe('3'); // default value from HTML
    expect(maxIterationsVal).toBe('100'); // default value from HTML

    // Buttons should be visible
    await expect(page.locator(km.generate)).toBeVisible();
    await expect(page.locator(km.reset)).toBeVisible();
    await expect(page.locator(km.cluster)).toBeVisible();
    await expect(page.locator(km.visualize)).toBeVisible();
    await expect(page.locator(km.save)).toBeVisible();

    // Cluster containers should exist and be empty initially
    const c1 = await km.getInnerHTML(km.cluster1);
    const c2 = await km.getInnerHTML(km.cluster2);
    const c3 = await km.getInnerHTML(km.cluster3);
    expect(c1).toBe('');
    expect(c2).toBe('');
    expect(c3).toBe('');

    // FSM expected entry action 'renderPage' is not implemented in HTML.
    // Verify that the global renderPage function is not present (edge case inspection).
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

  test('Generate Clustering transition (S0_Idle -> S1_ClustersGenerated): clicking Generate triggers an error from broken implementation and leaves clusters empty', async ({ page }) => {
    // The generate_clusters implementation in the HTML attempts to call .data on cluster entries
    // which does not match the implemented KMeans shape. We expect a TypeError to be thrown.
    const km = new KMeansPage(page);

    // Click generate and capture the pageerror that must occur naturally
    const err = await km.clickAndWaitForPageError(km.generate);

    // Validate that an error occurred and it points to property access issues (robust substrings).
    expect(err).toBeTruthy();
    const msg = String(err.message || '');
    const acceptableSubstrings = ['data', 'Cannot', 'reading', 'undefined', 'innerHTML'];
    const matched = acceptableSubstrings.some(s => msg.includes(s));
    expect(matched).toBe(true);

    // After the error, cluster containers should remain empty (no successful cluster content)
    const c1 = await km.getInnerHTML(km.cluster1);
    const c2 = await km.getInnerHTML(km.cluster2);
    const c3 = await km.getInnerHTML(km.cluster3);
    expect(c1).toBe('');
    expect(c2).toBe('');
    expect(c3).toBe('');
  });

  test('Cluster action (S1_ClustersGenerated -> S3_ClustersClustered): clicking Cluster triggers the same broken behavior and results in error', async ({ page }) => {
    // cluster_clusters is essentially identical to generate_clusters and is expected to throw
    const km = new KMeansPage(page);

    const err = await km.clickAndWaitForPageError(km.cluster);

    expect(err).toBeTruthy();
    const msg = String(err.message || '');
    // It should mention problems with property access or undefined values
    expect(msg.length).toBeGreaterThan(0);
    const found = ['data', 'undefined', 'reading', 'Cannot', 'innerHTML'].some(s => msg.includes(s));
    expect(found).toBe(true);

    // Verify DOM did not get valid cluster points appended
    const c1 = await km.getInnerHTML(km.cluster1);
    expect(c1).toBe('');
  });

  test('Visualize action (S1_ClustersGenerated -> S4_ClustersVisualized): clicking Visualize produces runtime error due to assumptions about existing .point elements', async ({ page }) => {
    const km = new KMeansPage(page);

    // Visualize attempts to reference points[j] when points NodeList may be empty -> TypeError expected
    const err = await km.clickAndWaitForPageError(km.visualize);

    expect(err).toBeTruthy();
    const msg = String(err.message || '');
    // We expect an error about innerHTML access or undefined element access
    const found = ['innerHTML', 'points', 'Cannot', 'reading', 'undefined'].some(s => msg.includes(s));
    expect(found).toBe(true);

    // Ensure no spurious '.point' elements have been injected into cluster containers by the broken code
    const c1 = await km.getInnerHTML(km.cluster1);
    const c2 = await km.getInnerHTML(km.cluster2);
    const c3 = await km.getInnerHTML(km.cluster3);
    expect(c1).toBe('');
    expect(c2).toBe('');
    expect(c3).toBe('');
  });

  test('Save action (S1_ClustersGenerated -> S5_ClustersSaved): clicking Save before clusters exist should raise an error; ensures save_clusters relies on internal clusters array and fails gracefully by throwing', async ({ page }) => {
    const km = new KMeansPage(page);

    // Save attempts to iterate clusters[i].length but clusters global is an empty array -> TypeError expected
    const err = await km.clickAndWaitForPageError(km.save);

    expect(err).toBeTruthy();
    const msg = String(err.message || '');
    // Message should hint at undefined or property access problem
    const found = ['length', 'clusters', 'undefined', 'Cannot', 'reading'].some(s => msg.includes(s));
    expect(found).toBe(true);
  });

  test('Reset action (S1_ClustersGenerated -> S2_ClustersReset): clicking Reset should not throw and should clear cluster containers', async ({ page }) => {
    const km = new KMeansPage(page);

    // First, artificially create content in cluster1/2/3 to validate reset clears them.
    // We will do this using page.evaluate to append innerHTML directly (not using broken cluster code).
    await page.evaluate(() => {
      const el1 = document.getElementById('cluster1');
      const el2 = document.getElementById('cluster2');
      const el3 = document.getElementById('cluster3');
      if (el1) el1.innerHTML = '<div class="point">seed</div>';
      if (el2) el2.innerHTML = '<div class="point">seed</div>';
      if (el3) el3.innerHTML = '<div class="point">seed</div>';
    });

    // Attach temporary listener to collect any page errors during reset
    const errors = await km.clickAndAssertNoPageError(km.reset);

    // No page errors should have occurred for reset
    expect(errors.length).toBe(0);

    // Cluster containers should be cleared by reset_clusters implementation
    const c1 = await km.getInnerHTML(km.cluster1);
    const c2 = await km.getInnerHTML(km.cluster2);
    const c3 = await km.getInnerHTML(km.cluster3);
    expect(c1).toBe('');
    expect(c2).toBe('');
    expect(c3).toBe('');

    // Variables num_clusters and max_iterations are reset to defaults by reset_clusters.
    // Because page variables are not directly accessible as module variables, check inputs remain at defaults.
    const numClustersVal = await km.getInputValue(km.numClusters);
    const maxIterationsVal = await km.getInputValue(km.maxIterations);
    // The HTML input values are not updated by reset_clusters (since it updates variables only),
    // so this assertion avoids assuming DOM reflect those changes. We still verify inputs exist.
    expect(numClustersVal).toBe('3');
    expect(maxIterationsVal).toBe('100');
  });

  test('Edge case: Clicking actions in sequence (Generate -> Cluster -> Visualize -> Save) each emit their respective runtime errors', async ({ page }) => {
    // Validate sequential interactions each produce a pageerror when clicked in sequence on a fresh page
    const km = new KMeansPage(page);

    // Generate -> expect error
    const genErr = await km.clickAndWaitForPageError(km.generate);
    expect(genErr).toBeTruthy();

    // After a failing generate, attempt cluster -> expect error
    const clusterErr = await km.clickAndWaitForPageError(km.cluster);
    expect(clusterErr).toBeTruthy();

    // Visualize -> expect error
    const vizErr = await km.clickAndWaitForPageError(km.visualize);
    expect(vizErr).toBeTruthy();

    // Save -> expect error
    const saveErr = await km.clickAndWaitForPageError(km.save);
    expect(saveErr).toBeTruthy();
  });

  test('Edge case: Verify that missing or mismatched APIs lead to observable runtime errors (confirming app is not patched)', async ({ page }) => {
    // This test asserts that the page is intentionally unmodified by the test harness and that certain
    // expected global helper functions or shape assumptions are missing (which leads to errors when used).
    const km = new KMeansPage(page);

    // Check that the global array `clusters` exists but is empty by default
    const clustersTypeAndLength = await page.evaluate(() => {
      return {
        defined: typeof clusters !== 'undefined',
        length: (Array.isArray(clusters) ? clusters.length : null),
        isArray: Array.isArray(clusters)
      };
    });

    // clusters should be defined (declared in the script) but empty array initially
    expect(clustersTypeAndLength.defined).toBe(true);
    expect(clustersTypeAndLength.isArray).toBe(true);
    expect(clustersTypeAndLength.length).toBe(0);

    // Attempting to call renderPage (which FSM indicates should exist) should not be callable
    const renderPageExists = await page.evaluate(() => typeof window.renderPage !== 'function');
    expect(renderPageExists).toBe(true);
  });
});