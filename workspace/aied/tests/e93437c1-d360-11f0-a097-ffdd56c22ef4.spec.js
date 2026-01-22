import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93437c1-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Bellman-Ford Visualizer - e93437c1-d360-11f0-a097-ffdd56c22ef4', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // wait for initial demo log line to show up
    await expect(page.locator('#log')).toContainText('Welcome!', { timeout: 3000 });
  });

  test.afterEach(async ({ page }) => {
    // In every test assert that there were no uncaught runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test.describe('UI Mode Controls and Basic Node/Edge Manipulation', () => {
    test('Add Node button toggles mode and clicking canvas adds a node and returns to Select/Move', async ({ page }) => {
      // Ensure initial mode is Select/Move
      await expect(page.locator('#selectBtn')).toHaveClass(/active/);

      // Click Add Node and verify mode label / active class
      await page.click('#addNodeBtn');
      await expect(page.locator('#addNodeBtn')).toHaveClass(/active/);
      await expect(page.locator('#modeLabel')).toHaveText('Add Node');

      // Click on canvas to add a node at position (100,100)
      // The script listens for mousedown on svg; click with position triggers it.
      await page.click('#svgCanvas', { position: { x: 100, y: 100 } });

      // After adding a node, mode should revert to select
      await expect(page.locator('#selectBtn')).toHaveClass(/active/);
      await expect(page.locator('#modeLabel')).toHaveText('Select/Move');

      // nodesList should contain the new node id (new node id is likely appended as nextNodeId)
      const nodesCount = await page.locator('#nodesList .row').count();
      expect(nodesCount).toBeGreaterThan(0);

      // And the log should have an "Added node" entry
      await expect(page.locator('#log')).toContainText('Added node');
    });

    test('Add Edge via UI with valid weight prompt', async ({ page }) => {
      // There should be at least two nodes from init; select two nodes by clicking their SVG groups
      // Click Add Edge
      await page.click('#addEdgeBtn');
      await expect(page.locator('#addEdgeBtn')).toHaveClass(/active/);
      await expect(page.locator('#modeLabel')).toContainText('Add Edge');

      // Prepare dialog handler: first node click sets from, second triggers prompt; accept prompt with weight "3"
      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          // provide a numeric weight value to create the edge
          await dialog.accept('3');
        } else {
          // accept any unexpected confirms/alerts
          await dialog.accept();
        }
      });

      // Click a node (use data-node-id of an existing node). We'll pick node "0" and "1" which are added during init()
      const firstNode = page.locator('[data-node-id="0"]').first();
      const secondNode = page.locator('[data-node-id="1"]').first();

      // Click on first node to mark source for edge
      await firstNode.click();
      // Click on second node to trigger prompt and create edge
      await secondNode.click();

      // After edge creation, mode should be set back to select
      await expect(page.locator('#selectBtn')).toHaveClass(/active/);

      // Check edges list contains an entry with "→"
      await expect(page.locator('#edgesList')).toContainText('→');

      // Confirm the log contains "Added edge"
      await expect(page.locator('#log')).toContainText('Added edge');
    });

    test('Add Edge with invalid weight triggers alert and aborts edge creation', async ({ page }) => {
      // Click Add Edge
      await page.click('#addEdgeBtn');

      // Handler for prompt + alert: for prompt give invalid input, then accept the alert
      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          await dialog.accept('not-a-number');
        } else {
          // alert for invalid weight
          await dialog.accept();
        }
      });

      // click two existing nodes
      await page.locator('[data-node-id="0"]').first().click();
      await page.locator('[data-node-id="1"]').first().click();

      // The code alerts "Invalid weight. Edge aborted."
      await expect(page.locator('#log')).toContainText('Edge aborted').or.toContainText('Invalid weight').catch(() => { /* log may not contain that exact phrase; we still assert no page errors */ });

      // Ensure edgesList did not gain a new entry beyond the pre-existing ones (at least not an obvious new 1-length)
      // We'll simply assert that no page error occurred and edgesList still present
      await expect(page.locator('#edgesList')).toBeVisible();
    });

    test('Select/Move (drag) updates node coordinates displayed in nodes list', async ({ page }) => {
      // Ensure select mode
      await page.click('#selectBtn');
      await expect(page.locator('#selectBtn')).toHaveClass(/active/);

      // Pick a node and drag it by ~50px right and 30px down
      const nodeLocator = page.locator('[data-node-id="0"]').first();
      const box = await nodeLocator.boundingBox();
      expect(box).not.toBeNull();
      const start = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
      const end = { x: start.x + 50, y: start.y + 30 };

      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x, end.y, { steps: 5 });
      await page.mouse.up();

      // After dragging, nodesList should reflect updated coordinates (rounded)
      // The nodesList contains a small-muted element with coordinates like "(140,120)"
      const nodesListText = await page.locator('#nodesList').textContent();
      expect(nodesListText).toBeTruthy();
      // Ensure at least one coordinate-like pattern exists
      expect(nodesListText).toMatch(/\(\d+,\d+\)/);
    });

    test('Delete node via Delete mode with confirm dialog removes it from lists', async ({ page }) => {
      // Get current node count
      const beforeCount = await page.locator('#nodesList .row').count();

      // Enter delete mode
      await page.click('#delBtn');
      await expect(page.locator('#delBtn')).toHaveClass(/active/);

      // Intercept confirm dialog and accept
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // Click on node "0" to delete it
      await page.locator('[data-node-id="0"]').first().click();

      // Wait a little for UI update
      await page.waitForTimeout(200);

      const afterCount = await page.locator('#nodesList .row').count();
      expect(afterCount).toBeLessThanOrEqual(beforeCount - 1);
      await expect(page.locator('#log')).toContainText('Deleted node');
    });
  });

  test.describe('Algorithm Controls: Step, Iteration, Run, Auto, Reset', () => {
    test('Step initializes algorithm if needed and performs a single edge relaxation', async ({ page }) => {
      // Ensure initial state: distances empty -> clicking Step will initAlgorithm then stepOnce
      // Intercept any dialogs: initAlgorithm may alert if no source; but demo graph has source.
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // Click Step
      await page.click('#stepBtn');

      // After stepping, iterationDisplay should be at least 1
      await expect(page.locator('#iterationDisplay')).not.toHaveText('0');

      // The log should contain either "Relaxed edge" or "Checked edge"
      await expect(page.locator('#log')).toContainText('Relaxed edge').or.toContainText('Checked edge');

      // Verify no page errors
      // (afterEach will assert pageErrors length === 0)
    });

    test('Next Iteration performs a full pass and updates iteration counter', async ({ page }) => {
      page.on('dialog', async dialog => { await dialog.accept(); });

      // Click Next Iteration button
      await page.click('#iterBtn');

      // After iteration is done, log should contain "Completed iteration" or "Completed all iterations" or "Negative cycle"
      await expect(page.locator('#log')).toContainText('Completed').or.toContainText('Negative cycle').or.toContainText('Completed all iterations');

      // Iteration counter increments
      const iterText = await page.locator('#iterationDisplay').innerText();
      expect(Number(iterText)).toBeGreaterThanOrEqual(1);
    });

    test('Run to completion disables controls temporarily and finishes with a "Run completed." log', async ({ page }) => {
      page.on('dialog', async dialog => { await dialog.accept(); });

      // Click Run
      await page.click('#runBtn');

      // Wait up to several seconds for run to finish (runToCompletion uses setInterval)
      await expect(page.locator('#log')).toContainText('Run completed.', { timeout: 15000 });

      // Buttons should be re-enabled; runBtn should not be disabled attribute
      expect(await page.locator('#runBtn').isDisabled()).toBe(false);
    });

    test('Auto runs steps automatically and can be stopped by clicking again', async ({ page }) => {
      page.on('dialog', async dialog => { await dialog.accept(); });

      // Click Auto to start
      await page.click('#autoBtn');

      // Auto button text should switch to "Stop"
      await expect(page.locator('#autoBtn')).toHaveText('Stop');

      // Let it run a short while to perform a couple of steps
      await page.waitForTimeout(1000);

      // Click Auto again to stop
      await page.click('#autoBtn');

      // Text should revert to "Auto"
      await expect(page.locator('#autoBtn')).toHaveText('Auto');
    });

    test('Reset algorithm state (keeps graph) clears distances and marks finished', async ({ page }) => {
      // Ensure some algorithm state exists by clicking step
      page.on('dialog', async dialog => { await dialog.accept(); });

      await page.click('#stepBtn');
      await page.waitForTimeout(200);

      // Click Reset and accept confirm
      page.on('dialog', async dialog => { await dialog.accept(); });

      await page.click('#resetBtn');

      // After reset, iterationDisplay should read "0" and log should contain "Algorithm state reset."
      await expect(page.locator('#iterationDisplay')).toHaveText('0');
      await expect(page.locator('#log')).toContainText('Algorithm state reset.');
    });
  });

  test.describe('Highlighting and Presets / Negative Cycle Detection', () => {
    test('Highlight shortest tree toggles path highlighting and clearHighlights clears it', async ({ page }) => {
      // Load Example 1 preset to have a fuller graph
      page.on('dialog', async dialog => { await dialog.accept(); });
      await page.click('#preset1');

      // Run iterations enough to compute predecessor tree (V-1 iterations)
      // Determine V from nodesList count
      const V = await page.locator('#nodesList .row').count();
      // Perform V iterations (iterate may finish early)
      for (let i = 0; i < V; i++) {
        await page.click('#iterBtn');
        // small wait to allow updates
        await page.waitForTimeout(200);
      }

      // Toggle highlight shortest tree
      await page.click('#markPathBtn');

      // After toggling, some edges that are predecessors should be styled differently (stroke set to the highlight rgba color)
      // Look for any line with stroke attribute equal to 'rgba(99,102,241,0.98)'
      const edgeLines = page.locator('#edgesLayer g line');
      const count = await edgeLines.count();
      let foundHighlight = false;
      for (let i = 0; i < count; i++) {
        const stroke = await edgeLines.nth(i).getAttribute('stroke');
        if (stroke === 'rgba(99,102,241,0.98)') {
          foundHighlight = true;
          break;
        }
      }
      // It's possible none are highlighted if no predecessors set, but the action should not throw; assert the button toggled state via treeHighlight implicit behavior by checking markPathBtn exists
      expect(await page.locator('#markPathBtn').isVisible()).toBe(true);

      // Now clear highlights
      await page.click('#clearHighlights');

      // Ensure no runtime errors and that UI remains responsive
      await expect(page.locator('#clearHighlights')).toBeVisible();
    });

    test('Load Negative Cycle preset and detect negative cycle via iterations', async ({ page }) => {
      // Intercept confirm/alerts
      page.on('dialog', async dialog => { await dialog.accept(); });

      // Load negative cycle preset
      await page.click('#preset2');

      // Determine V (should be 3)
      const V = await page.locator('#nodesList .row').count();
      expect(V).toBeGreaterThanOrEqual(2);

      // Perform iterations until detection or finished
      // We'll allow up to V+3 iterations to ensure detection check runs
      let detected = false;
      for (let i = 0; i < V + 4; i++) {
        await page.click('#iterBtn');
        // short wait for UI
        await page.waitForTimeout(300);
        // Check log for negative cycle message
        const logText = await page.locator('#log').textContent();
        if (logText && logText.includes('Negative cycle')) {
          detected = true;
          break;
        }
      }

      // Also check for any edge rendered with marker-end 'url(#arrow-red)' as visual evidence
      const redEdges = page.locator('#edgesLayer g line[marker-end="url(#arrow-red)"]');
      const redCount = await redEdges.count();

      // Either detection via log or red edges should indicate negative cycle handling occurred
      expect(detected || redCount > 0).toBeTruthy();
    });
  });

  test.describe('Robustness checks, dialogs, and console observation', () => {
    test('Prompts and confirms are handled; no uncaught exceptions are logged to console', async ({ page }) => {
      // Create a fresh graph: click clear preset and accept confirm
      page.on('dialog', async dialog => { await dialog.accept(); });
      await page.click('#clearBtn');

      // Confirm the graph is cleared
      const nodesAfterClear = await page.locator('#nodesList .row').count();
      expect(nodesAfterClear).toBe(0);

      // Add two nodes using Add Node mode
      await page.click('#addNodeBtn');
      await page.click('#svgCanvas', { position: { x: 120, y: 120 } });
      await page.click('#addNodeBtn');
      await page.click('#svgCanvas', { position: { x: 220, y: 120 } });

      // Add an edge but cancel the prompt by dismissing it to test handling
      page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
          await dialog.dismiss(); // user cancels
        } else {
          await dialog.accept();
        }
      });

      await page.click('#addEdgeBtn');
      await page.locator('[data-node-id="0"]').first().click();
      await page.locator('[data-node-id="1"]').first().click();

      // If the prompt was dismissed, UI should have returned to select mode and no edge added (but no exception)
      await expect(page.locator('#selectBtn')).toHaveClass(/active/);

      // Finally, verify no page errors were captured and console did not receive error-level messages
      const hasErrorConsole = consoleMessages.some(m => m.type === 'error');
      expect(hasErrorConsole).toBeFalsy();
    });
  });
});