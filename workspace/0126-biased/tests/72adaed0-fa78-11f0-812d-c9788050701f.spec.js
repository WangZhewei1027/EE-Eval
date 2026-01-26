import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72adaed0-fa78-11f0-812d-c9788050701f.html';

// Page Object for the K-Means visualization page
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.resetBtn = page.locator('#resetBtn');
    this.clusterBtn = page.locator('#clusterBtn');
    this.canvas = page.locator('#canvas');
    this.clusterInfo = page.locator('.cluster-info');
    this.count1 = page.locator('#count1');
    this.count2 = page.locator('#count2');
    this.count3 = page.locator('#count3');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the canvas to be initialized by the app scripts
    await this.canvas.waitFor({ state: 'visible', timeout: 5000 });
  }

  // Click the Cluster Points button
  async clickCluster() {
    await this.clusterBtn.click();
  }

  // Click the Reset Points button
  async clickReset() {
    await this.resetBtn.click();
  }

  // Returns whether the cluster-info element has the 'visible' class
  async isClusterInfoVisible() {
    return await this.clusterInfo.evaluate((el) => el.classList.contains('visible'));
  }

  // Returns the disabled state of the cluster button
  async isClusterBtnDisabled() {
    return await this.clusterBtn.evaluate((btn) => btn.disabled);
  }

  // Returns text contents of the three count spans as strings
  async getCounts() {
    const [c1, c2, c3] = await Promise.all([this.count1.textContent(), this.count2.textContent(), this.count3.textContent()]);
    return [c1?.trim() ?? '', c2?.trim() ?? '', c3?.trim() ?? ''];
  }

  // Trigger a window resize to exercise the resize handler
  async triggerResize() {
    await this.page.setViewportSize({ width: 800, height: 900 });
    // dispatch a resize event to ensure the page's handler runs
    await this.page.evaluate(() => window.dispatchEvent(new Event('resize')));
  }
}

test.describe('K-Means Clustering Visual (FSM tests)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Record console messages (info/warning/error)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No global teardown actions required for this suite; listeners are tied to pages
  });

  test('Initial state S0_Idle: page loads and init() ran (visual checks)', async ({ page }) => {
    // This test validates the initial/idle state after DOMContentLoaded and init execution.
    // We verify DOM elements exist, cluster info is hidden initially, cluster button is enabled,
    // counts are at their initial displayed values, and no runtime errors were emitted during load.

    const app = new KMeansPage(page);
    await app.goto();

    // Validate DOM presence
    await expect(app.canvas).toBeVisible({ timeout: 2000 });
    await expect(app.resetBtn).toBeVisible();
    await expect(app.clusterBtn).toBeVisible();
    await expect(app.clusterInfo).toBeVisible();

    // cluster-info should NOT have 'visible' class initially (S0_Idle)
    const visible = await app.isClusterInfoVisible();
    expect(visible).toBe(false);

    // cluster button should be enabled in the idle state
    const disabled = await app.isClusterBtnDisabled();
    expect(disabled).toBe(false);

    // Counts should be initial (the UI sets 0 in HTML initially)
    const counts = await app.getCounts();
    // At initial render, algorithm hasn't assigned clusters so counts should still show "0"
    expect(counts).toEqual(['0', '0', '0']);

    // Assert no page errors nor console error-level messages occurred during load
    expect(pageErrors.length, `Expected no page errors on load, but got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, `Expected no console.error messages on load, but got: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
  });

  test('Transition S0_Idle -> S1_Clustering when clicking ClusterPoints', async ({ page }) => {
    // This test validates that clicking the "Cluster Points" button starts clustering:
    // - clusterBtn becomes disabled
    // - cluster-info becomes visible (entry action kMeansStep -> assignClusters produces visible)
    // - the displayed cluster counts update to non-zero values (points assigned)
    // - no runtime exceptions are thrown during the transition

    const app = new KMeansPage(page);
    await app.goto();

    // Click cluster to start clustering
    await app.clickCluster();

    // Immediately after click, clusterBtn should be disabled by the handler
    await expect.poll(async () => await app.isClusterBtnDisabled(), {
      timeout: 2000,
      message: 'Waiting for clusterBtn to become disabled after clicking'
    }).toBe(true);

    // clusterInfo should become visible as assignClusters() adds the 'visible' class synchronously within kMeansStep
    await page.waitForSelector('.cluster-info.visible', { timeout: 2000 });

    const visible = await app.isClusterInfoVisible();
    expect(visible).toBe(true);

    // The counts should be updated to show distribution (not all zeros)
    const counts = await app.getCounts();
    // At least one cluster should have count > 0
    const numericCounts = counts.map(c => Number(c || '0'));
    const totalAssigned = numericCounts.reduce((s, v) => s + v, 0);
    expect(totalAssigned).toBeGreaterThan(0);

    // Ensure no uncaught exceptions or console error messages occurred during action
    expect(pageErrors.length, `Expected no page errors during clustering start, but got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, `Expected no console.error messages during clustering start, but got: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
  });

  test('Transition S1_Clustering -> S0_Idle when clicking ResetPoints (during clustering)', async ({ page }) => {
    // This test validates that clicking Reset Points while clustering:
    // - cancels animations/iterations (exit action sets isClustering = false implicitly)
    // - removes the 'visible' class from cluster-info
    // - clusterBtn becomes enabled again
    // - no runtime errors are thrown when reset is invoked during an active clustering process

    const app = new KMeansPage(page);
    await app.goto();

    // Start clustering first
    await app.clickCluster();

    // Wait for clustering to show visible info and disable the cluster button
    await page.waitForSelector('.cluster-info.visible', { timeout: 2000 });
    await expect.poll(async () => await app.isClusterBtnDisabled(), { timeout: 2000 }).toBe(true);

    // Now click reset while clustering in progress
    await app.clickReset();

    // After reset, cluster-info should NOT have 'visible' class
    await expect.poll(async () => !(await app.isClusterInfoVisible()), {
      timeout: 2000,
      message: 'Waiting for cluster-info to be removed after reset'
    }).toBe(true);

    // clusterBtn should be enabled after reset
    await expect.poll(async () => !(await app.isClusterBtnDisabled()), {
      timeout: 2000,
      message: 'Waiting for clusterBtn to be enabled after reset'
    }).toBe(true);

    // Validate no page errors and no console.error occurred during reset
    expect(pageErrors.length, `Expected no page errors during reset, but got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, `Expected no console.error messages during reset, but got: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);
  });

  test('Edge case: repeated ClusterPoints clicks and resize handler (no uncaught exceptions)', async ({ page }) => {
    // This test checks robustness:
    // - clicking cluster repeatedly should not cause errors (click handler guards with isClustering flag)
    // - resizing the window triggers the resize handler that recalculates canvas size and draws
    // - confirm no runtime exceptions are emitted for these edge actions

    const app = new KMeansPage(page);
    await app.goto();

    // Click cluster to start
    await app.clickCluster();
    await page.waitForSelector('.cluster-info.visible', { timeout: 2000 });

    // Try clicking cluster again while disabled - it should remain disabled and not throw
    await app.clusterBtn.click(); // second click should be ignored by the page logic when disabled

    // Trigger resize which has a handler to cancel animationFrame and redraw
    await app.triggerResize();

    // Allow a small delay for the app's resize handler to run
    await page.waitForTimeout(500);

    // No page errors should have been recorded
    expect(pageErrors.length, `Expected no page errors after repeated clicks and resize, but got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length, `Expected no console.error messages after repeated clicks and resize, but got: ${JSON.stringify(errorConsoleMessages)}`).toBe(0);

    // Finally reset to ensure app returns to idle cleanly
    await app.clickReset();
    await expect.poll(async () => !(await app.isClusterInfoVisible()), { timeout: 2000 }).toBe(true);
  });

  test('Behavioral assertions for FSM entry/exit: init() invoked on load and kMeansStep on cluster click', async ({ page }) => {
    // This test attempts to observe the evidence of onEnter/onExit actions via DOM side-effects:
    // - init() creates points/centroids and draws (we validate that canvas exists and cluster-info is not visible)
    // - clicking cluster triggers kMeansStep which assigns clusters and makes cluster-info visible
    // Note: The internal functions are in closure scope and not accessible directly; we assert via visible UI effects.

    const app = new KMeansPage(page);
    await app.goto();

    // init() is expected to have run on DOMContentLoaded: canvas present and cluster-info hidden
    expect(await app.canvas.isVisible()).toBe(true);
    expect(await app.isClusterInfoVisible()).toBe(false);

    // Start clustering which should trigger kMeansStep() and therefore assignment & UI changes
    await app.clickCluster();

    // cluster-info should become visible as the UI-level evidence of kMeansStep running
    await page.waitForSelector('.cluster-info.visible', { timeout: 2000 });
    expect(await app.isClusterInfoVisible()).toBe(true);

    // No uncaught exceptions expected during these entry/exit actions
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });
});