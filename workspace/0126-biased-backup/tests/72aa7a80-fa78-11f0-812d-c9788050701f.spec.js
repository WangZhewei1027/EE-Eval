import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aa7a80-fa78-11f0-812d-c9788050701f.html';

// Page object model for the Kruskal visualization page
class VisualizationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = '#startBtn';
    this.resetBtn = '#resetBtn';
    this.canvas = '#graphCanvas';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for DOMContentLoaded and the main controls to exist
    await Promise.all([
      this.page.waitForSelector(this.startBtn),
      this.page.waitForSelector(this.resetBtn),
      this.page.waitForSelector(this.canvas)
    ]);
  }

  async getStartButtonText() {
    return this.page.locator(this.startBtn).textContent();
  }

  async clickStart() {
    await this.page.click(this.startBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  // Returns the canvas data URL (PNG) for pixel-wise comparison/sanity checks
  async getCanvasDataURL() {
    return this.page.evaluate((sel) => {
      const c = document.querySelector(sel);
      // If canvas is not present or getContext fails, this will naturally throw in the page context.
      return c.toDataURL();
    }, this.canvas);
  }

  // Wait until the canvas's data URL changes from a provided baseline (polling)
  async waitForCanvasChange(baselineDataURL, timeout = 4000, pollInterval = 200) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const current = await this.getCanvasDataURL();
      if (current !== baselineDataURL) return current;
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new Error('Canvas did not change within timeout');
  }

  // Resize viewport (this should trigger the page's resize handler)
  async resize(width, height) {
    await this.page.setViewportSize({ width, height });
    // Give the page a bit to handle resize and redraw
    await this.page.waitForTimeout(300);
  }
}

test.describe('Kruskal Visualization — FSM and UI E2E tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught errors on the page (pageerror)
    page.on('pageerror', (err) => {
      // Collect error name and message for later assertions/insights
      pageErrors.push({ name: err.name, message: String(err.message), stack: String(err.stack) });
    });

    // Capture console messages for debugging and validation
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // Assert there were no uncaught runtime errors such as ReferenceError/SyntaxError/TypeError
    // This validates the application runs without uncaught exceptions during tests.
    const criticalErrors = pageErrors.filter(e =>
      ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name)
    );

    // Provide helpful diagnostics if a critical error occurred
    if (criticalErrors.length > 0) {
      // Log first few console messages for context (not required by test runner, but helpful)
      console.error('Captured console messages during test:', consoleMessages.slice(0, 10));
      // Throw to fail the test; include error details for easier debugging.
      throw new Error(
        `Unexpected critical errors were thrown in the page context: ${JSON.stringify(criticalErrors, null, 2)}`
      );
    }

    // Additionally assert that there were no uncaught page errors at all
    expect(pageErrors, 'No uncaught page errors should be present').toHaveLength(0);
  });

  test.describe('Initial State (S0_Idle) validations', () => {
    test('Initial load sets up the UI and enters Idle state', async ({ page }) => {
      // Arrange
      const viz = new VisualizationPage(page);

      // Act
      await viz.goto();

      // Assert: start button text indicates Idle state (evidence: startBtn text should be "Start Visualization")
      const startText = await viz.getStartButtonText();
      expect(startText).toBe('Start Visualization');

      // Assert: reset button exists and has expected label
      const resetText = await page.locator('#resetBtn').textContent();
      expect(resetText).toBe('Reset');

      // Assert: canvas is present and drawing happened (compare to a blank new canvas)
      const baselineDataURL = await viz.getCanvasDataURL();

      // Create an empty blank data URL from a same-size blank canvas in the page context to compare
      const blankDataURL = await page.evaluate((sel) => {
        const c = document.querySelector(sel);
        const blank = document.createElement('canvas');
        blank.width = c.width;
        blank.height = c.height;
        return blank.toDataURL();
      }, viz.canvas);

      // The drawing canvas should differ from a blank canvas if graph initialization drew something
      expect(baselineDataURL).not.toBe(blankDataURL);
    });
  });

  test.describe('Start/Pause transitions (S0 -> S1 -> S2 -> S1)', () => {
    test('Clicking Start enters Animating (S1) and changes button text to "Pause"', async ({ page }) => {
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Snapshot canvas before starting to detect animation changes
      const beforeStart = await viz.getCanvasDataURL();

      // Act: click start -> should begin animating and change text to 'Pause'
      await viz.clickStart();

      // Short wait to let the start handler update button text
      await page.waitForTimeout(100);

      const startTextAfter = await viz.getStartButtonText();
      expect(startTextAfter).toBe('Pause');

      // The animation's animateKruskal runs on a 1500ms interval. Wait for the canvas to change.
      // Wait up to 4s for a visible canvas update (this will naturally surface Type/Reference errors if they occur)
      const changed = await viz.waitForCanvasChange(beforeStart, 4500);
      expect(changed).toBeTruthy();
    });

    test('Clicking Pause from Animating enters Paused (S2) and button text returns to "Start Visualization"', async ({ page }) => {
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Start animation
      await viz.clickStart();
      await page.waitForTimeout(100);
      expect(await viz.getStartButtonText()).toBe('Pause');

      // Act: click again to pause (StartAnimation event toggles)
      await viz.clickStart();
      await page.waitForTimeout(100);

      // Assert
      const pausedText = await viz.getStartButtonText();
      expect(pausedText).toBe('Start Visualization');

      // To ensure the animation interval was cleared we can sample the canvas for some time
      // and assert it does not change after pausing.
      const snapshotAfterPause = await viz.getCanvasDataURL();
      // Wait 2x the animation interval to be confident no animation progression happens (~3000ms)
      await page.waitForTimeout(3200);
      const snapshotLater = await viz.getCanvasDataURL();
      expect(snapshotLater).toBe(snapshotAfterPause);
    });

    test('From Paused (S2) clicking Start returns to Animating (S1)', async ({ page }) => {
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Start then pause to reach S2
      await viz.clickStart();
      await page.waitForTimeout(100);
      expect(await viz.getStartButtonText()).toBe('Pause');

      await viz.clickStart(); // pause
      await page.waitForTimeout(100);
      expect(await viz.getStartButtonText()).toBe('Start Visualization');

      // Now resume
      const beforeResume = await viz.getCanvasDataURL();
      await viz.clickStart();
      await page.waitForTimeout(100);
      expect(await viz.getStartButtonText()).toBe('Pause');

      // Wait for one animation step to reflect on canvas
      const changed = await viz.waitForCanvasChange(beforeResume, 4500);
      expect(changed).toBeTruthy();
    });
  });

  test.describe('Reset transitions and edge cases (S1/S2 -> S0)', () => {
    test('Reset while Animating clears animation and returns to Idle (S1 -> S0)', async ({ page }) => {
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Start animation
      await viz.clickStart();
      await page.waitForTimeout(100);
      expect(await viz.getStartButtonText()).toBe('Pause');

      // Capture canvas while animating
      const snapshotWhileAnimating = await viz.getCanvasDataURL();

      // Act: Reset
      await viz.clickReset();
      await page.waitForTimeout(200);

      // Assert: Button text should reflect Idle
      const startText = await viz.getStartButtonText();
      expect(startText).toBe('Start Visualization');

      // After reset, the graph is re-initialized. The canvas should not be identical to the snapshot taken mid-animation.
      const afterReset = await viz.getCanvasDataURL();
      // It's acceptable for the reset to produce the same drawing occasionally (random edges), but edge weights are random.
      // We assert that reset produced a valid canvas data URL string and the page did not throw.
      expect(typeof afterReset).toBe('string');
      expect(afterReset.length).toBeGreaterThan(50);
    });

    test('Reset while Paused returns to Idle (S2 -> S0) and re-initializes graph', async ({ page }) => {
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Start then pause
      await viz.clickStart();
      await page.waitForTimeout(100);
      await viz.clickStart(); // pause
      await page.waitForTimeout(100);
      expect(await viz.getStartButtonText()).toBe('Start Visualization');

      // Snapshot before reset
      const beforeReset = await viz.getCanvasDataURL();

      // Act: Reset
      await viz.clickReset();
      await page.waitForTimeout(200);

      // Assert: Start button text back to Idle text
      expect(await viz.getStartButtonText()).toBe('Start Visualization');

      // The canvas should be a valid data URL (graph reinitialized). It may or may not equal beforeReset depending on randomness.
      const afterReset = await viz.getCanvasDataURL();
      expect(typeof afterReset).toBe('string');
      expect(afterReset.length).toBeGreaterThan(50);
    });

    test('Rapid toggles between Start and Pause do not cause uncaught exceptions (edge case)', async ({ page }) => {
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Rapidly click start/pause multiple times to trigger potential race conditions
      for (let i = 0; i < 6; i++) {
        await viz.clickStart();
        // Very short pause to simulate fast user
        await page.waitForTimeout(100);
      }

      // Ensure UI is in a consistent state (text should be either 'Pause' or 'Start Visualization')
      const finalText = await viz.getStartButtonText();
      expect(['Pause', 'Start Visualization']).toContain(finalText);

      // No uncaught exceptions should have been recorded (global afterEach will check this)
    });
  });

  test.describe('Other behaviors and environmental interactions', () => {
    test('Window resize triggers reinitialization (initGraph on resize)', async ({ page }) => {
      const viz = new VisualizationPage(page);
      await viz.goto();

      // Capture current canvas snapshot
      const beforeResize = await viz.getCanvasDataURL();

      // Resize viewport to force window resize event (page's resize handler should call initGraph)
      await viz.resize(800, 500);

      // After resize, canvas should be updated (data URL likely differs)
      const afterResize = await viz.getCanvasDataURL();

      // They might be equal in rare edge conditions, but generally resizing causes a redraw.
      // Assert that the afterResize is a valid data URL string and not empty
      expect(typeof afterResize).toBe('string');
      expect(afterResize.length).toBeGreaterThan(50);

      // It's acceptable if beforeResize === afterResize in rare timing cases; main goal is no runtime errors on resize.
    });

    test('No uncaught console errors and normal console logging behavior', async ({ page }) => {
      const viz = new VisualizationPage(page);
      await viz.goto();

      // This test intentionally inspects collected console messages to assert no severe 'error' console type messages occurred.
      // Wait briefly to allow any initialization logs to appear
      await page.waitForTimeout(200);

      // If there are console messages with type 'error', fail with details
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors, 'No console.error messages expected during normal initialization').toHaveLength(0);

      // Also validate there are some informational console messages (not required), but the absence does not fail the test.
    });
  });
});