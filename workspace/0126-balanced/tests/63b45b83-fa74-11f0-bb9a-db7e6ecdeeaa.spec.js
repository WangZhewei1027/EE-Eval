import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b45b83-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the K-Means page
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.canvas = page.locator('#canvas');
    this.generateBtn = page.locator('#generateBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.runBtn = page.locator('#runBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.clustersInput = page.locator('#clusters');
    this.pointsInput = page.locator('#points');
    this.legend = page.locator('#legend');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers
  async getLegendCount() {
    return await this.page.evaluate(() => document.getElementById('legend').children.length);
  }

  async isDisabled(locator) {
    return await locator.evaluate((el) => el.disabled === true);
  }

  async getCanvasDataURL() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('canvas');
      try {
        return c.toDataURL();
      } catch (e) {
        return null;
      }
    });
  }

  async setClusters(value) {
    await this.clustersInput.fill(String(value));
  }

  async setPoints(value) {
    await this.pointsInput.fill(String(value));
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Wait for dialog with a specific substring in message (returns message or null)
  async waitForDialogSubstring(substring, timeout = 3000) {
    try {
      const dialog = await this.page.waitForEvent('dialog', { timeout });
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    } catch (e) {
      return null;
    }
  }
}

test.describe('K-Means Clustering Demo - FSM tests (63b45b83-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Capture console errors and page errors to assert no runtime exceptions occurred
  /** @type {Array<string>} */
  let consoleErrors;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test assert there were no uncaught page errors or console.error messages
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial state (S0_Idle) - canvas shows intro, controls are in idle configuration', async ({ page }) => {
    // Validate the initial (Idle) state: buttons disabled, legend empty, canvas present
    const km = new KMeansPage(page);
    await km.goto();

    // Comments: Verifies S0_Idle entry_actions draw() resulted in initial text and UI disabled controls
    // generateBtn should be enabled (usable), others disabled
    expect(await km.isDisabled(km.generateBtn)).toBe(false);
    expect(await km.isDisabled(km.stepBtn)).toBe(true);
    expect(await km.isDisabled(km.runBtn)).toBe(true);
    expect(await km.isDisabled(km.resetBtn)).toBe(true);

    // Legend should be empty initially (no clusters shown)
    const legendCount = await km.getLegendCount();
    expect(legendCount).toBe(0);

    // Canvas should exist and return a valid dataURL
    const dataURL = await km.getCanvasDataURL();
    expect(typeof dataURL).toBe('string');
    expect(dataURL.length).toBeGreaterThan(100); // some content present
  });

  test('Generate Points (S0 -> S1) - enables controls, populates legend and draws points', async ({ page }) => {
    const km1 = new KMeansPage(page);
    await km.goto();

    // Capture canvas before generating to compare changes
    const before = await km.getCanvasDataURL();

    // Set parameters and click Generate Points
    await km.setClusters(4);
    await km.setPoints(50);

    // No dialog expected for valid inputs, click and proceed
    await km.clickGenerate();

    // After generating, buttons step/run/reset should be enabled
    expect(await km.isDisabled(km.stepBtn)).toBe(false);
    expect(await km.isDisabled(km.runBtn)).toBe(false);
    expect(await km.isDisabled(km.resetBtn)).toBe(false);

    // Legend should show 4 clusters
    const legendCount1 = await km.getLegendCount();
    expect(legendCount).toBe(4);

    // Canvas should have redrawn and differ from initial dataURL
    const after = await km.getCanvasDataURL();
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });

  test('Next Step (S1 -> S2) - performing a single step updates the visualization (and may converge)', async ({ page }) => {
    const km2 = new KMeansPage(page);
    await km.goto();

    // Use a small and deterministic config to make the test fast
    await km.setClusters(3);
    await km.setPoints(30);
    await km.clickGenerate();

    // Capture canvas snapshot before step
    const beforeStep = await km.getCanvasDataURL();

    // Prepare to catch a convergence alert if it happens
    const dialogPromise = page.waitForEvent('dialog', { timeout: 1500 }).catch(() => null);

    // Perform one step
    await km.clickStep();

    const dialog1 = await dialogPromise;
    if (dialog) {
      // If an alert happened, ensure it is the convergence alert and that buttons were disabled
      expect(dialog.message()).toContain('Clustering converged!');
      await dialog.accept();

      expect(await km.isDisabled(km.stepBtn)).toBe(true);
      expect(await km.isDisabled(km.runBtn)).toBe(true);
    } else {
      // If no alert, verify visualization updated and controls remain enabled (user can continue stepping)
      const afterStep = await km.getCanvasDataURL();
      expect(afterStep).not.toBeNull();
      expect(afterStep).not.toBe(beforeStep);

      // Step and Run should still be enabled unless converged
      expect(await km.isDisabled(km.stepBtn)).toBe(false);
      expect(await km.isDisabled(km.runBtn)).toBe(false);
    }
  });

  test('Run to End (S1 -> S2 -> S3) - run finishes clustering and alerts convergence', async ({ page }) => {
    const km3 = new KMeansPage(page);
    await km.goto();

    // Use smaller number of points to make convergence faster for the test
    await km.setClusters(3);
    await km.setPoints(25);
    await km.clickGenerate();

    // Listen for the convergence dialog, which should appear as runBtn runs to completion
    const dialogPromise1 = page.waitForEvent('dialog', { timeout: 5000 });

    await km.clickRun();

    // Verify convergence dialog occurred and has expected text
    const dialog2 = await dialogPromise;
    expect(dialog).not.toBeNull();
    expect(dialog.message()).toContain('Clustering converged!');
    await dialog.accept();

    // After convergence, step and run should be disabled
    expect(await km.isDisabled(km.stepBtn)).toBe(true);
    expect(await km.isDisabled(km.runBtn)).toBe(true);
  });

  test('Reset (S1 -> S4) - Reset clears visualization and disables interaction', async ({ page }) => {
    const km4 = new KMeansPage(page);
    await km.goto();

    // Generate points first
    await km.setClusters(3);
    await km.setPoints(40);
    await km.clickGenerate();

    // Ensure legend populated and controls enabled before reset
    expect(await km.getLegendCount()).toBe(3);
    expect(await km.isDisabled(km.resetBtn)).toBe(false);

    // Capture canvas data before reset
    const beforeReset = await km.getCanvasDataURL();

    // Click reset
    await km.clickReset();

    // After reset, legend should be empty
    const legendCount2 = await km.getLegendCount();
    expect(legendCount).toBe(0);

    // Controls should be disabled (except generate)
    expect(await km.isDisabled(km.stepBtn)).toBe(true);
    expect(await km.isDisabled(km.runBtn)).toBe(true);
    expect(await km.isDisabled(km.resetBtn)).toBe(true);

    // Canvas should be cleared (dataURL likely changed)
    const afterReset = await km.getCanvasDataURL();
    expect(afterReset).not.toBeNull();
    // It is acceptable if the canvas changed; ensure it does not equal the previous drawing
    expect(afterReset).not.toBe(beforeReset);
  });

  test('Input validation errors produce alerts - clusters and points out of range and non-number', async ({ page }) => {
    const km5 = new KMeansPage(page);
    await km.goto();

    // 1) clusters=0 -> alert about clusters
    await km.setClusters(0);
    await km.setPoints(50);

    // Wait for dialog and assert message
    const dialog1 = await page.waitForEvent('dialog', { timeout: 2000 });
    expect(dialog1.message()).toContain('Clusters (k) must be a number between 1 and 10.');
    await dialog1.accept();

    // 2) points too small -> alert about points
    await km.setClusters(3);
    await km.setPoints(5);

    const dialog2 = await page.waitForEvent('dialog', { timeout: 2000 });
    expect(dialog2.message()).toContain('Points must be a number between 10 and 1000.');
    await dialog2.accept();

    // 3) non-numeric clusters should also trigger clusters validation
    await km.setClusters('abc');
    await km.setPoints(20);

    const dialog3 = await page.waitForEvent('dialog', { timeout: 2000 });
    expect(dialog3.message()).toContain('Clusters (k) must be a number between 1 and 10.');
    await dialog3.accept();
  });

  test('Edge case: Generate then immediately Run - handles rapid workflow without exceptions', async ({ page }) => {
    const km6 = new KMeansPage(page);
    await km.goto();

    // Rapidly generate and run to check for race conditions
    await km.setClusters(2);
    await km.setPoints(20);

    // Click generate
    await km.clickGenerate();

    // Immediately click run
    const dialogPromise2 = page.waitForEvent('dialog', { timeout: 5000 });
    await km.clickRun();

    // Expect convergence dialog and that no runtime errors occurred
    const dialog3 = await dialogPromise;
    expect(dialog).not.toBeNull();
    expect(dialog.message()).toContain('Clustering converged!');
    await dialog.accept();

    // Verify controls disabled after completion
    expect(await km.isDisabled(km.stepBtn)).toBe(true);
    expect(await km.isDisabled(km.runBtn)).toBe(true);
  });
});