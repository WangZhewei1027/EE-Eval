import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b48293-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the Overfitting Demonstration page
class OverfittingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.degreeRange = page.locator('#degreeRange');
    this.degreeValue = page.locator('#degreeValue');
    this.errorDisplay = page.locator('#error');
    this.canvasData = page.locator('#canvasData');
    this.canvasFit = page.locator('#canvasFit');
  }

  // Navigate to the page and wait for initial update cycle to complete
  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
    // Wait for the degreeValue to be present and populated by the initial script
    await expect(this.degreeValue).toHaveText(/\d+/);
    // Wait until the error display contains Training MSE label produced by update()
    await expect(this.errorDisplay).toContainText('Training MSE');
    await expect(this.errorDisplay).toContainText('True MSE');
  }

  // Set the slider degree using DOM value assignment and dispatch an input event
  async setDegree(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('degreeRange');
      el.value = String(v);
      // Create and dispatch input event to mimic user interaction
      const ev = new Event('input', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    }, value);
    // Wait for DOM updates triggered by update()
    await expect(this.degreeValue).toHaveText(String(value));
    // errorDisplay will be updated as well - wait for it to contain "Training MSE"
    await expect(this.errorDisplay).toContainText('Training MSE');
  }

  // Parse Training and True MSE values from the error display innerHTML
  async getMSEs() {
    const html = await this.errorDisplay.innerHTML();
    // Extract numbers like 0.1234
    const trainMatch = html.match(/Training MSE.*?:\s*([0-9]+\.[0-9]+)/);
    const trueMatch = html.match(/True MSE.*?:\s*([0-9]+\.[0-9]+)/);
    const training = trainMatch ? parseFloat(trainMatch[1]) : NaN;
    const truth = trueMatch ? parseFloat(trueMatch[1]) : NaN;
    return { training, truth, raw: html };
  }

  // Sample a pixel from the canvas at (x, y) and return RGBA array
  // uses evaluation in page context to access canvas pixels
  async sampleCanvasPixel(canvasLocator, x, y) {
    const box = await canvasLocator.boundingBox();
    if (!box) return null;
    // Work in canvas coordinates; use default center if x/y omitted
    const cx = Math.round(x !== undefined ? x : box.width / 2);
    const cy = Math.round(y !== undefined ? y : box.height / 2);
    return await canvasLocator.evaluate((canvas, px, py) => {
      const ctx = canvas.getContext('2d');
      try {
        const data = ctx.getImageData(px, py, 1, 1).data;
        return Array.from(data);
      } catch (e) {
        // Some environments might restrict getImageData; return null to indicate failure
        return null;
      }
    }, cx, cy);
  }
}

test.describe('Overfitting Demonstration - FSM tests (Idle state + SliderChange event)', () => {
  // Capture console and page errors for each test to assert no unexpected runtime errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect console messages (all severities)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // any uncaught exception in page will be captured here
      pageErrors.push(err);
    });
  });

  test('Initial Idle state: entry actions drawDataCanvas() and update() should run', async ({ page }) => {
    // Comments:
    // This test validates the FSM's initial state S0_Idle entry actions:
    // - drawDataCanvas() has drawn the left canvas (non-empty pixel data)
    // - update() has run, updating degreeValue and error display with MSEs
    const p = new OverfittingPage(page);
    await p.goto();

    // Verify the slider initial value and displayed degree match the FSM extraction (value "1")
    await expect(p.degreeRange).toHaveValue('1');
    await expect(p.degreeValue).toHaveText('1');

    // Verify error display contains training and true MSE with numeric values
    const mses = await p.getMSEs();
    expect(Number.isFinite(mses.training)).toBeTruthy();
    expect(Number.isFinite(mses.truth)).toBeTruthy();

    // Sample center pixel on data canvas and fit canvas to ensure drawing occurred
    const dataPixel = await p.sampleCanvasPixel(p.canvasData);
    const fitPixel = await p.sampleCanvasPixel(p.canvasFit);
    // At least one canvas should have a non-transparent/non-empty pixel array
    // dataPixel or fitPixel could be null if getImageData is restricted, handle gracefully
    const dataHasColor = Array.isArray(dataPixel) && dataPixel.some((c) => c !== 0);
    const fitHasColor = Array.isArray(fitPixel) && fitPixel.some((c) => c !== 0);
    expect(dataHasColor || fitHasColor).toBeTruthy();

    // Assert no uncaught page errors and no console.error messages were emitted during initialization
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('SliderChange event: updating degree updates degreeValue, canvases, and MSEs', async ({ page }) => {
    // Comments:
    // This test simulates the SliderChange event described in the FSM.
    // It exercises several degree values and verifies:
    // - degreeValue text updates promptly
    // - error display (training & true MSE) updates (numeric)
    // - canvases are redrawn (sampled pixel changes)
    const p = new OverfittingPage(page);
    await p.goto();

    // Capture baseline MSE and pixel values
    const baseline = await p.getMSEs();
    const baselineFitPixel = await p.sampleCanvasPixel(p.canvasFit);

    // Change degree to 0 (edge case) and validate updates
    await p.setDegree(0);
    await expect(p.degreeRange).toHaveValue('0');
    await expect(p.degreeValue).toHaveText('0');
    const mses0 = await p.getMSEs();
    expect(Number.isFinite(mses0.training)).toBeTruthy();
    expect(Number.isFinite(mses0.truth)).toBeTruthy();

    // Ensure that the fit canvas changed visually (if pixel sampling is permitted)
    const fitPixel0 = await p.sampleCanvasPixel(p.canvasFit);
    if (Array.isArray(baselineFitPixel) && Array.isArray(fitPixel0)) {
      // It's acceptable that pixels may coincidentally be the same for some small changes, but typically should differ
      const identical = baselineFitPixel.every((v, i) => v === fitPixel0[i]);
      // We don't require they differ (randomness), but we record the observation; prefer inequality
      // assert either change has occurred or at least MSE changed
      const mseChanged = baseline.training !== mses0.training || baseline.truth !== mses0.truth;
      expect(mseChanged || !identical).toBeTruthy();
    }

    // Now test an intermediate degree (e.g., 5)
    await p.setDegree(5);
    await expect(p.degreeRange).toHaveValue('5');
    await expect(p.degreeValue).toHaveText('5');
    const mses5 = await p.getMSEs();
    expect(Number.isFinite(mses5.training)).toBeTruthy();
    expect(Number.isFinite(mses5.truth)).toBeTruthy();

    // And a high degree near the maximum (e.g., 12)
    await p.setDegree(12);
    await expect(p.degreeRange).toHaveValue('12');
    await expect(p.degreeValue).toHaveText('12');
    const mses12 = await p.getMSEs();
    expect(Number.isFinite(mses12.training)).toBeTruthy();
    expect(Number.isFinite(mses12.truth)).toBeTruthy();

    // Check that after several slider changes there were no uncaught exceptions or console errors
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: degree 0 behavior and maximum degree handling (0 and 15)', async ({ page }) => {
    // Comments:
    // Validate specific edge cases required by the FSM and implementation:
    // - degree = 0 should compute the mean (single coefficient) and display valid MSEs
    // - degree = max (15) should be accepted and not produce unhandled exceptions
    const p = new OverfittingPage(page);
    await p.goto();

    // degree 0
    await p.setDegree(0);
    await expect(p.degreeValue).toHaveText('0');
    const mses0 = await p.getMSEs();
    expect(Number.isFinite(mses0.training)).toBeTruthy();
    expect(Number.isFinite(mses0.truth)).toBeTruthy();

    // degree max (15)
    await p.setDegree(15);
    await expect(p.degreeValue).toHaveText('15');
    const msesMax = await p.getMSEs();
    expect(Number.isFinite(msesMax.training)).toBeTruthy();
    expect(Number.isFinite(msesMax.truth)).toBeTruthy();

    // Also sample fit canvas pixel to ensure drawing attempted for max degree
    const fitPixelMax = await p.sampleCanvasPixel(p.canvasFit);
    if (Array.isArray(fitPixelMax)) {
      // Some pixel should exist and be a numeric RGBA quadruple
      expect(fitPixelMax.length).toBe(4);
      expect(fitPixelMax.every((v) => Number.isFinite(v))).toBeTruthy();
    }

    // Confirm no page errors or console errors emitted
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Stability across multiple rapid slider changes (simulate user scrubbing)', async ({ page }) => {
    // Comments:
    // Simulate rapid slider changes (scrubbing) to ensure the update handler is robust under frequent input events.
    // Verifies degreeValue consistency and absence of uncaught exceptions.
    const p = new OverfittingPage(page);
    await p.goto();

    // Rapidly change degree across a sequence
    for (const val of [1, 3, 7, 2, 10, 4, 15, 0, 8]) {
      // Directly use setDegree which dispatches an input event and waits for UI update
      await p.setDegree(val);
      // Ensure the displayed degree matches
      await expect(p.degreeValue).toHaveText(String(val));
      // Ensure MSEs are present and numeric
      const mses = await p.getMSEs();
      expect(Number.isFinite(mses.training)).toBeTruthy();
      expect(Number.isFinite(mses.truth)).toBeTruthy();
    }

    // After rapid interactions, ensure no uncaught runtime errors
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and runtime error observation: report any console.error or uncaught exceptions', async ({ page }) => {
    // Comments:
    // This test explicitly demonstrates observation of console messages and page errors.
    // According to the testing guidance, we must observe console logs and page errors and assert their presence/absence.
    const p = new OverfittingPage(page);
    await p.goto();

    // Trigger a benign interaction to exercise code paths
    await p.setDegree(6);

    // Now assert that there were no uncaught page errors or console.error messages.
    // If there were any, we will fail the test and print them for diagnostics.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');

    if (pageErrors.length > 0) {
      // Fail with detailed info on pageErrors
      const msgs = pageErrors.map((e) => (e && e.stack) ? e.stack : String(e)).join('\n---\n');
      throw new Error('Uncaught page errors were detected:\n' + msgs);
    }

    if (consoleErrors.length > 0) {
      const msgs = consoleErrors.map((m) => `[console.${m.type}] ${m.text}`).join('\n');
      throw new Error('Console error messages were detected:\n' + msgs);
    }

    // If none, assert emptiness explicitly
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});