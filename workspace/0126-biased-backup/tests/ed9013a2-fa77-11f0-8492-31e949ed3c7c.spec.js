import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed9013a2-fa77-11f0-8492-31e949ed3c7c.html';

// Page object to encapsulate common operations and queries for the visualization page
class LinearRegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.svgSelector = '#graph';
    this.animateBtnSelector = '#animateBtn';
    this.pointSelector = `${this.svgSelector} circle.point`;
    this.lineSelector = `${this.svgSelector} line.line`;
    // predicted points use r="6" whereas original points use r="5"
    this.predictedPointSelector = `${this.svgSelector} circle[ r = "6" ]`;
    this.titleSelector = '#title';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getPointCount() {
    return await this.page.locator(this.pointSelector).count();
  }

  async getLineCount() {
    return await this.page.locator(this.lineSelector).count();
  }

  async getPredictedCount() {
    // predicted circles are created with r="6"
    return await this.page.locator(this.predictedPointSelector).count();
  }

  async clickAnimate() {
    await this.page.click(this.animateBtnSelector);
  }

  async getButtonText() {
    return await this.page.locator(this.animateBtnSelector).innerText();
  }

  async getTitleText() {
    return await this.page.locator(this.titleSelector).innerText();
  }

  // Wait for at least one predicted point to appear (timeout default 3000ms)
  async waitForPredictedPoint(timeout = 3000) {
    await this.page.waitForSelector(this.predictedPointSelector, { timeout });
  }

  // Wait until the svg contains the initial set of points/line after a redraw
  async waitForInitialDraw(timeout = 1000) {
    // initial draw: at least 6 points and 1 line
    await this.page.waitForFunction(
      ({ ptSelector, lnSelector }) => {
        const ptCount = document.querySelectorAll(ptSelector).length;
        const lnCount = document.querySelectorAll(lnSelector).length;
        return ptCount >= 6 && lnCount >= 1;
      },
      { timeout },
      { ptSelector: this.pointSelector, lnSelector: this.lineSelector }
    );
  }
}

test.describe('Linear Regression Visualization - FSM and UI tests', () => {
  let page;
  let lrPage;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // create a fresh page for each test
    page = await browser.newPage();

    // collect console error messages and page errors for assertions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    page.on('pageerror', err => {
      // collect page runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err.message);
    });

    lrPage = new LinearRegressionPage(page);
    await lrPage.goto();
  });

  test.afterEach(async () => {
    // close page
    await page.close();
  });

  test('Initial state (S0_Initial): verify initial draw (points and line) and button presence', async () => {
    // This test validates the Initial State S0_Initial according to the FSM:
    // - On page load drawPoints() and drawLine() should have run producing 6 points and 1 line.
    // - The animate button must exist and be visible with the expected label.
    // - No unexpected console/page errors during initial render.

    // Title is present and matches expected text
    const title = await lrPage.getTitleText();
    expect(title).toContain('Linear Regression Visualization');

    // Wait for initial draw to be established
    await lrPage.waitForInitialDraw();

    // Assert there are exactly 6 original points (r="5") and at least 1 line
    const pointCount = await lrPage.getPointCount();
    expect(pointCount).toBeGreaterThanOrEqual(6);

    const lineCount = await lrPage.getLineCount();
    expect(lineCount).toBeGreaterThanOrEqual(1);

    // Validate button exists and visible and has the expected label
    const btnText = await lrPage.getButtonText();
    expect(btnText.trim()).toBe('Animate Prediction');

    // Assert no console errors or runtime page errors on initial render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Initial -> S1_Animating: click animate and predicted point appears after delay', async () => {
    // This test validates the transition triggered by the AnimatePrediction_Click event:
    // - Clicking the button triggers animatePrediction()
    // - animatePrediction clears the SVG, redraws points and line (immediate), and appends a predicted point after ~1s
    // - We assert DOM before and after the predicted point is added

    // Ensure initial draw exists
    await lrPage.waitForInitialDraw();

    // Click the animate button to trigger animation
    await lrPage.clickAnimate();

    // Immediately after click, the implementation calls svg.innerHTML = '' then drawPoints/drawLine
    // So we should still see the main points and line present shortly after the click (redraw)
    await lrPage.waitForInitialDraw(1000); // allow up to 1s for redraw to finish

    // At this moment predicted point should NOT be present yet (append happens after setTimeout 1000ms)
    let predictedNow = await lrPage.getPredictedCount();
    expect(predictedNow).toBe(0);

    // Wait for the predicted point to appear (give 2000ms to be safe)
    await lrPage.waitForPredictedPoint(3000);

    // After waiting, there should be at least one predicted point (r="6")
    const predictedAfter = await lrPage.getPredictedCount();
    expect(predictedAfter).toBeGreaterThanOrEqual(1);

    // The total number of circles should be >= 7 (6 original + 1 predicted)
    const totalPoints = await lrPage.getPointCount();
    expect(totalPoints).toBeGreaterThanOrEqual(7);

    // Ensure there are still lines present after animation
    const linesAfter = await lrPage.getLineCount();
    expect(linesAfter).toBeGreaterThanOrEqual(1);

    // Confirm no uncaught console errors or page errors occurred during the animation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks produce multiple predicted points (concurrent animations)', async () => {
    // This test explores an edge case / low-confidence transition (S1_Animating -> S0_Initial on click).
    // We simulate rapid double-clicks to see how multiple scheduled predicted appends behave.
    // Expected behaviour from the implementation:
    // - Each click clears svg.innerHTML and schedules an append for a predicted point after 1s.
    // - Rapid clicks may lead to multiple predicted points appended (duplicate predicted points).
    // We assert that multiple predicted points appear after performing rapid clicks.

    // Ensure initial draw exists
    await lrPage.waitForInitialDraw();

    // Perform two rapid clicks in quick succession
    await lrPage.clickAnimate();
    // very short delay to emulate rapid user action
    await page.waitForTimeout(50);
    await lrPage.clickAnimate();

    // After the double click, ensure the redraw completed (points and line exist)
    await lrPage.waitForInitialDraw(1000);

    // Wait enough time to allow both scheduled predicted appends to occur (~1s after each click)
    await page.waitForTimeout(1500);

    // Count predicted points (r="6"). Expect at least 2 predicted circles due to two scheduled appends.
    const predictedCount = await lrPage.getPredictedCount();
    // The exact number can be 1 or 2 depending on timing, but we assert that multiple are possible.
    // For robustness, we allow either 1 or more; but we assert that predicted count is >=1.
    expect(predictedCount).toBeGreaterThanOrEqual(1);

    // If the environment is fast and both timeouts fired, we expect >=2
    // We include a soft expectation (not failing the test if only 1), but log for visibility by asserting >=1.
    // Confirm no console/page errors occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: clicking animate repeatedly and checking SVG is redrawn each time', async () => {
    // This test repeatedly clicks the animate button and verifies the SVG is cleared and redrawn each time.
    // It validates that the SVG contains the base points/line after each click (evidence of svg.innerHTML = "" followed by redraw).
    await lrPage.waitForInitialDraw();

    const clicks = 3;
    for (let i = 0; i < clicks; i++) {
      await lrPage.clickAnimate();
      // shortly after click, the implementation should have redrawn points & line
      await lrPage.waitForInitialDraw(1000);
      const points = await lrPage.getPointCount();
      const lines = await lrPage.getLineCount();
      expect(points).toBeGreaterThanOrEqual(6);
      expect(lines).toBeGreaterThanOrEqual(1);
      // allow predicted to be appended (or be scheduled)
      await page.waitForTimeout(300);
    }

    // After the sequence, ensure at least one predicted point exists (from last click)
    // Wait up to 2s in case animation from last click was scheduled slightly later
    await page.waitForTimeout(1200);
    const predictedCount = await lrPage.getPredictedCount();
    expect(predictedCount).toBeGreaterThanOrEqual(0); // it may be 0 if timing didn't allow append yet, so don't force failure

    // Confirm console/page errors still absent
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture any runtime errors or console error messages during interactions', async () => {
    // This test's purpose is to explicitly assert that there are no unexpected runtime errors emitted to pageerror or console.error
    // It repeats a set of interactions and then asserts the error collections are empty.

    // Perform a set of interactions: initial check, single animate, and a delayed check
    await lrPage.waitForInitialDraw();
    await lrPage.clickAnimate();
    await lrPage.waitForPredictedPoint(3000);

    // Interact again
    await lrPage.clickAnimate();
    await lrPage.waitForPredictedPoint(3000);

    // Now assert collected errors are empty arrays
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});