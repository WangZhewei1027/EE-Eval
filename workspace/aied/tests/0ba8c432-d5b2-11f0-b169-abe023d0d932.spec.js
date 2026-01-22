import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba8c432-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Weighted Graph FSM - 0ba8c432-d5b2-11f0-b169-abe023d0d932', () => {

  // Helper to set up listeners that capture console.error messages and page errors.
  async function attachErrorListeners(page, collectors) {
    collectors.consoleErrors = [];
    collectors.pageErrors = [];

    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          collectors.consoleErrors.push(msg.text());
        }
      } catch (e) {
        // swallow any listener errors
      }
    });

    page.on('pageerror', err => {
      try {
        // err may be an Error or other value; stringify safely
        collectors.pageErrors.push(err && err.message ? String(err.message) : String(err));
      } catch (e) {
        // swallow
      }
    });
  }

  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto(APP_URL);
  });

  test('Idle state - initial DOM elements are present and correct', async ({ page }) => {
    // Validate initial Idle state as per FSM S0_Idle:
    // - Inputs and buttons exist with expected placeholders/text
    // - Graph container exists and is empty initially
    await expect(page.locator('#node')).toBeVisible();
    await expect(page.locator('#edge')).toBeVisible();
    await expect(page.locator('#add-node')).toBeVisible();
    await expect(page.locator('#add-edge')).toBeVisible();
    await expect(page.locator('#node')).toHaveAttribute('placeholder', 'Enter node name');
    await expect(page.locator('#edge')).toHaveAttribute('placeholder', 'Enter edge weight');

    // The graph container should exist and initially be empty
    const graphHtml = await page.locator('#graph').innerHTML();
    expect(graphHtml.trim()).toBe('');
  });

  test('Add Node transition (S0_Idle -> S1_NodeAdded) updates the graph DOM', async ({ page }) => {
    // This test validates that clicking "Add Node" with a node name:
    // - Adds a node entry into the graph (updateGraph is called implicitly)
    // - No page errors occur during normal node addition
    const collectors = {};
    await attachErrorListeners(page, collectors);

    // Enter node name 'A' and click Add Node
    await page.fill('#node', 'A');
    await page.click('#add-node');

    // After adding, the graph should contain a .node element with text 'A'
    const nodeLocator = page.locator('#graph .node', { hasText: 'A' });
    await expect(nodeLocator).toHaveCount(1);
    await expect(nodeLocator.first()).toHaveText('A');

    // Ensure no runtime page errors or console errors occurred during node addition
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  test('Add Edge transition without existing node should be a no-op (no errors, no DOM change)', async ({ page }) => {
    // This validates that trying to add an edge when the corresponding node isn't present:
    // - Does not modify the graph DOM
    // - Does not throw a runtime error (because the code first checks graph[edge])
    const collectors = {};
    await attachErrorListeners(page, collectors);

    // Ensure graph empty
    await expect(page.locator('#graph .node')).toHaveCount(0);

    // Fill edge input to 'A' and click Add Edge (no corresponding node in graph)
    await page.fill('#edge', 'A');
    await page.click('#add-edge');

    // Graph should remain unchanged (still no nodes)
    await expect(page.locator('#graph .node')).toHaveCount(0);

    // No page errors expected in this scenario
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  test('Add Edge transition (S0_Idle -> S2_EdgeAdded) when node exists triggers runtime error due to missing #weight', async ({ page }) => {
    // This test intentionally triggers the buggy path in addEdge:
    // - Add a node with name 'B'
    // - Set edge input to 'B' and click Add Edge
    // The implementation checks graph[edge] and then tries to access document.getElementById('weight').value,
    // but there is no #weight element in the HTML, causing a TypeError. We must observe and assert that
    // this runtime error occurs naturally.
    const collectors = {};
    await attachErrorListeners(page, collectors);

    // Add node 'B' first
    await page.fill('#node', 'B');
    await page.click('#add-node');

    // Sanity: graph shows node B
    await expect(page.locator('#graph .node', { hasText: 'B' })).toHaveCount(1);

    // Now set the edge input to 'B' (matching the node) to satisfy if (graph[edge]) condition
    await page.fill('#edge', 'B');

    // Click Add Edge which is expected to throw a runtime error due to missing #weight element.
    // We don't catch the error — we let it happen and assert listeners captured it.
    await page.click('#add-edge');

    // Wait briefly to ensure pageerror events have been fired and collected
    await page.waitForTimeout(100);

    // There should be at least one page error recorded
    expect(collectors.pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error messages should indicate an issue accessing .value on null (TypeError)
    const pageErrorCombined = collectors.pageErrors.join(' | ');
    const consoleErrorCombined = collectors.consoleErrors.join(' | ');

    // Assert that either pageErrors or consoleErrors contain an indicative TypeError/reading/null text
    const sawIndicativeError = /typeerror|cannot read|reading 'value'|reading "value"|null/i;
    expect(sawIndicativeError.test(pageErrorCombined) || sawIndicativeError.test(consoleErrorCombined)).toBeTruthy();
  });

  test('Edge case: Adding empty node name creates a node DOM entry (empty content) without errors', async ({ page }) => {
    // This test validates adding an empty node name:
    // - The implementation will create graph[""] = {} and push "" into nodes
    // - updateGraph will render a .node element with empty textContent
    const collectors = {};
    await attachErrorListeners(page, collectors);

    // Ensure graph is empty initially
    await expect(page.locator('#graph .node')).toHaveCount(0);

    // Click Add Node with empty input
    await page.fill('#node', ''); // explicitly set empty
    await page.click('#add-node');

    // There should be a single .node element, but its text should be empty
    const nodes = page.locator('#graph .node');
    await expect(nodes).toHaveCount(1);
    const text = await nodes.first().textContent();
    expect(text).toBe('');

    // No page errors are expected for this action
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

  test('Adding the same node twice results in only one visible node in the DOM (graph keys are unique)', async ({ page }) => {
    // The implementation pushes duplicates into the nodes array but uses graph object keys for display,
    // so adding the same node twice should still render one DOM node for that key.
    const collectors = {};
    await attachErrorListeners(page, collectors);

    // Add node 'C' twice
    await page.fill('#node', 'C');
    await page.click('#add-node');
    await page.fill('#node', 'C');
    await page.click('#add-node');

    // Graph should show only one .node element for 'C' despite duplicate pushes
    const nodeLocator = page.locator('#graph .node', { hasText: 'C' });
    await expect(nodeLocator).toHaveCount(1);

    // No runtime errors expected
    expect(collectors.pageErrors.length).toBe(0);
    expect(collectors.consoleErrors.length).toBe(0);
  });

});