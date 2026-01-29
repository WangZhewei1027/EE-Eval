import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c962de0-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Binary Tree Visual Concept (Application ID: 3c962de0-fa78-11f0-857d-d58e82d5de73)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  // Handlers so we can remove them in afterEach
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    // Reset collections before each test
    consoleMessages = [];
    pageErrors = [];

    // Attach console and pageerror listeners to observe runtime behavior and errors
    consoleHandler = (msg) => {
      // collect all console messages for inspection (level, text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    pageErrorHandler = (error) => {
      // collect page errors (uncaught exceptions)
      pageErrors.push(error);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application page and wait for the initial SVG container and button
    await page.goto(APP_URL);
    await page.waitForSelector('#container svg');
    // Wait for nodes to be rendered (initial render uses updateUI during script execution)
    await page.waitForSelector('#nodes .node');
    await page.waitForSelector('#btnExpand');
  });

  test.afterEach(async ({ page }) => {
    // Tear down listeners to avoid cross-test interference
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);

    // Assert that there were no uncaught page errors during the test run.
    // The implementation should run without throwing runtime exceptions.
    expect(pageErrors, `Expected no runtime page errors, but found: ${pageErrors.map(e => e.message || e).join(' | ')}`).toHaveLength(0);

    // Additionally assert that there were no console.error messages (levels like 'error' or 'warning' can be informative)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors, `Expected no console errors/warnings, but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toHaveLength(0);
  });

  test('Initial state should be Collapsed (S0_Collapsed) with 3 nodes and 2 links', async ({ page }) => {
    // Validate button state and accessibility attributes for collapsed state
    const btn = page.locator('#btnExpand');
    await expect(btn).toHaveText('Expand Tree');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(btn).toHaveAttribute('aria-label', 'Toggle expand or collapse tree');

    // Validate that collapsed tree nodes and links are rendered
    const nodeLocator = page.locator('#nodes .node');
    const linkLocator = page.locator('#links line');

    // Expect 3 nodes and 2 links for collapsed state per FSM/implementation
    await expect(nodeLocator).toHaveCount(3);
    await expect(linkLocator).toHaveCount(2);

    // Check that node aria-labels match Node 1..3 (values present)
    const nodeLabels = await nodeLocator.evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
    expect(nodeLabels.sort()).toEqual(['Node 1', 'Node 2', 'Node 3'].sort());

    // Ensure the SVG glow defs were created (visual enhancement element)
    const hasGlowDef = await page.$eval('svg defs filter#glow', el => !!el).catch(() => false);
    expect(hasGlowDef).toBe(true);

    // Ensure links and nodes have animation-delay style set (staggering)
    const firstNodeStyle = await page.locator('#nodes .node').first().getAttribute('style');
    expect(firstNodeStyle).toContain('animation-delay');

    const firstLinkStyle = await page.locator('#links line').first().getAttribute('style');
    expect(firstLinkStyle).toContain('animation-delay');
  });

  test('Clicking Expand toggles to Expanded (S1_Expanded) with 7 nodes and 6 links', async ({ page }) => {
    // Click the expand button
    const btn = page.locator('#btnExpand');
    await btn.click();

    // After clicking, UI should update to expanded state
    await expect(btn).toHaveText('Collapse Tree');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');

    // Validate nodes and links counts for expanded state
    const nodeLocator = page.locator('#nodes .node');
    const linkLocator = page.locator('#links line');

    // Wait for expanded nodes to appear (7 nodes)
    await expect(nodeLocator).toHaveCount(7);
    await expect(linkLocator).toHaveCount(6);

    // Verify presence of nodes 1..7 via aria-labels
    const nodeLabels = await nodeLocator.evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
    const expectedLabels = ['Node 1','Node 2','Node 3','Node 4','Node 5','Node 6','Node 7'];
    expect(nodeLabels.sort()).toEqual(expectedLabels.sort());

    // Validate that node values (text nodes) correspond to their aria-label numbers
    const nodeTexts = await nodeLocator.evaluateAll(nodes => nodes.map(g => {
      const t = g.querySelector('text');
      return t ? t.textContent.trim() : null;
    }));
    expect(nodeTexts.sort()).toEqual(['1','2','3','4','5','6','7'].sort());
  });

  test('Clicking Collapse after Expand returns to Collapsed (S0_Collapsed)', async ({ page }) => {
    const btn = page.locator('#btnExpand');

    // Expand first
    await btn.click();
    await expect(btn).toHaveText('Collapse Tree');
    await expect(page.locator('#nodes .node')).toHaveCount(7);

    // Collapse by clicking again
    await btn.click();

    // Verify returned to collapsed state
    await expect(btn).toHaveText('Expand Tree');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#nodes .node')).toHaveCount(3);
    await expect(page.locator('#links line')).toHaveCount(2);

    // Confirm nodes correspond to Node 1..3
    const nodeLabels = await page.locator('#nodes .node').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
    expect(nodeLabels.sort()).toEqual(['Node 1','Node 2','Node 3'].sort());
  });

  test('Rapid multiple toggles produce a consistent final state (edge case)', async ({ page }) => {
    const btn = page.locator('#btnExpand');

    // Perform rapid clicks (5 clicks). Starting collapsed -> odd clicks => Expanded final
    await Promise.all(new Array(5).fill(0).map(() => btn.click()));

    // Expect final state to be Expanded (5 toggles => expanded)
    await expect(btn).toHaveText('Collapse Tree');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#nodes .node')).toHaveCount(7);
    await expect(page.locator('#links line')).toHaveCount(6);

    // Now perform 2 more rapid clicks => should end up Collapsed (7 total clicks)
    await Promise.all(new Array(2).fill(0).map(() => btn.click()));
    // After 2 more clicks (total 7), final parity is odd => Expanded. To explicitly test collapse, do one click to toggle even -> collapsed
    await btn.click(); // Now total 8 => Collapsed
    await expect(btn).toHaveText('Expand Tree');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#nodes .node')).toHaveCount(3);
    await expect(page.locator('#links line')).toHaveCount(2);
  });

  test('Accessibility and DOM structure checks (ancillary validations)', async ({ page }) => {
    // Validate the container has proper aria-label
    const containerLabel = await page.locator('#container').getAttribute('aria-label');
    expect(containerLabel).toBe('Binary Tree Visualization');

    // Validate buttons panel has aria-label
    const buttonsPanelLabel = await page.locator('#buttons').getAttribute('aria-label');
    expect(buttonsPanelLabel).toBe('Controls');

    // Validate footer text is present and contains expected substring
    const footerText = await page.locator('#footer').textContent();
    expect(footerText).toContain('Visual Concept');

    // Validate svg viewBox exists and matches expected value
    const svgViewBox = await page.locator('#container svg').getAttribute('viewBox');
    expect(svgViewBox).toBe('0 0 860 645');
  });

  test('Observability: No unexpected runtime exceptions or console errors during expand/collapse interactions', async ({ page }) => {
    // Re-run a sequence of expand/collapse to ensure no runtime errors appear
    const btn = page.locator('#btnExpand');

    // Toggle several times with pauses to allow DOM operations to settle
    for (let i = 0; i < 4; i++) {
      await btn.click();
      // wait for nodes to re-render
      await page.waitForTimeout(50);
    }

    // After interactions, still no page errors or console.error messages (checked in afterEach)
    // Additionally assert console has messages possibly from benign logs (we expect none)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

});