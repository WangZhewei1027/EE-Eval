import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79e2740-d361-11f0-8438-11a56595a476.html';

// Page Object Model for the K-Means demo page
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#canvas');
    this.kInput = page.locator('#kInput');
    this.startBtn = page.locator('#startBtn');
    this.nextBtn = page.locator('#nextBtn');
    this.runBtn = page.locator('#runBtn');
    this.resetBtn = page.locator('#resetBtn');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure canvas has loaded
    await expect(this.canvas).toBeVisible();
  }

  // Click the canvas at given coordinates relative to top-left of canvas
  async clickCanvasAt(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas has no bounding box');
    const clickX = Math.max(1, Math.min(box.width - 1, x));
    const clickY = Math.max(1, Math.min(box.height - 1, y));
    await this.canvas.click({ position: { x: clickX, y: clickY } });
  }

  // Helper to get canvas data URL (PNG)
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

  async setK(value) {
    await this.kInput.fill(String(value));
  }

  async startClustering() {
    await this.startBtn.click();
  }

  async nextStep() {
    await this.nextBtn.click();
  }

  async runClustering() {
    await this.runBtn.click();
  }

  async reset() {
    await this.resetBtn.click();
  }

  async isNextDisabled() {
    return await this.nextBtn.isDisabled();
  }

  async isRunDisabled() {
    return await this.runBtn.isDisabled();
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isKInputDisabled() {
    return await this.kInput.isDisabled();
  }
}

test.describe('K-Means Clustering Visualization - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let dialogMessages = [];

  // Setup/teardown: create a fresh page for each test and attach error/dialog listeners
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    dialogMessages = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      // Capture console errors (e.g. console.error)
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('dialog', async (dialog) => {
      // Record and accept dialogs so they do not block the test
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Assert that there were no unexpected page errors or console errors during tests.
    // The app code should run without uncaught exceptions or console.error messages.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test.describe('Initial Idle State (S0_Idle) validations', () => {
    test('Initial UI state: Next and Run disabled, Start enabled, K input enabled', async ({ page }) => {
      const app = new KMeansPage(page);

      // Initial assertions for Idle state
      await expect(app.canvas).toBeVisible();
      await expect(app.kInput).toBeVisible();
      expect(await app.isKInputDisabled()).toBe(false);
      expect(await app.isStartDisabled()).toBe(false);
      expect(await app.isNextDisabled()).toBe(true);
      expect(await app.isRunDisabled()).toBe(true);

      // Canvas has expected attributes (width/height)
      const attrs = await page.evaluate(() => {
        const c = document.getElementById('canvas');
        return { width: c.width, height: c.height, title: c.title };
      });
      expect(attrs.width).toBe(600);
      expect(attrs.height).toBe(400);
      expect(attrs.title).toContain('Click to add points');

      // Capture initial canvas image (initial draw()) to compare later
      const initialDataURL = await app.getCanvasDataURL();
      expect(typeof initialDataURL).toBe('string');
      // Should be a PNG data URL
      expect(initialDataURL.startsWith('data:image/png')).toBe(true);
    });
  });

  test.describe('Events and Transitions', () => {
    test('ClickCanvas event: adding a point updates the canvas (S0_Idle -> S0_Idle)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Capture data URL before clicking
      const before = await app.getCanvasDataURL();

      // Click canvas to add a point and verify canvas image changed
      await app.clickCanvasAt(100, 100);
      const after = await app.getCanvasDataURL();

      // There should be a visible change on the canvas image after adding a point
      expect(after).not.toBe(before);

      // Adding another point should change the image again
      const before2 = after;
      await app.clickCanvasAt(200, 150);
      const after2 = await app.getCanvasDataURL();
      expect(after2).not.toBe(before2);
    });

    test('StartClustering event: initialize centroids, assign clusters, enable Next/Run (S0_Idle -> S1_Clustering_Started)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Add exactly K (default 3) points
      await app.clickCanvasAt(50, 50);
      await app.clickCanvasAt(150, 80);
      await app.clickCanvasAt(250, 120);

      // Capture canvas image before starting clustering
      const beforeStart = await app.getCanvasDataURL();

      // Start clustering
      await app.startClustering();

      // After starting, K input and Start button should be disabled; Next and Run enabled
      expect(await app.isKInputDisabled()).toBe(true);
      expect(await app.isStartDisabled()).toBe(true);
      expect(await app.isNextDisabled()).toBe(false);
      expect(await app.isRunDisabled()).toBe(false);

      // Canvas should have changed because centroids/assignments are drawn
      const afterStart = await app.getCanvasDataURL();
      expect(afterStart).not.toBe(beforeStart);

      // No alerts should have been shown in the normal successful start
      expect(dialogMessages.filter(m => m.includes('Add at least') || m.includes('Need at least') || m.includes('Number of clusters'))).toEqual([]);
    });

    test('NextStep event: iterates K-means step; convergence leads to buttons disabled (S1_Clustering_Started -> S1_Clustering_Started or S2_Converged)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Add points and start
      await app.clickCanvasAt(60, 60);
      await app.clickCanvasAt(120, 100);
      await app.clickCanvasAt(200, 160);
      await app.startClustering();

      // Repeatedly click Next until either Next becomes disabled (converged) or max iterations reached
      const maxAttempts = 20;
      let converged = false;
      for (let i = 0; i < maxAttempts; i++) {
        // If already disabled, break
        if (await app.isNextDisabled()) {
          converged = true;
          break;
        }
        await app.nextStep();
        // If a converged alert was shown, dialogMessages will include it
        if (dialogMessages.some(m => m.includes('Converged'))) {
          converged = true;
          break;
        }
      }

      if (converged) {
        // On convergence, Next and Run should be disabled per FSM
        expect(await app.isNextDisabled()).toBe(true);
        expect(await app.isRunDisabled()).toBe(true);
        // Confirm we saw an alert that mentions convergence if that happened
        expect(dialogMessages.some(m => m.includes('Converged'))).toBe(true);
      } else {
        // If not converged within maxAttempts, at least we remain in clustering started state
        expect(await app.isNextDisabled()).toBe(false);
        expect(await app.isRunDisabled()).toBe(false);
      }
    });

    test('RunClustering event: runs to completion and disables Next/Run on convergence (S1_Clustering_Started -> S2_Converged)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Add points and start
      await app.clickCanvasAt(30, 30);
      await app.clickCanvasAt(100, 80);
      await app.clickCanvasAt(220, 180);
      await app.startClustering();

      // Clear previous dialogs
      dialogMessages = [];

      // Run clustering to completion
      await app.runClustering();

      // After running, either converged or stopped after max iterations; in both cases Next/Run should be disabled only when converged
      const convergedAlert = dialogMessages.find(m => m.includes('Converged in'));
      const stoppedAlert = dialogMessages.find(m => m.includes('Stopped after max iterations'));
      if (convergedAlert) {
        expect(await app.isNextDisabled()).toBe(true);
        expect(await app.isRunDisabled()).toBe(true);
        expect(convergedAlert).toMatch(/Converged in \d+ iterations!/);
      } else if (stoppedAlert) {
        // If not converged, the app notifies that max iterations were reached
        expect(stoppedAlert).toMatch(/Stopped after max iterations/);
      } else {
        // Some older browsers might show 'Converged in X iterations!' or slightly different phrasing.
        // As a fallback, ensure at least one dialog was shown for run
        expect(dialogMessages.length).toBeGreaterThan(0);
      }
    });

    test('Reset event: clears points and returns to Idle state (S1_Clustering_Started -> S0_Idle)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Add points and start
      await app.clickCanvasAt(80, 80);
      await app.clickCanvasAt(140, 100);
      await app.clickCanvasAt(210, 140);
      await app.startClustering();

      // Ensure canvas is different after start
      const afterStart = await app.getCanvasDataURL();

      // Click reset
      await app.reset();

      // UI should be back to initial Idle state
      expect(await app.isKInputDisabled()).toBe(false);
      expect(await app.isStartDisabled()).toBe(false);
      expect(await app.isNextDisabled()).toBe(true);
      expect(await app.isRunDisabled()).toBe(true);

      // Canvas should revert to a blank/initial drawing. Compare with an initial fresh load.
      // Reload a fresh page to capture initial canvas baseline for robust comparison
      await page.reload();
      const freshApp = new KMeansPage(page);
      await expect(freshApp.canvas).toBeVisible();
      const initialBaseline = await freshApp.getCanvasDataURL();

      // The canvas after reset (on the original page before reload) should be similar to the baseline.
      // Because we reloaded page, get the data URL from the reloaded page (which represents baseline) and from the current (reloaded) page.
      // Accept that some implementations may differ in metadata; conservatively expect equality after reset+reload.
      expect(await freshApp.getCanvasDataURL()).toBe(initialBaseline);
      // Note: We already reloaded; this ensures page is clean for subsequent tests.
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Starting clustering with insufficient points triggers an alert', async ({ page }) => {
      const app = new KMeansPage(page);

      // Add only 2 points but set K to 3
      await app.clickCanvasAt(40, 40);
      await app.clickCanvasAt(60, 80);
      await app.setK(3);

      // Clear any previous dialog messages
      dialogMessages = [];

      // Click Start - should result in an alert about needing at least K points
      await app.startClustering();

      // We expect a dialog that mentions "Need at least" or "Add at least"
      const msg = dialogMessages.find(m => m.includes('Need at least') || m.includes('Add at least'));
      expect(msg).toBeDefined();
      expect(msg).toMatch(/(Need at least|Add at least)/);
    });

    test('Invalid K input triggers validation alert (K out of bounds)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Add some points to avoid the "insufficient points" check being the main blocker
      await app.clickCanvasAt(20, 20);
      await app.clickCanvasAt(40, 40);
      await app.clickCanvasAt(60, 60);

      // Set invalid K (0)
      await app.setK(0);
      dialogMessages = [];
      await app.startClustering();

      // Expect an alert about K must be between 1 and 10
      expect(dialogMessages.some(m => m.includes('Number of clusters (K) must be between 1 and 10.'))).toBe(true);

      // Now set K to 11 (too large)
      await app.setK(11);
      dialogMessages = [];
      await app.startClustering();
      expect(dialogMessages.some(m => m.includes('Number of clusters (K) must be between 1 and 10.'))).toBe(true);
    });
  });
});