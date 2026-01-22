import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17640281-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('Dijkstra\'s Algorithm Visualization - FSM validation and runtime checks', () => {
  // Hold console error messages and uncaught page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages emitted by the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Capture uncaught exceptions on the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
    // Ensure the graph container and nodes are loaded before assertions in tests
    await page.waitForSelector('#graph');
    await page.waitForSelector('.node');
  });

  test.afterEach(async () => {
    // No explicit teardown required; Playwright handles cleanup
    // but we keep this hook to emphasize test structure and future extensibility
  });

  test.describe('State S0_Idle (Initial render)', () => {
    test('renders header, instructions, and the graph container', async ({ page }) => {
      // Validate entry evidence for Idle state: header and paragraph exist with expected text
      const h1 = await page.locator('h1').textContent();
      const p = await page.locator('p').textContent();
      expect(h1).toContain("Dijkstra's Algorithm Visualization");
      expect(p).toContain('Hover over the nodes to see the edges and click to find the shortest path.');

      // Graph container exists and has expected dimensions/position style attributes (basic check)
      const graph = page.locator('#graph');
      await expect(graph).toBeVisible();
    });

    test('renders the expected number of nodes and edges and no path highlighting initially', async ({ page }) => {
      // There are 5 nodes defined in the implementation
      const nodes = page.locator('#graph > .node');
      await expect(nodes).toHaveCount(5);

      // There are 5 edges defined in the implementation as '.edge' elements
      const edges = page.locator('#graph > .edge');
      await expect(edges).toHaveCount(5);

      // Ensure no node starts with the 'path' class in the Idle state
      const pathNodes = page.locator('#graph .node.path');
      await expect(pathNodes).toHaveCount(0);
    });

    test('no uncaught runtime errors or console errors on initial load', async () => {
      // Assert that page did not emit uncaught errors during load
      expect(pageErrors.length).toBe(0);

      // Assert that no console 'error' messages were logged on load
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Event: NodeClick and Transition: S0_Idle -> S1_PathFound', () => {
    test('clicking a node triggers path drawing and highlights nodes as path', async ({ page }) => {
      // Click the first node (node with id 0). Use nth-child(1) because nodes appended first.
      const firstNode = page.locator('#graph > .node').nth(0);
      await firstNode.click();

      // After clicking, drawPath will add 'path' class to selected nodes.
      // The implementation always starts reconstructing path from node with index nodes.length - 1 (node id 4)
      // So node 4 (nth-child(5)) should always be included in the path highlighting after a click.
      const targetNode = page.locator('#graph > .node').nth(4); // node id 4
      await expect(targetNode).toHaveClass(/path/);

      // At least one node should now have the 'path' class
      const pathNodes = page.locator('#graph .node.path');
      await expect(pathNodes).toHaveCountGreaterThan(0);

      // Confirm that the total number of nodes with .path increased compared to initial idle state
      // (We expect it to be >= 1 here)
      const count = await pathNodes.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });