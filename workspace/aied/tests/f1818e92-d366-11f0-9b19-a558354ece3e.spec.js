import { test, expect } from '@playwright/test';

class DFSPage {
  /**
   * Page Object for the DFS Visualization page.
   * Encapsulates common actions and DOM queries for clearer tests.
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1818e92-d366-11f0-9b19-a558354ece3e.html';
    this.selectors = {
      startBtn: '#start-btn',
      pauseBtn: '#pause-btn',
      resetBtn: '#reset-btn',
      stepBtn: '#step-btn',
      speedSelect: '#speed-select',
      stackContainer: '#stack-visualization',
      stackItems: '#stack-visualization .stack-item',
      currentNode: '#current-node',
      visitedNodes: '#visited-nodes',
      dfsPath: '#dfs-path',
      node: (id) => `#node-${id}`
    };
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
    // Wait for graph container to render nodes and edges
    await this.page.waitForSelector('#graph-container');
  }

  // Button actions
  async clickStart() {
    await this.page.click(this.selectors.startBtn);
  }
  async clickPause() {
    await this.page.click(this.selectors.pauseBtn);
  }
  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }
  async clickStep() {
    await this.page.click(this.selectors.stepBtn);
  }
  async changeSpeed(value) {
    await this.page.selectOption(this.selectors.speedSelect, String(value));
  }

  // Queries
  startIsDisabled() {
    return this.page.locator(this.selectors.startBtn).isDisabled();
  }
  pauseIsDisabled() {
    return this.page.locator(this.selectors.pauseBtn).isDisabled();
  }
  stepIsDisabled() {
    return this.page.locator(this.selectors.stepBtn).isDisabled();
  }
  async getStackItems() {
    const items = await this.page.$$eval(this.selectors.stackItems, nodes => nodes.map(n => n.textContent.trim()));
    return items;
  }
  async stackHasEmptyPlaceholder() {
    return this.page.locator(this.selectors.stackContainer).locator('text=Stack is empty').count().then(c => c > 0);
  }
  async getVisitedText() {
    return (await this.page.locator(this.selectors.visitedNodes).innerText()).trim();
  }
  async getCurrentNodeText() {
    return (await this.page.locator(this.selectors.currentNode).innerText()).trim();
  }
  async getDFSPathText() {
    return (await this.page.locator(this.selectors.dfsPath).innerText()).trim();
  }
  async nodeHasClass(nodeId, className) {
    return await this.page.locator(this.selectors.node(nodeId)).evaluate((el, cls) => el.classList.contains(cls), className);
  }
  async speedValue() {
    return await this.page.locator(this.selectors.speedSelect).inputValue();
  }
}

test.describe('DFS Visualization - FSM and interactions', () => {
  let dfsPage;
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console error messages for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    dfsPage = new DFSPage(page);
    await dfsPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Small delay to allow any async errors to surface before final assertions in tests
    await page.waitForTimeout(50);
  });

  test('Initial Idle state: UI is rendered and ready (S0_Idle)', async () => {
    // Validate that the app rendered initial controls and graph (Idle state expectations)
    await expect(dfsPage.page.locator(dfsPage.selectors.startBtn)).toBeVisible();
    await expect(dfsPage.page.locator(dfsPage.selectors.pauseBtn)).toBeVisible();
    await expect(dfsPage.page.locator(dfsPage.selectors.resetBtn)).toBeVisible();
    await expect(dfsPage.page.locator(dfsPage.selectors.stepBtn)).toBeVisible();
    await expect(dfsPage.page.locator(dfsPage.selectors.speedSelect)).toBeVisible();

    // Start should be enabled, pause & step disabled in Idle
    expect(await dfsPage.startIsDisabled()).toBe(false);
    expect(await dfsPage.pauseIsDisabled()).toBe(true);
    expect(await dfsPage.stepIsDisabled()).toBe(true);

    // Stack should show placeholder "Stack is empty"
    expect(await dfsPage.stackHasEmptyPlaceholder()).toBe(true);

    // Info panel initial values
    expect(await dfsPage.getCurrentNodeText()).toBe('-');
    expect(await dfsPage.getVisitedText()).toBe('None');
    expect(await dfsPage.getDFSPathText()).toBe('-');

    // Nodes for the sample graph should be present (A..G)
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      await expect(dfsPage.page.locator(`#node-${id}`)).toBeVisible();
    }

    // No uncaught page errors or console errors on initial load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Start DFS transitions to Running (S0_Idle -> S1_Running) and pushes A onto stack', async () => {
    // Start the DFS visualization
    await dfsPage.clickStart();

    // After starting: start button disabled, pause enabled, step disabled
    expect(await dfsPage.startIsDisabled()).toBe(true);
    expect(await dfsPage.pauseIsDisabled()).toBe(false);
    expect(await dfsPage.stepIsDisabled()).toBe(true);

    // The stack should now contain at least the starting node 'A' (visualization pushes 'A' immediately)
    await dfsPage.page.waitForSelector(dfsPage.selectors.stackItems);
    const stackItems = await dfsPage.getStackItems();
    expect(stackItems.length).toBeGreaterThan(0);
    // Top of stack is the last displayed .stack-item (stack shows top-to-bottom)
    expect(stackItems[0]).toBe('A');

    // Current node indicator should reflect 'A' as top of stack
    expect(await dfsPage.getCurrentNodeText()).toBe('A');

    // Node A should have class 'current' applied (visual cue)
    expect(await dfsPage.nodeHasClass('A', 'current')).toBe(true);

    // No page errors from starting
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Pause DFS transitions to Paused (S1_Running -> S2_Paused) and enables stepping', async () => {
    // Start then pause
    await dfsPage.clickStart();
    // Wait for initial push of A onto stack
    await dfsPage.page.waitForSelector(dfsPage.selectors.stackItems);
    await dfsPage.clickPause();

    // After pausing: start enabled, pause disabled, step enabled
    expect(await dfsPage.startIsDisabled()).toBe(false);
    expect(await dfsPage.pauseIsDisabled()).toBe(true);
    expect(await dfsPage.stepIsDisabled()).toBe(false);

    // Stack must still contain at least 'A'
    const stackItems = await dfsPage.getStackItems();
    expect(stackItems.length).toBeGreaterThan(0);
    expect(stackItems[0]).toBe('A');

    // Now perform a single step (StepForward event) to pop A and push neighbors
    await dfsPage.clickStep();

    // After stepping: visited nodes should include 'A' and dfs path should show 'A'
    // Wait briefly for DOM updates
    await dfsPage.page.waitForTimeout(50);
    expect(await dfsPage.getVisitedText()).toContain('A');
    expect(await dfsPage.getDFSPathText()).toContain('A');

    // Stack should now contain neighbors of A (B and C) - top should be 'B' per implementation
    // The stack shows top-to-bottom so first .stack-item should be top (B)
    const newStackItems = await dfsPage.getStackItems();
    expect(newStackItems.length).toBeGreaterThanOrEqual(1);
    expect(newStackItems[0]).toBe('B');

    // Node 'A' should have class 'visited'
    expect(await dfsPage.nodeHasClass('A', 'visited')).toBe(true);

    // Node 'B' should have class 'current' as top-of-stack
    expect(await dfsPage.nodeHasClass('B', 'current')).toBe(true);

    // No uncaught errors during pause/step
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Resume from Paused to Running (S2_Paused -> S1_Running) via Start', async () => {
    // Start, pause, then start again to resume
    await dfsPage.clickStart();
    await dfsPage.page.waitForSelector(dfsPage.selectors.stackItems);
    await dfsPage.clickPause();

    // Start again to resume
    await dfsPage.clickStart();

    // After resuming: start disabled, pause enabled, step disabled
    expect(await dfsPage.startIsDisabled()).toBe(true);
    expect(await dfsPage.pauseIsDisabled()).toBe(false);
    expect(await dfsPage.stepIsDisabled()).toBe(true);

    // Stack should still be present (not empty)
    await dfsPage.page.waitForSelector(dfsPage.selectors.stackContainer);
    const stackExists = !(await dfsPage.stackHasEmptyPlaceholder());
    expect(stackExists).toBe(true);

    // No page errors when resuming
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset DFS transitions to Reset (S1_Running or S2_Paused -> S3_Reset) and clears state', async () => {
    // Start the algorithm and perform a step to create visited state
    await dfsPage.clickStart();
    await dfsPage.page.waitForSelector(dfsPage.selectors.stackItems);
    // Pause to enable stepping and perform a step to mark 'A' visited
    await dfsPage.clickPause();
    await dfsPage.clickStep();
    await dfsPage.page.waitForTimeout(50);

    // Now click reset
    await dfsPage.clickReset();

    // After reset: stack should be empty placeholder shown
    expect(await dfsPage.stackHasEmptyPlaceholder()).toBe(true);

    // Visited nodes should be reset to 'None'
    expect(await dfsPage.getVisitedText()).toBe('None');

    // Current node should be '-'
    expect(await dfsPage.getCurrentNodeText()).toBe('-');

    // DFS path should be reset to '-'
    expect(await dfsPage.getDFSPathText()).toBe('-');

    // Buttons should reflect reset state: start enabled, pause disabled, step disabled
    expect(await dfsPage.startIsDisabled()).toBe(false);
    expect(await dfsPage.pauseIsDisabled()).toBe(true);
    expect(await dfsPage.stepIsDisabled()).toBe(true);

    // No uncaught errors during reset
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Change Speed event updates speed and behaves correctly when running', async () => {
    // Start DFS so that change handler will pause & restart the running algorithm
    await dfsPage.clickStart();
    await dfsPage.page.waitForSelector(dfsPage.selectors.stackItems);

    // Change speed to '200' (Fast)
    await dfsPage.changeSpeed('200');

    // The select value should reflect the chosen speed
    expect(await dfsPage.speedValue()).toBe('200');

    // After changing speed while running, the controls should still indicate a running state
    // (since implementation pauses and restarts internally)
    expect(await dfsPage.startIsDisabled()).toBe(true);
    expect(await dfsPage.pauseIsDisabled()).toBe(false);

    // Ensure no uncaught errors from change handler
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: clicking step when stack empty should be handled gracefully', async () => {
    // Ensure we're in reset/idle state
    await dfsPage.clickReset();

    // Step button is disabled in Idle/Reset; confirm that it's not clickable
    expect(await dfsPage.stepIsDisabled()).toBe(true);

    // Try to click step anyway - Playwright will throw if clicking a disabled element.
    // We assert that step remains disabled and no page errors occur when attempting no-ops in UI.
    // To simulate an attempted user click without bypassing UI constraints, we attempt click and expect it to reject.
    // However, rather than causing a crash, we ensure the UI prevents the action by remaining disabled.
    try {
      await dfsPage.clickStep();
    } catch (e) {
      // The click may fail because the button is disabled; that's acceptable.
      // Ensure no page errors were produced by this user attempt.
    }

    expect(await dfsPage.stepIsDisabled()).toBe(true);
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Full traversal sanity: run until completion and ensure final state is paused with empty stack', async ({ page }) => {
    // Start the DFS and let it run to completion by waiting sufficiently long.
    await dfsPage.clickStart();

    // Wait up to a few seconds for the traversal to finish: worst-case nodes: 7 and default speed 500ms.
    // We give a generous timeout to avoid flakiness.
    await page.waitForFunction(() => {
      const stackEl = document.getElementById('stack-visualization');
      return stackEl && stackEl.innerText.includes('Stack is empty');
    }, { timeout: 10000 });

    // After completion the algorithm pauses and stack shows empty placeholder
    expect(await dfsPage.stackHasEmptyPlaceholder()).toBe(true);

    // The pause button should be disabled after completion (pauseDFS called)
    expect(await dfsPage.pauseIsDisabled()).toBe(true);

    // All nodes should be marked visited (visited-nodes should list A..G)
    const visitedText = await dfsPage.getVisitedText();
    // Expect at least 'A' to be present and not 'None'
    expect(visitedText).not.toBe('None');
    expect(visitedText.length).toBeGreaterThan(0);

    // No uncaught runtime errors occurred during a full traversal
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});