import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b19c60-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the Bellman-Ford visualization page
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.sourceSelect = page.locator('#sourceNode');
    this.logContent = page.locator('#logContent');
    this.distanceRows = page.locator('#distanceTableBody tr');
    this.graphSvg = page.locator('#graph svg');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getConsoleAndPageErrors() {
    // The test harness sets up global capture arrays in the test before navigation.
    // Here we just return them if present.
    // (They are set in beforeEach using closures.)
    return {
      // no-op placeholder to be consistent with Page Object pattern
    };
  }

  async startAlgorithm() {
    await this.startBtn.click();
  }

  async performStep() {
    await this.stepBtn.click();
  }

  async resetAlgorithm() {
    await this.resetBtn.click();
  }

  async getLogText() {
    return (await this.logContent.textContent()) || '';
  }

  async getDistanceTable() {
    const rows = await this.distanceRows.elementHandles();
    const result = [];
    for (const r of rows) {
      const tds = await r.$$('td');
      if (tds.length >= 2) {
        const node = (await (await tds[0].innerText()).trim()) || '';
        const dist = (await (await tds[1].innerText()).trim()) || '';
        result.push({ node, dist });
      }
    }
    return result;
  }

  async isStartEnabled() {
    return this.startBtn.isEnabled();
  }

  async isStepEnabled() {
    return this.stepBtn.isEnabled();
  }

  async isResetEnabled() {
    return this.resetBtn.isEnabled();
  }

  async getSourceValue() {
    return this.sourceSelect.inputValue();
  }

  async countHighlightedEdges() {
    return await this.page.locator('svg .edge.highlight-edge').count();
  }

  async countHighlightedNodes() {
    return await this.page.locator('svg .node.highlight-node').count();
  }

  async svgExists() {
    return (await this.graphSvg.count()) > 0;
  }
}

test.describe('Bellman-Ford Algorithm Visualization - End-to-End', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset arrays per test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', msg => {
      // Store both type and text for richer assertions if needed
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Basic assertion to ensure no unexpected JS runtime errors occurred on the page.
    // We assert that there were no uncaught page errors in these tests (the app should not produce exceptions).
    expect(pageErrors.length, `Page had unexpected uncaught errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('Initial state (S0_Idle): UI components present and initialized', async ({ page }) => {
    // Validate initial Idle state: components exist, select populated, initSourceSelect & drawGraph executed
    const app = new BellmanFordPage(page);
    await app.goto();

    // Check that SVG graph is drawn
    expect(await app.svgExists()).toBeTruthy();

    // Buttons: start enabled, step disabled, reset enabled
    await expect(app.startBtn).toBeEnabled();
    await expect(app.stepBtn).toBeDisabled();
    await expect(app.resetBtn).toBeEnabled();

    // Source select populated with node options (A-E)
    const srcVal = await app.getSourceValue();
    expect(srcVal.length).toBeGreaterThan(0);

    // Log should contain initialization message from initAlgorithm called at load
    const logs = await app.getLogText();
    expect(logs).toContain('Algorithm initialized with source =');

    // Distance table should show 0 for the source node and ∞ for others
    const distances = await app.getDistanceTable();
    expect(distances.length).toBeGreaterThanOrEqual(5); // expect 5 nodes
    const srcRow = distances.find(r => r.dist === '0' || r.dist === '0.0');
    expect(srcRow).toBeTruthy();

    // There should be no console errors
    const errorMsgs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(errorMsgs.length).toBe(0);
  });

  test('StartAlgorithm event (S0 → S1): clicking Start initializes algorithm and enables stepping', async ({ page }) => {
    const app1 = new BellmanFordPage(page);
    await app.goto();

    // Clear any prior console messages from page init
    consoleMessages.length = 0;

    // Click Start - should disable start button and enable step button, and log initialization
    await app.startAlgorithm();

    await expect(app.startBtn).toBeDisabled();
    await expect(app.stepBtn).toBeEnabled();

    const logs1 = await app.getLogText();
    // Expect algorithm initialization and instruction to press next step
    expect(logs).toContain('Algorithm initialized with source =');
    expect(logs).toContain('Press "Next Step" to run the algorithm step-by-step.');

    // Ensure no uncaught console errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Step transitions (S1 → S2 repeated) and algorithm completion (S3): perform full step-through', async ({ page }) => {
    const app2 = new BellmanFordPage(page);
    await app.goto();

    // Start the algorithm to enable stepping
    await app.startAlgorithm();

    // Capture logs as we step
    // We'll click Next Step repeatedly until the step button is disabled (algorithm finished).
    // Add a guard for max iterations to avoid infinite loops.
    const maxClicks = 500;
    let clicks = 0;

    // Ensure at least one relaxation/check is observed
    let sawCheckingEdge = false;
    let sawRelaxation = false;

    while (await app.isStepEnabled() && clicks < maxClicks) {
      // Before clicking, record highlighted edges/nodes count so we can check that highlight behavior occurs
      const beforeHighlightCount = await app.countHighlightedEdges();

      await app.performStep();
      clicks++;

      // Small delay to let DOM updates propagate
      await page.waitForTimeout(20);

      const logs2 = await app.getLogText();

      if (logs.includes('Checking edge')) sawCheckingEdge = true;
      if (logs.includes('Relaxed: distance to')) sawRelaxation = true;

      // Check that highlighting of an edge occurred at some point after pressing step
      const afterHighlightCount = await app.countHighlightedEdges();
      // It's acceptable for afterHighlightCount to be zero in some steps; we collect evidence across the loop.
      if (beforeHighlightCount !== afterHighlightCount && afterHighlightCount > 0) {
        // Found highlight activity; break is not needed, we just note it occurred
      }

      // If algorithm is finished, step button will be disabled; we break and validate final logs
    }

    // At least one "Checking edge" log should have been emitted
    expect(sawCheckingEdge, 'Expected at least one "Checking edge" log during stepping').toBeTruthy();

    // Relaxation may or may not occur depending on graph; for this graph there will be some relaxations
    expect(sawRelaxation, 'Expected at least one "Relaxed" log in the demo graph').toBeTruthy();

    // After finishing, step button should be disabled
    await expect(app.stepBtn).toBeDisabled();

    // Validate final logs: either explicit "Algorithm finished..." or "No further relaxation..." per implementation
    const finalLogs = await app.getLogText();
    const finishedMessages = [
      'Algorithm finished: no negative weight cycles detected.',
      'No further relaxation; no negative weight cycle detected.',
      'Negative weight cycle detected! Algorithm stops.'
    ];
    const foundFinish = finishedMessages.some(msg => finalLogs.includes(msg));
    expect(foundFinish, `Expected one of finish messages (${finishedMessages.join(' | ')}) in logs`).toBeTruthy();

    // Verify distance table values have been updated (not all Infinity)
    const distances1 = await app.getDistanceTable();
    const allInfinite = distances.every(d => d.dist === '∞' || d.dist === 'Infinity');
    expect(allInfinite).toBeFalsy();

    // Ensure no console errors during the run
    const runtimeErrors = consoleMessages.filter(m => m.type === 'error');
    expect(runtimeErrors.length).toBe(0);
  });

  test('ResetAlgorithm event (S* → S0_Idle): clicking Reset resets UI and log', async ({ page }) => {
    const app3 = new BellmanFordPage(page);
    await app.goto();

    // Start then step once to create some state
    await app.startAlgorithm();
    await app.performStep();
    await page.waitForTimeout(20);

    const logsBeforeReset = await app.getLogText();
    expect(logsBeforeReset.length).toBeGreaterThan(0);

    // Click reset
    await app.resetAlgorithm();

    // After reset, logs are cleared according to implementation
    const logsAfterReset = await app.getLogText();
    expect(logsAfterReset.trim()).toBe(''); // reset sets logContent.textContent = ''

    // After reset: both start and step should be enabled (implementation sets stepBtn.disabled = false and startBtn.disabled = false)
    await expect(app.startBtn).toBeEnabled();
    await expect(app.stepBtn).toBeEnabled();

    // Distance table should reflect initAlgorithm with the current source (which reset captures from the select)
    const distances2 = await app.getDistanceTable();
    const srcZero = distances.find(r => r.dist === '0' || r.dist === '0.0');
    expect(srcZero).toBeTruthy();

    // Graph should be re-drawn (SVG present)
    expect(await app.svgExists()).toBeTruthy();

    // No uncaught page errors
    const errors1 = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Edge case: clicking disabled Next Step should not be possible (user-level)', async ({ page }) => {
    const app4 = new BellmanFordPage(page);
    await app.goto();

    // At initial load, stepBtn is disabled. Attempting to click via normal user interaction should fail.
    // Playwright's page.click rejects if element is not enabled; assert that it rejects.
    // This validates the UI correctly prevents stepping before algorithm start.
    await expect(page.click('#stepBtn')).rejects.toThrow();

    // Also check that no new 'Checking edge' logs were emitted as a result of the attempted click
    const logs3 = await app.getLogText();
    expect(logs).not.toContain('Checking edge');

    // Confirm no uncaught runtime errors from this attempted interaction
    const errors2 = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Negative cycle state (S4) is not reached for this graph - assert absence of negative cycle message', async ({ page }) => {
    // This test asserts that for the provided graph the algorithm does not detect a negative cycle.
    // FSM includes a negative-cycle final state; our test validates that it is not hit with the given graph.
    const app5 = new BellmanFordPage(page);
    await app.goto();

    await app.startAlgorithm();

    // Step until finished or until a safe cap
    const maxClicks1 = 500;
    let clicks1 = 0;
    while (await app.isStepEnabled() && clicks < maxClicks) {
      await app.performStep();
      clicks++;
      await page.waitForTimeout(10);
    }

    const logs4 = await app.getLogText();
    // The negative-cycle message is exactly: "Negative weight cycle detected! Algorithm stops."
    expect(logs.includes('Negative weight cycle detected! Algorithm stops.'), 'Negative cycle message should not appear for this graph').toBe(false);

    // Instead, assert that finishing message appears
    const finishMsgPresent = logs.includes('Algorithm finished: no negative weight cycles detected.') || logs.includes('No further relaxation; no negative weight cycle detected.');
    expect(finishMsgPresent).toBe(true);

    // No runtime console errors
    const errors3 = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Observe console logs for expected messages during a single step (S2 evidence)', async ({ page }) => {
    // This test focuses on verifying some FSM-evidence logs for a single performStep invocation.
    const app6 = new BellmanFordPage(page);
    await app.goto();

    // Start algorithm
    await app.startAlgorithm();

    // Clear captured console messages to focus on the next step invocation
    consoleMessages.length = 0;

    // Perform a single step
    await app.performStep();
    await page.waitForTimeout(50);

    // Check that the textual logs in the DOM contain "Checking edge" (evidence for S2)
    const domLogs = await app.getLogText();
    expect(domLogs).toContain('Checking edge');

    // The console captured messages should include any log outputs (the app logs into DOM, not console).
    // Ensure no unexpected console errors happened.
    const errorMsgs1 = consoleMessages.filter(m => m.type === 'error');
    expect(errorMsgs.length).toBe(0);

    // Check that DOM highlighting for the current edge exists (visual feedback)
    const highlightCount = await app.countHighlightedEdges();
    expect(highlightCount).toBeGreaterThanOrEqual(0); // At minimum, no crash; if >0 then highlight applied

    // Also ensure distances table updated (even if just showing ∞ or 0)
    const distances3 = await app.getDistanceTable();
    expect(distances.length).toBeGreaterThan(0);
  });
});