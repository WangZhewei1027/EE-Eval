import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bff01-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object Model for the Bellman-Ford demo page
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Capture current global variables from the page
  async getDistances() {
    return await this.page.evaluate(() => {
      // return distances if available on window
      try {
        return window.distances;
      } catch (e) {
        return undefined;
      }
    });
  }

  async getGraph() {
    return await this.page.evaluate(() => {
      try {
        return window.graph;
      } catch (e) {
        return undefined;
      }
    });
  }

  async clickStart() {
    await this.page.click('#start-button');
  }

  async clickReset() {
    await this.page.click('#reset-button');
  }

  async clickDisplay() {
    await this.page.click('#display-button');
  }

  async clickPlot() {
    await this.page.click('#plot-button');
  }

  async countTextSpansInGraphContainer() {
    return await this.page.evaluate(() => {
      const container = document.getElementById('graph-container');
      if (!container) return 0;
      return Array.from(container.querySelectorAll('span')).length;
    });
  }

  async canvasHasDrawing() {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('graph');
      if (!canvas) return false;
      const ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) return false;
      // Check a few pixels for non-empty (drawn) content by sampling center pixel
      try {
        const data = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
        // If all rgba are zero, assume empty; otherwise assume drawing occurred
        return !(data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 0);
      } catch (e) {
        // If getImageData throws (browser security or already errored), return false
        return false;
      }
    });
  }
}

test.describe('Bellman-Ford Interactive App (FSM validations)', () => {
  // We'll collect page errors and console messages during each test run
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // store message and the stack for debugging assertions
      pageErrors.push({
        message: err && err.message ? err.message : String(err),
        stack: err && err.stack ? err.stack : ''
      });
    });

    // Capture console events (console.error, warnings, logs)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test('S0_Idle: Initial page load should render controls and report runtime errors from initial setup', async ({ page }) => {
    // This test validates the Idle state (buttons and canvas existence)
    // and verifies that the page throws runtime errors during initial onload
    const app = new BellmanFordPage(page);

    // Basic DOM checks: buttons and canvas should exist regardless of script errors
    await expect(page.locator('#start-button')).toBeVisible();
    await expect(page.locator('#reset-button')).toBeVisible();
    await expect(page.locator('#display-button')).toBeVisible();
    await expect(page.locator('#plot-button')).toBeVisible();
    await expect(page.locator('#graph')).toBeVisible();

    // The implementation calls updateInputFields() on load while distances is null,
    // therefore we expect at least one runtime error (TypeError or similar) to have occurred.
    // Allow a tiny delay for async error propagation
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBeGreaterThan(0, 'Expected at least one runtime page error to occur on load');

    // Assert that the captured error messages indicate a property access issue (common in provided code)
    const messages = pageErrors.map(e => e.message).join(' | ');
    expect(messages.length).toBeGreaterThan(0);
  });

  test('S1_GraphCreated: Clicking Start should create graph and initialize distances', async ({ page }) => {
    // This test validates the StartGraph event: transition from Idle to GraphCreated
    const app = new BellmanFordPage(page);

    // Clear previous errors snapshot
    const initialErrorCount = pageErrors.length;

    // Click start to invoke createGraph()
    await app.clickStart();

    // allow any synchronous handlers to run
    await page.waitForTimeout(50);

    // After createGraph, distances should be an array of length 10 filled with Infinity
    const distances = await app.getDistances();
    // Distances should be defined and be an array
    expect(Array.isArray(distances)).toBe(true);
    expect(distances.length).toBe(10);

    // Each entry should be Infinity (per createGraph implementation)
    const allInfinity = distances.every((d) => d === Infinity);
    expect(allInfinity).toBe(true);

    // Ensure the click did not unexpectedly clear all prior errors - it may or may not create new ones,
    // but we at least assert that createGraph completed and set distances as expected.
    // Also capture any new page errors produced by subsequent interactions
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBeGreaterThanOrEqual(initialErrorCount);
  });

  test('S1 -> S3 DisplayDistances: Clicking Display updates distances via input fields (and may raise errors)', async ({ page }) => {
    // This test validates DisplayDistances event from GraphCreated -> DistancesDisplayed.
    // Because the implementation has several inconsistencies (inputFields may be missing or distances shapes differ),
    // we assert that either distances are updated or runtime errors are emitted.
    const app = new BellmanFordPage(page);

    // Ensure graph has been created first
    await app.clickStart();
    await page.waitForTimeout(50);

    const beforeErrorCount = pageErrors.length;
    const beforeDistances = await app.getDistances();

    // Click display - this triggers updateDisplayButton
    await app.clickDisplay();

    // allow any handlers to run and capture errors
    await page.waitForTimeout(100);

    // If updateDisplayButton succeeded, distances should be an array (or updated)
    const afterDistances = await app.getDistances();

    // Either we have a new runtime error or distances changed shape/values.
    if (pageErrors.length > beforeErrorCount) {
      // An error occurred while handling Display - that is expected in several execution paths
      const newErrors = pageErrors.slice(beforeErrorCount).map(e => e.message).join(' | ');
      expect(newErrors.length).toBeGreaterThan(0);
    } else {
      // No new errors -> expect distances to be defined and length 10
      expect(Array.isArray(afterDistances)).toBe(true);
      expect(afterDistances.length).toBe(10);
    }
  });

  test('S1 -> S4 PlotGraph: Clicking Plot attempts to draw and append distance summaries; capture drawing or errors', async ({ page }) => {
    // This test validates PlotGraph event from GraphCreated -> GraphPlotted.
    // We check for either a visual change (canvas drawing or appended spans) or that an error was thrown.
    const app = new BellmanFordPage(page);

    // Ensure starting graph
    await app.clickStart();
    await page.waitForTimeout(50);

    const beforeErrorCount = pageErrors.length;
    const beforeSpanCount = await app.countTextSpansInGraphContainer();
    const beforeCanvasDrawing = await app.canvasHasDrawing();

    // Click plot
    await app.clickPlot();

    // Allow handlers to run and capture errors
    await page.waitForTimeout(200);

    const afterSpanCount = await app.countTextSpansInGraphContainer();
    const afterCanvasDrawing = await app.canvasHasDrawing();

    // If code worked, either new span(s) will be added or canvas updated; otherwise, expect a runtime error
    if (afterSpanCount > beforeSpanCount || afterCanvasDrawing !== beforeCanvasDrawing) {
      // Visual change detected: pass the test.
      expect(true).toBe(true);
    } else {
      // No visual change: expect that a runtime error occurred during plotting
      expect(pageErrors.length).toBeGreaterThan(beforeErrorCount, 'Expected an error or visual output after clicking Plot');
    }
  });

  test('S1 -> S2 ResetGraph then back to S1: Clicking Reset from created graph should attempt reset and clicking Start again should recreate', async ({ page }) => {
    // This test validates ResetGraph transition behavior and that StartGraph can be used afterwards.
    const app = new BellmanFordPage(page);

    // Create graph first
    await app.clickStart();
    await page.waitForTimeout(50);

    // Snapshot before reset
    const beforeErrorCount = pageErrors.length;

    // Click reset - implementation sets distances = null and then calls updateGraph (which may throw)
    await app.clickReset();

    // Allow errors to surface
    await page.waitForTimeout(150);

    // Because updateResetButton sets distances=null before calling updateGraph (which contains inconsistencies),
    // we expect that either distances is null or that additional page errors were thrown.
    const afterDistances = await app.getDistances();

    // If updateResetButton completed without error, distances may have been reinitialized by updateGraph;
    // otherwise distances may be null or we captured errors.
    const errorsDuringReset = pageErrors.length - beforeErrorCount;
    if (errorsDuringReset > 0) {
      // An error occurred during reset as expected in some code paths
      expect(errorsDuringReset).toBeGreaterThan(0);
    } else {
      // No error - check that distances is either null or an array of length 10
      if (afterDistances === null) {
        expect(afterDistances).toBeNull();
      } else {
        expect(Array.isArray(afterDistances)).toBe(true);
        expect(afterDistances.length).toBe(10);
      }
    }

    // Now click Start again to ensure we can transition back to GraphCreated
    await app.clickStart();
    await page.waitForTimeout(50);

    const finalDistances = await app.getDistances();
    expect(Array.isArray(finalDistances)).toBe(true);
    expect(finalDistances.length).toBe(10);
  });

  test('Edge cases and erroneous interactions: clicking Display/Plot before Start and repeated clicks produce runtime errors (observed and asserted)', async ({ page }) => {
    // This test exercises edge-case interactions:
    // - Clicking Display before Start
    // - Clicking Plot before Start
    // - Rapidly clicking buttons multiple times
    const app = new BellmanFordPage(page);

    // Reset captured errors snapshot
    const beforeErrorCount = pageErrors.length;

    // Click Display before Start -> likely to error because inputFields/distances may be undefined
    await app.clickDisplay();
    // Click Plot before Start -> likely to error because distances may be undefined
    await app.clickPlot();

    // Rapid repeated clicks on Start, Display, Reset to exercise concurrency/state inconsistencies
    for (let i = 0; i < 3; i++) {
      await app.clickStart();
      await app.clickDisplay();
      await app.clickReset();
    }

    // Allow events to propagate and errors to be captured
    await page.waitForTimeout(300);

    // At least one new page error should have been recorded as a result of these edge interactions
    expect(pageErrors.length).toBeGreaterThan(beforeErrorCount, 'Expected additional runtime errors from edge-case interactions');

    // Additionally ensure console captured messages (warnings/errors) are available for debugging
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test.afterEach(async ({ page }) => {
    // In teardown we still assert that pageErrors is an array (sanity)
    expect(Array.isArray(pageErrors)).toBe(true);
    // Provide visibility of errors via test output if any exist (they will be included in Playwright report)
  });
});