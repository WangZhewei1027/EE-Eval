import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1d3c3-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Graph Visualization page
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.visualizeBtn = '#visualizeBtn';
    this.graphContainer = '#graphContainer';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main button to be available
    await this.page.waitForSelector(this.visualizeBtn);
  }

  async getButton() {
    return this.page.locator(this.visualizeBtn);
  }

  async getContainer() {
    return this.page.locator(this.graphContainer);
  }

  async clickVisualize() {
    await this.page.click(this.visualizeBtn);
  }

  // return locator lists
  getNodesLocator() {
    return this.page.locator(`${this.graphContainer} .node`);
  }

  getEdgesLocator() {
    return this.page.locator(`${this.graphContainer} .edge`);
  }
}

test.describe('Graph Visualization FSM (Undirected Graphs) - f0b1d3c3...', () => {
  // Collect runtime errors and console messages for each test to inspect later
  let pageErrors;
  let consoleErrors;
  let consoleWarnings;
  let consoleLogs;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleWarnings = [];
    consoleLogs = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      // store the error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages - classify by type
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      else if (type === 'warning') consoleWarnings.push(text);
      else consoleLogs.push({ type, text });
    });

    // Navigate to the app page
    await page.goto(APP_URL);
    // Wait at least for the button and container to be present
    await page.waitForSelector('#visualizeBtn');
    await page.waitForSelector('#graphContainer');
  });

  test.afterEach(async () => {
    // No teardown required beyond Playwright's context handling
    // But we keep tests deterministic by ensuring collections are available
  });

  test('S0_Idle: initial page renders expected elements (renderPage entry)', async ({ page }) => {
    // Validate initial Idle state as described in FSM:
    // - Visualize button present
    // - Graph container has initial instructional text
    const gp = new GraphPage(page);

    // Button exists and visible
    const btn = await gp.getButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Visualize Graph');

    // Graph container exists and contains placeholder text
    const container = await gp.getContainer();
    await expect(container).toBeVisible();

    // The initial paragraph should exist as textual child before clicking
    const containerHtml = await container.innerHTML();
    expect(containerHtml.toLowerCase()).toContain('graph will appear here');

    // Ensure no immediate uncaught exceptions were thrown during initial render
    // This asserts that page loaded without runtime errors during initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Visualizing: clicking Visualize Graph clears container and draws nodes & edges (drawGraph entry)', async ({ page }) => {
    // This test validates the main event/transition in the FSM:
    // - Clicking the #visualizeBtn triggers drawing logic:
    //   * container.innerHTML becomes empty then nodes (.node) and edges (.edge) are appended
    const gp = new GraphPage(page);

    // Precondition: ensure placeholder paragraph exists
    const container = await gp.getContainer();
    await expect(container.locator('p')).toHaveCount(1);

    // Click the visualize button
    await gp.clickVisualize();

    // After click, the placeholder paragraph should be removed (container cleared)
    await expect(container.locator('p')).toHaveCount(0);

    // There should be 5 nodes and 5 edges as per implementation
    const nodes = gp.getNodesLocator();
    const edges = gp.getEdgesLocator();

    await expect(nodes).toHaveCount(5);
    await expect(edges).toHaveCount(5);

    // Validate nodes textual ids (A-E) exist and are positioned by style attributes
    const expectedIds = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 0; i < expectedIds.length; i++) {
      const node = nodes.nth(i);
      await expect(node).toBeVisible();
      const text = await node.textContent();
      // ensure it contains the expected id somewhere (order might be preserved)
      expect(expectedIds).toContain(text.trim());
      // style left/top present and non-empty
      const left = await node.getAttribute('style');
      expect(left).toMatch(/left:.*px;?/);
      expect(left).toMatch(/top:.*px;?/);
    }

    // Validate edges have non-zero width and a rotate transform
    const edgesCount = await edges.count();
    for (let i = 0; i < edgesCount; i++) {
      const edge = edges.nth(i);
      await expect(edge).toBeVisible();
      const style = await edge.getAttribute('style');
      // width should be present (length computed)
      expect(style).toMatch(/width:.*px/);
      // transform should include rotate(angledeg)
      expect(style).toMatch(/transform:.*rotate\([0-9\.\-]+deg\)/);
      // left/top should be present
      expect(style).toMatch(/left:.*px/);
      expect(style).toMatch(/top:.*px/);
    }

    // No uncaught exceptions should have happened during drawing
    expect(pageErrors.length).toBe(0);
    // Also ensure no console.error messages were emitted (indicates runtime problems)
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated clicks: clicking "Visualize Graph" multiple times clears previous drawing and redraws (idempotence)', async ({ page }) => {
    // Edge case: clicking the button multiple times should not accumulate duplicate nodes/edges
    // The implementation clears container.innerHTML = '' before drawing, so node/edge counts should remain stable
    const gp = new GraphPage(page);

    // First click
    await gp.clickVisualize();
    await expect(gp.getNodesLocator()).toHaveCount(5);
    await expect(gp.getEdgesLocator()).toHaveCount(5);

    // Capture nodes text after first draw
    const nodesFirst = [];
    const nodesLocator = gp.getNodesLocator();
    for (let i = 0; i < 5; i++) {
      nodesFirst.push((await nodesLocator.nth(i).textContent()).trim());
    }

    // Second click (rapid)
    await gp.clickVisualize();
    await expect(gp.getNodesLocator()).toHaveCount(5);
    await expect(gp.getEdgesLocator()).toHaveCount(5);

    // Ensure node ids are still A-E (redrawn)
    const nodesSecond = [];
    for (let i = 0; i < 5; i++) {
      nodesSecond.push((await gp.getNodesLocator().nth(i).textContent()).trim());
    }

    // They should contain the same set (order may be consistent)
    expect(nodesFirst.length).toBe(5);
    expect(nodesSecond.length).toBe(5);
    expect(new Set(nodesSecond)).toEqual(new Set(['A', 'B', 'C', 'D', 'E']));

    // Rapid multiple clicks (simulate user spamming button)
    for (let i = 0; i < 3; i++) {
      await gp.clickVisualize();
    }
    // Still should be 5 nodes and 5 edges
    await expect(gp.getNodesLocator()).toHaveCount(5);
    await expect(gp.getEdgesLocator()).toHaveCount(5);

    // No uncaught exceptions occurred during multiple redraws
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge-case: container initially contains elements other than placeholder; clicking still clears and redraws', async ({ page }) => {
    // This test simulates the scenario where the container has extra stray DOM (manually inserted by page load).
    // We do not modify page JS; instead we insert an element into the container via the test harness (allowed).
    // Note: The instructions forbade injecting global variables or redefining functions, but DOM manipulation for testing is allowed.
    const gp = new GraphPage(page);

    // Insert an extra div inside the container to simulate unexpected markup (this is an edge-case test)
    await page.evaluate(() => {
      const container = document.getElementById('graphContainer');
      const marker = document.createElement('div');
      marker.id = 'test-marker';
      marker.textContent = 'TEST-MARKER';
      container.appendChild(marker);
    });

    // Ensure the marker is present
    await expect(page.locator('#graphContainer #test-marker')).toHaveCount(1);

    // Click visualize: page script should clear container.innerHTML = ''; which should remove the marker
    await gp.clickVisualize();

    // Marker should be gone
    await expect(page.locator('#test-marker')).toHaveCount(0);

    // Graph should be drawn anew with expected nodes/edges
    await expect(gp.getNodesLocator()).toHaveCount(5);
    await expect(gp.getEdgesLocator()).toHaveCount(5);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: console and pageerror streams are captured and contain no unexpected errors', async ({ page }) => {
    // This test validates that we are properly observing console and page errors.
    // It also asserts that the application does not throw runtime errors during normal usage.
    const gp = new GraphPage(page);

    // No errors before interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Trigger visualization
    await gp.clickVisualize();

    // Wait a tick to allow any asynchronous console messages to surface
    await page.waitForTimeout(100);

    // Re-assert there were no uncaught exceptions or console.error log entries
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // For diagnostics: ensure there are some console logs or normal console activity (not required)
    // We do not fail if there are none. We only assert that there are no console errors.
    // Optionally, inspect consoleWarnings for suspicious messages (but do not fail on warnings).
    // Ensure that any console warnings do not include the string "ReferenceError" or "TypeError" (indicates runtime problems)
    for (const warn of consoleWarnings) {
      expect(warn).not.toContain('ReferenceError');
      expect(warn).not.toContain('TypeError');
      expect(warn).not.toContain('SyntaxError');
    }
  });

  test('Accessibility & semantics: ensure interactive button is focusable and operable via keyboard (Enter/Space)', async ({ page }) => {
    // Validate keyboard operability as part of interaction tests
    const gp = new GraphPage(page);

    const btn = gp.getButton();
    await expect(btn).toBeVisible();
    await btn.focus();

    // Press Enter to trigger the same effect
    await page.keyboard.press('Enter');

    // After keyboard interaction, graph should be drawn
    await expect(gp.getNodesLocator()).toHaveCount(5);
    await expect(gp.getEdgesLocator()).toHaveCount(5);

    // Clear and press Space as well (space key triggers click on focused buttons in browsers)
    // Focus again and press Space
    await btn.focus();
    await page.keyboard.press('Space');

    // Still should be correct counts (the implementation clears and redraws)
    await expect(gp.getNodesLocator()).toHaveCount(5);
    await expect(gp.getEdgesLocator()).toHaveCount(5);

    // No uncaught exceptions
    expect(pageErrors.length).toBe(0);
  });
});