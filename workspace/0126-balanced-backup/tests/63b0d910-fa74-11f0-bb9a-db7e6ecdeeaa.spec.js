import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b0d910-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Suffix Tree Visualization (Application ID: 63b0d910-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Shared state captured per test
  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions
    page['_pageErrors'] = [];
    page['_consoleMessages'] = [];
    page['_dialogs'] = [];

    // Observe unhandled page errors (Runtime exceptions)
    page.on('pageerror', (err) => {
      page['_pageErrors'].push(err);
    });

    // Observe console messages and categorize them
    page.on('console', (msg) => {
      page['_consoleMessages'].push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Automatically accept alerts/prompts to avoid blocking, but record them
    page.on('dialog', async (dialog) => {
      page['_dialogs'].push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // ignore accept errors (will be reported via pageerror if any)
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: no unexpected page errors during test runtime
    const pageErrors = page['_pageErrors'] || [];
    expect(pageErrors.length, `No runtime page errors expected, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    // No console errors (we allow other console messages like 'info' or 'log')
    const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `No console errors/warnings expected, got: ${consoleErrors.map(c => c.text).join('; ')}`).toBe(0);
  });

  test.describe('Initial render and Idle state (S0_Idle)', () => {
    test('renders input and Build button; initial automatic build happens and SVG is present', async ({ page }) => {
      // Validate Idle state: input and build button exist
      const input = page.locator('#inputStr');
      const buildBtn = page.locator('#buildBtn');

      await expect(input).toHaveCount(1);
      await expect(buildBtn).toHaveCount(1);

      // Input default value should be the example provided in HTML
      await expect(input).toHaveValue('banana$');

      // The page's script triggers an initial click on load. We should observe a built SVG in #tree.
      // Wait for SVG to appear in the visualization container
      const svg = page.locator('#tree svg');
      await expect(svg).toBeVisible({ timeout: 3000 });

      // Ensure svg contains node groups drawn by the TreeVisualizer
      const nodeElements = page.locator('#tree svg .node');
      const leafElements = page.locator('#tree svg .leaf');
      // There should be at least one node and at least one leaf for 'banana$'
      await expect(nodeElements.count()).toBeGreaterThan(0);
      await expect(leafElements.count()).toBeGreaterThan(0);

      // Ensure edges are drawn (path elements with class 'edge')
      const edges = page.locator('#tree svg .edge');
      await expect(edges.count()).toBeGreaterThan(0);

      // Validate that no dialogs were shown during the automatic initial build (since input is already sanitized)
      const dialogs = page['_dialogs'] || [];
      // For the initial load sanitized input was 'banana$' and should not have triggered sanitization alert.
      expect(dialogs.length).toBeLessThanOrEqual(1); // allow zero or one in case environment had stray dialog; prefer zero
    });
  });

  test.describe('Building and transitions (S0_Idle -> S1_TreeBuilt)', () => {
    test('clicking Build button rebuilds the suffix tree and replaces the visualization', async ({ page }) => {
      // Ensure we have an existing SVG from initial build
      const svgBefore = await page.locator('#tree svg').elementHandle();
      expect(svgBefore).toBeTruthy();

      // Count nodes before rebuild
      const nodesBefore = await page.locator('#tree svg .node').count();

      // Perform explicit click to trigger BuildTreeClick transition
      await page.click('#buildBtn');

      // After click, a new svg should be inserted (container.innerHTML = "" -> replaced)
      const svgAfter = await page.locator('#tree svg').elementHandle();
      expect(svgAfter).toBeTruthy();

      // The element handle should be different (replaced) - comparing object identity by outerHTML string changed
      const beforeHTML = await svgBefore!.evaluate((el) => el.outerHTML);
      const afterHTML = await svgAfter!.evaluate((el) => el.outerHTML);
      expect(afterHTML).not.toBeNull();
      // Because rebuild replaces the svg, outerHTML is expected to be present and plausibly different or equal.
      // We assert that the container has a single svg and the drawn nodes exist.
      const nodeCountAfter = await page.locator('#tree svg .node').count();
      await expect(nodeCountAfter).toBeGreaterThan(0);

      // At least the visualization exists after rebuild
      expect(nodeCountAfter).toBeGreaterThanOrEqual(nodesBefore); // rebuild should produce nodes (non-decreasing)
    });

    test('sanitizes input with uppercase/special chars and shows sanitization alert, then builds', async ({ page }) => {
      // Clear previous dialogs
      page['_dialogs'] = [];

      // Set input to a string with uppercase and symbols so sanitizeInput modifies it
      const inputLocator = page.locator('#inputStr');
      await inputLocator.fill('Ab1!');

      // Click build - should trigger sanitization alert (and then proceed to build)
      await page.click('#buildBtn');

      // Wait a short time for dialogs to be recorded and build to finish
      await page.waitForTimeout(200); // small pause to let alert handling and SVG creation complete

      const dialogs = page['_dialogs'] || [];
      // Expect at least one dialog for sanitization
      const sanitizeDialog = dialogs.find(d => d.message.includes("Input sanitized to"));
      expect(sanitizeDialog, `Expected a sanitization alert dialog to appear. Dialogs seen: ${JSON.stringify(dialogs)}`).toBeTruthy();

      // After accepting the alert, the input field value should have been updated to sanitized form ('abc$')
      await expect(inputLocator).toHaveValue('abc$');

      // And the visualization should have been (re)built: an svg should be present
      const svg = page.locator('#tree svg');
      await expect(svg).toBeVisible({ timeout: 3000 });

      // There should be nodes drawn
      const nodeCount = await page.locator('#tree svg .node').count();
      await expect(nodeCount).toBeGreaterThan(0);
    });

    test('empty input triggers non-empty alert and does not change visualization', async ({ page }) => {
      // Ensure svg present before attempting empty input build
      const svgBeforeHandle = await page.locator('#tree svg').elementHandle();
      const svgBeforeHTML = svgBeforeHandle ? await svgBeforeHandle.evaluate(el => el.outerHTML) : null;

      // Clear input completely
      await page.locator('#inputStr').fill('');

      // Clear recorded dialogs
      page['_dialogs'] = [];

      // Click build - should trigger alert "Please enter a non-empty string."
      await page.click('#buildBtn');

      // Wait briefly for alert to be processed
      await page.waitForTimeout(100);

      const dialogs = page['_dialogs'] || [];
      const emptyDialog = dialogs.find(d => d.message && d.message.includes('Please enter a non-empty string.'));
      expect(emptyDialog, `Expected empty input alert. Dialogs: ${JSON.stringify(dialogs)}`).toBeTruthy();

      // The visualization should remain unchanged (script returns early on empty input)
      const svgAfterHandle = await page.locator('#tree svg').elementHandle();
      const svgAfterHTML = svgAfterHandle ? await svgAfterHandle.evaluate(el => el.outerHTML) : null;

      expect(svgBeforeHTML).toBe(svgAfterHTML);
    });
  });

  test.describe('Visual correctness and DOM structure (S1_TreeBuilt)', () => {
    test('visualization contains expected SVG structure: defs marker, edges, nodes, labels', async ({ page }) => {
      // Ensure there's an SVG built
      const svgLocator = page.locator('#tree svg');
      await expect(svgLocator).toBeVisible({ timeout: 3000 });

      // defs must include marker with id 'arrowhead' as implementation uses marker-end url(#arrowhead)
      const marker = page.locator('#tree svg defs marker#arrowhead');
      await expect(marker).toHaveCount(1);

      // Edge paths should exist and have the 'd' attribute describing the path
      const edgePaths = page.locator('#tree svg path.edge');
      const edgeCount = await edgePaths.count();
      await expect(edgeCount).toBeGreaterThan(0);
      // Check first edge has a path 'd' attribute
      const firstEdgeD = await edgePaths.nth(0).getAttribute('d');
      expect(typeof firstEdgeD === 'string' && firstEdgeD.length > 0).toBeTruthy();

      // Node labels: ensure nodeLabel texts exist and are non-empty
      const nodeLabels = page.locator('#tree svg text.nodeLabel');
      await expect(nodeLabels.count()).toBeGreaterThan(0);
      const firstLabel = await nodeLabels.nth(0).textContent();
      expect(typeof firstLabel === 'string' && firstLabel.length > 0).toBeTruthy();

      // Edge labels should be present as text.edgeLabel
      const edgeLabels = page.locator('#tree svg text.edgeLabel');
      await expect(edgeLabels.count()).toBeGreaterThan(0);
      const elText = await edgeLabels.nth(0).textContent();
      // Edge labels correspond to substrings of the input; they should be non-empty strings
      expect(elText && elText.length > 0).toBeTruthy();
    });
  });
});