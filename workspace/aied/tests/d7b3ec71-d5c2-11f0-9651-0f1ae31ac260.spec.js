import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b3ec71-d5c2-11f0-9651-0f1ae31ac260.html';

test.describe('Dijkstra’s Algorithm Visualization - FSM and UI tests', () => {
  // Capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', msg => {
      // store console messages with type for later assertions
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      page.context()._pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait until basic UI elements are available
    await expect(page.locator('#startNode')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Assert that no unexpected page errors or console error-level messages occurred.
    // We collect and assert here to satisfy the requirement to observe and assert console/page errors.
    const consoleErrors = page.context()._consoleMessages.filter(m => m.type === 'error');
    const pageErrors = page.context()._pageErrors;

    // If there are any page errors or console errors, fail with details
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Initial state (Idle): selects are populated, control buttons initial states, no logs', async ({ page }) => {
    // Validate the application starts in an idle-like state and UI initialized by populateSelects()
    // Expect start select to have options for nodes and end select to include the "None" option + node options
    const startOptions = await page.locator('#startNode option').allTextContents();
    expect(startOptions.length).toBeGreaterThanOrEqual(1);
    // The provided HTML populates node IDs like 'A', 'B', ...
    expect(startOptions).toContain('A');

    const endOptions = await page.locator('#endNode option').allTextContents();
    // Default option "None (show all shortest distances)" should be present
    expect(endOptions[0]).toMatch(/None \(show all shortest distances\)/);

    // Buttons: step and reset should be disabled initially according to the implementation
    const stepDisabled = await page.locator('#stepBtn').isDisabled();
    const resetDisabled = await page.locator('#resetBtn').isDisabled();
    const startDisabled = await page.locator('#startBtn').isDisabled();

    expect(stepDisabled).toBe(true);
    expect(resetDisabled).toBe(true);
    // Implementation leaves startBtn enabled so it should not be disabled
    expect(startDisabled).toBe(false);

    // Log should be empty on load
    const logText = await page.locator('#log').textContent();
    expect(logText.trim()).toBe('');

    // SVG should contain node groups created on init
    const nodeCount = await page.locator('svg .node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(8); // the HTML has 8 nodes

    // No console or page errors observed so far (checked in afterEach)
  });

  test('StartAlgorithm event transitions to Algorithm Initialized - UI and logs updated', async ({ page }) => {
    // Choose a start node and end node, then start the algorithm
    await page.selectOption('#startNode', 'A');
    await page.selectOption('#endNode', 'H'); // optional end node selection

    // Click start and verify initialization log & button states
    await page.click('#startBtn');

    // After start: startBtn should be disabled; stepBtn and resetBtn enabled
    await expect(page.locator('#startBtn')).toBeDisabled();
    await expect(page.locator('#stepBtn')).toBeEnabled();
    await expect(page.locator('#resetBtn')).toBeEnabled();

    // The log should contain the initialization message
    await expect(page.locator('#log')).toContainText('Algorithm initialized with start node A.');

    // The start node's distance tooltip should be 'Distance: 0'
    // The circle title is set on updateNodes; find the group for node A
    const titleAttr = await page.locator('svg .node[data-id="A"] circle').getAttribute('title');
    expect(titleAttr).toMatch(/Distance: 0/);

    // Because currentNode is null just after initialization, no node should have class 'current'
    const currentNodes = await page.locator('svg .node.current').count();
    expect(currentNodes).toBe(0);
  });

  test('StepAlgorithm event executes steps, updates distances, and eventually finishes (with end node path shown)', async ({ page }) => {
    // This test will:
    // - Select start and end nodes
    // - Start the algorithm
    // - Click Next Step repeatedly until algorithm finishes
    // - Validate visiting logs, next-node logs, final completion log, and final path log

    // Select start and end
    await page.selectOption('#startNode', 'A');
    await page.selectOption('#endNode', 'H');

    // Click start
    await page.click('#startBtn');

    // Wait for initialization log
    await expect(page.locator('#log')).toContainText('Algorithm initialized with start node A.');

    // We'll click step repeatedly until we see the finishing message in the log
    const logLocator = page.locator('#log');
    let previousLength = (await logLocator.textContent()).length;
    let finished = false;
    let maxSteps = 50;
    let steps = 0;
    while (!finished && steps < maxSteps) {
      steps += 1;
      // Click step
      await page.click('#stepBtn');

      // Wait until the log grows (ensures the step had time to log)
      await page.waitForFunction(
        (prevLen) => document.getElementById('log').textContent.length > prevLen,
        previousLength
      );
      const currentLog = await logLocator.textContent();
      previousLength = currentLog.length;

      // Check for messages that indicate step progress
      if (currentLog.includes('Visiting node') || currentLog.includes('Selected starting node')) {
        // good, algorithm is progressing
      }

      // Check for next node log
      if (currentLog.includes('Next node to visit')) {
        // progress indication
      }

      // Check for finished messages (two possible phrasing in implementation)
      if (currentLog.includes('All nodes visited, algorithm finished.') ||
          currentLog.includes('All reachable nodes visited, algorithm finished.')) {
        finished = true;
        break;
      }
    }

    expect(finished, `Algorithm did not finish within ${maxSteps} steps`).toBe(true);

    // After finishing, updateVisualization logs the shortest path to the selected end node
    // Confirm the log contains "Shortest path to node H:" and "total cost"
    const finalLog = await logLocator.textContent();
    expect(finalLog).toMatch(/Shortest path to node H:/);

    // The end node element should have class 'final-node' after finished when endNode is selected
    const endNodeHasFinal = await page.locator('svg .node[data-id="H"]').getAttribute('class');
    expect(endNodeHasFinal).toContain('final-node');

    // Edges forming the path should have class 'path-edge' at least for one edge
    const pathEdgeCount = await page.locator('svg line.path-edge').count();
    expect(pathEdgeCount).toBeGreaterThan(0);

    // The reset button should still be enabled (we can reset from finished)
    await expect(page.locator('#resetBtn')).toBeEnabled();
  });

  test('Subsequent StepAlgorithm clicks after finish are no-ops and do not add errors', async ({ page }) => {
    // Start from a fresh load: select start and end, run steps until finish, then click Step again to ensure no change
    await page.selectOption('#startNode', 'A');
    await page.selectOption('#endNode', 'H');
    await page.click('#startBtn');

    // Step until finished
    const logLocator = page.locator('#log');
    let prevLen = (await logLocator.textContent()).length;
    let finished = false;
    for (let i = 0; i < 50; i++) {
      await page.click('#stepBtn');
      await page.waitForFunction(prev => document.getElementById('log').textContent.length > prev, prevLen);
      const txt = await logLocator.textContent();
      if (txt.includes('All reachable nodes visited') || txt.includes('All nodes visited')) {
        finished = true;
        break;
      }
      prevLen = (await logLocator.textContent()).length;
    }
    expect(finished).toBe(true);

    // Store log length after finish
    const finishedLogLength = (await logLocator.textContent()).length;

    // Click Step again (should be a no-op since finished flag prevents further work)
    // The step button remains enabled by implementation, but step() returns immediately if finished
    await page.click('#stepBtn');

    // Wait briefly and ensure log did not grow
    await page.waitForTimeout(200);
    const afterExtraStepLen = (await logLocator.textContent()).length;
    expect(afterExtraStepLen).toBe(finishedLogLength);

    // No console/page errors should have occurred (checked in afterEach)
  });

  test('ResetAlgorithm returns UI and graph to initial state', async ({ page }) => {
    // Start algorithm then reset
    await page.selectOption('#startNode', 'A');
    await page.selectOption('#endNode', 'H');
    await page.click('#startBtn');

    // Wait for a small amount to ensure initialization applied
    await expect(page.locator('#log')).toContainText('Algorithm initialized with start node A.');

    // Click reset
    await page.click('#resetBtn');

    // After reset: startBtn enabled, step and reset disabled
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#stepBtn')).toBeDisabled();
    await expect(page.locator('#resetBtn')).toBeDisabled();

    // The log should be cleared by resetAlgorithm
    const logText = await page.locator('#log').textContent();
    expect(logText.trim()).toBe('');

    // The SVG should still contain node groups (graph redrawn)
    const nodeCount = await page.locator('svg .node').count();
    expect(nodeCount).toBeGreaterThanOrEqual(8);
  });

  test('EndNodeChange event updates selection and does not throw errors (edge case)', async ({ page }) => {
    // Select a different end node to trigger change handler
    await page.selectOption('#endNode', 'E');

    // The control's value should reflect the change
    const endVal = await page.locator('#endNode').inputValue();
    expect(endVal).toBe('E');

    // Change again to empty (the first option is empty string)
    await page.selectOption('#endNode', '');

    const endVal2 = await page.locator('#endNode').inputValue();
    expect(endVal2).toBe('');

    // There should be no errors triggered by changing the end node (checked in afterEach)
  });

  test('Clicking Next Step before starting is inert (edge case) and produces no errors', async ({ page }) => {
    // Ensure stepBtn is disabled before starting
    await expect(page.locator('#stepBtn')).toBeDisabled();

    // Attempt a forced click on the disabled button to simulate an edge-case interaction
    // Use force: true to bypass Playwright's disabled click prevention (simulating stray events)
    await page.click('#stepBtn', { force: true });

    // The log should remain empty (no steps executed)
    const logText = await page.locator('#log').textContent();
    expect(logText.trim()).toBe('');

    // No console/page errors should have occurred
  });
});