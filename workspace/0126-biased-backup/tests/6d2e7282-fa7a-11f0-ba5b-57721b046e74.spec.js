import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e7282-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('BFS Interactive Demo (FSM coverage) - 6d2e7282-fa7a-11f0-ba5b-57721b046e74', () => {
  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure we capture any console messages and page errors for assertions
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store only error-level console messages to inspect later
      const type = msg.type();
      const text = msg.text();
      page.context()._consoleMessages.push({ type, text });
    });

    page.on('pageerror', (err) => {
      page.context()._pageErrors.push(err);
    });
  });

  // Utility page object for interacting with BFS app
  const BFSPage = {
    async getBFSState(page) {
      // Return a serializable snapshot of bfsState without injecting or modifying runtime
      return await page.evaluate(() => {
        return {
          queue: Array.from(bfsState.queue || []),
          visited: Array.from(bfsState.visited || []),
          current: bfsState.current === undefined ? null : bfsState.current,
          parent: bfsState.parent || {},
          step: bfsState.step || 0,
          target: bfsState.target === undefined ? null : bfsState.target,
          found: bfsState.found || false,
          autoStepInterval: bfsState.autoStepInterval === null ? null : bfsState.autoStepInterval
        };
      });
    },

    async getUISummary(page) {
      return await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('.node')).map(n => ({
          id: n.id,
          text: n.textContent,
          classList: Array.from(n.classList)
        }));
        return {
          queueText: document.getElementById('queue-content').textContent,
          currentStepText: document.getElementById('current-step').textContent,
          visitedNodesText: document.getElementById('visited-nodes').textContent,
          pathToTargetText: document.getElementById('path-to-target').textContent,
          bfsStepsHtml: document.getElementById('bfs-steps').innerHTML,
          nodes
        };
      });
    },

    async click(page, selector) {
      await page.click(selector);
    },

    async setValue(page, selector, value) {
      await page.fill(selector, String(value));
    },

    async getElementText(page, selector) {
      const el = await page.locator(selector);
      return el.textContent();
    },

    async waitForLogContains(page, substring, timeout = 3000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const html = await page.locator('#bfs-steps').innerHTML();
        if (html.includes(substring)) return;
        await page.waitForTimeout(50);
      }
      throw new Error(`Timed out waiting for BFS log to contain "${substring}"`);
    },

    async waitForCondition(page, fn, timeout = 3000) {
      const start = Date.now();
      // fn executes in page context; return truthy to stop
      while (Date.now() - start < timeout) {
        const result = await page.evaluate(fn);
        if (result) return;
        await page.waitForTimeout(50);
      }
      throw new Error('Timed out waiting for condition in page');
    }
  };

  test.describe('FSM States and Initialization', () => {
    test('Initial load should parse default adjacency list and render graph (S0 -> S1)', async ({ page }) => {
      // COMMENT: Validate that window.onload invoked loadGraphFromInput and graph is rendered.
      // Check that nodes exist and BFS is reset to the Idle evidence (queue empty, visited empty)
      const ui = await BFSPage.getUISummary(page);

      // There should be nodes created from the default adjacency JSON (0..6)
      expect(ui.nodes.length).toBeGreaterThanOrEqual(2);
      const ids = ui.nodes.map(n => n.text);
      // Expect node "0" to be present
      expect(ids).toContain('0');

      // Queue should be empty representation
      expect(ui.queueText).toBe('[]');

      // Current step should be '0' after reset
      expect(ui.currentStepText).toBe('0');

      // Visited nodes should display 'None' after reset
      expect(ui.visitedNodesText).toBe('None');

      // Also ensure internal bfsState reflects Idle evidence
      const state = await BFSPage.getBFSState(page);
      expect(state.queue.length).toBe(0);
      expect(state.visited.length).toBe(0);
      expect(state.current).toBeNull();

      // No uncaught page errors on load
      expect(page.context()._pageErrors.length).toBe(0);
      // No console 'error' level messages
      const errorConsole = page.context()._consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole.length).toBe(0);
    });
  });

  test.describe('Graph generation and loading (S0 -> S1)', () => {
    test('Clicking Generate Graph populates adjacency list, renders nodes and resets BFS', async ({ page }) => {
      // COMMENT: Set node count and generate a graph; verify adjacency-list updated, nodes rendered, BFS reset
      await BFSPage.setValue(page, '#node-count', '5');
      await BFSPage.click(page, '#generate-graph');

      // adjacency-list should now contain JSON with 5 nodes (keys 0..4)
      const adjValue = await page.locator('#adjacency-list').inputValue();
      expect(adjValue).toContain('"0"'); // basic sanity check

      // Graph container should contain nodes with ids or text for 0..4
      const ui = await BFSPage.getUISummary(page);
      const nodeTexts = ui.nodes.map(n => n.text);
      expect(nodeTexts.length).toBeGreaterThanOrEqual(2);
      // BFS state should have been reset by generateRandomGraph calling resetBFS()
      const state = await BFSPage.getBFSState(page);
      expect(state.queue.length).toBe(0);
      expect(state.step).toBe(0);
      expect(state.visited.length).toBe(0);
    });

    test('Loading invalid adjacency JSON should show an alert (edge case)', async ({ page }) => {
      // COMMENT: Write invalid JSON into adjacency-list and click Load Graph to trigger error handling
      // Prepare to capture dialog
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await BFSPage.setValue(page, '#adjacency-list', '{ invalidJSON: }');
      await BFSPage.click(page, '#load-graph');

      // dialog should have appeared with "Invalid graph format"
      await page.waitForTimeout(200); // short wait for dialog handler
      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage).toContain('Invalid graph format');

      // After failed load, previous graph (from initialization) should remain: nodes should still exist
      const ui = await BFSPage.getUISummary(page);
      expect(ui.nodes.length).toBeGreaterThanOrEqual(1);
    });

    test('Loading a valid adjacency JSON renders the graph and resets BFS', async ({ page }) => {
      // COMMENT: Provide a small custom graph JSON and verify rendered nodes and reset behavior
      const smallGraph = JSON.stringify({
        "0": ["1"],
        "1": ["0", "2"],
        "2": ["1"]
      }, null, 4);

      await BFSPage.setValue(page, '#adjacency-list', smallGraph);
      await BFSPage.click(page, '#load-graph');

      // Ensure nodes 0,1,2 are rendered
      const ui = await BFSPage.getUISummary(page);
      const nodeTexts = ui.nodes.map(n => n.text);
      expect(nodeTexts).toEqual(expect.arrayContaining(['0', '1', '2']));

      // BFS should be reset
      const state = await BFSPage.getBFSState(page);
      expect(state.queue.length).toBe(0);
      expect(state.visited.length).toBe(0);
      expect(state.step).toBe(0);
    });
  });

  test.describe('BFS Execution (S1 -> S2 -> S3) and Controls', () => {
    test('Starting BFS initializes queue and visited with start node (StartBFS)', async ({ page }) => {
      // COMMENT: Use the initial default graph loaded on page load. Set start node and click Start BFS.
      await BFSPage.setValue(page, '#start-node', '0');
      await BFSPage.click(page, '#start-bfs');

      // BFS state should have start node queued and visited
      const state = await BFSPage.getBFSState(page);
      expect(state.queue.length).toBeGreaterThanOrEqual(1);
      expect(state.queue[0]).toBe('0' || 0); // page uses string keys; allow string or numeric
      expect(state.visited).toEqual(expect.arrayContaining(['0']));

      // UI queue display should reflect the queued node
      const ui = await BFSPage.getUISummary(page);
      expect(ui.queueText).toContain('0');

      // Node 0 should have 'visited' and 'queue' classes
      const node0 = ui.nodes.find(n => n.text === '0');
      expect(node0).toBeTruthy();
      expect(node0.classList).toEqual(expect.arrayContaining(['node', 'visited', 'queue']));
    });

    test('Stepping BFS processes nodes and logs progress; completes when queue empty (StepBFS -> S3)', async ({ page }) => {
      // COMMENT: Start BFS and step repeatedly until BFS complete log is emitted
      await BFSPage.setValue(page, '#start-node', '0');
      await BFSPage.click(page, '#start-bfs');

      // Step once and assert processing log exists
      await BFSPage.click(page, '#step-bfs');
      await BFSPage.waitForLogContains(page, 'Processing node');

      // Check that step count incremented in UI and internal state
      const stateAfter1 = await BFSPage.getBFSState(page);
      expect(stateAfter1.step).toBeGreaterThanOrEqual(1);
      expect(stateAfter1.current).toBeTruthy();

      // Continue stepping until we get 'BFS complete' in logs.
      // To avoid infinite loops, limit iterations.
      let iterations = 0;
      let foundComplete = false;
      while (iterations < 20 && !foundComplete) {
        await BFSPage.click(page, '#step-bfs');
        // allow small time for log to be appended
        await page.waitForTimeout(100);
        const bfsStepsHtml = await page.locator('#bfs-steps').innerHTML();
        if (bfsStepsHtml.includes('BFS complete')) {
          foundComplete = true;
          break;
        }
        iterations++;
      }
      expect(foundComplete).toBe(true);

      // After completion, calling step again should again append 'BFS complete' entry (idempotent)
      const beforeHtml = await page.locator('#bfs-steps').innerHTML();
      await BFSPage.click(page, '#step-bfs');
      await page.waitForTimeout(100);
      const afterHtml = await page.locator('#bfs-steps').innerHTML();
      expect(afterHtml.length).toBeGreaterThanOrEqual(beforeHtml.length);
      expect(afterHtml).toContain('BFS complete');
    });

    test('Auto Step starts interval and processes nodes; Stop Auto clears the interval', async ({ page }) => {
      // COMMENT: Validate auto-stepping creates an interval, processes at least one node, and can be stopped
      await BFSPage.setValue(page, '#start-node', '0');

      // Ensure we start with cleared interval
      const stateBefore = await BFSPage.getBFSState(page);
      expect(stateBefore.autoStepInterval).toBeNull();

      // Speed down to minimum to accelerate test
      await BFSPage.setValue(page, '#speed', '100');
      // Trigger input event to update speed UI
      await page.locator('#speed').dispatchEvent('input');

      // Start auto-step
      await BFSPage.click(page, '#auto-step');

      // Wait a bit for some auto steps to happen
      await page.waitForTimeout(500);

      const stateDuring = await BFSPage.getBFSState(page);
      // autoStepInterval should be non-null (an interval id)
      expect(stateDuring.autoStepInterval).not.toBeNull();

      // Some progress should have been made: step > 0 or visited nodes non-empty
      expect(stateDuring.step).toBeGreaterThanOrEqual(1);
      expect(stateDuring.visited.length).toBeGreaterThanOrEqual(1);

      // Now stop auto stepping
      await BFSPage.click(page, '#stop-auto');

      // Wait shortly and capture state after stopping
      await page.waitForTimeout(200);
      const stateAfterStop = await BFSPage.getBFSState(page);
      // autoStepInterval should be null after stopping
      expect(stateAfterStop.autoStepInterval).toBeNull();

      // Save step count and ensure no further steps are processed after stop (stable)
      const savedStep = stateAfterStop.step;
      await page.waitForTimeout(300);
      const finalState = await BFSPage.getBFSState(page);
      expect(finalState.step).toBe(savedStep);
    });

    test('Reset BFS returns to Idle state and clears UI indicators (ResetBFS -> S0)', async ({ page }) => {
      // COMMENT: Start BFS, step once, then reset and verify state and UI cleared
      await BFSPage.setValue(page, '#start-node', '0');
      await BFSPage.click(page, '#start-bfs');
      await BFSPage.click(page, '#step-bfs');
      await BFSPage.waitForLogContains(page, 'Processing node');

      // Now reset
      await BFSPage.click(page, '#reset-bfs');

      // Validate UI cleared to Idle evidence
      const ui = await BFSPage.getUISummary(page);
      expect(ui.queueText).toBe('[]');
      expect(ui.currentStepText).toBe('0');
      expect(ui.visitedNodesText).toBe('None');
      expect(ui.pathToTargetText).toBe('Not calculated');

      // Validate internal bfsState cleared
      const state = await BFSPage.getBFSState(page);
      expect(state.queue.length).toBe(0);
      expect(state.visited.length).toBe(0);
      expect(state.step).toBe(0);
      expect(state.current).toBeNull();

      // Auto step should be cleared as part of reset
      expect(state.autoStepInterval).toBeNull();
    });

    test('Finding a target node logs found message and displays path (showPathToTarget -> S3)', async ({ page }) => {
      // COMMENT: Load a deterministic small graph, set start and target, and step until target found.
      const smallGraph = JSON.stringify({
        "0": ["1","2"],
        "1": ["0","3"],
        "2": ["0","4"],
        "3": ["1"],
        "4": ["2"]
      }, null, 4);
      await BFSPage.setValue(page, '#adjacency-list', smallGraph);
      await BFSPage.click(page, '#load-graph');

      await BFSPage.setValue(page, '#start-node', '0');
      await BFSPage.setValue(page, '#target-node', '4');
      await BFSPage.click(page, '#start-bfs');

      // Step until we find target node 4
      let found = false;
      for (let i = 0; i < 10; i++) {
        await BFSPage.click(page, '#step-bfs');
        await page.waitForTimeout(50);
        const stepsHtml = await page.locator('#bfs-steps').innerHTML();
        if (stepsHtml.includes('Found target node')) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);

      // Path to target span should show the path (e.g., "0 → 2 → 4")
      const pathText = await page.locator('#path-to-target').textContent();
      expect(pathText).toContain('0');
      expect(pathText).toContain('4');
      expect(pathText).toMatch(/→/); // contains arrow joiner
    });

    test('Updating speed input updates UI label and restarts auto-step when active (UpdateSpeed)', async ({ page }) => {
      // COMMENT: Start auto-step, change speed, verify speed label changes and auto continues
      await BFSPage.setValue(page, '#start-node', '0');
      await BFSPage.click(page, '#start-bfs');

      // Start auto
      await BFSPage.setValue(page, '#speed', '500');
      await page.locator('#speed').dispatchEvent('input');
      await BFSPage.click(page, '#auto-step');

      // Wait briefly
      await page.waitForTimeout(200);

      // Change speed to another value
      await BFSPage.setValue(page, '#speed', '300');
      await page.locator('#speed').dispatchEvent('input');

      // Speed value displayed should update
      const speedText = await page.locator('#speed-value').textContent();
      expect(speedText).toContain('300ms');

      // If auto was active, it should have been restarted; autoStepInterval should be non-null
      const state = await BFSPage.getBFSState(page);
      expect(state.autoStepInterval).toBeTruthy();

      // Clean up by stopping auto
      await BFSPage.click(page, '#stop-auto');
    });
  });

  test.describe('Robustness: No unexpected runtime errors', () => {
    test('Page should not emit uncaught exceptions or console errors during normal flows', async ({ page }) => {
      // COMMENT: Perform a sequence of typical interactions and assert no uncaught page errors occurred
      await BFSPage.setValue(page, '#start-node', '0');
      await BFSPage.click(page, '#start-bfs');
      await BFSPage.click(page, '#step-bfs');
      await page.waitForTimeout(100);
      await BFSPage.click(page, '#reset-bfs');

      // Allow any asynchronous errors to surface
      await page.waitForTimeout(200);

      // Assert no pageerrors (uncaught exceptions)
      expect(page.context()._pageErrors.length).toBe(0);

      // Assert there are no console messages of type 'error'
      const errorConsole = page.context()._consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole.length).toBe(0);
    });
  });

  // Final teardown assertion to ensure no leakage of errors after each test run
  test.afterEach(async ({ page }) => {
    // Final safety check: ensure no global modifications introduced uncaught errors
    // We simply assert again that the page hasn't emitted page errors during the test lifecycle
    expect(page.context()._pageErrors.length).toBe(0);
  });
});