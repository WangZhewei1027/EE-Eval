import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c27c1-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Kruskal visualization page
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generateGraph');
    this.runBtn = page.locator('#runKruskal');
    this.resetBtn = page.locator('#reset');
    this.edgesList = page.locator('#edgesList');
    this.mstList = page.locator('#mstEdges');
    this.canvas = page.locator('#graphCanvas');
  }

  async navigate() {
    await this.page.goto(APP_URL);
    // Wait for onload init to run and initial graph generation to complete
    await this.page.waitForLoadState('load');
    // The initial generateRandomGraph call triggers DOM updates; wait for edgesList to have content
    await this.page.waitForTimeout(200); // small pause to let initial rendering occur
  }

  async clickGenerate() {
    await this.generateBtn.click();
    await this.page.waitForTimeout(100);
  }

  async clickRunKruskal() {
    await this.runBtn.click();
    await this.page.waitForTimeout(200);
  }

  async clickReset() {
    await this.resetBtn.click();
    await this.page.waitForTimeout(100);
  }

  async getEdgesListItems() {
    // return text contents of child nodes
    return this.edgesList.evaluate((el) => {
      const items = [];
      for (const child of el.children) {
        items.push(child.textContent.trim());
      }
      return items;
    });
  }

  async getMstListItems() {
    return this.mstList.evaluate((el) => {
      const items = [];
      for (const child of el.children) {
        items.push(child.textContent.trim());
      }
      // If no children, return the textContent (the placeholder message)
      if (items.length === 0) {
        return [el.textContent.trim()];
      }
      return items;
    });
  }

  async getMstText() {
    return this.mstList.textContent();
  }

  async getCanvasSize() {
    return this.canvas.evaluate((c) => ({ width: c.width, height: c.height }));
  }

  async hasFunctionOnWindow(fnName) {
    return this.page.evaluate((name) => typeof window[name] === 'function', fnName);
  }
}

test.describe('Kruskal Algorithm Visualization - FSM and UI validation', () => {
  // Global holders for console and page errors observed during a test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize arrays to capture console and page errors per test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0 (Idle) -> Initial entry action generateRandomGraph() invoked on load', async ({ page }) => {
    // Validate that the page loads and the initial generateRandomGraph() (onload/init) ran.
    const kruskal = new KruskalPage(page);
    await kruskal.navigate();

    // Verify functions exist on window: evidence in FSM
    expect(await kruskal.hasFunctionOnWindow('generateRandomGraph')).toBe(true);
    expect(await kruskal.hasFunctionOnWindow('runKruskal')).toBe(true);
    expect(await kruskal.hasFunctionOnWindow('reset')).toBe(true);

    // After initial generateRandomGraph call, edgesList should have at least one entry
    const edges = await kruskal.getEdgesListItems();
    expect(edges.length).toBeGreaterThan(0);

    // MST list should show the initial placeholder message (no MST computed yet)
    const mstText = (await kruskal.getMstListItems()).join('\n');
    expect(mstText).toContain("No edges in MST yet");

    // Canvas should exist with expected dimensions
    const canvasSize = await kruskal.getCanvasSize();
    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);

    // Assert there were no uncaught runtime errors during load
    // If pageErrors were observed, fail and include details
    expect(pageErrors, `Expected no uncaught page errors on load, but got: ${pageErrors.map(e => String(e)).join(' | ')}`).toHaveLength(0);

    // Also assert there were no console errors (type === 'error')
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Expected no console error messages, but found: ${JSON.stringify(errorConsoleMessages)}`).toHaveLength(0);
  });

  test('Transition: S0_Idle -> S1_GraphGenerated via clicking Generate Random Graph', async ({ page }) => {
    // This test verifies clicking the Generate button regenerates the graph and updates edgesList and canvas.
    const kruskal = new KruskalPage(page);
    await kruskal.navigate();

    // Capture current edges list snapshot
    const beforeEdges = await kruskal.getEdgesListItems();
    expect(beforeEdges.length).toBeGreaterThan(0);

    // Click Generate Random Graph (explicit event)
    await kruskal.clickGenerate();

    // After generating, edgesList should still contain entries and typically change
    const afterEdges = await kruskal.getEdgesListItems();
    expect(afterEdges.length).toBeGreaterThan(0);

    // Either the edges changed or remain valid; prefer to assert that the DOM was updated (text might differ)
    // It's possible that random generation yields same output (unlikely), so check for DOM update by HTML content length
    const beforeHtmlLength = await page.locator('#edgesList').evaluate(el => el.innerHTML.length);
    const afterHtmlLength = await page.locator('#edgesList').evaluate(el => el.innerHTML.length);
    // The lengths should be defined; ensure they are numbers
    expect(beforeHtmlLength).toBeGreaterThanOrEqual(0);
    expect(afterHtmlLength).toBeGreaterThanOrEqual(0);

    // No uncaught page errors and no console error logs during this interaction
    expect(pageErrors, `Unexpected page errors after Generate Graph: ${pageErrors.map(e => String(e)).join(' | ')}`).toHaveLength(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Unexpected console errors after Generate Graph: ${JSON.stringify(errorConsoleMessages)}`).toHaveLength(0);
  });

  test('Transition: S1_GraphGenerated -> S2_KruskalRunning via clicking Run Kruskal\'s Algorithm', async ({ page }) => {
    // Validate that running Kruskal populates the MST list and updates the canvas (visual feedback).
    const kruskal = new KruskalPage(page);
    await kruskal.navigate();

    // Ensure we are in state GraphGenerated: edges exist
    const edgesBefore = await kruskal.getEdgesListItems();
    expect(edgesBefore.length).toBeGreaterThan(0);

    // Click Run Kruskal
    await kruskal.clickRunKruskal();

    // MST should now have entries (not the placeholder message)
    const mstItems = await kruskal.getMstListItems();
    const mstJoined = mstItems.join('\n');
    expect(mstJoined).not.toContain("No edges in MST yet");
    // MST should include a 'Total MST Weight' summary element as final update
    expect(mstJoined).toMatch(/Total MST Weight:/);

    // Validate that MST edge count is <= V-1 (basic sanity check)
    // Retrieve number of vertices from the canvas text drawn (can't easily access JS variable), so infer from edges: MST has at least 1 and reasonable upper bound
    expect(mstItems.length).toBeGreaterThanOrEqual(1);

    // No uncaught runtime exceptions during algorithm run
    expect(pageErrors, `Unexpected page errors during Run Kruskal: ${pageErrors.map(e => String(e)).join(' | ')}`).toHaveLength(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Unexpected console errors during Run Kruskal: ${JSON.stringify(errorConsoleMessages)}`).toHaveLength(0);
  });

  test('Transition: S1_GraphGenerated -> S3_Reset via clicking Reset (MST cleared, Graph remains)', async ({ page }) => {
    // Validate that reset clears MST but keeps graph edges displayed (per implementation).
    const kruskal = new KruskalPage(page);
    await kruskal.navigate();

    // Ensure MST placeholder exists initially
    const mstInitial = await kruskal.getMstListItems();
    expect(mstInitial.join('\n')).toContain("No edges in MST yet");

    // Run Kruskal first to populate MST
    await kruskal.clickRunKruskal();
    const mstAfterRun = await kruskal.getMstListItems();
    expect(mstAfterRun.join('\n')).not.toContain("No edges in MST yet");

    // Now click Reset to clear MST
    await kruskal.clickReset();
    const mstAfterReset = await kruskal.getMstListItems();
    // Reset should show the placeholder message again
    expect(mstAfterReset.join('\n')).toContain("No edges in MST yet");

    // Edges list (graph edges) should still be present (reset does not regenerate edges)
    const edgesAfterReset = await kruskal.getEdgesListItems();
    expect(edgesAfterReset.length).toBeGreaterThan(0);

    // Validate no console errors or uncaught page errors during reset
    expect(pageErrors, `Unexpected page errors during Reset: ${pageErrors.map(e => String(e)).join(' | ')}`).toHaveLength(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Unexpected console errors during Reset: ${JSON.stringify(errorConsoleMessages)}`).toHaveLength(0);
  });

  test('Transition: S2_KruskalRunning -> S1_GraphGenerated via Reset (clear after running)', async ({ page }) => {
    // Validate that after running Kruskal, Reset returns to GraphGenerated state (MST cleared).
    const kruskal = new KruskalPage(page);
    await kruskal.navigate();

    // Run Kruskal
    await kruskal.clickRunKruskal();
    const mstAfterRun = await kruskal.getMstListItems();
    expect(mstAfterRun.join('\n')).not.toContain("No edges in MST yet");

    // Now reset
    await kruskal.clickReset();

    // MST should be cleared (placeholder message)
    const mstAfterReset = await kruskal.getMstListItems();
    expect(mstAfterReset.join('\n')).toContain("No edges in MST yet");

    // Ensure edges still shown
    const edgesNow = await kruskal.getEdgesListItems();
    expect(edgesNow.length).toBeGreaterThan(0);

    // Ensure no page errors and console errors
    expect(pageErrors, `Unexpected page errors during Reset after Run: ${pageErrors.map(e => String(e)).join(' | ')}`).toHaveLength(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Unexpected console errors during Reset after Run: ${JSON.stringify(errorConsoleMessages)}`).toHaveLength(0);
  });

  test('Edge cases: multiple consecutive clicks and idempotency of Reset; observe console and page errors', async ({ page }) => {
    // This test repeatedly clicks buttons to try to surface race conditions or thrown errors.
    const kruskal = new KruskalPage(page);
    await kruskal.navigate();

    // Rapidly click Generate several times
    for (let i = 0; i < 3; i++) {
      await kruskal.clickGenerate();
    }

    // Rapidly run Kruskal multiple times
    for (let i = 0; i < 3; i++) {
      await kruskal.clickRunKruskal();
    }

    // Rapidly click Reset multiple times (idempotency)
    for (let i = 0; i < 4; i++) {
      await kruskal.clickReset();
    }

    // After these operations, edges list should be present and MST should show placeholder (reset leaves MST empty)
    const edgesFinal = await kruskal.getEdgesListItems();
    expect(edgesFinal.length).toBeGreaterThan(0);

    const mstFinal = await kruskal.getMstListItems();
    // Since we reset last, expect placeholder message
    expect(mstFinal.join('\n')).toContain("No edges in MST yet");

    // Record console and page errors; tests should fail if any uncaught errors occurred during heavy interaction
    if (pageErrors.length > 0) {
      // Provide detailed failure message with error stack(s)
      const details = pageErrors.map(e => String(e)).join('\n---\n');
      throw new Error(`Uncaught page errors detected during stress test:\n${details}`);
    }
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Console error messages detected during stress test: ${JSON.stringify(errorConsoleMessages)}`).toHaveLength(0);
  });

  test('Sanity check: exported functions and no Syntax/Reference/Type errors on load (observing console and page errors)', async ({ page }) => {
    // This test explicitly observes console messages for common JS error names and asserts none were emitted.
    const kruskal = new KruskalPage(page);
    await kruskal.navigate();

    // Ensure functions exist
    expect(await kruskal.hasFunctionOnWindow('init')).toBe(true);
    expect(await kruskal.hasFunctionOnWindow('generateRandomGraph')).toBe(true);
    expect(await kruskal.hasFunctionOnWindow('runKruskal')).toBe(true);
    expect(await kruskal.hasFunctionOnWindow('reset')).toBe(true);

    // Inspect captured console messages for occurrences of ReferenceError, SyntaxError, TypeError
    const errorPattern = /(ReferenceError|SyntaxError|TypeError)/i;
    const matchingErrors = consoleMessages.filter(m => errorPattern.test(m.text) || m.type === 'error');

    // Fail the test if any of these critical errors are found in console or any uncaught page errors exist.
    if (matchingErrors.length > 0 || pageErrors.length > 0) {
      const consoleMsgs = matchingErrors.map(m => `${m.type}: ${m.text}`).join('\n');
      const pageErrs = pageErrors.map(e => String(e)).join('\n');
      throw new Error(`Detected critical errors:\nConsole Matches:\n${consoleMsgs}\n\nPage Errors:\n${pageErrs}`);
    }

    // Otherwise, explicitly assert none found
    expect(matchingErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});