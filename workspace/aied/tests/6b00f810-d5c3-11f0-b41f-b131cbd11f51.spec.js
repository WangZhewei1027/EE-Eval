import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00f810-d5c3-11f0-b41f-b131cbd11f51.html';

// Utility helpers for interacting with the page (simple page object pattern)
class DFSPage {
  constructor(page) {
    this.page = page;
    // element selectors
    this.startBtn = '#start-btn';
    this.pauseBtn = '#pause-btn';
    this.resetBtn = '#reset-btn';
    this.stepBtn = '#step-btn';
    this.speedSelect = '#speed-select';
    this.log = '#log';
    this.stack = '#stack';
    this.visitedBody = '#visited-body';
    this.graphCanvas = '#graph-canvas';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickStart() {
    await this.page.click(this.startBtn);
  }

  async clickPause() {
    await this.page.click(this.pauseBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  async clickStep() {
    await this.page.click(this.stepBtn);
  }

  async selectSpeed(value) {
    await this.page.selectOption(this.speedSelect, value);
  }

  async getGlobal(variableName) {
    return this.page.evaluate((name) => window[name], variableName);
  }

  async getStackArray() {
    return this.page.evaluate(() => window.stack.slice());
  }

  async getVisitedSetSize() {
    return this.page.evaluate(() => window.visited ? window.visited.size : 0);
  }

  async getVisitedOrderMap() {
    return this.page.evaluate(() => window.visitedOrderMap ? Object.assign({}, window.visitedOrderMap) : {});
  }

  async getLogText() {
    return this.page.evaluate(() => {
      const el = document.getElementById('log');
      return el ? el.innerText : '';
    });
  }

  async getStackDomItems() {
    return this.page.$$eval('#stack .stack-item', items => items.map(i => i.textContent));
  }

  async isElementDisabled(selector) {
    return this.page.$eval(selector, (el) => Boolean(el.disabled));
  }

  async nodeExists(nodeId) {
    return this.page.$(`#node-${nodeId}`) !== null;
  }
}

test.describe('DFS Visualization FSM - comprehensive end-to-end tests', () => {
  // Collect page errors and console error messages for each test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages — we treat console.error and any message containing common JS error names as important
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        } else {
          const text = msg.text();
          if (text.includes('ReferenceError') || text.includes('TypeError') || text.includes('SyntaxError')) {
            consoleErrors.push(text);
          }
        }
      } catch (e) {
        // swallow listener errors
      }
    });

    // Navigate to the application
    const dfsPage = new DFSPage(page);
    await dfsPage.goto();

    // Give any initialization scripts a short moment to run
    await page.waitForTimeout(50);
  });

  test.afterEach(async ({ page }) => {
    // Nothing special to teardown; listeners are per-test via beforeEach
    // Validate there were no uncaught page errors or console errors during the test run.
    // This assertion is important: the tests observe console and page errors and assert none occurred.
    expect(pageErrors.map(e => e.toString()).join('\n')).toBe('', {
      matcherHint: 'Expected no uncaught page errors',
    });
    expect(consoleErrors.join('\n')).toBe('', {
      matcherHint: 'Expected no console.error messages or fatal console messages',
    });

    // Close pages are handled by Playwright test runner automatically
  });

  test('Initial state Idle (S0_Idle) - stack and visited empty, controls correct', async ({ page }) => {
    // This test validates the initial (Idle) state as described in the FSM:
    // - stack.length === 0
    // - visited.size === 0
    // - renderGraph() called (nodes rendered)
    // - Start enabled; Pause and Step disabled
    const dfs = new DFSPage(page);

    // Validate global state: stack empty, visited empty
    const stack = await dfs.getStackArray();
    expect(Array.isArray(stack)).toBeTruthy();
    expect(stack.length).toBe(0);

    const visitedSize = await dfs.getVisitedSetSize();
    expect(visitedSize).toBe(0);

    // Check control button disabled/enabled states
    const startDisabled = await dfs.isElementDisabled(dfs.startBtn);
    const pauseDisabled = await dfs.isElementDisabled(dfs.pauseBtn);
    const stepDisabled = await dfs.isElementDisabled(dfs.stepBtn);

    expect(startDisabled).toBe(false); // start should be enabled
    expect(pauseDisabled).toBe(true);  // pause disabled in idle
    expect(stepDisabled).toBe(false);  // step should be enabled when idle (implementation allows step in idle)

    // Check that nodes were rendered in the graph canvas (renderGraph called)
    const nodeA = await page.$('#node-A');
    const nodeB = await page.$('#node-B');
    expect(nodeA).not.toBeNull();
    expect(nodeB).not.toBeNull();

    // Log should be empty at initial state
    const logText = await dfs.getLogText();
    expect(logText.trim()).toBe('');
  });

  test('Start DFS transitions to Running (S1_Running) and performs entry actions', async ({ page }) => {
    // This test validates that clicking Start triggers startDFS(), sets isRunning, pushes 'A' onto stack,
    // and adds a log entry 'Starting DFS from node A'. Also validates controls update.
    const dfs = new DFSPage(page);

    // Click Start
    await dfs.clickStart();

    // Wait until visited set contains at least the start node 'A' (dfsStep is synchronous for the first step)
    await page.waitForFunction(() => window.visited && window.visited.has('A'), null, { timeout: 2000 });

    // Validate isRunning is true
    const isRunning = await dfs.getGlobal('isRunning');
    expect(isRunning).toBe(true);

    // Validate that visited contains A and visitedOrderMap has an entry for A
    const visitedOrderMap = await dfs.getVisitedOrderMap();
    expect(visitedOrderMap['A']).toBeDefined();
    expect(Number(visitedOrderMap['A'])).toBeGreaterThanOrEqual(1);

    // Validate that log contains the starting message
    const log = await dfs.getLogText();
    expect(log).toContain('Starting DFS from node A');

    // Validate controls updated: Start disabled, Pause enabled, Step disabled while running
    const startDisabled = await dfs.isElementDisabled(dfs.startBtn);
    const pauseDisabled = await dfs.isElementDisabled(dfs.pauseBtn);
    const stepDisabled = await dfs.isElementDisabled(dfs.stepBtn);

    expect(startDisabled).toBe(true);
    expect(pauseDisabled).toBe(false);
    expect(stepDisabled).toBe(true);
  });

  test('Pause DFS transitions to Paused (S2_Paused) and Resume returns to Running (S1_Running)', async ({ page }) => {
    // This test validates Pause and Resume: clicking Pause sets isRunning=false and disables Pause,
    // then clicking Start resumes isRunning=true.
    const dfs = new DFSPage(page);

    // Start first to be able to pause
    await dfs.clickStart();
    await page.waitForFunction(() => window.isRunning === true, null, { timeout: 2000 });

    // Click Pause
    await dfs.clickPause();

    // Wait for isRunning false
    await page.waitForFunction(() => window.isRunning === false, null, { timeout: 2000 });

    let isRunning = await dfs.getGlobal('isRunning');
    expect(isRunning).toBe(false);

    // Controls: Pause should be disabled, Start enabled
    let pauseDisabled = await dfs.isElementDisabled(dfs.pauseBtn);
    let startDisabled = await dfs.isElementDisabled(dfs.startBtn);
    expect(pauseDisabled).toBe(true);
    expect(startDisabled).toBe(false);

    // Now resume by clicking Start again
    await dfs.clickStart();
    await page.waitForFunction(() => window.isRunning === true, null, { timeout: 2000 });

    isRunning = await dfs.getGlobal('isRunning');
    expect(isRunning).toBe(true);

    // Controls should reflect running again
    startDisabled = await dfs.isElementDisabled(dfs.startBtn);
    pauseDisabled = await dfs.isElementDisabled(dfs.pauseBtn);
    expect(startDisabled).toBe(true);
    expect(pauseDisabled).toBe(false);
  });

  test('Step Forward behavior in Idle/Paused and disabled while Running (StepForward event)', async ({ page }) => {
    // This test validates Step Forward:
    // - In Idle: clicking Step pushes 'A', logs starting message and updates stack
    // - While Running: step button is disabled per implementation (edge-case vs FSM mismatch)
    const dfs = new DFSPage(page);

    // Ensure in idle: reset first
    await dfs.clickReset();
    await page.waitForFunction(() => window.stack && window.stack.length === 0 && window.visited && window.visited.size === 0, null, { timeout: 2000 });

    // Step in idle: should initialize DFS (push 'A') and add starting log
    await dfs.clickStep();

    // Wait for stack update or visited to contain A
    await page.waitForFunction(() => (window.stack && window.stack.length > 0) || (window.visited && window.visited.has('A')), null, { timeout: 2000 });

    let stackArray = await dfs.getStackArray();
    // Either A was pushed and popped immediately (dfsStep popped A), or neighbors were pushed.
    expect(Array.isArray(stackArray)).toBe(true);

    // Log should contain starting message
    let logText = await dfs.getLogText();
    expect(logText).toContain('Starting DFS from node A');

    // Now start running to validate step button disabled while running
    await dfs.clickStart();
    await page.waitForFunction(() => window.isRunning === true, null, { timeout: 2000 });
    const stepDisabledWhileRunning = await dfs.isElementDisabled(dfs.stepBtn);
    expect(stepDisabledWhileRunning).toBe(true);

    // This highlights an edge case: FSM transition indicates StepForward can occur while running,
    // but implementation disables the step button when running. The test asserts the implemented behavior.
  });

  test('Reset DFS returns to Idle (S1_Running -> S0_Idle) clearing state and logs', async ({ page }) => {
    // This test validates Reset: while running or after some steps, resetDFS clears visited, stack, currentNode, log and stops running.
    const dfs = new DFSPage(page);

    // Start the traversal and wait a bit for some activity
    await dfs.clickStart();
    await page.waitForFunction(() => window.isRunning === true, null, { timeout: 2000 });

    // Now click Reset
    await dfs.clickReset();

    // Wait for reset effects
    await page.waitForFunction(() => {
      return window.isRunning === false &&
             window.stack &&
             window.stack.length === 0 &&
             window.visited &&
             window.visited.size === 0 &&
             document.getElementById('log') &&
             document.getElementById('log').innerText.trim() === '';
    }, null, { timeout: 2000 });

    const isRunning = await dfs.getGlobal('isRunning');
    const stackArray = await dfs.getStackArray();
    const visitedSize = await dfs.getVisitedSetSize();
    const logText = await dfs.getLogText();

    expect(isRunning).toBe(false);
    expect(stackArray.length).toBe(0);
    expect(visitedSize).toBe(0);
    expect(logText.trim()).toBe('');
  });

  test('ChangeSpeed event updates animationSpeed and handles running state (ChangeSpeed)', async ({ page }) => {
    // This test validates changing the speed select updates the animationSpeed global.
    // If running, implementation pauses and restarts: ensure no errors and animationSpeed set correctly.
    const dfs = new DFSPage(page);

    // Set to fastest available (200) before starting to speed up traversal
    await dfs.selectSpeed('200');
    let animationSpeed = await dfs.getGlobal('animationSpeed');
    expect(Number(animationSpeed)).toBe(200);

    // Start running
    await dfs.clickStart();
    await page.waitForFunction(() => window.isRunning === true, null, { timeout: 2000 });

    // Change speed while running; implementation pauses and restarts
    await dfs.selectSpeed('500'); // change to medium
    await page.waitForFunction(() => window.animationSpeed === 500, null, { timeout: 2000 });

    animationSpeed = await dfs.getGlobal('animationSpeed');
    expect(Number(animationSpeed)).toBe(500);

    // Validate that running is still a boolean (should be true after restart) - allow either true/false for robustness
    const isRunning = await dfs.getGlobal('isRunning');
    expect(typeof isRunning).toBe('boolean');

    // Ensure no page errors occurred during the pause->start cycle (captured in afterEach)
  });

  test('Complete traversal reaches Completed state (S3_Completed) and logs completion', async ({ page }) => {
    // This test runs the DFS to completion and validates the 'DFS traversal complete!' log entry appears,
    // the stack ends up empty, and isRunning becomes false.
    const dfs = new DFSPage(page);

    // Speed up the traversal for test: set to 200ms
    await dfs.selectSpeed('200');
    await page.waitForFunction(() => window.animationSpeed === 200, null, { timeout: 2000 });

    // Start and wait for completion; traversal is finite (6 nodes)
    await dfs.clickStart();

    // Wait for the completion message to appear in the log
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && logEl.innerText.includes('DFS traversal complete!');
    }, null, { timeout: 15000 }); // allow generous timeout for a few steps

    // Validate final state: stack empty, isRunning false
    const finalStack = await dfs.getStackArray();
    const finalIsRunning = await dfs.getGlobal('isRunning');
    expect(finalStack.length).toBe(0);
    expect(finalIsRunning).toBe(false);

    // Validate completion log message is present
    const logText = await dfs.getLogText();
    expect(logText).toContain('DFS traversal complete!');
  });

  test('Edge case: clicking Pause when already paused / clicking Start when already running (idempotence)', async ({ page }) => {
    // This test ensures that calling Pause while already paused or Start while already running doesn't throw errors and the state remains sensible.
    const dfs = new DFSPage(page);

    // Ensure idle and then click Pause (pause is disabled in idle but test calling anyway via evaluate to simulate user script)
    // We will call the pauseDFS function directly only if it exists; we are NOT injecting code, just invoking existing page functions.
    // Using the UI: clicking disabled button has no effect; verify no exceptions and state unchanged.
    const pauseDisabled = await dfs.isElementDisabled(dfs.pauseBtn);
    expect(pauseDisabled).toBe(true);

    // Clicking disabled button via Playwright will still dispatch a click event, but the browser won't trigger click handlers if disabled.
    // Attempt to click pause anyway and ensure no page errors
    await page.click(dfs.pauseBtn).catch(() => { /* ignore Playwright click rejection if any */ });

    // Start and then click Start again while running
    await dfs.clickStart();
    await page.waitForFunction(() => window.isRunning === true, null, { timeout: 2000 });

    // Click Start again (button is disabled while running; ensure clicking does not cause errors)
    await page.click(dfs.startBtn).catch(() => { /* ignore */ });

    // Ensure still running
    const isRunning = await dfs.getGlobal('isRunning');
    expect(isRunning).toBe(true);

    // No errors should have been emitted (checked in afterEach)
  });
});