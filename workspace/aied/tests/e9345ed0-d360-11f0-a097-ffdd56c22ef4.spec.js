import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9345ed0-d360-11f0-a097-ffdd56c22ef4.html';

// Page object encapsulating interactions and queries
class KruskalPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      svgCanvas: '#svgCanvas',
      genBtn: '#genBtn',
      nodesCount: '#nodesCount',
      edgeProb: '#edgeProb',
      probLabel: '#probLabel',
      graphType: '#graphType',
      stepBtn: '#stepBtn',
      playBtn: '#playBtn',
      pauseBtn: '#pauseBtn',
      resetBtn: '#resetBtn',
      clearBtn: '#clearBtn',
      speed: '#speed',
      speedLabel: '#speedLabel',
      totalEdges: '#totalEdges',
      curStep: '#curStep',
      mstWeight: '#mstWeight',
      consideredCount: '#consideredCount',
      mstCount: '#mstCount',
      nodesCountDisplay: '#nodesCountDisplay',
      edgeList: '#edgeList',
      ufParents: '#ufParents',
      ufRanks: '#ufRanks',
      svgLines: '#svgCanvas line'
    };
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait for initial demo setup to finish rendering edges/nodes
    await this.page.waitForTimeout(200); // allow initial DOM manipulations to settle
  }

  async setNodesCount(n) {
    await this.page.fill(this.selectors.nodesCount, String(n));
  }

  async clickGenerate() {
    await this.page.click(this.selectors.genBtn);
    // wait for graph redraw and UI updates
    await this.page.waitForTimeout(200);
  }

  async getText(selector) {
    const locator = this.page.locator(selector);
    return (await locator.textContent())?.trim() ?? '';
  }

  async getCurStep() {
    return parseInt(await this.getText(this.selectors.curStep), 10) || 0;
  }

  async getTotalEdges() {
    return parseInt(await this.getText(this.selectors.totalEdges), 10) || 0;
  }

  async getNodesCountDisplay() {
    return parseInt(await this.getText(this.selectors.nodesCountDisplay), 10) || 0;
  }

  async clickStep() {
    await this.page.click(this.selectors.stepBtn);
    await this.page.waitForTimeout(150);
  }

  async clickPlay() {
    await this.page.click(this.selectors.playBtn);
  }

  async clickPause() {
    await this.page.click(this.selectors.pauseBtn);
    // small wait for stopPlaying to clear timers
    await this.page.waitForTimeout(150);
  }

  async clickResetColors() {
    await this.page.click(this.selectors.resetBtn);
    await this.page.waitForTimeout(150);
  }

  async clickClearAll() {
    await this.page.click(this.selectors.clearBtn);
    await this.page.waitForTimeout(150);
  }

  async setEdgeProbability(val) {
    // set range input value and dispatch input event
    await this.page.evaluate((sel, v) => {
      const el = document.querySelector(sel);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, this.selectors.edgeProb, String(val));
    await this.page.waitForTimeout(50);
  }

  async setSpeed(val) {
    await this.page.evaluate((sel, v) => {
      const el = document.querySelector(sel);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, this.selectors.speed, String(val));
    await this.page.waitForTimeout(50);
  }

  async setGraphType(val) {
    await this.page.selectOption(this.selectors.graphType, val);
    await this.page.waitForTimeout(50);
  }

  async getFirstSvgLine() {
    const line = this.page.locator(this.selectors.svgLines).first();
    const count = await this.page.locator(this.selectors.svgLines).count();
    if (count === 0) return null;
    return line;
  }

  async clickFirstSvgLine() {
    const first = await this.getFirstSvgLine();
    if (!first) throw new Error('No SVG line found to click');
    await first.click({ position: { x: 1, y: 1 } });
    await this.page.waitForTimeout(50);
  }

  async getSvgChildrenCount() {
    return await this.page.locator(this.selectors.svgCanvas + ' > *').count();
  }

  async getEdgeListCount() {
    return await this.page.locator('#edgeList .edge-item').count();
  }

  async getEdgeStrokeOfFirstLine() {
    const first = await this.getFirstSvgLine();
    if (!first) return null;
    return await first.getAttribute('stroke');
  }

  async waitForCurStepToIncrease(from, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, fromVal) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const n = parseInt(el.textContent || '0', 10) || 0;
        return n > fromVal;
      },
      this.selectors.curStep,
      from,
      { timeout }
    );
  }
}

test.describe('Kruskal Algorithm Visualizer - FSM and UI tests', () => {
  let page;
  let app;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // collect console and page errors for later assertions
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    app = new KruskalPage(page);
    await app.navigate();
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors or console errors occurred during the test
    // This ensures the application did not throw unhandled exceptions during interactions.
    expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Console.error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toHaveLength(0);

    await page.close();
  });

  test('Initial state (S0_Idle -> S1_GraphGenerated via initDemo) - initDemo runs and renders graph', async () => {
    // The page calls initDemo() on load. Verify that nodes and edges are present and UI initialized.
    const totalEdges = await app.getTotalEdges();
    const nodesCountDisplay = await app.getNodesCountDisplay();
    const svgChildren = await app.getSvgChildrenCount();

    // Expect at least one node and some svg elements (edges + nodes)
    expect(nodesCountDisplay).toBeGreaterThanOrEqual(2);
    expect(totalEdges).toBeGreaterThanOrEqual(0);
    expect(svgChildren).toBeGreaterThanOrEqual(nodesCountDisplay); // there should be visible node elements
    // curStep should be zero initially
    expect(await app.getCurStep()).toBe(0);
  });

  test('GenerateGraph event transitions to Graph Generated (S0_Idle -> S1_GraphGenerated)', async () => {
    // Set a specific nodes count and generate. Verify UI updates reflect the new graph.
    await app.setNodesCount(6);
    await app.setEdgeProbability(50);
    await app.setGraphType('random');
    await app.clickGenerate();

    const nodesDisplay = await app.getNodesCountDisplay();
    expect(nodesDisplay).toBe(6);

    // total edges should be >= 0 and edge list should match totalEdges
    const totalEdges = await app.getTotalEdges();
    const edgeListCount = await app.getEdgeListCount();
    expect(edgeListCount).toBe(totalEdges);
  });

  test('StepEdge event (S1_GraphGenerated -> S2_Stepping) increments curStep and updates counts', async () => {
    // Ensure a graph exists
    const initialTotal = await app.getTotalEdges();
    expect(initialTotal).toBeGreaterThanOrEqual(0);

    const beforeCur = await app.getCurStep();
    await app.clickStep();
    const afterCur = await app.getCurStep();

    expect(afterCur).toBeGreaterThanOrEqual(beforeCur + 1);
    // consideredCount should be at least 1
    const considered = parseInt(await app.getText('#consideredCount'), 10);
    expect(considered).toBeGreaterThanOrEqual(1);
  });

  test('PlayEdges and PauseEdges transitions (S2_Stepping -> S3_Playing -> S4_Paused -> S3_Playing)', async () => {
    // speed down to speed up play for test
    await app.setSpeed(80);
    const before = await app.getCurStep();

    // start playing and wait for at least one step to occur
    await app.clickPlay();
    await app.waitForCurStepToIncrease(before, 3000); // wait until curStep > before

    const mid = await app.getCurStep();
    expect(mid).toBeGreaterThan(before);

    // pause and ensure curStep stops increasing
    await app.clickPause();
    const pausedAt = await app.getCurStep();
    // wait a bit and assert no change
    await page.waitForTimeout(500);
    const afterWait = await app.getCurStep();
    expect(afterWait).toBe(pausedAt);

    // resume playing from paused (S4_Paused -> S3_Playing)
    await app.clickPlay();
    await app.waitForCurStepToIncrease(pausedAt, 3000);
    const resumedAt = await app.getCurStep();
    expect(resumedAt).toBeGreaterThan(pausedAt);

    // stop playing to cleanup
    await app.clickPause();
  });

  test('ResetColors transition (S1_GraphGenerated -> S5_ColorsReset) resets progress and colors', async () => {
    // Step a few times to change state
    await app.clickStep();
    await app.clickStep();
    const progressed = await app.getCurStep();
    expect(progressed).toBeGreaterThanOrEqual(2);

    // Grab stroke of first edge to ensure it was modified
    const strokeBefore = await app.getEdgeStrokeOfFirstLine();

    // Reset colors (which also calls prepareKruskal and resets unions and curIndex)
    await app.clickResetColors();

    // After reset, curStep should be reset to 0
    const curAfterReset = await app.getCurStep();
    expect(curAfterReset).toBe(0);

    // First edge stroke should be back to the default stroke color
    const strokeAfter = await app.getEdgeStrokeOfFirstLine();
    // Default stroke used in colorAllDefaults is '#cbd5e1'
    // Accept either exact match or trimmed match
    expect(strokeAfter?.trim()).toBe('#cbd5e1');
  });

  test('ClearAll transition (S1_GraphGenerated -> S6_AllCleared) empties canvas and UI', async () => {
    // Ensure graph present
    const initialNodes = await app.getNodesCountDisplay();
    expect(initialNodes).toBeGreaterThanOrEqual(2);

    // Clear all
    await app.clickClearAll();

    // SVG should be empty
    const svgChildren = await app.getSvgChildrenCount();
    expect(svgChildren).toBe(0);

    // Totals and displays should be zeroed
    expect(await app.getTotalEdges()).toBe(0);
    expect(await app.getNodesCountDisplay()).toBe(0);
    expect(await app.getText('#curStep')).toBe('0');
    expect(await app.getText('#consideredCount')).toBe('0');
    expect(await app.getText('#mstCount')).toBe('0');

    // Edge case: clicking Step when nothing exists should not throw and should keep curStep 0
    await app.clickStep();
    expect(await app.getCurStep()).toBe(0);
  });

  test('EdgeProbabilityChange updates probLabel and affects graph when generating', async () => {
    // change probability display
    await app.setEdgeProbability(30);
    const probLabel = await app.getText('#probLabel');
    expect(probLabel).toBe('30%');

    // change nodes and generate to see effect (we cannot guarantee exact counts but generation should succeed)
    await app.setNodesCount(7);
    await app.clickGenerate();
    const nodesDisplay = await app.getNodesCountDisplay();
    expect(nodesDisplay).toBe(7);
  });

  test('SpeedChange updates speedLabel and affects play timing', async () => {
    await app.setSpeed(120);
    const speedLabel = await app.getText('#speedLabel');
    expect(speedLabel).toBe('120 ms');

    // Start playing and ensure it steps (timing not strictly asserted beyond progress)
    const before = await app.getCurStep();
    await app.clickPlay();
    await app.waitForCurStepToIncrease(before, 3000);
    await app.clickPause();
  });

  test('GraphTypeChange to complete builds a complete graph (edge count n*(n-1)/2)', async () => {
    const n = 6;
    await app.setNodesCount(n);
    await app.setGraphType('complete');
    await app.clickGenerate();

    const totalEdges = await app.getTotalEdges();
    const expected = (n * (n - 1)) / 2;
    expect(totalEdges).toBe(expected);
  });

  test('ClickEdge (SVG line) flashes edge (stroke becomes accent color immediately)', async () => {
    // Ensure there is at least one edge to click
    const totalEdges = await app.getTotalEdges();
    if (totalEdges === 0) {
      // generate a denser graph
      await app.setNodesCount(6);
      await app.setEdgeProbability(90);
      await app.clickGenerate();
    }

    const firstLine = await app.getFirstSvgLine();
    expect(firstLine).not.toBeNull();

    // get CSS var for accent to compare
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());

    // click the first line and check its stroke attribute has been changed to accent color
    await app.clickFirstSvgLine();
    // immediately read stroke (flashEdge sets stroke and later restores after 700ms)
    const strokeNow = await app.getEdgeStrokeOfFirstLine();
    expect(strokeNow).toBe(accent);
  });

  test('OnEnter/OnExit actions: play sets playing and stopPlaying clears it (S3_Playing entry/exit behavior respected)', async () => {
    // We cannot access internal "playing" directly, but behavior is observable via intervals and curStep changes.
    const before = await app.getCurStep();
    await app.setSpeed(60);
    await app.clickPlay();
    await app.waitForCurStepToIncrease(before, 3000);

    // Now pause (exit action stopPlaying should be called); curStep should stop increasing afterwards
    await app.clickPause();
    const pausedAt = await app.getCurStep();
    await page.waitForTimeout(400);
    const afterWait = await app.getCurStep();
    expect(afterWait).toBe(pausedAt);
  });

  test('Edge case: clicking generate with minimum/maximum node bounds and malformed input should clamp values', async () => {
    // Input a value less than min -> should clamp to min (2)
    await app.setNodesCount(1);
    await app.clickGenerate();
    expect(await app.getNodesCountDisplay()).toBeGreaterThanOrEqual(2);

    // Input a value greater than max -> clamp to max (20)
    await app.setNodesCount(999);
    await app.clickGenerate();
    expect(await app.getNodesCountDisplay()).toBeLessThanOrEqual(20);

    // non-numeric input should fallback to default (handled by parseInt || 8)
    await page.fill('#nodesCount', 'not-a-number');
    await app.clickGenerate();
    // should not throw and nodes count display should be at least 2
    expect(await app.getNodesCountDisplay()).toBeGreaterThanOrEqual(2);
  });
});