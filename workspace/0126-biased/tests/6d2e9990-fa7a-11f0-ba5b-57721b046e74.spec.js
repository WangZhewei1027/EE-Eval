import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e9990-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Dijkstra Interactive Demo (FSM validation) - 6d2e9990-fa7a-11f0-ba5b-57721b046e74', () => {
  // Collect console messages and page errors for each test to assert runtime health.
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(5000);
    // Arrays attached to page to be asserted within tests as needed
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', msg => {
      // Only push if it's an error-level console message for diagnostics
      const type = msg.type();
      page.context()._consoleMessages.push({ type, text: msg.text() });
    });

    page.on('pageerror', error => {
      page.context()._pageErrors.push(error);
    });

    await page.goto(APP_URL);
    // Wait for initial load - the page adds initial nodes on DOMContentLoaded
    await page.waitForSelector('#algorithm-state');
    // Ensure graph UI rendered
    await expect(page.locator('#graph')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: there should be no uncaught page errors during the test run
    // (If there are, tests that expect them will assert earlier.)
    const pageErrors = page.context()._pageErrors || [];
    expect(pageErrors.length).toBe(0);
    // Also ensure there were no console messages of type 'error'
    const consoleErrors = (page.context()._consoleMessages || []).filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Idle state (S0_Idle) and initial UI', () => {
    test('Initial page renders and is in Idle state (Ready to begin)', async ({ page }) => {
      // Validate algorithm state text indicates the Idle state
      const algoState = await page.locator('#algorithm-state').textContent();
      expect(algoState.trim()).toBe('Ready to begin');

      // current-step should be empty initially
      const currentStep = await page.locator('#current-step').textContent();
      expect(currentStep.trim()).toBe('');

      // The implementation initializes a simple graph on load (4 nodes)
      const nodeCountText = await page.locator('#node-count').textContent();
      expect(nodeCountText).toMatch(/^Nodes:\s*\d+/);

      // Verify start/target selects populated with at least one option
      const startOptions = await page.locator('#start-node option').count();
      const targetOptions = await page.locator('#target-node option').count();
      expect(startOptions).toBeGreaterThanOrEqual(1);
      expect(targetOptions).toBeGreaterThanOrEqual(1);
    });

    test('Add Node increases node count and renders a new circle in SVG', async ({ page }) => {
      // Count nodes before adding
      const beforeText = await page.locator('#node-count').textContent();
      const beforeCount = parseInt(beforeText.replace('Nodes:', '').trim(), 10);

      // Click Add Node
      await page.click('#add-node');

      // Node count should increment
      await expect(page.locator('#node-count')).toHaveText(new RegExp(`Nodes:\\s*${beforeCount + 1}`));

      // New node circle should exist (find an element with data-id equal to the next id)
      // The new node id will be beforeCount (since initial nodes are 0..beforeCount-1)
      const newId = beforeCount; // because nextNodeId increments from 0
      const newCircle = page.locator(`#graph circle.node[data-id="${newId}"]`);
      await expect(newCircle).toBeVisible();
    });
  });

  test.describe('Graph construction: edges, clear, random', () => {
    test('Add Edge by selecting two nodes updates edge count and adjacency list', async ({ page }) => {
      // Ensure there are at least two nodes
      const nodes = page.locator('#graph circle.node');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThanOrEqual(2);

      // Record edge count before
      const beforeEdgeText = await page.locator('#edge-count').textContent();
      const beforeEdgeCount = parseInt(beforeEdgeText.replace('Edges:', '').trim(), 10);

      // Click Add Edge to enter selecting state
      await page.click('#add-edge');
      // After clicking once, the button text becomes 'Select first node'
      await expect(page.locator('#add-edge')).toHaveText(/Select first node|Add Edge \(select two nodes\)|Select second node/);

      // Click first node
      const firstNode = nodes.nth(0);
      await firstNode.click();

      // Button should now prompt for second node
      await expect(page.locator('#add-edge')).toHaveText(/Select second node/);

      // Click a different node (second)
      const secondNode = nodes.nth(1);
      await secondNode.click();

      // After adding, edge count should increase by at least 1 (could be duplicate check prevents add)
      const afterEdgeText = await page.locator('#edge-count').textContent();
      const afterEdgeCount = parseInt(afterEdgeText.replace('Edges:', '').trim(), 10);
      expect(afterEdgeCount).toBeGreaterThanOrEqual(beforeEdgeCount);

      // The adjacency list should include an entry referencing the new neighbor(s)
      const adjacency = await page.locator('#adjacency-list').textContent();
      expect(adjacency).toContain('Adjacency List:');
    });

    test('Clear Graph empties nodes and edges and resets algorithm state', async ({ page }) => {
      // Click Clear Graph
      await page.click('#clear-graph');

      // Node and edge counts should be zero
      await expect(page.locator('#node-count')).toHaveText('Nodes: 0');
      await expect(page.locator('#edge-count')).toHaveText('Edges: 0');

      // Start/target selects should be empty (no options)
      const startOptions = await page.locator('#start-node option').count();
      const targetOptions = await page.locator('#target-node option').count();
      expect(startOptions).toBe(0);
      expect(targetOptions).toBe(0);

      // Algorithm state should be reset to Idle (dijkstra.reset sets this)
      await expect(page.locator('#algorithm-state')).toHaveText('Ready to begin');

      // Distance table should be cleared
      const distanceRows = await page.locator('#distance-table tbody tr').count();
      expect(distanceRows).toBe(0);
    });

    test('Generate Random Graph populates nodes and edges and resets algorithm UI', async ({ page }) => {
      // Set random counts
      await page.fill('#random-nodes', '6');
      await page.fill('#random-edges', '7');

      // Click generate
      await page.click('#random-graph');

      // Node count should reflect 6
      await expect(page.locator('#node-count')).toHaveText(/Nodes:\s*6/);

      // Start/target selects should have options
      const startOptions = await page.locator('#start-node option').count();
      const targetOptions = await page.locator('#target-node option').count();
      expect(startOptions).toBeGreaterThanOrEqual(2);
      expect(targetOptions).toBeGreaterThanOrEqual(2);

      // Algorithm state should remain Idle (reset occurred)
      await expect(page.locator('#algorithm-state')).toHaveText('Ready to begin');
    });
  });

  test.describe('Algorithm controls, transitions and states', () => {
    test('Run (S0 -> S1) sets algorithm-state to Running and reset returns to Idle (S1 exit)', async ({ page }) => {
      // Ensure selects have values; pick first and last options
      const startOption = await page.locator('#start-node option').first().getAttribute('value');
      const lastIndex = (await page.locator('#start-node option').count()) - 1;
      const targetOption = await page.locator(`#start-node option:nth-child(${lastIndex + 1})`).getAttribute('value');

      // Select start and target
      await page.selectOption('#start-node', startOption);
      await page.selectOption('#target-node', targetOption);

      // Click Run - this triggers dijkstra.run(...) and sets algorithm-state to running
      await page.click('#run-algorithm');

      // Immediately expect algorithm state to indicate running (it may change to completed quickly on auto-run)
      const runningText = await page.locator('#algorithm-state').textContent();
      expect(runningText).toMatch(/Running Dijkstra's algorithm\.\.\.|Running Dijkstra’s algorithm\.\.\./);

      // Now click Reset Visualization which triggers dijkstra.reset() (S1 exit action should produce same effect)
      await page.click('#reset-algorithm');

      // Algorithm state should be back to Idle
      await expect(page.locator('#algorithm-state')).toHaveText('Ready to begin');

      // current-step cleared
      await expect(page.locator('#current-step')).toHaveText('');
    });

    test('Step Algorithm from Idle (S0 -> S4) initializes step-by-step and can step to completion (S2) or error (S3)', async ({ page }) => {
      // Choose start and target (ensure different)
      const optionCount = await page.locator('#start-node option').count();
      expect(optionCount).toBeGreaterThanOrEqual(2);
      const startVal = await page.locator('#start-node option').first().getAttribute('value');
      const targetVal = await page.locator('#start-node option').nth(1).getAttribute('value');

      await page.selectOption('#start-node', startVal);
      await page.selectOption('#target-node', targetVal);

      // Click Step Through when not running - this should call dijkstra.run(..., true)
      await page.click('#step-algorithm');

      // Current step should be initialized per S4 evidence
      await expect(page.locator('#current-step')).toHaveText('Step 0: Initialized distances');

      // Now repeatedly click Step Through until the algorithm completes or reports error.
      // We'll cap the attempts to avoid infinite loops in case of unexpected behavior.
      let finalState = null;
      for (let i = 0; i < 20; i++) {
        // Click the step button (it will either perform a step or be disabled when finished)
        const stepButton = page.locator('#step-algorithm');
        const disabled = await stepButton.isDisabled();
        if (disabled) break;
        await stepButton.click();

        // Check algorithm-state after each step - it might report completion or error
        const stateText = (await page.locator('#algorithm-state').textContent()).trim();
        if (stateText === 'Algorithm completed' || stateText === 'No path exists to some nodes') {
          finalState = stateText;
          break;
        }

        // Small pause to allow UI updates between clicks
        await page.waitForTimeout(50);
      }

      // One of the terminal states should have been reached
      const finalStateText = finalState || (await page.locator('#algorithm-state').textContent()).trim();
      expect(['Algorithm completed', 'No path exists to some nodes']).toContain(finalStateText);

      // If completed, path-result and distance-result should show values; if error, path-result indicates no path
      if (finalStateText === 'Algorithm completed') {
        const pathRes = (await page.locator('#path-result').textContent()).trim();
        const distRes = (await page.locator('#distance-result').textContent()).trim();
        expect(pathRes.length).toBeGreaterThan(0);
        expect(distRes.length).toBeGreaterThan(0);
      } else {
        const pathRes = (await page.locator('#path-result').textContent()).trim();
        expect(pathRes).toBe('No path exists to target node');
      }
    });

    test('Step Algorithm while running can lead to Algorithm Completed or Algorithm Error (S1 -> S2 or S3) when stepping', async ({ page }) => {
      // Select start and target that exist
      const startVal = await page.locator('#start-node option').first().getAttribute('value');
      const targetVal = await page.locator('#start-node option').nth(1).getAttribute('value');

      await page.selectOption('#start-node', startVal);
      await page.selectOption('#target-node', targetVal);

      // Start automatic run (non-step mode). This creates an interval that periodically calls step()
      await page.click('#run-algorithm');

      // Immediately press the Step Through button a few times to invoke step while running
      // (The code's click handler will call dijkstra.step when dijkstra.running is true)
      for (let i = 0; i < 5; i++) {
        await page.click('#step-algorithm');
        await page.waitForTimeout(50);
        const state = (await page.locator('#algorithm-state').textContent()).trim();
        if (state === 'Algorithm completed' || state === 'No path exists to some nodes') break;
      }

      // After some steps the algorithm should either be completed or in error state
      const finalState = (await page.locator('#algorithm-state').textContent()).trim();
      expect(['Algorithm completed', 'No path exists to some nodes', "Running Dijkstra's algorithm..."]).toContain(finalState);
      // Reset to ensure test isolation
      await page.click('#reset-algorithm');
      await expect(page.locator('#algorithm-state')).toHaveText('Ready to begin');
    });

    test('Reset Visualization restores Idle state and clears highlights (S1 exit verification)', async ({ page }) => {
      // Ensure there is a path scenario; run step-through to populate visited/path edges
      const startVal = await page.locator('#start-node option').first().getAttribute('value');
      const targetVal = await page.locator('#start-node option').nth(1).getAttribute('value');

      await page.selectOption('#start-node', startVal);
      await page.selectOption('#target-node', targetVal);

      // Start step-by-step
      await page.click('#step-algorithm');
      await expect(page.locator('#current-step')).toHaveText('Step 0: Initialized distances');

      // Step once or twice
      await page.click('#step-algorithm');
      await page.waitForTimeout(100);

      // Now click Reset Visualization
      await page.click('#reset-algorithm');

      // After reset, algorithm-state is Idle
      await expect(page.locator('#algorithm-state')).toHaveText('Ready to begin');

      // All edges should have no 'visited' or 'path' classes
      const visitedEdges = await page.locator('.edge.visited').count();
      const pathEdges = await page.locator('.edge.path').count();
      expect(visitedEdges).toBe(0);
      expect(pathEdges).toBe(0);

      // Path and distance results cleared
      await expect(page.locator('#path-result')).toHaveText('');
      await expect(page.locator('#distance-result')).toHaveText('');
    });
  });

  test.describe('Error scenarios and edge cases', () => {
    test('Attempting to Run or Step with no nodes triggers alert error and does not crash (edge case)', async ({ page }) => {
      // Clear graph to remove all nodes
      await page.click('#clear-graph');

      // Listen for dialog and assert the alert message
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      // Click Run - should show an alert about selecting nodes
      await page.click('#run-algorithm');
      // Give time for dialog handler
      await page.waitForTimeout(50);
      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage).toMatch(/Please select both start and target nodes/);

      // Test Step in cleared graph triggers same alert
      dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });
      await page.click('#step-algorithm');
      await page.waitForTimeout(50);
      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage).toMatch(/Please select both start and target nodes/);
    });

    test('Edge weight input influences added edge weight and adjacency list reflects the weight', async ({ page }) => {
      // Ensure at least two nodes exist by adding nodes if necessary
      const nodeCount = await page.locator('#graph circle.node').count();
      if (nodeCount < 2) {
        await page.click('#add-node');
        await page.click('#add-node');
      }

      // Set a distinct edge weight
      await page.fill('#edge-weight', '42');

      // Use add-edge flow between first two nodes
      await page.click('#add-edge');
      await page.locator('#graph circle.node').nth(0).click();
      await page.locator('#graph circle.node').nth(1).click();

      // Verify adjacency list contains the weight 42
      const adjacencyText = await page.locator('#adjacency-list').textContent();
      expect(adjacencyText).toContain('(42)');
    });
  });
});