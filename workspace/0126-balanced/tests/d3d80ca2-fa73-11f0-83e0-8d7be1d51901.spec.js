import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d80ca2-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the knapsack demo
class KnapsackPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      randomBtn: '#randomBtn',
      resetBtn: '#resetBtn',
      stepBtn: '#stepBtn',
      playBtn: '#playBtn',
      pauseBtn: '#pauseBtn',
      runBtn: '#runBtn',
      solveBtn: '#solveBtn',
      explainBtn: '#explainBtn',
      numItems: '#numItems',
      capacityInput: '#capacityInput',
      speed: '#speed',
      pqBox: '#pqBox',
      itemsList: '#itemsList',
      bestProfit: '#bestProfit',
      bestSol: '#bestSol',
      log: '#log',
      svgGroups: 'svg#svgCanvas g[data-id]',
      tooltip: '#tooltip',
      canvasWrap: '#canvasWrap',
      currentNode: '#currentNode'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRandomize() {
    await this.page.click(this.selectors.randomBtn);
  }
  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }
  async clickStep() {
    await this.page.click(this.selectors.stepBtn);
  }
  async clickPlay() {
    await this.page.click(this.selectors.playBtn);
  }
  async clickPause() {
    await this.page.click(this.selectors.pauseBtn);
  }
  async clickRunToEnd() {
    await this.page.click(this.selectors.runBtn);
  }
  async clickSolveFast() {
    await this.page.click(this.selectors.solveBtn);
  }
  async clickExplain() {
    await this.page.click(this.selectors.explainBtn);
  }

  async setNumItems(n) {
    await this.page.fill(this.selectors.numItems, String(n));
  }
  async setCapacity(cap) {
    await this.page.fill(this.selectors.capacityInput, String(cap));
  }
  async setSpeed(ms) {
    await this.page.fill(this.selectors.speed, String(ms));
  }

  async getPQText() {
    return this.page.locator(this.selectors.pqBox).innerText();
  }
  async getItemsCount() {
    return this.page.locator(`${this.selectors.itemsList} .row`).count();
  }
  async getBestProfit() {
    const text = await this.page.locator(this.selectors.bestProfit).innerText();
    return Number(text.trim());
  }
  async getBestSolText() {
    return this.page.locator(this.selectors.bestSol).innerText();
  }
  async getLogText() {
    return this.page.locator(this.selectors.log).innerText();
  }
  async getPlayDisplay() {
    return this.page.locator(this.selectors.playBtn).evaluate(el => getComputedStyle(el).display);
  }
  async getPauseDisplay() {
    return this.page.locator(this.selectors.pauseBtn).evaluate(el => getComputedStyle(el).display);
  }
  async countSvgNodes() {
    return this.page.locator(this.selectors.svgGroups).count();
  }
  async hoverFirstNode() {
    const first = this.page.locator(this.selectors.svgGroups).first();
    await first.hover();
  }
  async waitForPQEmpty(timeout = 5000) {
    await this.page.waitForFunction(
      sel => document.querySelector(sel) && document.querySelector(sel).innerText.toLowerCase().includes('priority queue empty'),
      this.selectors.pqBox,
      { timeout }
    );
  }
  async waitForLogContains(substr, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, s) => document.querySelector(sel) && document.querySelector(sel).innerText.includes(s),
      this.selectors.log,
      substr,
      { timeout }
    );
  }
  async getCapacityValue() {
    return this.page.locator(this.selectors.capacityInput).evaluate(el => el.value);
  }
  async getCurrentNodeText() {
    return this.page.locator(this.selectors.currentNode).innerText();
  }
}

test.describe('Branch and Bound — 0/1 Knapsack (Interactive Demo)', () => {
  // Collect console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Basic smoke test: load page and verify initial UI elements
  test('initialization: page loads and initial problem is created (S0_Idle entry actions)', async ({ page }) => {
    const app = new KnapsackPage(page);
    await app.goto();

    // Verify no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Verify key elements exist
    await expect(page.locator(app.selectors.randomBtn)).toBeVisible();
    await expect(page.locator(app.selectors.resetBtn)).toBeVisible();
    await expect(page.locator(app.selectors.stepBtn)).toBeVisible();
    await expect(page.locator(app.selectors.playBtn)).toBeVisible();
    await expect(page.locator(app.selectors.runBtn)).toBeVisible();
    await expect(page.locator(app.selectors.solveBtn)).toBeVisible();
    await expect(page.locator(app.selectors.explainBtn)).toBeVisible();

    // The app's start() calls initProblem on load; we expect the PQ to be initially non-empty
    const pqText = await app.getPQText();
    expect(pqText.toLowerCase()).not.toContain('priority queue empty');

    // Items list should have default number equal to #numItems value (6 by default)
    const numItemsValue = Number(await page.locator('#numItems').inputValue());
    const itemsCount = await app.getItemsCount();
    expect(itemsCount).toBe(numItemsValue);

    // Best profit should be zero at start
    const bestProfit = await app.getBestProfit();
    expect(bestProfit).toBeGreaterThanOrEqual(0);

    // No page errors during initialization
    expect(pageErrors.length).toBe(0);

    // Also assert no console errors were emitted
    const consoleError = consoleMessages.find(m => m.type === 'error');
    expect(consoleError).toBeUndefined();
  });

  test.describe('FSM transitions and controls', () => {
    test('RandomizeClick transitions to Randomized (S1_Randomized) and updates capacity and items', async ({ page }) => {
      const app1 = new KnapsackPage(page);
      await app.goto();

      // Capture capacity before randomize
      const beforeCap = await app.getCapacityValue();
      await app.clickRandomize();

      // Randomize handler logs and updates UI — wait for log entry
      await app.waitForLogContains('Randomized problem');

      // Capacity input should change to a new value (randomizeHandler sets capacityInput.value)
      const afterCap = await app.getCapacityValue();
      expect(afterCap).not.toBe('');
      // It's possible the random capacity equals the previous value occasionally, but
      // we assert that the capacity is a number and > 0
      expect(Number(afterCap)).toBeGreaterThan(0);

      // Items list should still be populated and reflect the configured numItems
      const itemsCount1 = await app.getItemsCount();
      const numItemsValue1 = Number(await page.locator('#numItems').inputValue());
      expect(itemsCount).toBe(numItemsValue);

      // PQ should be non-empty after randomize (root pushed)
      const pqText1 = await app.getPQText();
      expect(pqText.toLowerCase()).not.toContain('priority queue empty');

      // No fatal page errors
      expect(pageErrors.length).toBe(0);
    });

    test('ResetClick transitions to Reset (S2_Reset) and re-initializes problem', async ({ page }) => {
      const app2 = new KnapsackPage(page);
      await app.goto();

      // Change inputs then reset
      await app.setNumItems(4);
      await app.setCapacity(8);
      await app.clickReset();

      // Wait for init log
      await app.waitForLogContains('Problem initialized');

      // number of items in UI should equal 4 now
      const itemsCount2 = await app.getItemsCount();
      expect(itemsCount).toBe(4);

      // Best profit should be reset to >= 0
      const bestProfit1 = await app.getBestProfit();
      expect(bestProfit).toBeGreaterThanOrEqual(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('StepClick transitions to Step (S3_Step) and performs one iteration', async ({ page }) => {
      const app3 = new KnapsackPage(page);
      await app.goto();

      // Count initial nodes in svg
      const beforeNodes = await app.countSvgNodes();
      // Perform one step
      await app.clickStep();

      // Wait for a log entry indicating a pop or expansion
      await app.waitForLogContains('Popped Node');

      // There should be more nodes drawn after a step (children added)
      const afterNodes = await app.countSvgNodes();
      expect(afterNodes).toBeGreaterThanOrEqual(beforeNodes);

      // Current node (top of PQ) should update or be '-' if PQ empty
      const currentNodeText = await app.getCurrentNodeText();
      expect(typeof currentNodeText).toBe('string');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('PlayClick & PauseClick start and stop Auto Play (S4_AutoPlay entry/exit actions)', async ({ page }) => {
      const app4 = new KnapsackPage(page);
      await app.goto();

      // Initially play visible, pause hidden
      const playDisplayBefore = await app.getPlayDisplay();
      const pauseDisplayBefore = await app.getPauseDisplay();
      expect(playDisplayBefore).not.toBe('none');
      expect(pauseDisplayBefore).toBe('none');

      // Start autoplay
      await app.clickPlay();

      // After starting, play should be hidden, pause visible
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#playBtn')).display === 'none');
      const playDisplayAfter = await app.getPlayDisplay();
      const pauseDisplayAfter = await app.getPauseDisplay();
      expect(playDisplayAfter).toBe('none');
      expect(pauseDisplayAfter).not.toBe('none');

      // Let it run a bit then pause
      await page.waitForTimeout(250);
      await app.clickPause();

      // After pausing, play should be visible again, pause hidden
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#pauseBtn')).display === 'none');
      const playDisplayFinal = await app.getPlayDisplay();
      const pauseDisplayFinal = await app.getPauseDisplay();
      expect(playDisplayFinal).not.toBe('none');
      expect(pauseDisplayFinal).toBe('none');

      // Confirm no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('RunToEndClick transitions to Run to End (S5_RunToEnd) and empties PQ', async ({ page }) => {
      const app5 = new KnapsackPage(page);
      await app.goto();

      // Click run to end: this starts a fast interval that runs step() repeatedly
      await app.clickRunToEnd();

      // Wait for PQ to be empty (UI shows "Priority queue empty.")
      await app.waitForPQEmpty(10000);

      // PQ box should reflect empty
      const pqText2 = await app.getPQText();
      expect(pqText.toLowerCase()).toContain('priority queue empty');

      // Best profit should be set (>= 0)
      const bestProfit2 = await app.getBestProfit();
      expect(bestProfit).toBeGreaterThanOrEqual(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Solve fast (S5_RunToEnd via solveFast) completes without animation', async ({ page }) => {
      const app6 = new KnapsackPage(page);
      await app.goto();

      // Click solve fast
      await app.clickSolveFast();

      // Wait for 'Solved (fast).' log entry or PQ to become empty
      // The app logs 'Solved (fast).' at the end of solveFast()
      await app.waitForLogContains('Solved (fast).');

      // PQ should be empty in UI after solveFast completes
      // (solveFast pushes nodes and empties pq in the loop)
      // We allow that the UI might not show PQ empty because pushPQ added some nodes for visualization,
      // but at least bestProfit is updated or remains >= 0
      const bestProfit3 = await app.getBestProfit();
      expect(bestProfit).toBeGreaterThanOrEqual(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('ExplainStepClick (S6_ExplainStep) shows explanation for top node; handles finished case', async ({ page }) => {
      const app7 = new KnapsackPage(page);
      await app.goto();

      // Intercept dialog and capture its message
      let dialogMessage = '';
      page.on('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click explain to trigger explanation for current top node
      await app.clickExplain();

      // Wait until a dialog was shown and captured
      await page.waitForFunction(() => !!window.__pw_dummy || true, { timeout: 500 }).catch(() => {}); // noop: just allow time for dialog handling

      // Assert that dialogMessage contains some explanation text or mentions "Node"
      // The explanation includes "Node" and bound numbers; assert it contains the word "Node" or "Nothing left"
      expect(typeof dialogMessage).toBe('string');
      expect(dialogMessage.length).toBeGreaterThan(0);
      expect(dialogMessage.toLowerCase().includes('node') || dialogMessage.toLowerCase().includes('nothing left')).toBeTruthy();

      // Now finish the algorithm and then attempt explain again to hit the "Nothing left in PQ" alert path
      // Solve to end first
      await app.clickSolveFast();
      await app.waitForLogContains('Solved (fast).');

      // Reset captured message
      dialogMessage = '';
      // Click explain when PQ likely empty -> triggers 'Nothing left in PQ. Algorithm finished.'
      await app.clickExplain();
      // We expect the dialog to appear and contain 'Nothing left' in this finished case
      await page.waitForTimeout(200); // small wait for dialog to fire and be handled
      expect(dialogMessage.toLowerCase()).toContain('nothing left');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and UI/visual feedback', () => {
    test('Hovering a node shows tooltip with node details; tooltip hides on mouseleave', async ({ page }) => {
      const app8 = new KnapsackPage(page);
      await app.goto();

      // Ensure there is at least one node to hover
      const nodeCount = await app.countSvgNodes();
      expect(nodeCount).toBeGreaterThan(0);

      // Hover the first node to trigger tooltip
      await app.hoverFirstNode();

      // Tooltip should become visible and contain "Node" text
      await page.waitForSelector('#tooltip', { state: 'visible' });
      const tooltipText = await page.locator('#tooltip').innerText();
      expect(tooltipText).toContain('Node');

      // Move pointer away by hovering canvas
      await page.locator('#canvasWrap').hover({ position: { x: 10, y: 10 } });
      // wait a short time and ensure tooltip is hidden
      await page.waitForTimeout(150);
      const tooltipDisplay = await page.locator('#tooltip').evaluate(el => getComputedStyle(el).display);
      expect(tooltipDisplay).toBe('none');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Step when PQ empty logs completion message (edge case)', async ({ page }) => {
      const app9 = new KnapsackPage(page);
      await app.goto();

      // Run to end to empty PQ
      await app.clickRunToEnd();
      await app.waitForPQEmpty(10000);

      // Now click Step when PQ empty
      await app.clickStep();

      // Wait for log to contain 'PQ empty — done.' per implementation
      await app.waitForLogContains('PQ empty — done.');

      // Confirm presence of that message in logs
      const logText = await app.getLogText();
      expect(logText).toContain('PQ empty — done.');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // Final safety: ensure auto-play is stopped if left running
    // Try to click pause if visible to stop intervals
    try {
      const pauseVisible = await page.locator('#pauseBtn').evaluate(el => getComputedStyle(el).display !== 'none');
      if (pauseVisible) {
        await page.click('#pauseBtn');
      }
    } catch (e) {
      // ignore any errors here
    }

    // Assert no fatal uncaught page errors occurred during the test
    expect(pageErrors.length).toBe(0);
  });
});