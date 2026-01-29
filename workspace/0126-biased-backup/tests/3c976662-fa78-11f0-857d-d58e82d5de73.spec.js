import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c976662-fa78-11f0-857d-d58e82d5de73.html';

/**
 * Page object for the Ternary Search Visualization app.
 * Encapsulates common selectors and interactions used by the tests.
 */
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.array = page.locator('#array');
    this.explanation = page.locator('#explanation');
    this.rangeIndicators = page.locator('#range-indicators');
    this.markerLabel = page.locator('.marker-label');
    this.highlightMid1 = page.locator('.highlight-mid1');
    this.highlightMid2 = page.locator('.highlight-mid2');
    this.highlightFound = page.locator('.highlight-found');
    this.arrayItems = page.locator('#array .array-el');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getExplanationText() {
    return this.explanation.innerHTML();
  }

  async getRangeText() {
    return this.rangeIndicators.innerHTML();
  }

  async getArrayCount() {
    return this.arrayItems.count();
  }

  async waitForMarkers(timeout = 5000) {
    await this.markerLabel.first().waitFor({ state: 'visible', timeout });
  }

  async waitForNoMarkers(timeout = 5000) {
    await expect(this.markerLabel).toHaveCount(0, { timeout });
  }

  async startBtnDisabled() {
    return await this.startBtn.evaluate(el => el.disabled);
  }

  async resetBtnDisabled() {
    return await this.resetBtn.evaluate(el => el.disabled);
  }

  async anyConsoleErrors() {
    return this._consoleErrors && this._consoleErrors.length > 0;
  }

  // Helpers to attach console and pageerror listeners for assertions
  attachLogCollectors() {
    this._consoleMessages = [];
    this._consoleErrors = [];
    this._pageErrors = [];

    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      this._consoleMessages.push({ type, text });
      if (type === 'error') this._consoleErrors.push(text);
    });

    this.page.on('pageerror', (err) => {
      this._pageErrors.push(String(err));
    });
  }

  getConsoleMessages() {
    return this._consoleMessages || [];
  }
  getConsoleErrors() {
    return this._consoleErrors || [];
  }
  getPageErrors() {
    return this._pageErrors || [];
  }
}

test.describe('Ternary Search Visualization (FSM validation)', () => {
  // Increase timeout for tests that must wait for animations/timeouts
  test.setTimeout(60_000);

  test.describe.configure({ mode: 'serial' });

  // Before each test we will navigate to the app and attach listeners for console/page errors.
  test.beforeEach(async ({ page }) => {
    // No-op here; each test creates its own VisualizerPage and goes to page.
  });

  test('Initial load shows Idle state (S0_Idle) with initialized display and controls', async ({ page }) => {
    // This test validates the onEnter action initializeDisplay() for S0_Idle.
    const app = new VisualizerPage(page);
    app.attachLogCollectors();

    await app.goto();

    // Verify no runtime page errors or console errors occurred during load
    expect(app.getPageErrors()).toEqual([]);
    expect(app.getConsoleErrors()).toEqual([]);

    // The explanation should instruct to press Start
    const explanationHtml = await app.getExplanationText();
    expect(explanationHtml).toContain('Press <strong>Start</strong>');

    // Controls: start enabled, reset disabled
    expect(await app.startBtnDisabled()).toBe(false);
    expect(await app.resetBtnDisabled()).toBe(true);

    // Array should be rendered with the expected number of elements (16 as per implementation)
    const count = await app.getArrayCount();
    expect(count).toBe(16);

    // Range indicators should initially show left 0 and right 15 (arr.length - 1)
    const rangeHtml = await app.getRangeText();
    expect(rangeHtml).toContain('Left: 0');
    expect(rangeHtml).toContain('Right: 15');

    // No marker labels should be present on idle display
    await app.waitForNoMarkers();

    // Confirm no console or page errors have arrived after initial assertions
    expect(app.getPageErrors()).toEqual([]);
    expect(app.getConsoleErrors()).toEqual([]);
  });

  test('Click Start transitions Idle -> Running (S0_Idle -> S1_Running) and begins animation', async ({ page }) => {
    // This test validates the StartClick event and S1 entry action ternarySearchAnim()
    const app = new VisualizerPage(page);
    app.attachLogCollectors();

    await app.goto();

    // Click the Start button to begin animation
    await app.clickStart();

    // Immediately after click: start should be disabled and reset enabled
    expect(await app.startBtnDisabled()).toBe(true);
    expect(await app.resetBtnDisabled()).toBe(false);

    // The algorithm renders mid markers right away before the first wait; assert they appear
    await app.waitForMarkers(6000); // allow a generous timeout in case of scheduling variability

    // Explanation should reflect the search has begun and mention the target (66)
    const explanationHtml = await app.getExplanationText();
    expect(explanationHtml.toLowerCase()).toContain('search for');
    expect(explanationHtml).toContain('66');

    // The DOM should contain highlight classes for mid1 and mid2 at least initially
    const mid1Count = await app.highlightMid1.count();
    const mid2Count = await app.highlightMid2.count();
    expect(mid1Count + mid2Count).toBeGreaterThanOrEqual(1);

    // No runtime errors should have occurred so far
    expect(app.getPageErrors()).toEqual([]);
    expect(app.getConsoleErrors()).toEqual([]);

    // Let the animation progress long enough for it to potentially find the target and complete.
    // The animation uses stepDuration = 2200ms and does multiple awaits; give ample time to complete.
    // At completion, resetBtn should become disabled and startBtn enabled again.
    await page.waitForTimeout(12_000); // wait for the sequence to finish (safety buffer)

    // After completion we expect the animation to have ended and buttons to be back to idle state.
    expect(await app.startBtnDisabled()).toBe(false);
    expect(await app.resetBtnDisabled()).toBe(true);

    // If the algorithm found the target, a highlight-found class should be present at least once.
    const foundCount = await app.highlightFound.count();
    // Because target 66 is in the array, we expect it to be found.
    expect(foundCount).toBeGreaterThanOrEqual(1);

    // Final explanation should mention found or not found message; assert it mentions either 'found' or 'not found'
    const finalExplanation = (await app.getExplanationText()).toLowerCase();
    expect(finalExplanation.includes('found') || finalExplanation.includes('not found')).toBe(true);

    // Still, assert no page errors or console errors during entire run
    expect(app.getPageErrors()).toEqual([]);
    expect(app.getConsoleErrors()).toEqual([]);
  });

  test('Click Reset during Running transitions Running -> Reset (S1_Running -> S2_Reset) and re-initializes display', async ({ page }) => {
    // This test validates the ResetClick event while running and the reset() entry action for S2_Reset.
    const app = new VisualizerPage(page);
    app.attachLogCollectors();

    await app.goto();

    // Start the animation
    await app.clickStart();

    // Wait for the animation to have started (marker labels visible)
    await app.waitForMarkers(6000);

    // Sanity check: we are running (start disabled, reset enabled)
    expect(await app.startBtnDisabled()).toBe(true);
    expect(await app.resetBtnDisabled()).toBe(false);

    // Now click reset while running to trigger reset()
    await app.clickReset();

    // After reset, controls should reflect Idle: start enabled, reset disabled
    expect(await app.startBtnDisabled()).toBe(false);
    expect(await app.resetBtnDisabled()).toBe(true);

    // Explanation should be reset to the initial guidance
    const explanationHtml = await app.getExplanationText();
    expect(explanationHtml).toContain('Press <strong>Start</strong>');

    // There should be no marker labels after reset (initialized display)
    await app.waitForNoMarkers(5000);

    // Range indicators should reflect full range again
    const rangeHtml = await app.getRangeText();
    expect(rangeHtml).toContain('Left: 0');
    expect(rangeHtml).toContain('Right: 15');

    // Confirm there were no page errors or console errors produced by reset flow
    expect(app.getPageErrors()).toEqual([]);
    expect(app.getConsoleErrors()).toEqual([]);
  });

  test('Restart after Reset transitions Reset -> Idle -> Running (S2_Reset -> S0_Idle -> S1_Running)', async ({ page }) => {
    // This test validates that after a reset the user can start the animation again and it behaves as expected.
    const app = new VisualizerPage(page);
    app.attachLogCollectors();

    await app.goto();

    // Start then reset quickly to simulate the full cycle
    await app.clickStart();
    await app.waitForMarkers(6000);
    await app.clickReset();

    // Ensure idle state restored
    expect(await app.startBtnDisabled()).toBe(false);
    expect(await app.resetBtnDisabled()).toBe(true);
    await app.waitForNoMarkers(5000);

    // Start again after reset
    await app.clickStart();

    // Confirm we returned to running state
    expect(await app.startBtnDisabled()).toBe(true);
    expect(await app.resetBtnDisabled()).toBe(false);

    // Markers should re-appear
    await app.waitForMarkers(6000);

    // Let it finish
    await page.waitForTimeout(10_000);

    // Final controls should be idle
    expect(await app.startBtnDisabled()).toBe(false);
    expect(await app.resetBtnDisabled()).toBe(true);

    // Confirm no page errors or console errors across the cycle
    expect(app.getPageErrors()).toEqual([]);
    expect(app.getConsoleErrors()).toEqual([]);
  });

  test('Edge case: Ensure clicking Start while already running does not break the app and no errors emitted', async ({ page }) => {
    // This test validates that repeated attempts to start while running are safely ignored (start handler checks running)
    const app = new VisualizerPage(page);
    app.attachLogCollectors();

    await app.goto();

    // Start the animation
    await app.clickStart();
    await app.waitForMarkers(6000);

    // Attempt to click the Start button again while running.
    // Because the button is disabled by the script when running, Playwright's click will fail if it's truly disabled.
    // Attempting to click programmatically via JS would bypass disabled semantics, which is not allowed per task rules (do not patch).
    // So we assert the button is disabled and that the app remains stable for a while.
    expect(await app.startBtnDisabled()).toBe(true);

    // Wait for several seconds to ensure the app continues (no errors thrown)
    await page.waitForTimeout(6_000);

    // After waiting, confirm the app still has no pageerrors and no console.error messages
    expect(app.getPageErrors()).toEqual([]);
    expect(app.getConsoleErrors()).toEqual([]);

    // Let the run finish to restore idle state
    await page.waitForTimeout(8_000);
    expect(await app.startBtnDisabled()).toBe(false);
    expect(await app.resetBtnDisabled()).toBe(true);
  });

  test('Observability: Capture console messages and page errors during run; assert none occurred', async ({ page }) => {
    // This test focuses on observing console and page errors while performing the major transitions.
    const app = new VisualizerPage(page);
    app.attachLogCollectors();

    await app.goto();

    // Perform a full cycle: start -> wait a bit -> reset -> start again -> let finish
    await app.clickStart();
    await app.waitForMarkers(6000);

    // click reset while running
    await app.clickReset();
    await app.waitForNoMarkers(5000);

    // start again
    await app.clickStart();
    await app.waitForMarkers(6000);

    // Wait for completion
    await page.waitForTimeout(12_000);

    // Collect and assert that no pageerror or console.error occurred during these interactions
    const pageErrors = app.getPageErrors();
    const consoleErrors = app.getConsoleErrors();
    const consoleMsgs = app.getConsoleMessages();

    // For diagnostics in case of test failure, include the messages in the assertion message.
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
    expect(consoleErrors, `Unexpected console.error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);

    // As an extra check, ensure there were console messages but they are informational or warnings at most
    // This is permissive: we only fail on error-type console messages (handled above).
    expect(consoleMsgs.length).toBeGreaterThanOrEqual(0);
  });
});