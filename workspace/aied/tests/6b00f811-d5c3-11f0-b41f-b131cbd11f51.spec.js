import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b00f811-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object Model for the BFS visualization page
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.graphSelect = page.locator('#graph-select');
    this.startNodeSelect = page.locator('#start-node');
    this.speedSlider = page.locator('#speed');
    this.startBtn = page.locator('#start-btn');
    this.stepBtn = page.locator('#step-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.queueElements = page.locator('#queue-elements');
    this.status = page.locator('#status');
    this.canvas = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Read serializable snapshot of bfsState from the page
  async getBfsStateSnapshot() {
    return await this.page.evaluate(() => {
      if (typeof bfsState === 'undefined' || bfsState === null) return null;
      return {
        isRunning: !!bfsState.isRunning,
        queue: Array.isArray(bfsState.queue) ? bfsState.queue.slice() : [],
        visitedSize: bfsState.visited ? bfsState.visited.size : 0,
        currentNode: bfsState.currentNode,
        speed: bfsState.speed,
        animationId: bfsState.animationId || null
      };
    });
  }

  async selectGraph(value) {
    await this.graphSelect.selectOption(value);
  }

  async selectStartNode(value) {
    await this.startNodeSelect.selectOption(value);
  }

  async setSpeed(value) {
    // value should be string or number
    await this.speedSlider.fill(String(value));
    // Use evaluate to set the slider value and dispatch input event for reliability
    await this.page.evaluate((v) => {
      const slider = document.getElementById('speed');
      slider.value = String(v);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getStatusText() {
    return (await this.status.textContent())?.trim();
  }

  async getQueueElementsText() {
    return await this.page.evaluate(() => {
      const container = document.getElementById('queue-elements');
      if (!container) return [];
      return Array.from(container.children).map(el => ({
        text: el.textContent.trim(),
        classes: Array.from(el.classList)
      }));
    });
  }

  async getStartNodeOptionsCount() {
    return await this.page.evaluate(() => {
      const sel = document.getElementById('start-node');
      return sel ? sel.options.length : 0;
    });
  }

  async getStartBtnText() {
    return (await this.startBtn.textContent())?.trim();
  }
}

test.describe('BFS Visualization - FSM state and transitions (6b00f811-d5c3-11f0-b41f-b131cbd11f51)', () => {
  let page;
  let bfsPage;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Collect console errors and page errors for assertions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err); // Error object
    });

    bfsPage = new BFSPage(page);
    await bfsPage.goto();
  });

  test.afterEach(async () => {
    // Try to reset the app to clear any intervals. This is best-effort.
    try {
      await bfsPage.clickReset();
    } catch (e) {
      // ignore teardown errors
    }
    // Close page to ensure intervals don't linger in next tests
    await page.close();
  });

  test('Initial Idle State: page renders and initial UI reflects Idle (S0_Idle)', async () => {
    // Validate initial status text matches Idle evidence
    const status = await bfsPage.getStatusText();
    // The HTML initial status text includes: Click "Start BFS" to begin visualization
    expect(status).toContain('Click "Start BFS" to begin visualization');

    // Start button should be enabled
    expect(await bfsPage.startBtn.isEnabled()).toBeTruthy();

    // Step button starts disabled per HTML
    expect(await bfsPage.stepBtn.isDisabled()).toBeTruthy();

    // Queue should be empty initially
    const queue = await bfsPage.getQueueElementsText();
    expect(queue.length).toBe(0);

    // No unexpected page errors on initial load
    expect(pageErrors.length).toBe(0);
    // No console error messages
    expect(consoleErrors.length).toBe(0);
  });

  test('Graph selection change resets BFS and updates start node options (GraphSelectChange event)', async () => {
    // Change to 'tree' structure and assert start node options updated and status reset
    await bfsPage.selectGraph('tree');

    // Wait for DOM updates and drawGraph to run
    await page.waitForTimeout(100);

    const optionsCount = await bfsPage.getStartNodeOptionsCount();
    // Tree has 7 nodes in the implementation
    expect(optionsCount).toBe(7);

    const status = await bfsPage.getStatusText();
    expect(status).toContain('Graph ready. Click "Start BFS" to begin visualization');

    // Ensure bfsState has been reset
    const state = await bfsPage.getBfsStateSnapshot();
    expect(state).not.toBeNull();
    expect(state.queue.length).toBe(0);
    expect(state.visitedSize).toBe(0);
    expect(state.isRunning).toBe(false);

    // No page errors or console errors caused by changing graph
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Start node selection change triggers reset (StartNodeSelectChange event)', async () => {
    // Change start node to '3'
    await bfsPage.selectStartNode('3');

    // Wait for update
    await page.waitForTimeout(50);

    const status = await bfsPage.getStatusText();
    expect(status).toContain('Graph ready. Click "Start BFS" to begin visualization');

    const state = await bfsPage.getBfsStateSnapshot();
    expect(state.queue.length).toBe(0);
    expect(state.currentNode).toBeNull();

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Speed slider input changes bfsState.speed (SpeedSliderInput event)', async () => {
    // Set slider to a new value and assert bfsState.speed updated accordingly
    // The code sets bfsState.speed = 2100 - this.value
    await bfsPage.setSpeed(1500);

    const state = await bfsPage.getBfsStateSnapshot();
    // Expect speed to be 2100 - 1500 = 600
    expect(state.speed).toBe(600);

    // No transition/state change; still idle
    expect(state.isRunning).toBe(false);

    // No errors from speed input
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Start BFS from Idle transitions to Running (S0_Idle -> S1_BFS_Running) and then Pause -> Step mode', async () => {
    // Ensure we're in idle and select a specific start node
    await bfsPage.selectStartNode('0');

    // Click Start BFS (first click triggers startBFS and then toggling listener)
    await bfsPage.clickStart();

    // Allow handlers and interval creation
    await page.waitForTimeout(200);

    // Snapshot: isRunning should be true and status should indicate start node
    let state = await bfsPage.getBfsStateSnapshot();
    expect(state.isRunning).toBe(true);
    // queue should contain the selected start node (0)
    expect(state.queue.length).toBeGreaterThanOrEqual(1);
    expect(state.queue[0]).toBe(0);

    const status = await bfsPage.getStatusText();
    expect(status).toContain('BFS started from node 0');

    // startBtn's text should have been changed to "Pause BFS" by the toggle handler
    const startBtnText = await bfsPage.getStartBtnText();
    expect(startBtnText).toBe('Pause BFS');

    // Now click Start button again to 'Pause' (toggle handler sets Resume and stops animation)
    await bfsPage.clickStart();
    await page.waitForTimeout(100);

    // Now bfsState.isRunning should be false (paused) and stepBtn enabled
    state = await bfsPage.getBfsStateSnapshot();
    expect(state.isRunning).toBe(false);
    expect(await bfsPage.stepBtn.isEnabled()).toBeTruthy();

    // At this point we are in step-by-step mode; ensure no page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Clean up - ensure we clear any interval in case something remained
    await bfsPage.clickReset();
  });

  test('Step through BFS (S1_BFS_Running -> S2_BFS_Step -> S3_BFS_Completed) using step button', async () => {
    // Start BFS then immediately pause to enter step mode to control stepping deterministically
    await bfsPage.selectStartNode('0');
    await bfsPage.clickStart();
    await page.waitForTimeout(150);
    // Pause
    await bfsPage.clickStart();
    await page.waitForTimeout(100);

    // Ensure queue has items to step through
    let state = await bfsPage.getBfsStateSnapshot();
    expect(state.queue.length).toBeGreaterThan(0);

    // Step repeatedly until BFS completes
    const visitedNodes = new Set();
    let iterations = 0;
    const maxIterations = 50; // safety cap

    while (iterations < maxIterations) {
      iterations++;
      // Click step
      await bfsPage.clickStep();

      // Wait a small amount of time for performBFSStep to update DOM and state
      await page.waitForTimeout(80);

      const statusText = await bfsPage.getStatusText();

      // If we're visiting a node, record it
      if (statusText.includes('Visiting node')) {
        // Extract node number
        const match = statusText.match(/Visiting node\s+(\d+)/);
        if (match) {
          visitedNodes.add(match[1]);
        }
      }

      // If BFS completed, break loop
      if (statusText.includes('BFS completed')) {
        break;
      }

      // Also break if queue becomes empty in state
      state = await bfsPage.getBfsStateSnapshot();
      if (state.queue.length === 0 && !state.isRunning) {
        // final step should have set BFS completed
        break;
      }
    }

    // After stepping, status must indicate completion
    const finalStatus = await bfsPage.getStatusText();
    expect(finalStatus).toMatch(/BFS completed/i);

    // Validate that we visited at least one node during stepping
    expect(visitedNodes.size).toBeGreaterThanOrEqual(1);

    // Validate that the page BFS state reflects not running, empty queue
    state = await bfsPage.getBfsStateSnapshot();
    expect(state.isRunning).toBe(false);
    expect(state.queue.length).toBe(0);

    // No page errors produced during stepping
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Clean up by clicking reset
    await bfsPage.clickReset();
    await page.waitForTimeout(50);
  });

  test('Edge case: Clicking Step while idle sets completion message and disables step button (S0_Idle -> S0_Idle)', async () => {
    // Ensure idle state
    const initialState = await bfsPage.getBfsStateSnapshot();
    expect(initialState.queue.length).toBe(0);
    expect(initialState.isRunning).toBe(false);

    // Click step when nothing is queued
    await bfsPage.clickStep();
    await page.waitForTimeout(50);

    const statusText = await bfsPage.getStatusText();
    expect(statusText).toContain('BFS completed!');

    // Step button should be disabled after this behavior per nextStep()
    expect(await bfsPage.stepBtn.isDisabled()).toBeTruthy();

    // No page errors or console errors from this unexpected user interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Reset back to normal
    await bfsPage.clickReset();
  });

  test('Reset button clears state and stops any running animation (ResetButtonClick event)', async () => {
    // Start BFS to create running animation
    await bfsPage.selectStartNode('0');
    await bfsPage.clickStart();
    await page.waitForTimeout(150);

    // Click reset
    await bfsPage.clickReset();
    await page.waitForTimeout(50);

    // State should be reset
    const state = await bfsPage.getBfsStateSnapshot();
    expect(state.queue.length).toBe(0);
    expect(state.visitedSize).toBe(0);
    expect(state.currentNode).toBeNull();
    expect(state.isRunning).toBe(false);

    // UI status should reflect Graph ready message
    const statusText = await bfsPage.getStatusText();
    expect(statusText).toContain('Graph ready. Click "Start BFS" to begin visualization');

    // No errors generated by reset
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Robustness: repeated Start clicks do not throw and keep BFS state consistent', async () => {
    // Repeatedly click start button multiple times rapidly and assert no crashes/errors and isRunning remains boolean
    await bfsPage.selectStartNode('1');

    // click start several times quickly
    for (let i = 0; i < 3; i++) {
      await bfsPage.clickStart();
      await page.waitForTimeout(60);
    }

    // Wait briefly for any errors to surface
    await page.waitForTimeout(100);

    const state = await bfsPage.getBfsStateSnapshot();
    // isRunning should be boolean (true or false) with consistent UI
    expect(typeof state.isRunning).toBe('boolean');

    // Ensure no uncaught exceptions were raised during the rapid clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Reset to stop any possible interval
    await bfsPage.clickReset();
  });

  test('Console and page error observation: no unexpected errors were emitted during normal flows', async () => {
    // As a final check, navigate through a couple of flows to make sure console/page errors are captured
    await bfsPage.selectGraph('complex');
    await bfsPage.selectStartNode('2');
    await bfsPage.setSpeed(1200);
    await bfsPage.clickStart();
    await page.waitForTimeout(150);
    // Pause
    await bfsPage.clickStart();
    await page.waitForTimeout(80);
    // Step once
    await bfsPage.clickStep();
    await page.waitForTimeout(80);
    // Reset
    await bfsPage.clickReset();
    await page.waitForTimeout(80);

    // Assert that there were no pageerror events
    expect(pageErrors.length).toBe(0);

    // Assert there were no console error messages
    expect(consoleErrors.length).toBe(0);
  });
});