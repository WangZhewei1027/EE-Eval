import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8dc9b3-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Bellman-Ford Algorithm Visualization (FSM: Idle -> Running)', () => {
  let consoleMessages;
  let pageErrors;

  // Common setup to collect console and page errors for each test, and navigate to the app.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (including errors) emitted by the page
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors (pageerror events)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure the page is fully loaded before assertions
    await page.waitForLoadState('load');
  });

  test.afterEach(async () => {
    // Nothing special to tear down per test - Playwright fixtures handle closing pages/contexts.
  });

  test('Initial (S0_Idle) state: page renders expected components and no active classes', async ({ page }) => {
    // This test validates the Idle state: presence of UI, graph container, nodes and edges,
    // and that no nodes/edges are "active" before running the algorithm.

    // Check the Run Algorithm button exists and has correct text
    const startButton = await page.waitForSelector('#startButton', { state: 'visible' });
    expect(startButton).not.toBeNull();
    expect(await startButton.innerText()).toBe('Run Algorithm');

    // Check the graph container exists
    const graphContainer = await page.$('#graphContainer');
    expect(graphContainer).not.toBeNull();

    // Check nodes and edges were created from the implementation
    const nodes = await page.$$('.node');
    const edges = await page.$$('.edge');

    // Implementation defines 4 nodes and 5 edges in the HTML/JS
    expect(nodes.length).toBe(4);
    expect(edges.length).toBe(5);

    // None of the nodes or edges should have the 'active' class on initial render
    for (const node of nodes) {
      const classAttr = await node.getAttribute('class');
      expect(classAttr.includes('active')).toBe(false);
    }
    for (const edge of edges) {
      const classAttr = await edge.getAttribute('class');
      expect(classAttr.includes('active')).toBe(false);
    }

    // FSM initial state's entry_actions mentioned `renderPage()`. Verify whether such a global exists.
    // We must not inject or call it — only check for its presence on the window object.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // The implementation provided does not define renderPage; assert that fact so tests reflect reality.
    expect(hasRenderPage).toBe(false);

    // Assert there were no page errors or console error messages during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Event: RunAlgorithm transition (S0_Idle -> S1_Running) activates nodes and edges', async ({ page }) => {
    // This test validates the transition triggered by clicking the Run Algorithm button.
    // It checks that nodes and edges acquire the 'active' class as the algorithm "runs".

    // Ensure initial state as a sanity check
    const nodesBefore = await page.$$('.node');
    expect(nodesBefore.length).toBe(4);
    const edgesBefore = await page.$$('.edge');
    expect(edgesBefore.length).toBe(5);

    // Click the Run Algorithm button to trigger the transition to the Running state
    await page.click('#startButton');

    // The implementation uses setInterval and setTimeout with delays based on iterations.
    // At iteration 0, setTimeout uses delay 0 and will add .active to nodes and edges immediately.
    // Wait for at least one node to become active.
    await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.some(n => n.classList.contains('active'));
    }, { timeout: 3000 });

    // Now assert that all edges have become active (edges are all set active inside the same timeouts)
    const edgesActive = await page.$$eval('.edge', edges =>
      edges.every(e => e.classList.contains('active'))
    );
    expect(edgesActive).toBe(true);

    // And at least the first node should be active; after small delay all nodes should be active
    await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.length > 0 && nodes.every(n => n.classList.contains('active'));
    }, { timeout: 3000 });

    const allNodesActive = await page.$$eval('.node', nodes =>
      nodes.every(n => n.classList.contains('active'))
    );
    expect(allNodesActive).toBe(true);

    // Verify that clicking the button (the event) was wired and produced the observable visual changes.
    // Also ensure there were no uncaught page errors or console errors during the transition.
    const consoleErrorsAfter = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorsAfter.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple clicks should not produce runtime errors and visual state remains stable', async ({ page }) => {
    // This test validates robustness: clicking Run multiple times should not throw errors,
    // and after algorithm runs, the visual state remains (nodes/edges remain active).
    // It also monitors console and page errors.

    // Click the Run Algorithm button multiple times in quick succession
    await page.click('#startButton');
    await page.click('#startButton');
    await page.click('#startButton');

    // Give the time-based animations/process some time to run; final interval termination in implementation
    // would occur after a few seconds. Wait up to 5 seconds to ensure the process completes and classes applied.
    await page.waitForTimeout(5000);

    // After the runs, all nodes and edges should still have the active class
    const allNodesActive = await page.$$eval('.node', nodes =>
      nodes.length > 0 && nodes.every(n => n.classList.contains('active'))
    );
    const allEdgesActive = await page.$$eval('.edge', edges =>
      edges.length > 0 && edges.every(e => e.classList.contains('active'))
    );
    expect(allNodesActive).toBe(true);
    expect(allEdgesActive).toBe(true);

    // Ensure no page errors or console error messages were emitted as a result of repeated clicks
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Behavior verification: clicking an unrelated area does not start the algorithm', async ({ page }) => {
    // This test ensures that only the expected event (#startButton click) triggers the FSM transition.
    // Clicking elsewhere should not produce active classes or errors.

    // Click on the graph container (an unrelated area)
    await page.click('#graphContainer');

    // Wait briefly to allow any accidental handlers to run if they exist
    await page.waitForTimeout(500);

    // Nodes and edges should still be inactive
    const nodesStillInactive = await page.$$eval('.node', nodes =>
      nodes.every(n => !n.classList.contains('active'))
    );
    const edgesStillInactive = await page.$$eval('.edge', edges =>
      edges.every(e => !e.classList.contains('active'))
    );

    expect(nodesStillInactive).toBe(true);
    expect(edgesStillInactive).toBe(true);

    // No console errors or page errors should have been produced by clicking the container
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Verify FSM evidence elements exist: components match extracted selectors', async ({ page }) => {
    // This test asserts that the components identified in the FSM extraction are actually present in the DOM.
    // It checks #startButton, .graph-container, .node and .edge selectors.

    const startButton = await page.$('#startButton');
    const graphContainer = await page.$('.graph-container');
    const nodes = await page.$$('.node');
    const edges = await page.$$('.edge');

    expect(startButton).not.toBeNull();
    expect(graphContainer).not.toBeNull();
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    expect(edges.length).toBeGreaterThanOrEqual(1);

    // Confirm button has expected accessible text
    expect(await startButton.innerText()).toContain('Run Algorithm');

    // No page errors during this check
    expect(pageErrors.length).toBe(0);
  });
});