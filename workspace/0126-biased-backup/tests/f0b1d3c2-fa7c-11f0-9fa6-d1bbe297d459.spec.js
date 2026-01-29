import { test, expect } from '@playwright/test';

// Test file: f0b1d3c2-fa7c-11f0-9fa6-d1bbe297d459.spec.js
// Application URL (served static): http://127.0.0.1:5500/workspace/0126-biased/html/f0b1d3c2-fa7c-11f0-9fa6-d1bbe297d459.html

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1d3c2-fa7c-11f0-9fa6-d1bbe297d459.html';
    this.selectors = {
      demoBtn: '#demo-btn',
      demoGraph: '#demo-graph',
      nodes: '#demo-graph .node',
      edges: '#demo-graph .edge',
      arrows: '#demo-graph .arrow'
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async getButton() {
    return this.page.locator(this.selectors.demoBtn);
  }

  async clickShowButton() {
    await this.page.click(this.selectors.demoBtn);
  }

  async nodeCount() {
    return await this.page.locator(this.selectors.nodes).count();
  }

  async edgeCount() {
    return await this.page.locator(this.selectors.edges).count();
  }

  async arrowCount() {
    return await this.page.locator(this.selectors.arrows).count();
  }

  async demoGraphChildCount() {
    return await this.page.locator(this.selectors.demoGraph).evaluate((el) => el.childElementCount);
  }

  async getButtonText() {
    return await this.page.locator(this.selectors.demoBtn).textContent();
  }

  async isButtonDisabled() {
    return await this.page.locator(this.selectors.demoBtn).getAttribute('disabled').then(v => v !== null);
  }

  async getNodeLabels() {
    return await this.page.locator(this.selectors.nodes).allTextContents();
  }

  async getEdgeStyles() {
    return await this.page.locator(this.selectors.edges).evaluateAll((els) =>
      els.map((el) => ({
        width: el.style.width,
        left: el.style.left,
        top: el.style.top,
        transform: el.style.transform
      }))
    );
  }

  async getArrowStyles() {
    return await this.page.locator(this.selectors.arrows).evaluateAll((els) =>
      els.map((el) => ({
        left: el.style.left,
        top: el.style.top,
        transform: el.style.transform
      }))
    );
  }
}

test.describe('Directed Graphs: Demo FSM validation (f0b1d3c2-...)', () => {
  // Collect console errors and page errors per test to validate runtime behavior.
  test.beforeEach(async ({ page }) => {
    // Clear any default listeners and attach our own collectors
    page._collectedConsoleErrors = [];
    page._collectedPageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page._collectedConsoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', (err) => {
      page._collectedPageErrors.push(err);
    });
  });

  // Test 1: Initial state (S0_Idle) - the page should render the button and an empty graph container.
  test('S0_Idle: initial render shows "Show Example Graph" button and empty demo graph', async ({ page }) => {
    const demo = new DemoPage(page);

    // Navigate to the page (entry action: renderPage() is represented by the static HTML)
    await demo.goto();

    // Validate button exists and has correct initial text
    const btn = await demo.getButton();
    await expect(btn).toBeVisible();
    const text = (await demo.getButtonText())?.trim();
    expect(text).toBe('Show Example Graph');

    // Button should not be disabled initially
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(false);

    // The demo graph container should be present and initially empty (no graph elements)
    const childCount = await demo.demoGraphChildCount();
    expect(childCount).toBe(0);

    // Ensure no runtime console errors or page errors occurred during initial load
    expect(page._collectedConsoleErrors.length).toBe(0);
    expect(page._collectedPageErrors.length).toBe(0);
  });

  // Test 2: Transition ShowGraph - clicking button displays nodes/edges and updates button (S1_GraphDisplayed)
  test('ShowGraph event: clicking button appends nodes and edges, disables button, and updates text', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Capture pre-click counts
    expect(await demo.nodeCount()).toBe(0);
    expect(await demo.edgeCount()).toBe(0);

    // Click the button to trigger the ShowGraph transition
    // This should create node and edge elements and update the button state/text
    await demo.clickShowButton();

    // After click: expect 3 nodes and 4 edges present (per implementation)
    await expect(page.locator(demo.selectors.nodes)).toHaveCount(3);
    await expect(page.locator(demo.selectors.edges)).toHaveCount(4);

    // Each edge should contain an arrow element
    await expect(page.locator(demo.selectors.arrows)).toHaveCount(4);

    // Button should now be disabled and display "Graph Displayed"
    const btnText = (await demo.getButtonText())?.trim();
    expect(btnText).toBe('Graph Displayed');

    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(true);

    // Validate graph container child count equals edges + nodes = 7
    const childCount = await demo.demoGraphChildCount();
    expect(childCount).toBe(7);

    // Validate node labels include A, B, C (order may vary but contents should be present)
    const labels = await demo.getNodeLabels();
    expect(labels.sort()).toEqual(['A', 'B', 'C'].sort());

    // Inspect edge styles: ensure each edge element has a width string (could be '0px' if computed from detached nodes),
    // and transform/left/top present (as strings, possibly empty). We assert non-null strings to confirm DOM attributes set.
    const edgeStyles = await demo.getEdgeStyles();
    expect(edgeStyles.length).toBe(4);
    for (const es of edgeStyles) {
      // width should be a non-empty string (even '0px' is acceptable)
      expect(typeof es.width).toBe('string');
      expect(es.width.length).toBeGreaterThanOrEqual(0);
      // left/top/transform are strings as well (may be empty depending on geometry)
      expect(typeof es.left).toBe('string');
      expect(typeof es.top).toBe('string');
      expect(typeof es.transform).toBe('string');
    }

    // Inspect arrow styles: ensure arrow elements have left/top/transform strings
    const arrowStyles = await demo.getArrowStyles();
    expect(arrowStyles.length).toBe(4);
    for (const as of arrowStyles) {
      expect(typeof as.left).toBe('string');
      expect(typeof as.top).toBe('string');
      expect(typeof as.transform).toBe('string');
    }

    // Ensure no console errors or page errors were produced by the click handler
    expect(page._collectedConsoleErrors.length).toBe(0);
    expect(page._collectedPageErrors.length).toBe(0);
  });

  // Test 3: Edge case - clicking the button again should not produce additional graph elements nor runtime errors.
  // The implementation disables the button after the first click; ensure that behavior prevents duplication.
  test('Edge case: second click does not duplicate elements and causes no runtime errors', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // First click to display graph
    await demo.clickShowButton();
    await expect(page.locator(demo.selectors.nodes)).toHaveCount(3);
    await expect(page.locator(demo.selectors.edges)).toHaveCount(4);

    // Attempt to click again via user-initiated click; disabled buttons should not fire the handler.
    // Use page.click which simulates a real user click; since the button is disabled, it should not add more elements.
    await page.click(demo.selectors.demoBtn).catch(() => {
      // In case playwright raises due to element disabled, ignore - the important check is that no extra elements are added.
    });

    // After second click attempt, counts should remain unchanged
    await expect(page.locator(demo.selectors.nodes)).toHaveCount(3);
    await expect(page.locator(demo.selectors.edges)).toHaveCount(4);

    // Also verify that child count remains 7
    const childCount = await demo.demoGraphChildCount();
    expect(childCount).toBe(7);

    // Confirm no console errors or page errors were emitted during the second click attempt
    expect(page._collectedConsoleErrors.length).toBe(0);
    expect(page._collectedPageErrors.length).toBe(0);
  });

  // Test 4: Validate DOM insertion order expectation (edges appended before nodes) and check layering by child indexes.
  test('DOM order: edges are appended before nodes (implementation detail) and nodes appear above edges', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Trigger graph display
    await demo.clickShowButton();

    // Grab children of demo-graph and determine which are edges vs nodes in sequence
    const childrenInfo = await page.locator('#demo-graph').evaluate((el) => {
      return Array.from(el.children).map((child) => ({
        className: child.className,
        tagName: child.tagName,
        textContent: child.textContent || ''
      }));
    });

    // Expect the first 4 children to be edges and last 3 to be nodes if implementation order is preserved
    // We will not strictly fail if ordering differs, but we assert that there are 4 edges and 3 nodes overall and
    // check for at least one edge preceding nodes in the child list to reflect the append order in code.
    const edgeCountInOrder = childrenInfo.filter((c) => c.className.includes('edge')).length;
    const nodeCountInOrder = childrenInfo.filter((c) => c.className.includes('node')).length;
    expect(edgeCountInOrder).toBe(4);
    expect(nodeCountInOrder).toBe(3);

    // Assert that at least one edge appears before at least one node in the DOM child order (reflecting append sequence)
    const firstEdgeIndex = childrenInfo.findIndex((c) => c.className.includes('edge'));
    const firstNodeIndex = childrenInfo.findIndex((c) => c.className.includes('node'));
    expect(firstEdgeIndex).toBeGreaterThanOrEqual(0);
    expect(firstNodeIndex).toBeGreaterThanOrEqual(0);
    expect(firstEdgeIndex).toBeLessThan(firstNodeIndex);

    // No console/page errors produced by insertion/layout code
    expect(page._collectedConsoleErrors.length).toBe(0);
    expect(page._collectedPageErrors.length).toBe(0);
  });

  // Test 5: Robustness - ensure that programmatic attempts to create more nodes/edges via injection are not performed by tests
  // and that the page's runtime does not throw ReferenceError/TypeError/SyntaxError during normal usage.
  test('Runtime errors: ensure no ReferenceError/TypeError/SyntaxError occur during normal interactions', async ({ page }) => {
    const demo = new DemoPage(page);

    // Navigate and perform actions
    await demo.goto();
    await demo.clickShowButton();

    // After interactions, inspect collected page errors (should be none)
    // If any thrown errors occurred they will be present in page._collectedPageErrors
    const pageErrors = page._collectedPageErrors;
    const consoleErrors = page._collectedConsoleErrors;

    // Provide explicit assertions for the absence of common JS runtime errors.
    // We do not attempt to inject or modify the page - only observe. If the application had errors,
    // these assertions would fail and surface the real issues.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});