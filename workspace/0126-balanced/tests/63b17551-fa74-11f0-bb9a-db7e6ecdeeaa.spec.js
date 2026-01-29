import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b17551-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('DFS Visualization FSM - 63b17551-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    await page.goto(URL);
    // Ensure the page loaded
    await expect(page).toHaveURL(URL);
  });

  test.afterEach(async () => {
    // No-op placeholder for any teardown if needed later
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('Initial UI: Reset disabled and Start enabled; visualization reset', async ({ page }) => {
      // Validate the initial Idle state per FSM:
      // - buttons.reset.disabled = true
      // - resetVisualization() should have been effectively applied to DOM (no visited/current/start classes)

      const resetDisabled = await page.locator('#resetBtn').isDisabled();
      const startDisabled = await page.locator('#startBtn').isDisabled();

      expect(resetDisabled, 'Reset button should be disabled in Idle state').toBe(true);
      expect(startDisabled, 'Start button should be enabled in Idle state').toBe(false);

      // Check that no node has visited/current/start classes
      const anyNodeHasState = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#graph g'));
        return nodes.some(n => n.classList.contains('visited') || n.classList.contains('current') || n.classList.contains('start'));
      });
      expect(anyNodeHasState, 'No node should have visited/current/start classes in Idle state').toBe(false);

      // Check edges also have no visited class
      const anyEdgeVisited = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#graph line.edge')).some(l => l.classList.contains('visited'));
      });
      expect(anyEdgeVisited, 'No edge should be marked visited in Idle state').toBe(false);

      // Assert no uncaught page errors were emitted during load
      expect(pageErrors.length, `Expected no page errors on load, found: ${pageErrors.length}`).toBe(0);
    });
  });

  test.describe('Start DFS / Animating State (S1_Animating)', () => {
    test('Click Start triggers Animating: start button disabled, start node marked, animation begins', async ({ page }) => {
      // Click Start DFS
      await page.click('#startBtn');

      // Immediately after clicking, per implementation:
      // - setNodeState(startNode, 'start') should apply to node A
      // - buttons.start.disabled = true and buttons.reset.disabled = true
      const startBtnDisabled = await page.locator('#startBtn').isDisabled();
      const resetBtnDisabled = await page.locator('#resetBtn').isDisabled();
      expect(startBtnDisabled, 'Start button should be disabled after starting DFS').toBe(true);
      expect(resetBtnDisabled, 'Reset button should be disabled immediately after starting DFS').toBe(true);

      // Node A should have class 'start' immediately
      const nodeAHasStart = await page.evaluate(() => {
        const el = document.querySelector('#graph g[data-id="A"]') || document.querySelector('#graph g[data-id="A"]');
        // Some browsers may normalize dataset attribute differently; fallback by dataset.id
        const node = Array.from(document.querySelectorAll('#graph g')).find(g => g.dataset.id === 'A');
        if (!node) return false;
        return node.classList.contains('start');
      });
      expect(nodeAHasStart, 'Node A should be marked with class "start" immediately after clicking Start').toBe(true);

      // Wait for the first dfsStep to run (animationSpeed = 600ms). Allow generous timeout to avoid flakiness.
      // After first step, Node A should become 'current' (setNodeState overwrites 'start').
      await page.waitForFunction(() => {
        const node1 = Array.from(document.querySelectorAll('#graph g')).find(g => g.dataset.id === 'A');
        return node && node.classList.contains('current');
      }, { timeout: 4000 });

      // Assert that Node A is now 'current'
      const nodeAIsCurrent = await page.evaluate(() => {
        const node2 = Array.from(document.querySelectorAll('#graph g')).find(g => g.dataset.id === 'A');
        return !!(node && node.classList.contains('current'));
      });
      expect(nodeAIsCurrent, 'Node A should become "current" during animation').toBe(true);

      // After at least one neighbor is discovered, an edge should be marked as visited: wait for any edge.visited
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('#graph line.edge')).some(l => l.classList.contains('visited'));
      }, { timeout: 6000 });

      const someEdgeVisited = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#graph line.edge')).some(l => l.classList.contains('visited'));
      });
      expect(someEdgeVisited, 'At least one edge should have class "visited" during animation').toBe(true);

      // Ensure no uncaught page errors occurred during this interaction
      expect(pageErrors.length, `Expected no page errors during animation start, found: ${pageErrors.length}`).toBe(0);
    });

    test('Animation runs steps (DFS_Step transition) and highlights current nodes and edges', async ({ page }) => {
      // Start the DFS
      await page.click('#startBtn');

      // Wait for multiple steps to happen; observe that nodes transition current -> visited over time.
      // We'll wait until we observe at least one node moved from 'current' to 'visited'.
      // Track previous 'current' node via evaluation.
      const sawVisitedAfterCurrent = await page.waitForFunction(() => {
        // If any node has 'visited' class, that's evidence some node finished being current.
        return Array.from(document.querySelectorAll('#graph g')).some(g => g.classList.contains('visited'));
      }, { timeout: 10000 });

      expect(sawVisitedAfterCurrent, 'A node should transition to "visited" during DFS steps').toBeTruthy();

      // Also ensure we can detect a 'current' node concurrently (animation ongoing)
      const hasCurrent = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#graph g')).some(g => g.classList.contains('current'));
      });
      expect(hasCurrent, 'There should be at least one node with class "current" while animation proceeds').toBe(true);

      // Validate that setEdgeVisited effects are visible (some edges have visited class)
      const edgeVisitedCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#graph line.edge')).filter(l => l.classList.contains('visited')).length;
      });
      expect(edgeVisitedCount, 'There should be one or more edges marked visited after DFS steps').toBeGreaterThan(0);

      // No runtime errors expected during DFS steps
      expect(pageErrors.length, `Expected no page errors during DFS steps, found: ${pageErrors.length}`).toBe(0);
    });
  });

  test.describe('Reset Transition and Reset State (S2_Reset / S0_Idle re-entry)', () => {
    test('After animation finishes reset becomes enabled and ResetVisualization returns to Idle', async ({ page }) => {
      // Start DFS
      await page.click('#startBtn');

      // Wait for animation to complete naturally. When animation completes,
      // dfsStep's code sets buttons.start.disabled = false; buttons.reset.disabled = false;
      // So we wait for reset button to become enabled, indicating animation finished.
      await page.waitForFunction(() => {
        const reset = document.querySelector('#resetBtn');
        return reset && !reset.disabled;
      }, { timeout: 30000 }); // allow up to 30 seconds for full DFS completion

      // Now reset button should be enabled. Click it to trigger ResetVisualization event and transition to Idle.
      await page.click('#resetBtn');

      // After reset click, expected behavior:
      // - clearInterval(animationInterval) was called (animation stopped)
      // - resetVisualization() applied => no node/edge with state classes
      // - buttons.start.disabled = false, buttons.reset.disabled = true
      const startBtnDisabledAfterReset = await page.locator('#startBtn').isDisabled();
      const resetBtnDisabledAfterReset = await page.locator('#resetBtn').isDisabled();

      expect(startBtnDisabledAfterReset, 'After reset, Start should be enabled').toBe(false);
      expect(resetBtnDisabledAfterReset, 'After reset, Reset should be disabled').toBe(true);

      // Ensure no node has state classes
      const anyNodeHasStateAfterReset = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#graph g')).some(g =>
          g.classList.contains('visited') || g.classList.contains('current') || g.classList.contains('start'));
      });
      expect(anyNodeHasStateAfterReset, 'After reset, no nodes should have visited/current/start classes').toBe(false);

      // Ensure no edge has visited class
      const anyEdgeVisitedAfterReset = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#graph line.edge')).some(l => l.classList.contains('visited'));
      });
      expect(anyEdgeVisitedAfterReset, 'After reset, no edges should have class "visited"').toBe(false);

      // Validate onExit action side-effects: dfsStep.prevNode should have been reset to null by reset handler
      const dfsPrevNode = await page.evaluate(() => {
        // Access global dfsStep if present
        // If dfsStep is not present, return a sentinel to avoid throwing
        // but site defines dfsStep so this should be accessible
        try {
          return window.dfsStep ? window.dfsStep.prevNode : '__NO_DFS_STEP__';
        } catch (e) {
          return '__ACCESS_ERROR__';
        }
      });
      expect(dfsPrevNode, 'dfsStep.prevNode should be null after reset').toBeNull();

      // No page errors during reset action
      expect(pageErrors.length, `Expected no page errors during reset, found: ${pageErrors.length}`).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Observations', () => {
    test('No unexpected ReferenceError / SyntaxError / TypeError occurred during interactions', async ({ page }) => {
      // This test ensures we observed and recorded console and page errors.
      // The FSM requires we "observe console logs and page errors" and let such errors happen naturally.
      // We assert here that no uncaught ReferenceError/SyntaxError/TypeError were thrown.

      // Gather textual summaries of page errors for debugging output if any
      const errorTypes = pageErrors.map(e => {
        // Provide the constructor name and message when possible
        try {
          return { name: e.name || (e.constructor && e.constructor.name) || 'Error', message: e.message || String(e) };
        } catch {
          return { name: 'Unknown', message: String(e) };
        }
      });

      // Assert there are no page errors of the specified kinds
      const problematic = errorTypes.filter(e =>
        e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError'
      );

      expect(problematic.length, `Expected no ReferenceError/SyntaxError/TypeError. Found: ${JSON.stringify(problematic)}`).toBe(0);

      // Additionally assert console did not include obvious error logs
      const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error' || /error/i.test(m.text));
      expect(consoleErrorEntries.length, `Expected no console.error messages, found: ${consoleErrorEntries.length}`).toBe(0);
    });

    test('Attempting to click Reset while disabled does not trigger errors (edge case)', async ({ page }) => {
      // In the initial state, Reset is disabled. This test attempts to click the disabled reset
      // button to confirm the application does not throw errors when such an interaction occurs.
      // Note: A disabled button should not trigger the click handler in normal user interaction.
      // Playwright will dispatch a real click; since the button is disabled, the browser will ignore it.
      // We simply attempt the interaction and confirm no pageerror is produced.

      const resetBtn = page.locator('#resetBtn');
      expect(await resetBtn.isDisabled(), 'Reset should be disabled before starting').toBe(true);

      // Attempt to click disabled Reset button; it should do nothing and not throw uncaught exceptions
      try {
        await resetBtn.click({ timeout: 2000 });
      } catch (e) {
        // Playwright might throw if it refuses click on disabled; that's acceptable as an interaction detail.
        // We do not fail the test just because click was not performed; instead we verify no page errors were logged.
      }

      // Allow small delay to capture any possible errors that might have been thrown asynchronously
      await page.waitForTimeout(500);

      // Confirm no page errors occurred
      expect(pageErrors.length, `No page errors should result from clicking disabled reset, found: ${pageErrors.length}`).toBe(0);
    });
  });
});