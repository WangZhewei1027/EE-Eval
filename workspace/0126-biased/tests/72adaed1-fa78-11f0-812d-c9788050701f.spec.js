import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72adaed1-fa78-11f0-812d-c9788050701f.html';

// Page object encapsulating interactions and queries for the KNN visualization page
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.newPointBtn = page.locator('#newPointBtn');
    this.infoBtn = page.locator('#infoBtn');
    this.visualization = page.locator('#visualization');
    this.infoPanel = page.locator('#infoPanel');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for DOMContentLoaded and some initial rendering (initial points should be present)
    await this.page.waitForSelector('#visualization');
    // ensure JS in page had a chance to create initial points
    await this.page.waitForTimeout(100);
  }

  async clickAddRandomPoint() {
    await this.newPointBtn.click();
  }

  async clickInfoBtn() {
    await this.infoBtn.click();
  }

  async countPoints() {
    return await this.page.$$eval('#visualization .point', els => els.length);
  }

  async countNewPoints() {
    return await this.page.$$eval('#visualization .point.new', els => els.length);
  }

  async countConnections() {
    return await this.page.$$eval('#visualization .connection', els => els.length);
  }

  async countNeighborsMarked() {
    return await this.page.$$eval('#visualization .point.neighbor', els => els.length);
  }

  async isInfoPanelVisible() {
    return await this.infoPanel.evaluate(el => el.classList.contains('visible'));
  }

  async getNewPointBackgroundColor() {
    // returns computed background-color of the .point.new element, or null if none
    return await this.page.$eval('#visualization .point.new', el => {
      const style = window.getComputedStyle(el);
      return style.backgroundColor;
    }).catch(() => null);
  }

  async waitForNewPoint(timeout = 3000) {
    await this.page.waitForSelector('#visualization .point.new', { timeout });
  }

  async waitForConnectionsCountAtLeast(n, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, min) => document.querySelectorAll(sel).length >= min,
      '#visualization .connection',
      n,
      { timeout }
    );
  }
}

test.describe('K-Nearest Neighbors Visualization - FSM driven tests', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {KNNPage} */
  let knn;
  /** @type {Array<string>} */
  let consoleErrors;
  /** @type {Array<Error>} */
  let pageErrors;
  /** @type {Array<string>} */
  let consoleLogs;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    knn = new KNNPage(page);
    consoleErrors = [];
    pageErrors = [];
    consoleLogs = [];

    // Collect console messages and errors to observe runtime behavior
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      // record errors and logs separately
      if (type === 'error') consoleErrors.push(text);
      consoleLogs.push(`[${type}] ${text}`);
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // capture full error object / message
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await knn.goto();
  });

  test.afterEach(async () => {
    // Close page
    await page.close();
  });

  test('Idle state: page renders controls and initial visualization (S0_Idle)', async () => {
    // This test validates the Idle state entry: page renders header, controls, visualization and info panel exists but hidden.
    // Verify the control buttons exist
    await expect(knn.newPointBtn).toBeVisible();
    await expect(knn.infoBtn).toBeVisible();

    // Visualization container exists
    await expect(knn.visualization).toBeVisible();

    // Info panel exists but should not be visible initially (no 'visible' class)
    const visible = await knn.isInfoPanelVisible();
    expect(visible).toBe(false);

    // There should be initial points rendered (the implementation creates 30 points)
    const pointCount = await knn.countPoints();
    expect(pointCount).toBeGreaterThanOrEqual(20); // tolerate variance but expect many initial points

    // Ensure no uncaught page errors of critical JS types were emitted during initial load
    // We assert that no uncaught page errors like ReferenceError/SyntaxError/TypeError occurred.
    const foundCriticalError = pageErrors.some(e =>
      e && (e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError')
    );
    expect(foundCriticalError).toBe(false);
  });

  test('Toggle Info Panel transitions: show and hide (S0_Idle -> S2_InfoPanelVisible -> S0_Idle)', async () => {
    // This test validates the ToggleInfoPanel event and transitions onEnter/onExit by checking class 'visible' toggling.

    // Initially hidden
    expect(await knn.isInfoPanelVisible()).toBe(false);

    // Click to show info panel
    await knn.clickInfoBtn();

    // After click, the info panel should have 'visible' class
    await page.waitForTimeout(100); // allow transition to take effect
    expect(await knn.isInfoPanelVisible()).toBe(true);

    // Click again to hide
    await knn.clickInfoBtn();
    await page.waitForTimeout(100);
    expect(await knn.isInfoPanelVisible()).toBe(false);

    // Validate that clicking info button didn't produce JS runtime errors
    expect(consoleErrors.length).toBe(0);
    const foundPageError = pageErrors.some(e =>
      e && (e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError')
    );
    expect(foundPageError).toBe(false);
  });

  test('Add Random Point creates a new point, draws connections and marks neighbors (S0_Idle -> S1_NewPointAdded)', async () => {
    // This test validates the AddRandomPoint event: new green point is added, k connections drawn, neighbors highlighted and then classification color is applied.

    // Take initial counts
    const initialNewCount = await knn.countNewPoints();
    expect(initialNewCount).toBe(0);

    // Trigger add
    await knn.clickAddRandomPoint();

    // Wait for new point to appear
    await knn.waitForNewPoint(3000);
    const newCount = await knn.countNewPoints();
    expect(newCount).toBe(1);

    // Implementation uses k = 3 neighbors: expect at least 3 connection elements
    await knn.waitForConnectionsCountAtLeast(3, 3000);
    const connCount = await knn.countConnections();
    expect(connCount).toBeGreaterThanOrEqual(3);

    // Neighbor points should be marked with 'neighbor' class (at least k)
    const neighborCount = await knn.countNeighborsMarked();
    expect(neighborCount).toBeGreaterThanOrEqual(3);

    // Initially new point has green background (CSS class .new). After classification (setTimeout 1s) its background changes to blue or red.
    // Wait >1s for classification to occur and assert computed background is no longer the initial green.
    const initialGreenRGB = 'rgb(46, 204, 113)';
    // Short wait to allow classification timeout (1000ms in source + margin)
    await page.waitForTimeout(1250);

    const bgColor = await knn.getNewPointBackgroundColor();
    // Ensure a new point still exists
    expect(bgColor).not.toBeNull();
    // Background should have changed away from the initial green used for '.point.new'
    expect(bgColor).not.toBe(initialGreenRGB);

    // Also ensure no uncaught page errors while performing add point
    expect(consoleErrors.length).toBe(0);
    const foundCriticalError = pageErrors.some(e =>
      e && (e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError')
    );
    expect(foundCriticalError).toBe(false);
  });

  test('Edge case: adding multiple new points in succession cleans previous new point and connections', async () => {
    // This test validates that addNewPoint removes existing '.point.new' and '.connection' elements before adding new ones.

    // Click once
    await knn.clickAddRandomPoint();
    await knn.waitForNewPoint(3000);
    await page.waitForTimeout(1200); // let classification happen

    const newCount1 = await knn.countNewPoints();
    const connCount1 = await knn.countConnections();
    expect(newCount1).toBe(1);
    expect(connCount1).toBeGreaterThanOrEqual(3);

    // Click again quickly to create a second new point
    await knn.clickAddRandomPoint();

    // Wait for the new one to appear and previous removed
    await knn.waitForNewPoint(3000);
    await page.waitForTimeout(1200);

    const newCount2 = await knn.countNewPoints();
    const connCount2 = await knn.countConnections();

    // There should still only be a single '.point.new' in the DOM after the second click
    expect(newCount2).toBe(1);

    // Connections should reflect only the latest addition (at least k)
    expect(connCount2).toBeGreaterThanOrEqual(3);

    // Ensure old neighbor classes do not accumulate infinitely: neighbor count should be reasonable (<= total points)
    const neighborCount = await knn.countNeighborsMarked();
    const totalPoints = await knn.countPoints();
    expect(neighborCount).toBeLessThanOrEqual(totalPoints);

    // No console errors during rapid clicks
    expect(consoleErrors.length).toBe(0);
    const foundCriticalError = pageErrors.some(e =>
      e && (e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError')
    );
    expect(foundCriticalError).toBe(false);
  });

  test('Robustness: interacting with controls repeatedly does not produce uncaught JS errors (error scenario checks)', async () => {
    // This test stresses the controls by toggling info panel and adding points repeatedly,
    // while monitoring for any uncaught errors or console.error messages.

    // Perform a sequence of interactions
    for (let i = 0; i < 5; i++) {
      await knn.clickInfoBtn();
      await page.waitForTimeout(50);
      await knn.clickInfoBtn();
      await page.waitForTimeout(50);
      await knn.clickAddRandomPoint();
      // small delay between rapid interactions
      await page.waitForTimeout(150);
    }

    // Allow any pending timeouts (classification) to run
    await page.waitForTimeout(1500);

    // Collect any console errors and page errors
    // Assert that there are no console.error messages logged
    expect(consoleErrors.length).toBe(0);

    // Assert that there are no uncaught page errors of critical JS types (Reference/Error/TypeError/SyntaxError)
    const criticalPageErrors = pageErrors.filter(e =>
      e && (e.name === 'ReferenceError' || e.name === 'TypeError' || e.name === 'SyntaxError')
    );
    expect(criticalPageErrors.length).toBe(0);

    // As an additional check, if any page error objects exist, ensure their messages are strings (defensive)
    for (const err of pageErrors) {
      expect(typeof (err && err.message)).toBe('string');
    }
  });
});