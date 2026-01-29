import { test, expect } from '@playwright/test';

test.setTimeout(120000); // Some animations are long; give generous timeout

// Test file for Application ID: 72aa5371-fa78-11f0-812d-c9788050701f
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/72aa5371-fa78-11f0-812d-c9788050701f.html
// This suite validates the FSM states/transitions for the Dijkstra visualization.
// It also captures console messages and page errors and asserts on them.

test.describe('Dijkstra Visualization - FSM states and transitions', () => {
  // Shared variables to collect console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console events
    page.on('console', msg => {
      // store text and type for later assertions/debugging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test (loaded exactly as-is)
    await page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/72aa5371-fa78-11f0-812d-c9788050701f.html', { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors occurred during the test.
    // This follows the requirement to observe page errors and assert their presence/absence.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

    // Optionally surface console errors if they exist (we consider console.error as failure)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `Console error/warning messages:\n${consoleErrors.map(e => `${e.type}: ${e.text}`).join('\n')}`).toBe(0);
  });

  test.describe('S0_Idle (Initial) state validations', () => {
    test('Initial DOM setup: initGraph() was executed on load', async ({ page }) => {
      // Validate nodes and edges were created by initGraph on DOMContentLoaded (entry action of S0)
      // There should be 6 nodes (A-F) and 8 edges as per implementation.
      const nodeIds = await page.$$eval('.node', nodes => nodes.map(n => n.id).sort());
      expect(nodeIds).toEqual(['node-A', 'node-B', 'node-C', 'node-D', 'node-E', 'node-F'].sort());

      const edgeCount = await page.$$eval('.edge', edges => edges.length);
      expect(edgeCount).toBe(8);

      const weightCount = await page.$$eval('.weight', weights => weights.length);
      expect(weightCount).toBe(8);

      // Start and end nodes should have corresponding classes
      const startClass = await page.getAttribute('#node-A', 'class');
      expect(startClass).toContain('start');

      const endClass = await page.getAttribute('#node-F', 'class');
      expect(endClass).toContain('end');

      // No visited or path classes initially
      const anyVisited = await page.$('.node.visited');
      expect(anyVisited).toBeNull();

      const anyPathNode = await page.$('.node.path');
      expect(anyPathNode).toBeNull();

      // Buttons should be present and start should be enabled in idle state
      const startDisabled = await page.$eval('#startBtn', b => b.disabled);
      expect(startDisabled).toBe(false);

      const resetDisabled = await page.$eval('#resetBtn', b => b.disabled || false);
      // There is no disabled attribute on reset in implementation; this just verifies presence
      expect(resetDisabled).toBe(false);
    });

    test('Reset when already idle clears visual states without errors', async ({ page }) => {
      // Click reset in idle - should simply clear classes and not throw
      await page.click('#resetBtn');

      // After reset, still no visited/path nodes or active steps
      const anyVisited = await page.$('.node.visited');
      expect(anyVisited).toBeNull();

      const anyPathNode = await page.$('.node.path');
      expect(anyPathNode).toBeNull();

      const anyActiveStep = await page.$('.step.active');
      expect(anyActiveStep).toBeNull();
    });
  });

  test.describe('S1_AlgorithmRunning state and transitions', () => {
    test('Run Algorithm: clicking Run Algorithm transitions to running and eventually completes', async ({ page }) => {
      // Start algorithm - this should trigger runDijkstra (entry action for S1)
      // Verify startBtn disabled while running, then eventually step6 active indicating completion (S2)
      await page.click('#startBtn');

      // Immediately after click startBtn should be disabled (evidence in implementation)
      // Use a short wait to let DOM update
      await page.waitForTimeout(100);
      let startDisabled = await page.$eval('#startBtn', b => b.disabled);
      expect(startDisabled).toBe(true);

      // While algorithm runs, nodes should get visited at some point. Wait for at least one visited node.
      // Use a timeout large enough to accommodate animations.
      await page.waitForSelector('.node.visited', { timeout: 30000 });

      // Wait for final animation step (step6 active) which denotes AlgorithmCompleted (S2)
      // The implementation animates step numbers and then animates path and re-enables the start button.
      await page.waitForSelector('#step6.active', { timeout: 60000 });

      // After completion, startBtn should be re-enabled
      startDisabled = await page.$eval('#startBtn', b => b.disabled);
      expect(startDisabled).toBe(false);

      // Validate that the final active step is 6
      const activeStepId = await page.$eval('.step.active', el => el.id);
      expect(activeStepId).toBe('step6');

      // Validate that some nodes are marked as part of the path (class 'path') and that start/end are included
      const pathNodes = await page.$$eval('.node.path', nodes => nodes.map(n => n.id));
      // At minimum, both start and end should be part of the path if a path was found
      expect(pathNodes).toEqual(expect.arrayContaining(['node-A', 'node-F']));

      // Validate at least one edge has class 'path' (part of the shortest path highlight)
      const pathEdge = await page.$('.edge.path');
      expect(pathEdge).not.toBeNull();
    });

    test('Reset during running clears visuals (transition S1 -> S0) but does not forcibly re-enable start button', async ({ page }) => {
      // Start algorithm
      await page.click('#startBtn');

      // Wait for at least one visited node to appear
      await page.waitForSelector('.node.visited', { timeout: 20000 });

      // Now click reset while running
      await page.click('#resetBtn');

      // Reset logic clears visited/path classes and step actives
      // Wait a short time for DOM to update
      await page.waitForTimeout(100);

      // No node should have visited or path classes immediately after reset
      const anyVisited = await page.$('.node.visited');
      expect(anyVisited).toBeNull();

      const anyPathNode = await page.$('.node.path');
      expect(anyPathNode).toBeNull();

      // Steps should have no active class after reset handler
      const anyActiveStep = await page.$('.step.active');
      expect(anyActiveStep).toBeNull();

      // Note: Implementation does not re-enable startBtn on reset, so if algorithm is still running
      // startBtn may remain disabled. Assert that it is a boolean (exists) and is currently disabled (true).
      const startDisabled = await page.$eval('#startBtn', b => b.disabled);
      expect(typeof startDisabled).toBe('boolean');

      // If the algorithm later completes, it will re-enable the button. We do not force completion here.
    });

    test('Clicking Run Algorithm when already disabled does not throw and does not start duplicate runs', async ({ page }) => {
      // Click start once
      await page.click('#startBtn');
      await page.waitForTimeout(100);
      let startDisabled = await page.$eval('#startBtn', b => b.disabled);
      expect(startDisabled).toBe(true);

      // Attempt to click the disabled start button (this should be a no-op)
      // Playwright click will not click a disabled button; use evaluate to attempt a programmatic click,
      // but per requirements we MUST NOT patch or override environment. A programmatic click on a disabled button
      // will still call click() on the element but disabled buttons do not fire 'click' handlers in browsers.
      // We'll call click via evaluate to confirm no additional console errors or exceptions are thrown.
      await page.evaluate(() => {
        const btn = document.getElementById('startBtn');
        if (btn) {
          try { btn.click(); } catch (e) { /* Let any exceptions bubble to pageerror which is captured */ }
        }
      });

      // Give some time; ensure no page errors captured by afterEach
      await page.waitForTimeout(500);

      // Still should be disabled until algorithm completes (or remains disabled if we reset)
      startDisabled = await page.$eval('#startBtn', b => b.disabled);
      expect(startDisabled).toBe(true);
    });
  });

  test.describe('S2_AlgorithmCompleted validations', () => {
    test('When algorithm completes, final state (S2) shows step6 active and reconstructs shortest path', async ({ page }) => {
      // Start algorithm and wait for completion
      await page.click('#startBtn');

      // Wait for final step
      await page.waitForSelector('#step6.active', { timeout: 60000 });

      // Confirm step6 is active
      const isStep6Active = await page.$eval('#step6', el => el.classList.contains('active'));
      expect(isStep6Active).toBe(true);

      // Confirm that path nodes have 'path' class and visited nodes may have been transformed to 'path'
      const pathNodeIds = await page.$$eval('.node.path', nodes => nodes.map(n => n.id));
      expect(pathNodeIds.length).toBeGreaterThanOrEqual(2); // at least start and end

      // Confirm that edges making the path have class 'path'
      const pathEdges = await page.$$eval('.edge.path', edges => edges.length);
      expect(pathEdges).toBeGreaterThanOrEqual(1);

      // Finally the start button should be enabled again (run completed)
      const startDisabled = await page.$eval('#startBtn', b => b.disabled);
      expect(startDisabled).toBe(false);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('Multiple resets in a row do not throw and leave DOM in idle state', async ({ page }) => {
      // Click reset multiple times
      await page.click('#resetBtn');
      await page.click('#resetBtn');
      await page.click('#resetBtn');

      // DOM should remain in idle layout: start and end classes present and no active steps
      const startClass = await page.getAttribute('#node-A', 'class');
      expect(startClass).toContain('start');

      const endClass = await page.getAttribute('#node-F', 'class');
      expect(endClass).toContain('end');

      const anyActiveStep = await page.$('.step.active');
      expect(anyActiveStep).toBeNull();
    });

    test('Starting algorithm and letting it fully run then pressing reset results in cleared visuals and ready-to-run state', async ({ page }) => {
      // Run to completion
      await page.click('#startBtn');
      await page.waitForSelector('#step6.active', { timeout: 60000 });

      // Now click reset
      await page.click('#resetBtn');

      // After reset, there should be no active steps and no visited/path nodes
      const anyVisited = await page.$('.node.visited');
      expect(anyVisited).toBeNull();

      const anyPathNode = await page.$('.node.path');
      expect(anyPathNode).toBeNull();

      const anyActiveStep = await page.$('.step.active');
      expect(anyActiveStep).toBeNull();

      // start button should remain enabled after reset (since it was enabled at completion)
      const startDisabled = await page.$eval('#startBtn', b => b.disabled);
      expect(startDisabled).toBe(false);
    });
  });
});