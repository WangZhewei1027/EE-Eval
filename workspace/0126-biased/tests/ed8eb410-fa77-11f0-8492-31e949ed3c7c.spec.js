import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8eb410-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object to encapsulate interactions and assertions for the Deadlock Visualization page
class DeadlockPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start');
    this.canvas = page.locator('#canvas');
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  // Click the "Start Visualization" button
  async clickStart() {
    await this.startButton.click();
  }

  // Click on the canvas at the center (safe no-op for state change)
  async clickCanvasCenter() {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  // Retrieve the global deadlocked boolean from the page
  async getDeadlockedVariable() {
    return await this.page.evaluate(() => {
      // Access global variable set by the page script
      // It is expected to exist as per the provided implementation
      return typeof deadlocked !== 'undefined' ? deadlocked : null;
    });
  }

  // Sample the pixel color at the center of the canvas and return [r,g,b,a]
  async sampleCanvasCenterPixel() {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      const x = Math.floor(canvas.width / 2);
      const y = Math.floor(canvas.height / 2);
      const data = ctx.getImageData(x, y, 1, 1).data;
      return [data[0], data[1], data[2], data[3]];
    });
  }

  // Helper to assert canvas pixel equals expected rgb (exact match)
  static assertRgbEquals(actual, expectedRgb) {
    const [r, g, b] = actual;
    expect([r, g, b]).toEqual(expectedRgb);
  }

  // Helper to assert canvas pixel equals expected rgb allowing small tolerance
  static assertRgbClose(actual, expectedRgb, tolerance = 2) {
    const [r, g, b] = actual;
    const [er, eg, eb] = expectedRgb;
    expect(Math.abs(r - er)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(g - eg)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(b - eb)).toBeLessThanOrEqual(tolerance);
  }
}

test.describe('Deadlock Visualization - FSM states and transitions', () => {
  // Collect console messages and page errors for each test to observe runtime behavior
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events with their types and text
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // After each test ensure no unexpected page errors occurred
    // We record them here so test failures will show the collected errors for debugging
    expect(pageErrors, `Expected no page errors, but found: ${pageErrors.map(e => String(e)).join('; ')}`).toHaveLength(0);

    // Ensure there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, `Expected no console errors, but found: ${consoleErrors.map(c => c.text).join('; ')}`).toHaveLength(0);
  });

  test('Initial state on load should be Running (green circle) and draw() executed on enter', async ({ page }) => {
    // This test validates the initial FSM state S0_Running after the page loads
    const dp = new DeadlockPage(page);
    await dp.goto();

    // Verify the start button exists and is visible
    await expect(dp.startButton).toBeVisible();

    // The global "deadlocked" variable should be false initially
    const deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(false);

    // Sample the canvas center pixel and assert it's green (#4caf50 -> rgb(76,175,80))
    const centerPixel = await dp.sampleCanvasCenterPixel();
    DeadlockPage.assertRgbClose(centerPixel, [76, 175, 80]);

    // No page errors or console errors should have occurred during load (asserted in afterEach)
  });

  test('Clicking Start toggles to Deadlocked (red) -- S0_Running -> S1_Deadlocked', async ({ page }) => {
    // This test validates the transition triggered by the StartVisualization event (button click)
    const dp = new DeadlockPage(page);
    await dp.goto();

    // Click the start button once to toggle state
    await dp.clickStart();

    // After the click, the global "deadlocked" variable should be true
    const deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(true);

    // The canvas center pixel should now be red (#ff5252 -> rgb(255,82,82))
    const centerPixel = await dp.sampleCanvasCenterPixel();
    DeadlockPage.assertRgbClose(centerPixel, [255, 82, 82]);
  });

  test('Clicking Start again toggles back to Running (green) -- S1_Deadlocked -> S0_Running', async ({ page }) => {
    // This test validates the reverse transition back to Running on a second click
    const dp = new DeadlockPage(page);
    await dp.goto();

    // First click -> deadlocked
    await dp.clickStart();
    let deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(true);

    // Second click -> back to running
    await dp.clickStart();
    deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(false);

    // Canvas center should be green again
    const centerPixel = await dp.sampleCanvasCenterPixel();
    DeadlockPage.assertRgbClose(centerPixel, [76, 175, 80]);
  });

  test('Rapid multiple clicks toggle state correctly and remain stable (stability / edge case)', async ({ page }) => {
    // This test rapidly clicks the start button many times to ensure no exceptions and correct final state
    const dp = new DeadlockPage(page);
    await dp.goto();

    // Rapidly click start 11 times
    const clicks = 11;
    for (let i = 0; i < clicks; i++) {
      await dp.clickStart();
    }

    // Determine expected final state: toggled clicks times => parity
    const expectedDeadlocked = clicks % 2 === 1;
    const deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(expectedDeadlocked);

    // Validate canvas color corresponds to final expected state
    const centerPixel = await dp.sampleCanvasCenterPixel();
    if (expectedDeadlocked) {
      DeadlockPage.assertRgbClose(centerPixel, [255, 82, 82]);
    } else {
      DeadlockPage.assertRgbClose(centerPixel, [76, 175, 80]);
    }
  });

  test('Clicking on the canvas (non-button area) should not change state (no-op edge case)', async ({ page }) => {
    // This test ensures clicks outside of the button do not trigger state transitions
    const dp = new DeadlockPage(page);
    await dp.goto();

    // Ensure initial state is Running
    let deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(false);
    let centerPixel = await dp.sampleCanvasCenterPixel();
    DeadlockPage.assertRgbClose(centerPixel, [76, 175, 80]);

    // Click on canvas center (should be a no-op according to implementation)
    await dp.clickCanvasCenter();

    // State should remain unchanged
    deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(false);
    centerPixel = await dp.sampleCanvasCenterPixel();
    DeadlockPage.assertRgbClose(centerPixel, [76, 175, 80]);
  });

  test('Draw() is invoked on load and on each toggle (observable via canvas pixels and global variable)', async ({ page }) => {
    // This test indirectly verifies the entry action draw() executes by inspecting canvas pixels and variable changes
    const dp = new DeadlockPage(page);
    await dp.goto();

    // Initial draw() -> Running
    let deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(false);
    let centerPixel = await dp.sampleCanvasCenterPixel();
    DeadlockPage.assertRgbClose(centerPixel, [76, 175, 80]);

    // Toggle to Deadlocked -> draw() should be called and canvas should update
    await dp.clickStart();
    deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(true);
    centerPixel = await dp.sampleCanvasCenterPixel();
    DeadlockPage.assertRgbClose(centerPixel, [255, 82, 82]);

    // Toggle back -> draw() should be called and canvas should update back to Running
    await dp.clickStart();
    deadlocked = await dp.getDeadlockedVariable();
    expect(deadlocked).toBe(false);
    centerPixel = await dp.sampleCanvasCenterPixel();
    DeadlockPage.assertRgbClose(centerPixel, [76, 175, 80]);
  });

  test('Observe console logs and page errors during interactions (no runtime errors expected)', async ({ page }) => {
    // This test collects console logs and page errors while performing typical interactions
    const dp = new DeadlockPage(page);
    await dp.goto();

    // Perform interactions
    await dp.clickStart();
    await dp.clickStart();
    await dp.clickStart();

    // We expect zero page errors and zero console.error messages (asserted in afterEach).
    // However, for debugging purposes, we also assert that console messages (of any type) were captured (informational)
    // and that they are not 'error' type.
    // This explicit expectation is supplemental to the afterEach-wide assertions.
    // Ensure we at least captured the console events (could be zero if the page doesn't log anything)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});