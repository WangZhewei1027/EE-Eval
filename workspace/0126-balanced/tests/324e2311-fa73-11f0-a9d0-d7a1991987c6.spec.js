import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e2311-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object for the PageRank demo page
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodesSelector = '#nodes';
    this.canvasSelector = '#canvas';
    this.buttonSelector = "button[onclick='calculatePageRank()']";
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main interactive button to be available
    await this.page.waitForSelector(this.buttonSelector, { state: 'visible' });
  }

  async clickCalculate() {
    await this.page.click(this.buttonSelector);
  }

  async getNodesHTML() {
    return await this.page.$eval(this.nodesSelector, el => el.innerHTML);
  }

  async getNodesText() {
    return await this.page.$eval(this.nodesSelector, el => el.innerText);
  }

  async waitForRanksDisplayed(timeout = 2000) {
    // displayRanks inserts an <h2> then multiple <p> lines. Wait for the header to appear.
    await this.page.waitForSelector('#nodes h2', { timeout });
  }

  async getCanvasDataUrl() {
    // Convert canvas contents to a data URL for comparison
    return await this.page.$eval(this.canvasSelector, (canvas) => {
      // toDataURL captures the current bitmap
      return canvas.toDataURL();
    });
  }

  async functionsExist() {
    return await this.page.evaluate(() => {
      return {
        calculatePageRank: typeof calculatePageRank,
        displayRanks: typeof displayRanks,
        drawGraph: typeof drawGraph
      };
    });
  }
}

test.describe('PageRank Demonstration (FSM validation)', () => {
  // Will collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console messages and unhandled page errors
    page._collectedConsole = [];
    page._collectedPageErrors = [];

    page.on('console', (msg) => {
      // Only capture textual value to make assertions easier
      try {
        page._collectedConsole.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore any unexpected console message shapes
      }
    });

    page.on('pageerror', (err) => {
      // Capture error name and message for assertions
      page._collectedPageErrors.push({ name: err.name, message: err.message });
    });
  });

  test('S0_Idle: Initial idle state renders button, empty nodes, and canvas exists', async ({ page }) => {
    // This test validates the Idle (S0_Idle) state entry action: renderPage() is represented
    // by the presence of the Calculate PageRank button, empty nodes container, and a canvas.
    const app = new PageRankPage(page);
    await app.goto();

    // The Calculate PageRank button must be present and visible
    const btn = await page.$("button[onclick='calculatePageRank()']");
    expect(btn).not.toBeNull();

    // The nodes container should be empty (no PageRank values yet)
    const nodesHTML = await app.getNodesHTML();
    expect(nodesHTML.trim()).toBe(''); // should be empty string initially

    // The canvas should exist and have the expected size attributes
    const canvas = await page.$('#canvas');
    expect(canvas).not.toBeNull();
    const canvasWidth = await canvas.getAttribute('width');
    const canvasHeight = await canvas.getAttribute('height');
    expect(canvasWidth).toBe('500');
    expect(canvasHeight).toBe('500');

    // There should be no unhandled page errors at this initial render
    expect(page._collectedPageErrors.length).toBe(0);
  });

  test('S1_Calculating and return to S0_Idle: clicking Calculate PageRank computes ranks and draws graph', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Calculating when the user clicks the button,
    // and the S1_Calculating exit actions displayRanks(ranks) and drawGraph(ranks).
    const app = new PageRankPage(page);
    await app.goto();

    // Capture canvas state before calculation
    const beforeDataUrl = await app.getCanvasDataUrl();

    // Click calculate to trigger calculation and rendering
    await app.clickCalculate();

    // Wait for displayRanks to update the DOM with results
    await app.waitForRanksDisplayed(5000); // allow more time for computation

    // The nodes container should now contain a heading and PageRank values
    const nodesText = await app.getNodesText();
    expect(nodesText).toMatch(/PageRank Values/);
    // Expect entries for the known nodes (A..E) with numeric values with four decimals
    expect(nodesText).toMatch(/A:\s*\d+\.\d{4}/);
    expect(nodesText).toMatch(/B:\s*\d+\.\d{4}/);
    expect(nodesText).toMatch(/C:\s*\d+\.\d{4}/);
    expect(nodesText).toMatch(/D:\s*\d+\.\d{4}/);
    expect(nodesText).toMatch(/E:\s*\d+\.\d{4}/);

    // Canvas should have been drawn to; data URL should change after drawGraph
    const afterDataUrl = await app.getCanvasDataUrl();
    expect(afterDataUrl).toBeTruthy();
    // It's possible the canvas produces same image in very rare cases, but normally different after drawing
    expect(afterDataUrl).not.toBe(beforeDataUrl);

    // No unhandled page errors should have occurred during a normal calculation
    expect(page._collectedPageErrors.length).toBe(0);
  });

  test('Repeated calculations: clicking Calculate multiple times updates DOM and canvas without throwing', async ({ page }) => {
    // This test validates stability when the Calculate PageRank action is invoked multiple times
    const app = new PageRankPage(page);
    await app.goto();

    // Run calculation once
    await app.clickCalculate();
    await app.waitForRanksDisplayed(5000);
    const firstNodes = await app.getNodesText();
    const firstCanvas = await app.getCanvasDataUrl();

    // Run calculation again - should re-render values and canvas
    await app.clickCalculate();
    // Wait again for header (it exists already) - small delay to allow re-render
    await page.waitForTimeout(200);
    const secondNodes = await app.getNodesText();
    const secondCanvas = await app.getCanvasDataUrl();

    // The textual values should still include node entries (stability)
    expect(secondNodes).toMatch(/A:\s*\d+\.\d{4}/);

    // Canvas should produce a valid data URL; may or may not be identical, but must be valid
    expect(secondCanvas).toMatch(/^data:image\/png;base64,/);

    // Ensure no unhandled page errors happened during the repeated interactions
    expect(page._collectedPageErrors.length).toBe(0);
  });

  test('Runtime functions exist on window and can be invoked programmatically', async ({ page }) => {
    // This test checks for the existence of the named functions (onEnter/onExit in FSM mapped names)
    const app = new PageRankPage(page);
    await app.goto();

    const types = await app.functionsExist();
    expect(types.calculatePageRank).toBe('function');
    expect(types.displayRanks).toBe('function');
    expect(types.drawGraph).toBe('function');

    // Programmatic invocation should be possible; call calculatePageRank() via evaluate and ensure it runs
    // We call it directly (this will run the calculation synchronously in page context and return).
    const result = await page.evaluate(async () => {
      // call the function and return a simple success marker after it completes
      await calculatePageRank();
      return 'done';
    });
    expect(result).toBe('done');

    // Still expect no uncaught page errors after a programmatic invocation
    expect(page._collectedPageErrors.length).toBe(0);
  });

  test('Edge case: invoking drawGraph without ranks triggers a TypeError (observe unhandled pageerror)', async ({ page }) => {
    // This test intentionally triggers an unhandled runtime error to validate error observation.
    // It schedules a call to drawGraph() without arguments inside a setTimeout so the error is unhandled
    // and surfaces as a pageerror event rather than being caught by the evaluate() call.
    const app = new PageRankPage(page);
    await app.goto();

    // Ensure no prior errors
    expect(page._collectedPageErrors.length).toBe(0);

    // Schedule an unhandled call to drawGraph() in the page context
    // The call should run asynchronously and produce a TypeError because `ranks` is undefined.
    await page.evaluate(() => {
      // schedule unhandled invocation
      setTimeout(() => {
        // Intentionally call drawGraph with no args to provoke a runtime TypeError
        // Do not catch the error so it becomes an unhandled page error
        drawGraph();
      }, 0);
    });

    // Wait for the pageerror to be captured
    await page.waitForTimeout(200); // small delay to allow the scheduled function to run

    // At least one unhandled page error is expected and should be a TypeError
    expect(page._collectedPageErrors.length).toBeGreaterThanOrEqual(1);
    const err = page._collectedPageErrors[page._collectedPageErrors.length - 1];
    // The browser should report a TypeError for attempting to read properties of undefined
    expect(err.name).toBe('TypeError');

    // Optionally verify message includes indicative text; keep it loose to support varying browser messages
    expect(err.message.length).toBeGreaterThan(0);
  });

  test('Console messages and page errors capturing behavior', async ({ page }) => {
    // This test demonstrates capturing and asserting console output and page errors arrays.
    const app = new PageRankPage(page);
    await app.goto();

    // No messages initially
    expect(page._collectedConsole.length).toBeGreaterThanOrEqual(0);
    expect(page._collectedPageErrors.length).toBe(0);

    // Trigger a normal calculation which does not log to console in current implementation
    await app.clickCalculate();
    await app.waitForRanksDisplayed(3000);

    // There may be zero console messages, but the structure must have been collected
    expect(Array.isArray(page._collectedConsole)).toBe(true);
    // No unhandled errors expected in normal flow
    expect(page._collectedPageErrors.length).toBe(0);
  });
});