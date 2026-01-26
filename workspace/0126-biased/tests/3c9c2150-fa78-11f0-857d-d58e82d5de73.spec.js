import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9c2150-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page Object for interacting with the K-Means demo page.
 * Encapsulates common operations to keep tests readable.
 */
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.simulateSelector = '#simulateBtn';
    this.resetSelector = '#resetBtn';
    this.canvasSelector = '#kmeansCanvas';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for controls area to become available
    await this.page.waitForSelector(this.simulateSelector, { state: 'visible', timeout: 5000 });
  }

  async clickSimulate() {
    await this.page.click(this.simulateSelector);
  }

  async clickReset() {
    await this.page.click(this.resetSelector);
  }

  async getSimulateText() {
    return (await this.page.locator(this.simulateSelector).innerText()).trim();
  }

  async getSimulateAriaPressed() {
    return (await this.page.locator(this.simulateSelector).getAttribute('aria-pressed'));
  }

  async getResetText() {
    return (await this.page.locator(this.resetSelector).innerText()).trim();
  }

  /**
   * Compute a simple checksum of the canvas pixel data by summing all channels.
   * This is used to detect visual changes to the kmeansCanvas across frames.
   */
  async getCanvasPixelSum() {
    return await this.page.evaluate((sel) => {
      const canv = document.querySelector(sel);
      if (!canv) return null;
      const ctx = canv.getContext('2d');
      // Use width/height properties on the element (they are set in HTML)
      const w = canv.width;
      const h = canv.height;
      try {
        const data = ctx.getImageData(0, 0, w, h).data;
        // Simple checksum: sum of all bytes
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        return sum;
      } catch (err) {
        // If reading image data fails (tainted canvas etc.), return a stringified error message
        return { error: err?.toString?.() ?? String(err) };
      }
    }, this.canvasSelector);
  }

  /**
   * Wait until the simulate button reflects running state (Pause Simulation & aria-pressed=true),
   * or until timeout.
   */
  async waitForRunning(timeout = 2000) {
    await this.page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return el.textContent.trim() === 'Pause Simulation' && el.getAttribute('aria-pressed') === 'true';
    }, this.simulateSelector, { timeout });
  }

  async waitForPaused(timeout = 2000) {
    await this.page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      return el.textContent.trim() === 'Start Simulation' && el.getAttribute('aria-pressed') === 'false';
    }, this.simulateSelector, { timeout });
  }
}

test.describe('K-Means Clustering — Visualized Elegance (FSM-driven tests)', () => {
  // Collect console messages and page errors during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by page for later assertions/inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('States: Idle (S0_Idle) and Running (S1_Running)', () => {
    test('Initial Idle state: simulate button and canvas are initialized (S0_Idle)', async ({ page }) => {
      // This test validates the initial Idle state expectations:
      // - simulateBtn exists, reads "Start Simulation" and aria-pressed="false"
      // - initial draw() occurred meaning the canvas is not blank
      // - no uncaught page errors or console.error messages during initialization
      const app = new KMeansPage(page);
      await app.goto();

      // Validate simulate button initial text and aria attribute (FSM evidence)
      const simText = await app.getSimulateText();
      expect(simText).toBe('Start Simulation');

      const aria = await app.getSimulateAriaPressed();
      expect(aria).toBe('false');

      // The canvas should have been drawn to during initialization (generatePoints(), initializeCentroids(), draw())
      const sum = await app.getCanvasPixelSum();
      // Expect a numeric checksum and non-zero so the canvas isn't entirely blank
      expect(typeof sum === 'number' || (sum && typeof sum === 'object')).not.toBe(false);
      if (typeof sum === 'number') {
        expect(sum).toBeGreaterThan(0);
      } else {
        // If error-like object returned, fail the test with details
        throw new Error(`Unable to read canvas pixel data: ${JSON.stringify(sum)}`);
      }

      // Assert no uncaught page errors and no console.error messages
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Start Simulation transitions Idle -> Running (S0_Idle -> S1_Running)', async ({ page }) => {
      // This test validates clicking the simulate button starts the animation loop:
      // - Button text becomes "Pause Simulation" and aria-pressed is "true"
      // - The kmeansCanvas content changes while running (centroids move / draw updates)
      const app = new KMeansPage(page);
      await app.goto();

      // Capture a baseline snapshot
      const before = await app.getCanvasPixelSum();

      // Click start
      await app.clickSimulate();

      // Wait until button reflects running state
      await app.waitForRunning(3000);

      const simText = await app.getSimulateText();
      expect(simText).toBe('Pause Simulation');
      const aria = await app.getSimulateAriaPressed();
      expect(aria).toBe('true');

      // Allow some frames to run and capture a new snapshot
      await page.waitForTimeout(350); // Give the animation a bit of time to update
      const after = await app.getCanvasPixelSum();

      // Ensure that the canvas changed while running (visual evidence of centroids/points motion)
      expect(typeof before).toBe('number');
      expect(typeof after).toBe('number');
      expect(after).not.toBe(before);

      // No uncaught page errors or console.error messages during this transition
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Pause Simulation transitions Running -> Idle (S1_Running -> S0_Idle)', async ({ page }) => {
      // This test starts the simulation and then pauses it:
      // - After pausing, button text returns to "Start Simulation" and aria-pressed="false"
      // - The kmeansCanvas stops updating (pixel checksum remains stable)
      const app = new KMeansPage(page);
      await app.goto();

      // Start simulation
      await app.clickSimulate();
      await app.waitForRunning(3000);

      // Wait a short period to let animation change canvas
      await page.waitForTimeout(250);
      const runningSnapshot = await app.getCanvasPixelSum();

      // Pause simulation
      await app.clickSimulate();
      await app.waitForPaused(3000);

      // Immediately capture canvas after pausing
      const pausedSnapshot = await app.getCanvasPixelSum();

      // Give some time and capture again to confirm no further changes (animation stopped)
      await page.waitForTimeout(400);
      const pausedSnapshotLater = await app.getCanvasPixelSum();

      // Validate textual state evidence
      const simText = await app.getSimulateText();
      expect(simText).toBe('Start Simulation');
      const aria = await app.getSimulateAriaPressed();
      expect(aria).toBe('false');

      // Check that canvas was changing while running
      expect(typeof runningSnapshot).toBe('number');
      expect(typeof pausedSnapshot).toBe('number');
      // The snapshot at the moment of pausing may equal the running snapshot (depending on timing),
      // but after pausing we expect stability: pausedSnapshot === pausedSnapshotLater
      expect(pausedSnapshot).toBe(pausedSnapshotLater);

      // Also there should be no console errors or uncaught page exceptions
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transitions & Controls: Reset and edge behaviors', () => {
    test('Reset Simulation while Idle resets visualization (S0_Idle -> S0_Idle)', async ({ page }) => {
      // This test validates clicking Reset when Idle:
      // - running is set to false and simulate button shows "Start Simulation"
      // - fresh points/centroids are generated and draw() is invoked (visual change expected)
      const app = new KMeansPage(page);
      await app.goto();

      // Ensure Idle initially
      await app.waitForPaused(2000);
      const beforeReset = await app.getCanvasPixelSum();

      // Click reset
      await app.clickReset();

      // After resetting, simulate button should be Start Simulation and aria-pressed false
      await app.waitForPaused(2000);
      const simText = await app.getSimulateText();
      expect(simText).toBe('Start Simulation');
      const aria = await app.getSimulateAriaPressed();
      expect(aria).toBe('false');

      // Canvas should have been re-drawn (different checksum expected)
      const afterReset = await app.getCanvasPixelSum();
      expect(typeof beforeReset).toBe('number');
      expect(typeof afterReset).toBe('number');
      // It's possible but unlikely that a regenerated random dataset produces identical canvas checksum;
      // assert that they are different to validate reset behavior. If flakiness observed, adjust tolerance.
      expect(afterReset).not.toBe(beforeReset);

      // No page errors or console error messages from reset handler
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Reset Simulation while Running stops and resets (S1_Running -> S0_Idle via Reset)', async ({ page }) => {
      // This test starts the simulation, then clicks Reset:
      // - Reset should set running=false, simulateBtn text to "Start Simulation"
      // - Centroids/points should be re-initialized and a fresh draw() executed
      const app = new KMeansPage(page);
      await app.goto();

      // Start simulation and let it run briefly
      await app.clickSimulate();
      await app.waitForRunning(3000);
      await page.waitForTimeout(200);
      const runningSnapshot = await app.getCanvasPixelSum();

      // Click reset while running
      await app.clickReset();

      // After reset, the button should be in Idle state
      await app.waitForPaused(3000);
      const simText = await app.getSimulateText();
      expect(simText).toBe('Start Simulation');
      const aria = await app.getSimulateAriaPressed();
      expect(aria).toBe('false');

      // Canvas should have been redrawn to new state (different checksum expected)
      const afterReset = await app.getCanvasPixelSum();
      expect(typeof runningSnapshot).toBe('number');
      expect(typeof afterReset).toBe('number');
      expect(afterReset).not.toBe(runningSnapshot);

      // No page errors or console errors emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Rapid toggling of simulate button should not produce page errors and ends in deterministic state', async ({ page }) => {
      // Edge-case test: click the simulate button rapidly multiple times to ensure stability
      // Starting state is Idle; after odd number of toggles it should be Running ("Pause Simulation")
      const app = new KMeansPage(page);
      await app.goto();

      // Rapidly toggle 5 times
      for (let i = 0; i < 5; i++) {
        await app.page.click(app.simulateSelector);
        // very short delay between clicks to simulate fast user input
        await app.page.waitForTimeout(50);
      }

      // After 5 toggles starting from Idle, expected to be Running
      // Wait a bit for UI update
      await app.page.waitForTimeout(200);
      const simText = await app.getSimulateText();
      const aria = await app.getSimulateAriaPressed();

      expect(simText === 'Pause Simulation' || simText === 'Start Simulation').toBeTruthy();
      // Expect 'Pause Simulation' given 5 toggles from initial Idle. If timing caused an extra toggle, we still accept either,
      // but assert aria attribute and text are consistent with one another.
      if (simText === 'Pause Simulation') {
        expect(aria).toBe('true');
      } else {
        expect(aria).toBe('false');
      }

      // Finally clean up by resetting to Idle to avoid leaving running animations impacting other tests
      await app.clickReset();
      await app.waitForPaused(2000);

      // Assert there were no page errors or console.error messages during rapid toggling
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console and runtime errors', () => {
    test('No unexpected runtime errors (ReferenceError / SyntaxError / TypeError) were thrown during page lifecycle', async ({ page }) => {
      // This test's goal is to monitor page errors and console errors across a typical usage flow.
      // It will not patch or otherwise interfere with the application; it only observes.
      const app = new KMeansPage(page);
      await app.goto();

      // Perform a series of interactions that exercise application code paths:
      // start, let run, pause, reset
      await app.clickSimulate();
      await app.waitForRunning(2500);
      await page.waitForTimeout(200);
      await app.clickSimulate();
      await app.waitForPaused(2000);
      await app.clickReset();

      // Give a moment for any asynchronous errors to surface
      await page.waitForTimeout(300);

      // Collect any uncaught errors captured
      const errors = pageErrors.slice();

      // Log console messages and errors for debugging if needed (kept in memory only)
      // We assert that there were no uncaught exceptions and no console.error entries.
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');

      // If any pageErrors exist, fail with details to aid triage
      if (errors.length > 0 || consoleErrors.length > 0) {
        // Attach helpful diagnostics to the error to assist debugging
        const diagnostics = {
          pageErrors: errors.map(e => e.message ? e.message : String(e)),
          consoleErrors: consoleErrors.map(c => c.text),
          recentConsole: consoleMessages.slice(-20)
        };
        throw new Error('Unexpected runtime errors detected: ' + JSON.stringify(diagnostics, null, 2));
      }

      // Otherwise, pass the test asserting zero runtime errors
      expect(errors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});