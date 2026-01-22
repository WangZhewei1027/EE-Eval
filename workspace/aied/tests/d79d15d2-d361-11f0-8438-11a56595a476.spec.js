import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d15d2-d361-11f0-8438-11a56595a476.html';

// Page Object for the DFS visualization page
class DFSPage {
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  async goto() {
    // Attach listeners before navigation to capture any load-time console/page errors
    this.page.on('console', msg => {
      const text = msg.text();
      this.consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') this.consoleErrors.push(text);
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err.message);
    });
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for svg and nodes to be created via init() on load
    await this.page.waitForSelector('svg[aria-label="Graph visualization"]');
    await this.page.waitForSelector('svg circle.node');
  }

  // Locators
  startBtn() { return this.page.locator('#startBtn'); }
  nextBtn() { return this.page.locator('#nextBtn'); }
  resetBtn() { return this.page.locator('#resetBtn'); }
  svg() { return this.page.locator('svg[aria-label="Graph visualization"]'); }
  nodes() { return this.page.locator('svg circle.node'); }
  nodeByIndex(i) { return this.page.locator('svg circle.node').nth(i); }
  nodeById(id) { return this.page.locator(`#node-${id}`); }
  logEl() { return this.page.locator('#log'); }

  // Actions
  async clickNodeByIndex(i) {
    const node = this.nodeByIndex(i);
    await node.scrollIntoViewIfNeeded();
    await node.click();
  }

  async keypressNodeByIndex(i, key = 'Enter') {
    const node = this.nodeByIndex(i);
    await node.focus();
    await this.page.keyboard.press(key);
  }

  async clickStart() {
    await this.startBtn().click();
  }

  async clickNext() {
    await this.nextBtn().click();
  }

  async clickReset() {
    await this.resetBtn().click();
  }

  // Utilities
  async getStartBtnDisabled() {
    return await this.startBtn().getAttribute('disabled') !== null;
  }
  async getNextBtnDisabled() {
    return await this.nextBtn().getAttribute('disabled') !== null;
  }
  async getResetBtnDisabled() {
    return await this.resetBtn().getAttribute('disabled') !== null;
  }

  async getLogText() {
    return await this.logEl().innerText();
  }

  async countNodes() {
    return await this.nodes().count();
  }

  async countEdges() {
    // edges are line.edge
    return await this.page.locator('svg line.edge').count();
  }

  async getNodeClassListByIndex(i) {
    return await this.nodeByIndex(i).evaluate(node => node.getAttribute('class') || '');
  }

  async getNodeAriaPressedByIndex(i) {
    return await this.nodeByIndex(i).getAttribute('aria-pressed');
  }

  async getNodePointerEventsByIndex(i) {
    return await this.nodeByIndex(i).evaluate(node => node.style.pointerEvents || '');
  }

  // Return captured console errors/messages
  getConsoleErrors() { return this.consoleErrors; }
  getConsoleMessages() { return this.consoleMessages; }
  getPageErrors() { return this.pageErrors; }
}

// Tests
test.describe('DFS Visualization - FSM tests (d79d15d2-d361-11f0-8438-11a56595a476)', () => {
  let dfs;

  test.beforeEach(async ({ page }) => {
    dfs = new DFSPage(page);
    await dfs.goto();
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly; aim to assert no unexpected errors occurred in each test below
  });

  test('Initial Idle state: renders page and initial controls disabled (S0_Idle)', async () => {
    // Validate initial UI elements as per S0_Idle evidence
    expect(await dfs.countNodes()).toBeGreaterThanOrEqual(1); // nodes created
    // Graph has 7 nodes per implementation
    expect(await dfs.countNodes()).toBe(7);
    // Edges count should be 9 per implementation
    expect(await dfs.countEdges()).toBe(9);

    // Buttons initial states
    expect(await dfs.getStartBtnDisabled()).toBe(true);
    expect(await dfs.getNextBtnDisabled()).toBe(true);
    expect(await dfs.getResetBtnDisabled()).toBe(false);

    // The log should have been initialized by reset() called in init(); assert content indicates reset
    const logText = await dfs.getLogText();
    expect(logText).toMatch(/Reset completed/i);

    // Ensure no console errors or page errors on initial load
    expect(dfs.getConsoleErrors()).toEqual([]);
    expect(dfs.getPageErrors()).toEqual([]);
  });

  test('Selecting a start node by click transitions to Node Selected (S1_NodeSelected)', async () => {
    // Click the first node
    await dfs.clickNodeByIndex(0);

    // After selection, start button should become enabled
    expect(await dfs.getStartBtnDisabled()).toBe(false);

    // The clicked node should have aria-pressed true and have the 'selectedStart' class
    const ariaPressed = await dfs.getNodeAriaPressedByIndex(0);
    expect(ariaPressed).toBe('true');

    const classList = await dfs.getNodeClassListByIndex(0);
    expect(classList).toContain('selectedStart');

    // Log should contain selection message
    const logText = await dfs.getLogText();
    expect(logText).toMatch(/Selected start node/i);

    // No runtime errors produced during selection
    expect(dfs.getConsoleErrors()).toEqual([]);
    expect(dfs.getPageErrors()).toEqual([]);
  });

  test('Selecting a start node by keyboard (Enter) transitions to Node Selected (NodeKeyPress)', async () => {
    // Reset first to get a clean log and state
    await dfs.clickReset();
    // Ensure start is disabled after reset
    expect(await dfs.getStartBtnDisabled()).toBe(true);

    // Use keyboard Enter on the second node
    await dfs.keypressNodeByIndex(1, 'Enter');

    // Start button should now be enabled
    expect(await dfs.getStartBtnDisabled()).toBe(false);

    // The node should be marked selected and appear in the log
    const ariaPressed = await dfs.getNodeAriaPressedByIndex(1);
    expect(ariaPressed).toBe('true');

    const logText = await dfs.getLogText();
    expect(logText).toMatch(/Selected start node/i);

    // Again, assert no unexpected page or console errors
    expect(dfs.getConsoleErrors()).toEqual([]);
    expect(dfs.getPageErrors()).toEqual([]);
  });

  test('Starting DFS initializes Running state and enables Next Step (S2_DFS_Running)', async () => {
    // Select a node first
    await dfs.clickNodeByIndex(2); // select node at index 2
    // Click Start
    await dfs.clickStart();

    // After starting, Start should be disabled and Next enabled
    expect(await dfs.getStartBtnDisabled()).toBe(true);
    expect(await dfs.getNextBtnDisabled()).toBe(false);

    // While running, node pointer-events should be 'none'
    // Check a sample node pointer-events
    const pointerEvents = await dfs.getNodePointerEventsByIndex(0);
    expect(pointerEvents).toBe('none');

    // Log should indicate DFS starting from the selected node
    const logText = await dfs.getLogText();
    expect(logText).toMatch(/Starting DFS from node/i);

    // No console/page errors
    expect(dfs.getConsoleErrors()).toEqual([]);
    expect(dfs.getPageErrors()).toEqual([]);
  });

  test('Next Step transitions visit nodes and completes DFS (S2_DFS_Running -> S3_DFS_Complete)', async () => {
    // Select a start node and start DFS
    await dfs.clickNodeByIndex(0);
    await dfs.clickStart();

    // Click Next repeatedly until completion message appears or until a safety cap
    const maxSteps = 50; // safety cap
    let completed = false;
    for (let i = 0; i < maxSteps; i++) {
      // Ensure nextBtn is enabled before clicking; if disabled, break
      const nextDisabled = await dfs.getNextBtnDisabled();
      if (nextDisabled) break;
      await dfs.clickNext();
      const log = await dfs.getLogText();
      if (log.match(/DFS complete! No more nodes to visit\./i)) {
        completed = true;
        break;
      }
      // small short delay to allow DOM updates
      await dfs.page.waitForTimeout(50);
    }

    expect(completed).toBe(true);

    // After completion, nextBtn should be disabled and startBtn disabled
    expect(await dfs.getNextBtnDisabled()).toBe(true);
    expect(await dfs.getStartBtnDisabled()).toBe(true);

    // Log should contain visiting messages and push messages prior to completion
    const finalLog = await dfs.getLogText();
    expect(finalLog).toMatch(/Visiting node/i);
    expect(finalLog).toMatch(/Pushed neighbor/i);
    expect(finalLog).toMatch(/DFS complete! No more nodes to visit\./i);

    // Verify that at least one node has class 'visited' after traversal
    let visitedCount = 0;
    const nodesCount = await dfs.countNodes();
    for (let i = 0; i < nodesCount; i++) {
      const classes = await dfs.getNodeClassListByIndex(i);
      if (classes.includes('visited')) visitedCount++;
    }
    expect(visitedCount).toBeGreaterThanOrEqual(1);

    // No console/page errors during run
    expect(dfs.getConsoleErrors()).toEqual([]);
    expect(dfs.getPageErrors()).toEqual([]);
  });

  test('Reset returns to Idle state and clears highlights (Reset event)', async () => {
    // Start, perform one step, then reset
    await dfs.clickNodeByIndex(1);
    await dfs.clickStart();
    // perform at least one step if possible
    if (!(await dfs.getNextBtnDisabled())) {
      await dfs.clickNext();
    }
    // Now reset
    await dfs.clickReset();

    // Buttons should be back to initial states
    expect(await dfs.getStartBtnDisabled()).toBe(true);
    expect(await dfs.getNextBtnDisabled()).toBe(true);
    expect(await dfs.getResetBtnDisabled()).toBe(false);

    // All nodes should not have visited/current/selectedStart classes
    const nodesCount = await dfs.countNodes();
    for (let i = 0; i < nodesCount; i++) {
      const classes = await dfs.getNodeClassListByIndex(i);
      expect(classes).not.toMatch(/visited|current|selectedStart/);
      const aria = await dfs.getNodeAriaPressedByIndex(i);
      expect(aria).toBe('false');
    }

    // Log should indicate reset was completed
    const logText = await dfs.getLogText();
    expect(logText).toMatch(/Reset completed/i);

    // No console/page errors
    expect(dfs.getConsoleErrors()).toEqual([]);
    expect(dfs.getPageErrors()).toEqual([]);
  });

  test('Edge cases: selecting same node twice does not duplicate selection log; pressing Next while not running does nothing', async () => {
    // Reset to be sure
    await dfs.clickReset();

    // Select node 0
    await dfs.clickNodeByIndex(0);
    const logAfterFirst = await dfs.getLogText();

    // Click the same node again; per implementation this should return early and not add a new log entry
    await dfs.clickNodeByIndex(0);
    const logAfterSecond = await dfs.getLogText();
    expect(logAfterSecond).toBe(logAfterFirst); // no new log lines added

    // Press Next while not running; nextBtn is disabled so clicking should not change log
    expect(await dfs.getNextBtnDisabled()).toBe(true);
    // Attempt click (disabled) - no effect expected
    try {
      await dfs.clickNext();
    } catch (e) {
      // Playwright may throw when clicking a disabled element; ignore - intention is no state change
    }
    const logAfterNextAttempt = await dfs.getLogText();
    expect(logAfterNextAttempt).toBe(logAfterFirst);

    // No console/page errors
    expect(dfs.getConsoleErrors()).toEqual([]);
    expect(dfs.getPageErrors()).toEqual([]);
  });

  test('Keyboard selection (Space) works and Start without selection is prevented (error scenario check)', async () => {
    // Reset
    await dfs.clickReset();

    // Press Space on node 3 to select
    await dfs.keypressNodeByIndex(3, ' ');
    expect(await dfs.getStartBtnDisabled()).toBe(false);
    const logSelect = await dfs.getLogText();
    expect(logSelect).toMatch(/Selected start node/i);

    // Now simulate the alert scenario: attempt to call start when no selection exists.
    // We will reset (clearing selection) then attempt to execute startBtn click via page.evaluate only if startBtn were not disabled.
    // But startBtn is disabled after reset; to test the alert path we'd need to trigger startDFS without selection.
    // We will instead verify that clicking the startBtn while disabled does nothing and no unexpected console errors occur.
    await dfs.clickReset();
    expect(await dfs.getStartBtnDisabled()).toBe(true);
    // Attempt to click disabled Start; Playwright may throw — ignore but ensure no console/page errors produced
    try {
      await dfs.clickStart();
    } catch (e) {
      // ignore
    }
    // No new errors must have appeared
    expect(dfs.getConsoleErrors()).toEqual([]);
    expect(dfs.getPageErrors()).toEqual([]);
  });
});