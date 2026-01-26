import { test, expect } from '@playwright/test';

// Test file for Application ID: 12144dc0-fa7a-11f0-acf9-69409043402d
// URL served at: http://127.0.0.1:5500/workspace/0126-biased/html/12144dc0-fa7a-11f0-acf9-69409043402d.html
// Filename requirement: 12144dc0-fa7a-11f0-acf9-69409043402d.spec.js

// Page Object encapsulating interactions with the DFS demo page
class DfsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.loadGraphBtn = page.locator('#load-graph-btn');
    this.graphInput = page.locator('#graph-input');
    this.status = page.locator('#status');
    this.startNodeInput = page.locator('#start-node-input');
    this.startDfsBtn = page.locator('#start-dfs-btn');
    this.stepBtn = page.locator('#step-btn');
    this.autoRunBtn = page.locator('#auto-run-btn');
    this.pauseBtn = page.locator('#pause-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.speedRange = page.locator('#speed-range');
    this.speedDisplay = page.locator('#speed-display');

    this.inspectNodeInput = page.locator('#inspect-node-input');
    this.inspectBtn = page.locator('#inspect-btn');
    this.inspectOutput = page.locator('#inspect-output');

    this.manualPushNode = page.locator('#manual-push-node');
    this.manualPushBtn = page.locator('#manual-push-btn');
    this.manualPopCount = page.locator('#manual-pop-count');
    this.manualPopBtn = page.locator('#manual-pop-btn');

    // Displays
    this.graphList = page.locator('#graph-list');
    this.stackList = page.locator('#stack-list');
    this.visitedList = page.locator('#visited-list');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/12144dc0-fa7a-11f0-acf9-69409043402d.html', { waitUntil: 'load' });
  }

  // Helpers for reading status / displays
  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }
  async getGraphText() {
    return (await this.graphList.textContent())?.trim() ?? '';
  }
  async getStackText() {
    return (await this.stackList.textContent())?.trim() ?? '';
  }
  async getVisitedText() {
    return (await this.visitedList.textContent())?.trim() ?? '';
  }
  async getLogText() {
    return (await this.log.textContent()) ?? '';
  }

  // Action helpers
  async loadGraph() {
    await this.loadGraphBtn.click();
  }

  async setGraphInput(text) {
    await this.graphInput.fill(text);
  }

  async startDFS(startNode = null) {
    if (startNode !== null) {
      await this.startNodeInput.fill(startNode);
    }
    await this.startDfsBtn.click();
  }

  async step() {
    await this.stepBtn.click();
  }

  async autoRun() {
    await this.autoRunBtn.click();
  }

  async pause() {
    await this.pauseBtn.click();
  }

  async reset() {
    await this.resetBtn.click();
  }

  async setSpeed(value) {
    await this.speedRange.fill(String(value));
    // trigger input event by dispatching a small JS event if necessary
    await this.speedRange.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
    // speed display updates asynchronously; wait a little
    await this.page.waitForTimeout(50);
  }

  async inspect(node) {
    await this.inspectNodeInput.fill(node);
    await this.inspectBtn.click();
  }

  async manualPush(node) {
    await this.manualPushNode.fill(node);
    await this.manualPushBtn.click();
  }

  async manualPop(count = '1') {
    await this.manualPopCount.fill(String(count));
    await this.manualPopBtn.click();
  }

  // Button state queries
  async isDisabled(selector) {
    return await this.page.locator(selector).evaluate((el) => el.disabled === true);
  }
}

// Collect console error and page errors for assertion
async function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  return { consoleErrors, pageErrors };
}

test.describe('DFS Interactive Demo - FSM and UI tests', () => {
  // Run each test with a fresh page
  test.beforeEach(async ({ page }) => {
    // Nothing global here; each test will navigate via page object.
  });

  test('Initial Ready state on load: graph rendered and controls updated', async ({ page }) => {
    // Validate initial "Ready" state (S0_Ready) evidence: status text, graph rendered, reset state invoked.
    const collectors = await attachErrorCollectors(page);
    const dfs = new DfsPage(page);
    await dfs.goto();

    // The page's init hook runs on window.load and should parse default textarea and call resetState.
    // Check status message evidence
    await expect.soft(dfs.status).toHaveText(/Graph loaded\. Ready to start DFS\.|Ready\./, { timeout: 2000 });

    // Graph should be rendered with nodes A..F
    const graphText = await dfs.getGraphText();
    expect(graphText).toContain('A: B, C');
    expect(graphText).toContain('F: '); // ensure F present

    // Buttons: Start should be enabled; Step disabled; Auto Run enabled (per JS updateControls(true,false,true,false))
    expect(await dfs.isDisabled('#start-dfs-btn')).toBe(false);
    expect(await dfs.isDisabled('#step-btn')).toBe(true);
    // auto-run might be enabled by JS init
    expect(await dfs.isDisabled('#auto-run-btn')).toBe(false);
    expect(await dfs.isDisabled('#pause-btn')).toBe(true);
    expect(await dfs.isDisabled('#reset-btn')).toBe(true);

    // Stack and Visited show empty states
    expect(await dfs.getStackText()).toMatch(/\(empty\)/i);
    expect(await dfs.getVisitedText()).toMatch(/\(none\)/i);

    // Ensure no uncaught page errors nor console errors occurred during initialization
    expect(collectors.pageErrors.length, 'no page errors on load').toBe(0);
    expect(collectors.consoleErrors.length, 'no console error messages on load').toBe(0);
  });

  test('LOAD_GRAPH event: clicking Load Graph updates graph and status', async ({ page }) => {
    // This validates the LOAD_GRAPH event and transition S0_Ready->S0_Ready behavior (graph parsing)
    const collectors = await attachErrorCollectors(page);
    const dfs = new DfsPage(page);
    await dfs.goto();

    // Change graph input to a small custom graph and load it
    const customGraph = `X:Y
Y:Z
Z:`;
    await dfs.setGraphInput(customGraph);
    await dfs.loadGraph();

    // After loading, status should indicate graph loaded
    const status = await dfs.getStatusText();
    expect(status).toMatch(/Graph loaded\. Ready to start DFS\./);

    const graphText = await dfs.getGraphText();
    expect(graphText).toContain('X: Y');
    expect(graphText).toContain('Z:');

    // Start button should be enabled
    expect(await dfs.isDisabled('#start-dfs-btn')).toBe(false);

    // No uncaught errors
    expect(collectors.pageErrors.length, 'no page errors after load').toBe(0);
    expect(collectors.consoleErrors.length, 'no console errors after load').toBe(0);
  });

  test.describe('DFS Running (S1_DFS_Running) and transitions via Next Step and Reset', () => {
    test('START_DFS event puts UI into Running state and Next Step visits nodes', async ({ page }) => {
      // Validate START_DFS transition and NEXT_STEP visits (including repeated NEXT_STEP staying in S1_DFS_Running until completion)
      const collectors = await attachErrorCollectors(page);
      const dfs = new DfsPage(page);
      await dfs.goto();

      // Ensure using default graph and default start node 'A'
      await dfs.startDFS('A');

      // After starting, status should mention DFS started
      const status = await dfs.getStatusText();
      expect(status).toMatch(/DFS started at \"?A\"?/);

      // Buttons: start disabled, step enabled, auto-run enabled, reset enabled
      expect(await dfs.isDisabled('#start-dfs-btn')).toBe(true);
      expect(await dfs.isDisabled('#step-btn')).toBe(false);
      expect(await dfs.isDisabled('#auto-run-btn')).toBe(false);
      expect(await dfs.isDisabled('#reset-btn')).toBe(false);

      // Perform a single Next Step and validate that A is visited and stack updated
      await dfs.step();
      // Wait briefly to let UI update
      await page.waitForTimeout(100);
      const visited = await dfs.getVisitedText();
      expect(visited).toContain('A');

      const stackText = await dfs.getStackText();
      // After first step, top should be B (per DFS pushing neighbors reversed for A:B,C)
      expect(stackText).toMatch(/B\s*←\s*top/);

      const logText = await dfs.getLogText();
      expect(logText).toMatch(/Visited node \"A\"|Visiting node "A"/i);

      // Continue stepping until DFS completes (status shows complete)
      // Use a safe loop with a cap to avoid infinite loop
      let attempts = 0;
      let finalStatus = '';
      while (attempts < 20) {
        const s = await dfs.getStatusText();
        if (/DFS complete|DFS is complete/i.test(s)) {
          finalStatus = s;
          break;
        }
        await dfs.step();
        await page.waitForTimeout(50);
        attempts++;
      }
      expect(/DFS complete|DFS is complete/i.test(finalStatus) || /DFS complete|DFS is complete/i.test(await dfs.getStatusText())).toBe(true);

      // When finished, stack should show (empty) and visited should contain multiple nodes
      expect(await dfs.getStackText()).toMatch(/\(empty\)/i);
      expect((await dfs.getVisitedText()).length).toBeGreaterThan(0);

      // No uncaught runtime errors during DFS running and stepping
      expect(collectors.pageErrors.length, 'no page errors during DFS start/steps').toBe(0);
      expect(collectors.consoleErrors.length, 'no console errors during DFS start/steps').toBe(0);
    });

    test('RESET event returns to Ready state from Running', async ({ page }) => {
      // Validate Reset transition S1_DFS_Running -> S0_Ready
      const collectors = await attachErrorCollectors(page);
      const dfs = new DfsPage(page);
      await dfs.goto();

      // Start DFS then reset
      await dfs.startDFS('A');
      await dfs.step(); // perform at least one step
      await page.waitForTimeout(50);
      await dfs.reset();

      // After reset, status should say Ready or show 'State reset.' in log and status 'Ready.'
      const status = await dfs.getStatusText();
      expect(status).toMatch(/Ready\.|Graph loaded\. Ready to start DFS\./i);

      // Stack and visited should be reset
      expect(await dfs.getStackText()).toMatch(/\(empty\)/i);
      expect(await dfs.getVisitedText()).toMatch(/\(none\)/i);

      // Buttons: Start enabled again
      expect(await dfs.isDisabled('#start-dfs-btn')).toBe(false);

      expect(collectors.pageErrors.length, 'no page errors on reset').toBe(0);
      expect(collectors.consoleErrors.length, 'no console errors on reset').toBe(0);
    });
  });

  test.describe('Auto Run (S3_Auto_Run) and Pause (S4_Paused) transitions', () => {
    test('AUTO_RUN starts auto run and PAUSE pauses it; can resume and finish', async ({ page }) => {
      // Validate S1 -> S3 via AUTO_RUN and S3 -> S4 via PAUSE and S4 -> S3 via AUTO_RUN
      const collectors = await attachErrorCollectors(page);
      const dfs = new DfsPage(page);
      await dfs.goto();

      // Start DFS
      await dfs.startDFS('A');

      // Speed up the auto-run to finish quicker
      await dfs.setSpeed('5'); // steps/second -> 200ms per step

      // Start auto-run
      await dfs.autoRun();
      // Status should be 'Auto running DFS...'
      await expect.soft(dfs.status).toHaveText(/Auto running DFS\.\.\./, { timeout: 1000 });

      // Pause after a short delay, while auto-run is running
      await page.waitForTimeout(300); // allow some steps to happen
      await dfs.pause();

      // Status should say 'Auto run paused.'
      await expect.soft(dfs.status).toHaveText(/Auto run paused\./, { timeout: 1000 });

      // Resume auto-run
      await dfs.autoRun();
      await expect.soft(dfs.status).toHaveText(/Auto running DFS\.\.\./, { timeout: 1000 });

      // Wait until completion (status will show completion)
      await page.waitForFunction(() => {
        const s = document.getElementById('status');
        return s && /DFS complete|DFS is complete/.test(s.textContent || '');
      }, { timeout: 5000 });

      const finalStatus = await dfs.getStatusText();
      expect(/DFS complete|DFS is complete/i.test(finalStatus)).toBe(true);

      // No uncaught errors
      expect(collectors.pageErrors.length, 'no page errors in auto run flow').toBe(0);
      expect(collectors.consoleErrors.length, 'no console errors in auto run flow').toBe(0);
    });
  });

  test.describe('Inspect Node, Manual Push and Manual Pop events and edge cases', () => {
    test('INSPECT_NODE shows node info, edge-case handling for missing and non-existent nodes', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const dfs = new DfsPage(page);
      await dfs.goto();

      // Inspect empty input should prompt user
      await dfs.inspect('');
      await expect(dfs.inspectOutput).toHaveText(/Enter node to inspect\./);

      // Inspect non-existent node
      await dfs.inspect('Z');
      await expect(dfs.inspectOutput).toHaveText(/does not exist in the graph/i);

      // Inspect existing node (A)
      await dfs.inspect('A');
      const out = await dfs.inspectOutput.textContent();
      expect(out).toContain('Node "A"');
      expect(out).toMatch(/Neighbors:|Status:/);

      expect(collectors.pageErrors.length, 'no page errors during inspect actions').toBe(0);
      expect(collectors.consoleErrors.length, 'no console errors during inspect actions').toBe(0);
    });

    test('MANUAL_PUSH and MANUAL_POP behavior and edge cases', async ({ page }) => {
      const collectors = await attachErrorCollectors(page);
      const dfs = new DfsPage(page);
      await dfs.goto();

      // Start DFS so manual push/pop are allowed (manualPushBtn disabled when !canStep && !running)
      await dfs.startDFS('A');

      // Try manual push for a non-existent node -> should set status indicating cannot push
      await dfs.manualPush('ZZ');
      await page.waitForTimeout(50);
      expect(await dfs.getStatusText()).toMatch(/Cannot push: node "ZZ" does not exist\./);

      // Manual push of existing node (e.g., F)
      await dfs.manualPush('F');
      await page.waitForTimeout(50);
      // Top of stack should be F
      expect(await dfs.getStackText()).toMatch(/F\s*←\s*top/);

      // Manual pop with count more than stack length: should pop available nodes and not crash
      // First get stack length by counting div children in stack-list
      const stackCount = await page.locator('#stack-list > div').count();
      // Pop more than available
      await dfs.manualPop(10);
      await page.waitForTimeout(50);
      // If stack became empty, we should see '(empty)'
      const stackTextAfter = await dfs.getStackText();
      if (stackCount > 0) {
        // Accept either reduced stack or empty
        expect(stackTextAfter.length).toBeGreaterThan(0);
      }
      // When popping empty, status should reflect if attempted later
      // Ensure manualPop when empty shows helpful message by emptying stack then calling pop
      // Reset, then try popping when stack is empty
      await dfs.reset();
      await dfs.manualPop(1);
      await page.waitForTimeout(50);
      expect(await dfs.getStatusText()).toMatch(/Stack is empty. Cannot pop\./);

      expect(collectors.pageErrors.length, 'no page errors during manual push/pop').toBe(0);
      expect(collectors.consoleErrors.length, 'no console errors during manual push/pop').toBe(0);
    });
  });

  test('Error scenario: Invalid graph input triggers parse error and status shows error', async ({ page }) => {
    // This test ensures the LOAD_GRAPH handler catches parsing errors and updates status accordingly.
    const collectors = await attachErrorCollectors(page);
    const dfs = new DfsPage(page);
    await dfs.goto();

    // Provide invalid graph input (missing colon)
    await dfs.setGraphInput('INVALID_LINE_NO_COLON');
    await dfs.loadGraph();

    // Status should include 'Error loading graph'
    const status = await dfs.getStatusText();
    expect(status).toMatch(/Error loading graph:/i);

    // Graph list should remain unchanged from previous valid load (initial graph is still present)
    const graphText = await dfs.getGraphText();
    expect(graphText.length).toBeGreaterThan(0);
    expect(graphText).toContain('A: B, C');

    // Ensure no uncaught page errors occurred (the parse error is handled)
    expect(collectors.pageErrors.length, 'no uncaught page errors for invalid graph input').toBe(0);
    expect(collectors.consoleErrors.length, 'no console errors for invalid graph input').toBe(0);
  });

  test('Final sanity: no unexpected console errors or page errors across typical flows', async ({ page }) => {
    // Run a quick end-to-end to ensure listeners are capturing and that no unexpected runtime exceptions occur
    const collectors = await attachErrorCollectors(page);
    const dfs = new DfsPage(page);
    await dfs.goto();

    // A quick user flow: start -> a couple steps -> auto-run -> finish
    await dfs.startDFS('A');
    await dfs.step();
    await dfs.step();
    await dfs.setSpeed('5');
    await dfs.autoRun();

    // Wait for completion
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && /DFS complete|DFS is complete/.test(s.textContent || '');
    }, { timeout: 5000 });

    // Verify final status is complete and stack empty
    expect(/DFS complete|DFS is complete/i.test(await dfs.getStatusText())).toBe(true);
    expect(await dfs.getStackText()).toMatch(/\(empty\)/i);

    // Assert no uncaught runtime exceptions surfaced
    expect(collectors.pageErrors.length, 'no page errors in final sanity flow').toBe(0);
    expect(collectors.consoleErrors.length, 'no console errors in final sanity flow').toBe(0);
  });
});