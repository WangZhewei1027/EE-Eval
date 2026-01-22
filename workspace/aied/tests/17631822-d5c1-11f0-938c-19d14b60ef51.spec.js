import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17631822-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('Weighted Graph Visualization - Rendering and FSM checks', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners and navigate before each test so we can observe console/page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // collect all console messages for later inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      // collect unhandled exceptions from the page
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL);
  });

  // Test the single FSM state: S0_Idle - visual presence of #graph and entry actions evidence
  test('S0_Idle: graph container is present and rendered', async ({ page }) => {
    // This test validates that the Idle state (visual) is present by checking the #graph element.
    const graph = page.locator('#graph');
    await expect(graph).toHaveCount(1);

    // There should be no interactive controls in this Idle-only visualization
    await expect(page.locator('button')).toHaveCount(0);
    await expect(page.locator('input')).toHaveCount(0);
    await expect(page.locator('select')).toHaveCount(0);
  });

  // Validate nodes are drawn correctly with expected labels and positions
  test('Graph rendering: nodes are created with correct labels and positions', async ({ page }) => {
    // This test validates the DOM nodes representing graph nodes and checks their positions match the data.
    const nodeLocator = page.locator('#graph .node');
    await expect(nodeLocator).toHaveCount(5); // Expect 5 nodes: A..E

    // Retrieve the node DOM texts and ensure A-E are present
    const texts = await nodeLocator.allTextContents();
    // Convert texts to a Set for easy membership checks
    const textSet = new Set(texts.map(t => t.trim()));
    ['A', 'B', 'C', 'D', 'E'].forEach(label => {
      expect(textSet.has(label)).toBeTruthy();
    });

    // Pull the original node data from the page script to cross-check positions
    const nodeData = await page.evaluate(() => {
      // graph is defined in the page script tag; read its nodes array
      // Return array of {id, x, y}
      return window.graph && window.graph.nodes ? window.graph.nodes : [];
    });

    // For each declared node, verify the corresponding DOM element has matching left/top styles
    for (const expectedNode of nodeData) {
      const locator = page.locator(`#graph .node`, { hasText: expectedNode.id });
      await expect(locator).toHaveCount(1);

      // Get the inline style values (left/top are set inline in the page script)
      const styleLeft = await locator.evaluate(el => el.style.left);
      const styleTop = await locator.evaluate(el => el.style.top);

      expect(styleLeft).toBe(`${expectedNode.x}px`);
      expect(styleTop).toBe(`${expectedNode.y}px`);
    }
  });

  // Validate edges and weight labels are created and styled
  test('Graph rendering: edges and weight labels are present and formatted', async ({ page }) => {
    // This test checks that visual edges (.edge) and weight labels (span) are appended to the graph container.
    const edgeLocator = page.locator('#graph .edge');
    await expect(edgeLocator).toHaveCount(6); // Expect 6 edges per the implementation

    // Each edge should have a computed width greater than zero and a transform containing translate and rotate
    const edgesCount = await edgeLocator.count();
    for (let i = 0; i < edgesCount; i++) {
      const edge = edgeLocator.nth(i);
      const widthStyle = await edge.evaluate(el => el.style.width);
      // width should be a pixel value like "123.456px"
      expect(widthStyle.endsWith('px')).toBeTruthy();
      const widthValue = parseFloat(widthStyle.replace('px', ''));
      expect(widthValue).toBeGreaterThan(0);

      const transformStyle = await edge.evaluate(el => el.style.transform);
      // transform is expected to include a translate(xpx, ypx) and rotate(angledeg)
      expect(transformStyle.includes('translate(') || transformStyle.includes('translate3d(')).toBeTruthy();
      expect(transformStyle.includes('rotate(')).toBeTruthy();
    }

    // Weight labels are appended as span elements directly to the graph container
    const weightSpans = page.locator('#graph > span');
    await expect(weightSpans).toHaveCount(6);

    // Verify the weight labels match the weights defined in the graph data
    const weightsInDOM = await weightSpans.allTextContents();
    const weightsFromData = await page.evaluate(() => {
      return window.graph && window.graph.edges ? window.graph.edges.map(e => String(e.weight)) : [];
    });

    // The implementation appends labels in the same order as edges.forEach, so expect arrays to match
    expect(weightsInDOM.map(s => s.trim())).toEqual(weightsFromData);
  });

  // Validate FSM entry action mention: renderPage() is listed in FSM but not necessarily present in page context
  test('FSM entry action check: renderPage function presence', async ({ page }) => {
    // The FSM described an entry action "renderPage()". This test verifies whether such a function exists on window.
    // It explicitly does not inject or define renderPage; it only inspects the page environment as-is.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // The application implemented rendering inline and did not define renderPage; assert that fact.
    expect(hasRenderPage).toBeFalsy();
  });

  // Validate there are no defined transitions or interactive event handlers as per FSM extraction notes
  test('FSM transitions and event handlers: none present (no interactive elements)', async ({ page }) => {
    // The FSM extraction indicates no interactive elements or event handlers. Verify there are no clickable controls.
    await expect(page.locator('button, input, textarea, select, [role="button"]')).toHaveCount(0);

    // Verify that the page did render content visually but did not register obvious interactive handlers (best-effort)
    // We cannot introspect JS event listeners reliably without modifying the page; we at least assert that no visible controls exist.
    const nodeCount = await page.locator('#graph .node').count();
    expect(nodeCount).toBeGreaterThan(0);
  });

  // Observe and assert that no runtime errors (pageerror) or console.error messages occurred during load
  test('Runtime: no page errors or console.error messages during initial load', async ({ page }) => {
    // This test collects console messages and page errors from beforeEach navigation and ensures none indicate runtime failures.
    // Filter console messages for error-level types
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    // Assert that there were no uncaught exceptions and no console.error messages.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Reload page to ensure idempotent rendering with no errors on subsequent loads
  test('Edge Case: reload page and verify repeatable rendering with no additional errors', async ({ page }) => {
    // Reload the page
    await page.reload();

    // After reload, ensure nodes and edges are still present
    await expect(page.locator('#graph .node')).toHaveCount(5);
    await expect(page.locator('#graph .edge')).toHaveCount(6);
    // Ensure no new unhandled exceptions were reported (pageerror listener persists)
    expect(pageErrors.length).toBe(0);

    // Also ensure console.error wasn't emitted during reload
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});