import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c96a312-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Graph Visualization — FSM comprehensive tests (Application 3c96a312-...)', () => {
  // Collect runtime console errors and page errors for each test run.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages (console.error & runtime console messages)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is (do not modify)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown per test besides letting Playwright close the page automatically.
    // The collected console/page errors are asserted within tests.
  });

  test('S0_Idle: Page renders initial UI and expected elements (entry action: renderPage())', async ({ page }) => {
    // Verify page headings are present as evidence for Idle state
    const h1 = page.locator('h1');
    const h2 = page.locator('h2');
    await expect(h1).toHaveText('Graph (Undirected)');
    await expect(h2).toHaveText('An elegant visualization of an undirected graph');

    // Verify container and SVG exist with expected attributes
    const container = page.locator('.container');
    await expect(container).toHaveAttribute('aria-label', 'Undirected graph visualization');

    const svg = page.locator('svg');
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg).toHaveAttribute('viewBox', '0 0 680 680');

    // Buttons initial aria-pressed states as in the implementation evidence
    const btnHighlight = page.locator('#btnHighlightEdges');
    const btnPulse = page.locator('#btnPulseNodes');
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'false');
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'true');

    // Nodes initially have the glow-pulse class per HTML
    const nodes = page.locator('.node');
    await expect(nodes).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await expect(nodes.nth(i)).toHaveClass(/glow-pulse/);
    }

    // Ensure no runtime errors were emitted during initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleHighlightEdges: clicking highlight toggles edge highlight and aria-pressed (S0 -> S1 and S1 -> S2)', async ({ page }) => {
    const btnHighlight = page.locator('#btnHighlightEdges');
    const edges = page.locator('.edge');

    // Precondition: edges should not have 'highlighted' class
    for (let i = 0; i < await edges.count(); i++) {
      await expect(edges.nth(i)).not.toHaveClass(/highlighted/);
    }

    // Click to highlight edges (transition to S1_EdgesHighlighted)
    await btnHighlight.click();

    // After click: aria-pressed should reflect new boolean 'true'
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'true');

    // All edges should now have the highlighted class
    for (let i = 0; i < await edges.count(); i++) {
      await expect(edges.nth(i)).toHaveClass(/highlighted/);
    }

    // Click again to toggle back (S1 -> S2)
    await btnHighlight.click();

    // aria-pressed should now be 'false'
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'false');

    // Edges should no longer have highlighted class
    for (let i = 0; i < await edges.count(); i++) {
      await expect(edges.nth(i)).not.toHaveClass(/highlighted/);
    }

    // Edge-case: multiple rapid clicks should toggle reliably
    await btnHighlight.click(); // highlight
    await btnHighlight.click(); // un-highlight
    await btnHighlight.click(); // highlight again
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'true');

    // Verify classes match the final state
    for (let i = 0; i < await edges.count(); i++) {
      await expect(edges.nth(i)).toHaveClass(/highlighted/);
    }

    // Assert no uncaught page errors or console error messages occurred during interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleNodePulse: clicking pulse toggles glow-pulse on nodes and aria-pressed (S0 -> S4 and S4 -> S3)', async ({ page }) => {
    const btnPulse = page.locator('#btnPulseNodes');
    const nodes = page.locator('.node');

    // Initial state: pulseActive is true, nodes have glow-pulse class
    for (let i = 0; i < await nodes.count(); i++) {
      await expect(nodes.nth(i)).toHaveClass(/glow-pulse/);
    }
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'true');

    // Click to disable pulse (transition to S4_NodesNotPulsing)
    await btnPulse.click();
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'false');
    for (let i = 0; i < await nodes.count(); i++) {
      await expect(nodes.nth(i)).not.toHaveClass(/glow-pulse/);
    }

    // Click again to re-enable pulse (S4 -> S3)
    await btnPulse.click();
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'true');
    for (let i = 0; i < await nodes.count(); i++) {
      await expect(nodes.nth(i)).toHaveClass(/glow-pulse/);
    }

    // Edge case: toggling many times quickly should keep aria-pressed consistent with last click
    await btnPulse.click(); // off
    await btnPulse.click(); // on
    await btnPulse.click(); // off
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'false');

    // Final assertion on nodes' class for the final off state
    for (let i = 0; i < await nodes.count(); i++) {
      await expect(nodes.nth(i)).not.toHaveClass(/glow-pulse/);
    }

    // Check for runtime errors (none expected)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Tooltip behavior: mouseenter shows tooltip, mousemove repositions, and mouseleave hides (NodeMouseEnter / NodeMouseLeave)', async ({ page }) => {
    const tooltip = page.locator('#tooltip');
    const node0 = page.locator('#n0'); // Node A

    // Ensure tooltip starts hidden
    await expect(tooltip).toHaveAttribute('aria-hidden', 'true');

    // Move mouse over the node to trigger 'mouseenter' and 'mousemove' handlers
    // Use bounding box to move mouse precisely over the node
    const box = await node0.boundingBox();
    expect(box).not.toBeNull();
    // Move to the center of the node
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // A small pause to allow the event handlers to run and style updates to apply
    await page.waitForTimeout(50);

    // Tooltip should show with the corresponding label
    await expect(tooltip).toHaveText('Node A');
    await expect(tooltip).toHaveAttribute('aria-hidden', 'false');

    // Check inline opacity was set to '1' by the event handler
    const opacity = await tooltip.evaluate((el) => el.style.opacity);
    expect(opacity === '1' || opacity === '1.0').toBeTruthy();

    // Save position after initial hover
    const leftAfterHover = await tooltip.evaluate((el) => el.style.left);
    const topAfterHover = await tooltip.evaluate((el) => el.style.top);

    // Move mouse slightly to trigger 'mousemove' and reposition the tooltip
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10);
    await page.waitForTimeout(20);

    const leftAfterMove = await tooltip.evaluate((el) => el.style.left);
    const topAfterMove = await tooltip.evaluate((el) => el.style.top);

    // The tooltip position should update when mouse moves (left/top should change)
    // We assert that at least one of left or top changed
    expect(leftAfterMove !== leftAfterHover || topAfterMove !== topAfterHover).toBeTruthy();

    // Move the mouse away to trigger mouseleave
    await page.mouse.move(0, 0);
    await page.waitForTimeout(50);

    // Tooltip should hide again
    await expect(tooltip).toHaveAttribute('aria-hidden', 'true');
    const opacityAfterLeave = await tooltip.evaluate((el) => el.style.opacity || getComputedStyle(el).opacity);
    // Handler sets opacity to '0'
    expect(opacityAfterLeave === '0' || opacityAfterLeave === '0.0').toBeTruthy();

    // No runtime errors should have been emitted during tooltip interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Keyboard focus on node shows tooltip and blur hides it (focus / blur handlers)', async ({ page }) => {
    const tooltip = page.locator('#tooltip');
    const node1 = page.locator('#n1'); // Node B

    // Focus the node to trigger focus handler
    await node1.focus();
    await page.waitForTimeout(20);

    // Tooltip should be visible with Node B label
    await expect(tooltip).toHaveText('Node B');
    await expect(tooltip).toHaveAttribute('aria-hidden', 'false');

    // Blur to hide tooltip
    await node1.evaluate((n) => (n.blur ? n.blur() : undefined));
    await page.waitForTimeout(20);
    await expect(tooltip).toHaveAttribute('aria-hidden', 'true');

    // Confirm nodes have tabindex attribute for accessibility
    const nodes = page.locator('.node');
    for (let i = 0; i < await nodes.count(); i++) {
      await expect(nodes.nth(i)).toHaveAttribute('tabindex', '0');
    }

    // No runtime errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Comprehensive transition coverage: cycle through all FSM toggles and ensure consistent DOM states', async ({ page }) => {
    const btnHighlight = page.locator('#btnHighlightEdges');
    const btnPulse = page.locator('#btnPulseNodes');
    const edges = page.locator('.edge');
    const nodes = page.locator('.node');

    // Start from initial state (Idle): edges not highlighted, nodes pulsing
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'false');
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'true');

    // 1) Toggle edges -> highlighted (S0 -> S1)
    await btnHighlight.click();
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'true');
    for (let i = 0; i < await edges.count(); i++) {
      await expect(edges.nth(i)).toHaveClass(/highlighted/);
    }

    // 2) Toggle nodes pulse off (S0 -> S4 from Idle perspective)
    await btnPulse.click();
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'false');
    for (let i = 0; i < await nodes.count(); i++) {
      await expect(nodes.nth(i)).not.toHaveClass(/glow-pulse/);
    }

    // 3) Toggle edges off (S1 -> S2)
    await btnHighlight.click();
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'false');
    for (let i = 0; i < await edges.count(); i++) {
      await expect(edges.nth(i)).not.toHaveClass(/highlighted/);
    }

    // 4) Toggle nodes pulse on (S4 -> S3)
    await btnPulse.click();
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'true');
    for (let i = 0; i < await nodes.count(); i++) {
      await expect(nodes.nth(i)).toHaveClass(/glow-pulse/);
    }

    // Repeat toggles to cover transitions S2 -> S1 and S3 -> S4
    await btnHighlight.click(); // S2 -> S1
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'true');
    await btnHighlight.click(); // back to S2
    await expect(btnHighlight).toHaveAttribute('aria-pressed', 'false');

    await btnPulse.click(); // S3 -> S4
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'false');
    await btnPulse.click(); // back to S3
    await expect(btnPulse).toHaveAttribute('aria-pressed', 'true');

    // Final state sanity check: no lingering partial states
    for (let i = 0; i < await edges.count(); i++) {
      // Either highlighted or not — check class exists or not by reading attribute to ensure code executed earlier
      const cls = await edges.nth(i).getAttribute('class');
      expect(typeof cls).toBe('string');
    }
    for (let i = 0; i < await nodes.count(); i++) {
      const cls = await nodes.nth(i).getAttribute('class');
      expect(typeof cls).toBe('string');
    }

    // Ensure no page exceptions or console errors were produced during the combined sequence
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Runtime diagnostics: capture and assert absence of ReferenceError/SyntaxError/TypeError on load and interactions', async ({ page }) => {
    // This test focuses on observing the page and asserting that no runtime exceptions were emitted.
    // We have already been collecting console errors and page errors in beforeEach listeners.
    // Assert no captured page errors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);

    // Assert no console error messages were emitted
    expect(consoleErrors.length).toBe(0);

    // As an extra defensive check, perform a trivial operation that would re-run event listeners:
    // click both buttons once and interact with a node to exercise more code paths.
    await page.locator('#btnHighlightEdges').click();
    await page.locator('#btnPulseNodes').click();

    const node2Box = await page.locator('#n2').boundingBox();
    if (node2Box) {
      await page.mouse.move(node2Box.x + node2Box.width / 2, node2Box.y + node2Box.height / 2);
      await page.waitForTimeout(20);
      await page.mouse.move(0, 0);
    }

    // After additional interaction, ensure still no errors were recorded
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});