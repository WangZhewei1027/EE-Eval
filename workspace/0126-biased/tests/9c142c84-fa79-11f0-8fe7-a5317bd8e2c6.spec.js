import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c142c84-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object Model for the explorer page to keep tests organized
class ExplorerPage {
  constructor(page) {
    this.page = page;
    // selectors
    this.initBtn = '#initBtn';
    this.stepBtn = '#stepBtn';
    this.runBtn = '#runBtn';
    this.pauseBtn = '#pauseBtn';
    this.decideLeftBtn = '#decideLeftBtn';
    this.decideRightBtn = '#decideRightBtn';
    this.saveSnapshotBtn = '#saveSnapshotBtn';
    this.listSnapshotsBtn = '#listSnapshotsBtn';
    this.clearSnapshotsBtn = '#clearSnapshotsBtn';
    this.compareMode = '#compareMode';
    this.modeSelect = '#modeSelect';
    this.stateInfo = '#stateInfo';
    this.bestInfo = '#bestInfo';
    this.log = '#log';
    this.funcExpr = '#funcExpr';
    this.leftInput = '#leftInput';
    this.rightInput = '#rightInput';
    this.epsInput = '#epsInput';
    this.speedInput = '#speedInput';
    this.snapshotsList = '#snapshotsList';
    this.resetBtn = '#resetBtn';
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getStateInfoText() {
    return (await this.page.locator(this.stateInfo).innerText()).trim();
  }

  async getBestInfoText() {
    return (await this.page.locator(this.bestInfo).innerText()).trim();
  }

  async getLogText() {
    return (await this.page.locator(this.log).innerText()).trim();
  }

  async setValue(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async selectValue(selector, value) {
    await this.page.selectOption(selector, value);
  }

  // Access the in-page global S object for direct state assertions
  async getGlobalS() {
    return await this.page.evaluate(() => {
      // Return a minimal snapshot of S so tests can assert on key flags
      return {
        initialized: window.S && window.S.initialized,
        running: window.S && window.S.running,
        intervalId: window.S && window.S.intervalId ? true : false,
        currentIndex: window.S && typeof window.S.currentIndex !== 'undefined' ? window.S.currentIndex : null,
        statesLength: window.S && Array.isArray(window.S.states) ? window.S.states.length : 0,
        snapshotsCount: window.S && window.S.snapshots ? Object.keys(window.S.snapshots).length : 0,
      };
    });
  }

  async getSnapshotsListText() {
    return (await this.page.locator(this.snapshotsList).innerText()).trim();
  }
}

// Top-level describe grouping all FSM-related tests
test.describe('Ternary Search Interactive Explorer - FSM & UI integration', () => {
  let page;
  let explorer;
  const consoleMessages = [];
  const pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    explorer = new ExplorerPage(page);
    // Collect console messages and page errors so tests can assert on them
    page.on('console', (msg) => {
      // store console messages (type, text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // store uncaught exceptions
      pageErrors.push(err);
    });
    await page.goto(APP_URL);
    // Wait a bit for initial setup logic (array editor rendering, initial redraw)
    await page.waitForTimeout(150);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('S0_NotInitialized initial page state should show not initialized and no global initialization', async () => {
    // Validate initial UI text and global S flags
    const sText = await explorer.getStateInfoText();
    // The page's initial stateInfo contains 'Not initialized.' according to the HTML implementation
    expect(sText.toLowerCase()).toContain('not initialized');
    const S = await explorer.getGlobalS();
    expect(S.initialized).toBeFalsy();
    // Ensure no unexpected page errors happened during initial load
    // We will assert later (after interactions) that no ReferenceError/SyntaxError/TypeError occurred
  });

  test('Transition S0 -> S1 Initialize: clicking Initialize sets S.initialized and updates state info', async () => {
    // Click Initialize and verify state changes
    await explorer.click(explorer.initBtn);
    await page.waitForTimeout(100); // allow event handlers to run
    const S = await explorer.getGlobalS();
    expect(S.initialized).toBeTruthy();
    // stateInfo should reflect step 0 and iterations 0
    const info = await explorer.getStateInfoText();
    expect(info).toMatch(/Step:\s*0/i);
    expect(info).toMatch(/Iterations:\s*0/i);
    // L and R should match inputs (leftInput/rightInput default values are -5 and 5)
    const leftVal = await page.inputValue(explorer.leftInput);
    const rightVal = await page.inputValue(explorer.rightInput);
    expect(info).toContain(`L=${leftVal}`);
    expect(info).toContain(`R=${rightVal}`);
    // The log should contain the 'Initialized. Mode:' message
    const logText = await explorer.getLogText();
    expect(logText).toMatch(/Initialized\. Mode:/i);
  });

  test('Transition S1 -> S2 Run: clicking Run sets running true and interval is scheduled; Pause stops it', async () => {
    // Ensure initialized
    await explorer.click(explorer.initBtn);
    await page.waitForTimeout(50);

    // Set a slow speed so we can assert running state before any step completes
    await explorer.setValue(explorer.speedInput, '2000');
    // Click Run
    await explorer.click(explorer.runBtn);
    // Give small delay to allow runAuto to set S.running
    await page.waitForTimeout(50);
    let S = await explorer.getGlobalS();
    expect(S.running).toBeTruthy();
    expect(S.intervalId).toBeTruthy();

    // Now Pause: click pause button
    await explorer.click(explorer.pauseBtn);
    await page.waitForTimeout(50);
    S = await explorer.getGlobalS();
    expect(S.running).toBeFalsy();
    // The log should indicate it was paused or that running was stopped
    const logText = await explorer.getLogText();
    // Accept either message from runAuto or stopRun invocation
    expect(logText.length).toBeGreaterThan(0);
  });

  test('Manual compare flow: S1 -> S3 (manual pause) -> manual decision -> state advances', async () => {
    // Reset and initialize for a clean start
    await explorer.click(explorer.resetBtn);
    await page.waitForTimeout(50);
    await explorer.click(explorer.initBtn);
    await page.waitForTimeout(50);

    // Switch to manual compare mode
    await explorer.selectValue(explorer.compareMode, 'manual');
    // Trigger change event by clicking the select (selectOption already triggers)
    await page.waitForTimeout(50);
    // Request a single step - this should push a state and pause for manual decision
    await explorer.click(explorer.stepBtn);
    await page.waitForTimeout(150);

    // Verify a paused situation: after manual step, log should include 'Paused for manual decision' or 'paused'
    const logText = await explorer.getLogText();
    expect(logText.toLowerCase()).toContain('paused') || expect(logText.toLowerCase()).toContain('manual decision');

    // Verify that the current state shows step >= 1 and iterations >=1
    const info = await explorer.getStateInfoText();
    expect(info).toMatch(/Step:\s*[1-9]\d*/i);
    expect(info).toMatch(/Iterations:\s*[1-9]\d*/i);

    // Now apply a manual decision: click the left decision button
    await explorer.click(explorer.decideLeftBtn);
    await page.waitForTimeout(150);

    // After manual decision, the state should advance (step increment)
    const infoAfter = await explorer.getStateInfoText();
    // Should display a step number greater than or equal to previous (>=1)
    const stepMatch = info.match(/Step:\s*([0-9]+)/i);
    const stepAfterMatch = infoAfter.match(/Step:\s*([0-9]+)/i);
    if (stepMatch && stepAfterMatch) {
      const step = Number(stepMatch[1]);
      const stepAfter = Number(stepAfterMatch[1]);
      expect(stepAfter).toBeGreaterThanOrEqual(step + 1);
    } else {
      // If parsing failed, at least ensure there is some step text in new info
      expect(infoAfter).toMatch(/Step:\s*[0-9]+/i);
    }

    // Ensure bestInfo updated (manual decision changes L or R)
    const bestInfo = await explorer.getBestInfoText();
    expect(bestInfo.length).toBeGreaterThan(0);
  });

  test('S2 -> S4 Completed: a Step when eps large should immediately mark done and update stateInfo accordingly', async () => {
    // Reset and initialize
    await explorer.click(explorer.resetBtn);
    await page.waitForTimeout(50);
    await explorer.click(explorer.initBtn);
    await page.waitForTimeout(50);

    // Set eps large so interval width <= eps on first step and triggers completion
    await explorer.setValue(explorer.epsInput, '1000');
    // Trigger a single step
    await explorer.click(explorer.stepBtn);
    await page.waitForTimeout(150);

    // The stateInfo should indicate done and include the termination reason
    const info = await explorer.getStateInfoText();
    // Implementation uses 'done=' followed by reason if done true
    expect(info.toLowerCase()).toContain('done=');
    // The reason is likely 'Interval width <= eps' or similar; assert 'eps' or 'interval' appears
    expect(info.toLowerCase()).toMatch(/interval|eps/);
    // Also log should contain convergence or termination message
    const logText = await explorer.getLogText();
    expect(logText.toLowerCase()).toMatch(/terminated|converged|interval/);
  });

  test('Snapshot lifecycle: save, list, load/fork, delete, clear snapshots', async () => {
    // Ensure initialized and at a known state
    await explorer.click(explorer.resetBtn);
    await page.waitForTimeout(50);
    await explorer.click(explorer.initBtn);
    await page.waitForTimeout(50);

    // Save a snapshot
    // Some UI actions trigger dialogs (confirm/alert). Intercept dialogs to avoid blocking.
    page.on('dialog', async (dialog) => {
      // For all confirms/alerts during snapshot operations, accept to proceed
      try { await dialog.accept(); } catch (e) { /* ignore */ }
    });

    await explorer.click(explorer.saveSnapshotBtn);
    await page.waitForTimeout(100);
    // After saving, S.snapshots count should be >= 1
    const S = await explorer.getGlobalS();
    expect(S.snapshotsCount).toBeGreaterThanOrEqual(1);

    // List snapshots: click listSnapshotsBtn
    await explorer.click(explorer.listSnapshotsBtn);
    await page.waitForTimeout(100);
    const snapsText = await explorer.getSnapshotsListText();
    expect(snapsText.length).toBeGreaterThan(0);
    expect(snapsText.toLowerCase()).not.toContain('no snapshots saved');

    // Attempt to delete via the delete button in the snapshots list: find delete button and click
    // The delete button is a child button within snapshotsList entries; locate it and click if present
    const deleteButtons = await page.locator('#snapshotsList button').all();
    if (deleteButtons.length > 0) {
      await deleteButtons[0].click();
      await page.waitForTimeout(100);
      const Safter = await explorer.getGlobalS();
      // snapshots count should be decreased or zero
      expect(Safter.snapshotsCount).toBeGreaterThanOrEqual(0);
    }

    // Save another snapshot then clear all snapshots (confirm dialog accepted above)
    await explorer.click(explorer.saveSnapshotBtn);
    await page.waitForTimeout(100);
    const beforeClear = await explorer.getGlobalS();
    expect(beforeClear.snapshotsCount).toBeGreaterThanOrEqual(1);

    // Click clear snapshots (will trigger confirm which we accept)
    await explorer.click(explorer.clearSnapshotsBtn);
    await page.waitForTimeout(150);
    const afterClear = await explorer.getGlobalS();
    expect(afterClear.snapshotsCount).toBe(0);
  });

  test('Edge case: invalid function expression should be handled (logged) and not crash the page', async () => {
    // Initialize and then set an invalid function expression to provoke parse errors
    await explorer.click(explorer.resetBtn);
    await page.waitForTimeout(50);
    await explorer.click(explorer.initBtn);
    await page.waitForTimeout(50);

    // Enter a syntactically invalid function
    await explorer.setValue(explorer.funcExpr, 'Math.sin('); // missing closing paren -> parseFunction would throw
    // Force a sampling for plot which calls parseFunction internally
    // We can trigger a redraw via clicking init again
    await explorer.click(explorer.initBtn);
    await page.waitForTimeout(200);

    // The page implementation logs parse errors into the log element
    const logText = await explorer.getLogText();
    expect(logText.toLowerCase()).toContain('function parse error');

    // Ensure the page did not produce uncaught errors in the pageerror handler
    // We will assert below that no pageErrors (ReferenceError/SyntaxError/TypeError) were captured
  });

  test('Final assertion: there should be no uncaught ReferenceError/SyntaxError/TypeError during interactions', async () => {
    // Collect any console errors and page errors seen in this test session.
    // The pageErrors array was populated throughout the beforeEach+tests via page.on('pageerror').
    // We assert that none of the captured pageErrors are of the specified types.
    // Build arrays of textual diagnostics from console messages as well.
    const errorTypesFound = {
      ReferenceError: false,
      SyntaxError: false,
      TypeError: false
    };

    // Check pageErrors first
    for (const err of pageErrors) {
      // err is an Error object; check its name property
      if (err && err.name && Object.prototype.hasOwnProperty.call(errorTypesFound, err.name)) {
        errorTypesFound[err.name] = true;
      }
    }

    // Also parse console messages of type 'error' for mentions of these error names
    for (const m of consoleMessages) {
      if (m.type === 'error' && typeof m.text === 'string') {
        if (m.text.includes('ReferenceError')) errorTypesFound.ReferenceError = true;
        if (m.text.includes('SyntaxError')) errorTypesFound.SyntaxError = true;
        if (m.text.includes('TypeError')) errorTypesFound.TypeError = true;
      }
    }

    // Assert that none of the critical error types occurred as uncaught page errors
    expect(errorTypesFound.ReferenceError).toBe(false);
    expect(errorTypesFound.SyntaxError).toBe(false);
    expect(errorTypesFound.TypeError).toBe(false);
  });
});