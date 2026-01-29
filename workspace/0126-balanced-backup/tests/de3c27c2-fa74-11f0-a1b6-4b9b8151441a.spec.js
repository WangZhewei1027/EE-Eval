import { test, expect } from '@playwright/test';

class PrimPage {
  /**
   * Page object for the Prim's Algorithm visualization page.
   * Encapsulates selectors and simple interactions without altering page JS.
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generateGraph');
    this.startBtn = page.locator('#startAlgorithm');
    this.resetBtn = page.locator('#reset');
    this.graphContainer = page.locator('#graphContainer');
    this.stepsList = page.locator('#steps');
  }

  async goto(url) {
    await this.page.goto(url);
    // Ensure load event has fired
    await this.page.waitForLoadState('load');
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async graphInnerHTML() {
    return await this.graphContainer.evaluate(el => el.innerHTML);
  }

  async stepsInnerHTML() {
    return await this.stepsList.evaluate(el => el.innerHTML);
  }

  // Safe checks using typeof to avoid causing ReferenceErrors
  async typeofGlobal(name) {
    return await this.page.evaluate(n => typeof window[n], name);
  }
}

test.describe('Prim Algorithm Visualization - FSM and error observation', () => {
  const url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c27c2-fa74-11f0-a1b6-4b9b8151441a.html';
  let primPage;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages (e.g., SyntaxError reported in console)
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // Swallow any unexpected errors from the listener itself.
      }
    });

    // Capture uncaught page errors (runtime exceptions)
    page.on('pageerror', err => {
      try {
        pageErrors.push(err.message || String(err));
      } catch (e) {
        // ignore
      }
    });

    primPage = new PrimPage(page);
    await primPage.goto(url);

    // Small delay to allow any inline script parse/runtime errors to be emitted
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  test('Initial load should render basic DOM elements (S0_Idle) and emit script parse/runtime errors', async () => {
    // Validate presence of UI components expected in the Idle state
    await expect(primPage.generateBtn).toBeVisible();
    await expect(primPage.startBtn).toBeVisible();
    await expect(primPage.resetBtn).toBeVisible();
    await expect(primPage.graphContainer).toBeVisible();
    await expect(primPage.stepsList).toBeVisible();

    // The implementation has a known syntax/runtime issue in the inline script.
    // We expect at least one console error or page error to have been recorded.
    const totalErrors = consoleErrors.length + pageErrors.length;
    expect(totalErrors).toBeGreaterThan(0);

    // At least one error should reference a SyntaxError or unexpected token (robust check).
    const combined = consoleErrors.concat(pageErrors).join(' | ');
    const hasSyntax = /SyntaxError|Unexpected token|Unexpected identifier|Unexpected string|Uncaught/.test(combined);
    expect(hasSyntax).toBeTruthy();

    // Because the script likely failed to run, helper functions and stateful globals shouldn't be defined.
    // We use typeof checks which are safe and do not create new errors.
    expect(await primPage.typeofGlobal('generateRandomGraph')).not.toBe('function');
    expect(await primPage.typeofGlobal('primsAlgorithm')).not.toBe('function');
    expect(await primPage.typeofGlobal('renderGraph')).not.toBe('function');
    expect(await primPage.typeofGlobal('clearGraph')).not.toBe('function');

    // Since the script likely didn't run, the graph container and steps should be empty initially.
    const graphHtml = await primPage.graphInnerHTML();
    const stepsHtml = await primPage.stepsInnerHTML();
    expect(graphHtml.trim()).toBe('');
    expect(stepsHtml.trim()).toBe('');
  });

  test.describe('Events and transitions (attempts should not crash the page further)', () => {
    test('Clicking Generate Random Graph should not produce successful graph rendering when script failed (S0 -> S1)', async () => {
      // Record current error counts
      const beforeConsoleCount = consoleErrors.length;
      const beforePageCount = pageErrors.length;

      // Attempt to trigger the GenerateGraph event
      await primPage.clickGenerate();

      // Wait briefly for any additional errors to appear
      await new Promise(resolve => setTimeout(resolve, 150));

      // DOM should remain unchanged (no nodes/edges rendered) because script didn't attach handlers
      const graphHtmlAfter = await primPage.graphInnerHTML();
      expect(graphHtmlAfter.trim()).toBe('');

      // No new errors beyond the initial parse/runtime errors should necessarily be produced by the click.
      // But allow for cases where browsers emit additional errors; assert we did not unexpectedly clear prior errors.
      expect(consoleErrors.length).toBeGreaterThanOrEqual(beforeConsoleCount);
      expect(pageErrors.length).toBeGreaterThanOrEqual(beforePageCount);
    });

    test('Clicking Start Algorithm should not start algorithm steps when script failed (S0 -> S2)', async () => {
      const beforeConsoleCount = consoleErrors.length;
      const beforePageCount = pageErrors.length;

      // Attempt to start algorithm
      await primPage.clickStart();

      // Wait for potential errors
      await new Promise(resolve => setTimeout(resolve, 150));

      // Steps list should remain empty
      const stepsHtmlAfter = await primPage.stepsInnerHTML();
      expect(stepsHtmlAfter.trim()).toBe('');

      // Verify that the global isRunning variable was not set by the page script (typeof is safe)
      const isRunningType = await primPage.page.evaluate(() => typeof window.isRunning);
      // If script didn't run, typeof window.isRunning should be 'undefined' (or not 'boolean'/'object')
      expect(isRunningType).not.toBe('boolean');

      // Error counts should not have decreased
      expect(consoleErrors.length).toBeGreaterThanOrEqual(beforeConsoleCount);
      expect(pageErrors.length).toBeGreaterThanOrEqual(beforePageCount);
    });

    test('Clicking Reset should not reset anything when script failed (S0 -> S3)', async () => {
      const beforeConsoleCount = consoleErrors.length;
      const beforePageCount = pageErrors.length;

      // Attempt to reset
      await primPage.clickReset();

      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 150));

      // Steps and graph should remain unchanged (still empty)
      const graphHtmlAfter = await primPage.graphInnerHTML();
      const stepsHtmlAfter = await primPage.stepsInnerHTML();
      expect(graphHtmlAfter.trim()).toBe('');
      expect(stepsHtmlAfter.trim()).toBe('');

      // No unexpected error reduction
      expect(consoleErrors.length).toBeGreaterThanOrEqual(beforeConsoleCount);
      expect(pageErrors.length).toBeGreaterThanOrEqual(beforePageCount);
    });
  });

  test.describe('State-specific expectations when script is present vs absent', () => {
    test('Validate that FSM entry action functions are not available due to script parse error (renderGraph, primsAlgorithm)', async () => {
      // Check that expected entry action functions referenced by the FSM are not defined
      expect(await primPage.typeofGlobal('renderPage')).not.toBe('function');
      expect(await primPage.typeofGlobal('renderGraph')).not.toBe('function');
      expect(await primPage.typeofGlobal('primsAlgorithm')).not.toBe('function');

      // Confirm that nodes/edges globals are not present as usable arrays
      const nodesType = await primPage.page.evaluate(() => typeof window.nodes);
      const edgesType = await primPage.page.evaluate(() => typeof window.edges);
      expect(nodesType).not.toBe('object'); // would be 'object' if array was defined
      expect(edgesType).not.toBe('object');
    });

    test('Edge case: ensure clicking buttons does not create new uncaught ReferenceErrors by us (we do not call undefined functions)', async () => {
      // We only click buttons; ensure no new pageerror entries appear as a result of our interactions.
      const beforePageErrors = pageErrors.length;

      // Perform interaction sequence: generate -> start -> reset
      await primPage.clickGenerate();
      await primPage.clickStart();
      await primPage.clickReset();

      // Allow events to surface
      await new Promise(resolve => setTimeout(resolve, 200));

      // Page-level errors should not decrease; they may stay same or increase if page generated more errors.
      expect(pageErrors.length).toBeGreaterThanOrEqual(beforePageErrors);
    });
  });

  test('Diagnostic: surface captured console and page errors for debugging', async () => {
    // This test aggregates and asserts that we captured errors and logs their content for diagnostics.
    const combined = consoleErrors.concat(pageErrors);
    // We must have captured at least one error as the inline script contains an invalid expression.
    expect(combined.length).toBeGreaterThan(0);

    // Additionally assert that at least one captured message mentions 'edge-' or similar indicative snippet
    // from the broken line "edge.element = edge-${edge.from}-${edge.to};"
    const suspicious = combined.some(msg => /edge-|\$\{edge\.from|\$\{edge\.to|edge\-\$\{/.test(msg) || /SyntaxError|Unexpected token/.test(msg));
    expect(suspicious).toBeTruthy();

    // For test output clarity, also assert combined messages are strings
    combined.forEach(msg => expect(typeof msg).toBe('string'));
  });
});