import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f5ce1-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Branch and Bound Interactive Application (FSM validation)', () => {
  // Capture runtime page errors and console errors for each test
  test.beforeEach(async ({ page }) => {
    // arrays attached to page for later assertions via evaluate
    await page.addInitScript(() => {
      // no-op, preserve page environment
    });
  });

  test('Initial Idle state: page loads and initial UI is correct (S0_Idle)', async ({ page }) => {
    // Arrays to capture errors and console error messages
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the app
    await page.goto(APP_URL);

    // Validate heading evidence for Idle state
    const heading = page.locator('h1', { hasText: 'Branch and Bound Algorithm' });
    await expect(heading).toBeVisible();

    // By default the problem type should be knapsack and knapsack setup visible
    const knapsackSetup = page.locator('#knapsackSetup');
    const tspSetup = page.locator('#tspSetup');

    await expect(knapsackSetup).toBeVisible();
    await expect(tspSetup).toBeHidden();

    // Ensure no unexpected runtime errors occurred during initial load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test.describe('Problem Setup transitions and controls (S1_Problem_Setup)', () => {
    let pageErrors;
    let consoleErrors;

    test.beforeEach(async ({ page }) => {
      pageErrors = [];
      consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      await page.goto(APP_URL);
    });

    test('Problem type change toggles setups and generates TSP matrix when selected (ProblemTypeChange)', async ({ page }) => {
      // Switch to TSP
      await page.selectOption('#problemType', 'tsp');

      // tspSetup should be visible and knapsack hidden
      await expect(page.locator('#tspSetup')).toBeVisible();
      await expect(page.locator('#knapsackSetup')).toBeHidden();

      // generateRandomMatrix is called by toggleProblemType - resulting matrix should be present
      const matrixHtml = await page.locator('#distanceMatrix').innerHTML();
      expect(matrixHtml).toContain('<table');
      // Ensure number of rows matches numCities value (default 4)
      const rows = await page.locator('#distanceMatrix table tr').count();
      expect(rows).toBeGreaterThanOrEqual(4); // header + rows

      // Switch back to Knapsack
      await page.selectOption('#problemType', 'knapsack');
      await expect(page.locator('#knapsackSetup')).toBeVisible();
      await expect(page.locator('#tspSetup')).toBeHidden();

      // Ensure no page errors or console errors were produced
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Random items button updates items input (RandomItemsClick)', async ({ page }) => {
      const itemsInput = page.locator('#items');
      const before = await itemsInput.inputValue();

      // Click Random Items
      await page.click('#randomItems');

      // The items input should have been updated to a different string
      const after = await itemsInput.inputValue();
      expect(after).not.toBe('');
      expect(after).not.toEqual(before);

      // Basic validation of format: should contain commas and spaces
      expect(after).toMatch(/,\d/);

      // No runtime errors
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Algorithm Execution and History (S2_Execution)', () => {
    let pageErrors;
    let consoleErrors;

    test.beforeEach(async ({ page }) => {
      pageErrors = [];
      consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      await page.goto(APP_URL);
    });

    test('Initialize problem makes execution/visualization/exploration panels visible (InitProblemClick)', async ({ page }) => {
      // Initialize the default knapsack problem
      await page.click('#initProblem');

      await expect(page.locator('#executionPanel')).toBeVisible();
      await expect(page.locator('#visualizationPanel')).toBeVisible();
      await expect(page.locator('#explorationPanel')).toBeVisible();

      // treeContainer should contain the initial node element
      const node0 = page.locator('#treeContainer .node[data-node-id="0"]');
      await expect(node0).toBeVisible();

      // The application's state should have a history length of 1 and currentStep 0
      const { historyLen, currentStep } = await page.evaluate(() => {
        return { historyLen: state.history.length, currentStep: state.currentStep };
      });
      expect(historyLen).toBeGreaterThanOrEqual(1);
      expect(currentStep).toBe(0);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Stepping forward and backward updates tree and history (StepForwardClick, StepBackwardClick)', async ({ page }) => {
      await page.click('#initProblem');

      // Capture initial nodes count
      const initialNodes = await page.evaluate(() => state.tree.nodes.length);

      // Step forward should perform a step and create children for knapsack initial node
      await page.click('#stepForward');

      // Wait for visualization update: number of nodes should increase
      await page.waitForTimeout(50);
      const nodesAfterStep = await page.evaluate(() => state.tree.nodes.length);
      expect(nodesAfterStep).toBeGreaterThanOrEqual(initialNodes + 1);

      // Step backward should revert to previous history entry (if possible)
      const previousStep = await page.evaluate(() => state.currentStep);
      await page.click('#stepBackward');
      await page.waitForTimeout(50);
      const currentStepAfterBack = await page.evaluate(() => state.currentStep);
      // If we could go back, currentStep should have decreased by at most 1
      expect(currentStepAfterBack).toBeGreaterThanOrEqual(0);
      expect(currentStepAfterBack).toBeLessThanOrEqual(previousStep);

      // Edge-case: Step backward at step 0 should not go negative
      // First ensure we are at step 0
      await page.evaluate(() => { state.currentStep = 0; state.tree = JSON.parse(JSON.stringify(state.history[0])); });
      await page.click('#stepBackward');
      await page.waitForTimeout(20);
      const stepAfterEdgeBack = await page.evaluate(() => state.currentStep);
      expect(stepAfterEdgeBack).toBeGreaterThanOrEqual(0);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Run to completion toggles running state and respects speed input (RunToEndClick, SpeedInput)', async ({ page }) => {
      await page.click('#initProblem');

      // Set speed to a small delay to speed up the run
      await page.fill('#speed', '200');
      await page.click('#runToEnd');

      // After starting, button text should change to 'Stop'
      await expect(page.locator('#runToEnd')).toHaveText(/Stop/);

      // Let it run for a short period to advance some steps
      await page.waitForTimeout(400);

      // Then stop
      await page.click('#runToEnd');

      // After stopping, button text should revert
      await expect(page.locator('#runToEnd')).toHaveText('Run to Completion');

      // Validate that running state is false in page state
      const runningFlag = await page.evaluate(() => state.running);
      expect(runningFlag).toBe(false);

      // Speed value UI should reflect the change
      const speedLabel = await page.locator('#speedValue').innerText();
      expect(speedLabel).toContain('200');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Reset brings the algorithm back to initial tree node (ResetClick)', async ({ page }) => {
      await page.click('#initProblem');

      // Perform a step to change state
      await page.click('#stepForward');
      await page.waitForTimeout(50);
      const nodesAfterStep = await page.evaluate(() => state.tree.nodes.length);
      expect(nodesAfterStep).toBeGreaterThanOrEqual(2);

      // Reset
      await page.click('#reset');
      await page.waitForTimeout(20);

      // After reset the tree should have only the initial node
      const nodesAfterReset = await page.evaluate(() => state.tree.nodes.length);
      expect(nodesAfterReset).toBe(1);

      // currentStep should be 0
      const currentStep = await page.evaluate(() => state.currentStep);
      expect(currentStep).toBe(0);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Visualization and Exploration (S3_Visualization -> S4_Exploration)', () => {
    let pageErrors;
    let consoleErrors;

    test.beforeEach(async ({ page }) => {
      pageErrors = [];
      consoleErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      await page.goto(APP_URL);
      await page.click('#initProblem');
    });

    test('Clicking on a node shows node details and sets selectedNode (TreeClick -> Node details)', async ({ page }) => {
      // Ensure there is at least the root node
      const node0 = page.locator('#treeContainer .node[data-node-id="0"]');
      await expect(node0).toBeVisible();

      // Click the root node -> selectedNode should update and nodeDetails should be populated
      await node0.click();

      await expect(page.locator('#selectedNode')).toHaveText('0');

      // nodeDetails textarea should contain a textual representation of the node
      const details = await page.locator('#nodeDetails').inputValue();
      expect(details.length).toBeGreaterThan(0);
      expect(details).toMatch(/Level|Path|Taken/);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Explore node transitions into exploration and performs a step (ExploreNodeClick)', async ({ page }) => {
      // Click root node to select
      await page.locator('#treeContainer .node[data-node-id="0"]').click();
      await expect(page.locator('#selectedNode')).toHaveText('0');

      // Click Explore This Node -> should call performStep and expand the tree
      await page.click('#exploreNode');

      // Wait a bit for visualization update
      await page.waitForTimeout(50);

      // After exploring, there should be children for node 0 in the state
      const hasChildren = await page.evaluate(() => !!state.tree.children[0] && state.tree.children[0].length > 0);
      expect(hasChildren).toBe(true);

      // Node details should reflect the (possibly updated) current node
      const nodeDetails = await page.locator('#nodeDetails').inputValue();
      expect(nodeDetails.length).toBeGreaterThan(0);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Pruning a selected active node marks it pruned in the DOM and state (PruneNodeClick)', async ({ page }) => {
      // Ensure we have children by exploring root first
      await page.locator('#treeContainer .node[data-node-id="0"]').click();
      await page.click('#exploreNode');
      await page.waitForTimeout(50);

      // Find a child node id from application state
      const childId = await page.evaluate(() => {
        const c = state.tree.children[0];
        return (c && c.length) ? c[0] : null;
      });

      expect(childId).not.toBeNull();

      // Click the child node in the UI to select it
      const childLocator = page.locator(`#treeContainer .node[data-node-id="${childId}"]`);
      await expect(childLocator).toBeVisible();
      await childLocator.click();

      // Ensure selected node updated
      await expect(page.locator('#selectedNode')).toHaveText(String(childId));

      // Prune the selected node
      await page.click('#pruneNode');

      // Wait for update
      await page.waitForTimeout(30);

      // The node should have .pruned class in the DOM
      const prunedLocator = page.locator(`#treeContainer .node.pruned[data-node-id="${childId}"]`);
      await expect(prunedLocator).toBeVisible();

      // And state.tree.pruned should include the node id
      const prunedInState = await page.evaluate((id) => state.tree.pruned.includes(id), childId);
      expect(prunedInState).toBe(true);

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('No unexpected runtime ReferenceError/SyntaxError/TypeError occurred during full interaction', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(APP_URL);

      // Perform a sequence of interactions to exercise code paths
      await page.selectOption('#problemType', 'tsp');
      await page.click('#initProblem');
      await page.fill('#speed', '300');
      await page.click('#stepForward');
      await page.waitForTimeout(30);
      await page.click('#stepBackward');
      await page.click('#runToEnd');
      await page.waitForTimeout(200);
      await page.click('#runToEnd'); // stop
      await page.click('#reset');

      // Try clicking random matrix generation explicitly
      await page.selectOption('#problemType', 'tsp');
      await page.click('#randomMatrix');

      // Finally, ensure there were no uncaught page errors
      // We assert that pageErrors and consoleErrors are arrays (captured) and are empty
      expect(Array.isArray(pageErrors)).toBe(true);
      expect(Array.isArray(consoleErrors)).toBe(true);

      // If there are errors, fail the test and provide details
      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        // Provide informative failure with captured messages
        throw new Error(`Captured page errors: ${JSON.stringify(pageErrors)}; console errors: ${JSON.stringify(consoleErrors)}`);
      }
    });
  });
});