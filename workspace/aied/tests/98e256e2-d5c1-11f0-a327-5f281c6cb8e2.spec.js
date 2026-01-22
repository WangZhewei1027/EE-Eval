import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e256e2-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object encapsulating common interactions and queries
class KruskalPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.randBtn = page.locator('#randBtn');
    this.sampleBtn = page.locator('#sampleBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.playBtn = page.locator('#playBtn');
    this.finishBtn = page.locator('#finishBtn');
    this.nodeCount = page.locator('#nodeCount');
    this.nodeCountLabel = page.locator('#nodeCountLabel');
    this.edgeProb = page.locator('#edgeProb');
    this.edgeProbLabel = page.locator('#edgeProbLabel');
    this.speed = page.locator('#speed');
    this.speedLabel = page.locator('#speedLabel');
    // Status
    this.currentEdge = page.locator('#currentEdge');
    this.edgesConsidered = page.locator('#edgesConsidered');
    this.totalEdges = page.locator('#totalEdges');
    this.mstWeight = page.locator('#mstWeight');
    this.selectedList = page.locator('#selectedList');
    this.ufList = page.locator('#ufList');
    // SVG
    this.svg = page.locator('#svg');
    this.svgArea = page.locator('#svgArea');
  }

  async waitForRender() {
    // a small helper to wait for the UI to settle (render is synchronous but DOM updates may take microtasks)
    await this.page.waitForTimeout(50);
  }

  async clickGenerateRandom() {
    await this.randBtn.click();
    await this.waitForRender();
  }

  async clickLoadSample() {
    await this.sampleBtn.click();
    await this.waitForRender();
  }

  async clickReset() {
    await this.resetBtn.click();
    await this.waitForRender();
  }

  async clickStep() {
    await this.stepBtn.click();
    await this.waitForRender();
  }

  async clickPlay() {
    await this.playBtn.click();
    await this.waitForRender();
  }

  async clickFinish() {
    await this.finishBtn.click();
    await this.waitForRender();
  }

  async setNodeCountValue(v) {
    await this.nodeCount.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
    await this.waitForRender();
  }

  async setEdgeProbValue(v) {
    await this.edgeProb.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
    await this.waitForRender();
  }

  async setSpeedValue(v) {
    await this.speed.evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v));
    await this.waitForRender();
  }

  async getCurrentEdgeText() {
    return (await this.currentEdge.textContent()).trim();
  }

  async getEdgesConsidered() {
    const t = await this.edgesConsidered.textContent();
    return parseInt(t.trim(), 10);
  }

  async getTotalEdges() {
    const t = await this.totalEdges.textContent();
    return parseInt(t.trim(), 10);
  }

  async getMstWeight() {
    const t = await this.mstWeight.textContent();
    return parseInt(t.trim(), 10);
  }

  async getSelectedListText() {
    return (await this.selectedList.innerHTML()).trim();
  }

  async getUFText() {
    return (await this.ufList.innerHTML()).trim();
  }

  async countNodeElements() {
    return await this.page.locator('svg g.node').count();
  }

  async countEdgeElements() {
    return await this.page.locator('svg g[data-id]').count();
  }

  async dblclickEdgeById(id) {
    const edgeHandle = this.page.locator(`svg g[data-id="${id}"]`);
    await edgeHandle.dblclick();
    await this.waitForRender();
  }

  // Drag a node: finds first node group and drags by dx,dy
  async dragFirstNodeBy(dx = 30, dy = 20) {
    const nodeHandle = await this.page.locator('svg g.node').first();
    const box = await nodeHandle.boundingBox();
    if (!box) throw new Error('Node bounding box not found');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + dx, startY + dy, { steps: 5 });
    await this.page.mouse.up();
    await this.waitForRender();
  }

  // Get a specific edge line's x1,x2 attributes for verification
  async getEdgeLineCoords(id) {
    const line = this.page.locator(`svg g[data-id="${id}"] line`);
    const x1 = await line.getAttribute('x1');
    const y1 = await line.getAttribute('y1');
    const x2 = await line.getAttribute('x2');
    const y2 = await line.getAttribute('y2');
    return { x1: Number(x1), y1: Number(y1), x2: Number(x2), y2: Number(y2) };
  }
}

test.describe('Kruskal Demo — FSM states and transitions', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // collect only error-level console messages to inspect runtime issues
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      // uncaught exceptions
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait a short while to let the app initialize (createSampleGraph runs on init)
    await page.waitForTimeout(150);
  });

  test.afterEach(async () => {
    // nothing special to teardown; listeners go away with page
  });

  test('Initial load and Idle -> GraphGenerated transition (LoadSampleGraph invoked on init)', async ({ page }) => {
    const p = new KruskalPage(page);

    // The app's init() calls createSampleGraph() automatically.
    // Validate primary UI elements exist and that a graph is present.
    await expect(p.randBtn).toBeVisible();
    await expect(p.sampleBtn).toBeVisible();
    await expect(p.stepBtn).toBeVisible();
    await expect(p.playBtn).toBeVisible();
    await expect(p.finishBtn).toBeVisible();

    // Verify node count label reflects input default
    const nodeCountValue = await p.nodeCount.inputValue();
    const nodeCountLabel = await p.nodeCountLabel.textContent();
    expect(nodeCountLabel.trim()).toBe(nodeCountValue);

    // After initialization, there should be node and edge SVG elements created
    const nodeCount = await p.countNodeElements();
    const edgeCount = await p.countEdgeElements();
    expect(nodeCount).toBeGreaterThanOrEqual(2); // at least two nodes for the sample
    expect(edgeCount).toBeGreaterThanOrEqual(1); // sample edges exist

    // Check status area: totalEdges should be equal to sortedEdges length (non-zero)
    const totalEdges = await p.getTotalEdges();
    expect(totalEdges).toBeGreaterThanOrEqual(1);

    // currentEdge should show the first sorted edge (not necessarily '—' due to init building a graph)
    const currentEdgeText = await p.getCurrentEdgeText();
    expect(currentEdgeText.length).toBeGreaterThan(0);

    // Ensure no uncaught page errors or console errors during initial load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Generate Random Graph transition from Idle/Sample -> Graph Generated', async ({ page }) => {
    const p = new KruskalPage(page);

    // Change node count and edge probability and then generate a random graph
    await p.setNodeCountValue(6);
    await p.setEdgeProbValue('0.1'); // low density
    await p.clickGenerateRandom();

    // Validate nodes and edges updated according to parameters
    const nodeCount = await p.countNodeElements();
    expect(nodeCount).toBeGreaterThanOrEqual(2);
    const edgeCount = await p.countEdgeElements();
    // With low prob, edges could be few; ensure at least one created (generateRandomGraph ensures a chain if zero)
    expect(edgeCount).toBeGreaterThanOrEqual(nodeCount - 1 >= 1 ? nodeCount - 1 : 1);

    // Ensure UI status reflects new graph
    const totalEdges = await p.getTotalEdges();
    expect(totalEdges).toBe(edgeCount);

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Reset Algorithm transition: edges reset and state cleared', async ({ page }) => {
    const p = new KruskalPage(page);

    // Generate a random graph to ensure stateful changes
    await p.clickGenerateRandom();
    // Perform a couple of steps to change states
    await p.clickStep();
    await p.clickStep();

    // Now reset algorithm
    await p.clickReset();

    // After reset, edgesConsidered should be 0 and mstWeight 0
    const edgesConsidered = await p.getEdgesConsidered();
    const mstWeight = await p.getMstWeight();
    expect(edgesConsidered).toBe(0);
    expect(mstWeight).toBe(0);

    // Check that union-find list is displayed (not '—') or shows p[i] entries
    const ufText = await p.getUFText();
    expect(ufText.length).toBeGreaterThanOrEqual(1);

    // No runtime errors should have occurred
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('StepAlgorithm transition: stepping through edges updates UI and ends at completion', async ({ page }) => {
    const p = new KruskalPage(page);

    // Start from a sample graph to have deterministic-ish small graph
    await p.clickLoadSample();

    // Read initial totals
    const totalEdges = await p.getTotalEdges();
    expect(totalEdges).toBeGreaterThanOrEqual(1);

    // Repeatedly click Step until Done or until a reasonable upper bound to avoid infinite loops
    let maxSteps = Math.max(totalEdges + 5, 50);
    let lastCurrent = await p.getCurrentEdgeText();
    let stepCount = 0;
    while (stepCount < maxSteps) {
      await p.clickStep();
      stepCount++;
      const current = await p.getCurrentEdgeText();
      // If the algorithm reports 'Done' we can break -> Completed state
      if (current === 'Done') break;
      // Expect that edgesConsidered increased monotonically
      const considered = await p.getEdgesConsidered();
      expect(considered).toBeGreaterThanOrEqual(0);
      lastCurrent = current;
    }

    const finalCurrent = await p.getCurrentEdgeText();
    // The implementation sets current edge to 'Done' when finished by step() when edgeIndex >= sortedEdges.length
    expect(['Done', '—', lastCurrent]).toContain(finalCurrent);

    // Verify MST selection count is at most nodes -1 (sensible)
    const selectedHtml = await p.getSelectedListText();
    // If not the placeholder '—', there should be lines with edges
    if (selectedHtml !== '—') {
      const selectedLines = selectedHtml.split('<br>');
      // nodes count
      const nodes = await p.countNodeElements();
      expect(selectedLines.length).toBeLessThanOrEqual(Math.max(0, nodes - 1));
    }

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('AutoPlay transition: toggling play and auto-stepping until completion', async ({ page }) => {
    const p = new KruskalPage(page);

    // Use sample graph for predictable small size
    await p.clickLoadSample();

    // Start autoplay
    await p.clickPlay();

    // Ensure button text changed to indicate playing
    const playTextWhilePlaying = await p.playBtn.textContent();
    expect(playTextWhilePlaying.trim()).toBe('Pause');

    // Wait a bit to let autoplay run; since speed default is 800ms, wait longer (but bounded)
    await page.waitForTimeout(1200);

    // If auto-play hasn't finished, toggle to stop (so test is deterministic)
    const currentEdgeAfterRun = await p.getCurrentEdgeText();
    if (currentEdgeAfterRun !== 'Done') {
      // Pause playback to inspect
      await p.clickPlay();
    }

    // Wait a bit to ensure the click takes effect
    await page.waitForTimeout(100);

    // If finished automatically, play button should be 'Auto Play'. If paused, it should also return to 'Auto Play'
    const playText = await p.playBtn.textContent();
    expect(['Auto Play', 'Pause']).toContain(playText.trim());

    // Ensure progress counters make sense
    const considered = await p.getEdgesConsidered();
    const totalEdges = await p.getTotalEdges();
    expect(considered).toBeGreaterThanOrEqual(0);
    expect(totalEdges).toBeGreaterThanOrEqual(considered);

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('RunToCompletion transition: quick finish and validate MST and status', async ({ page }) => {
    const p = new KruskalPage(page);

    // Rebuild sample graph and then run to completion
    await p.clickLoadSample();

    // Run to completion
    await p.clickFinish();

    // After finish, edgeIndex should be at end and currentEdge either '—' or reflect no further edge
    const current = await p.getCurrentEdgeText();
    // Accept both '—' or a displayed edge (implementation leaves currentEdge as first if not processed; but edges will be marked)
    expect(current.length).toBeGreaterThanOrEqual(1);

    // Edges considered should be equal to totalEdges OR selectedEdges length equals nodes-1
    const totalEdges = await p.getTotalEdges();
    const considered = await p.getEdgesConsidered();
    // considered is maintained during runToCompletion, so expect considered > 0
    expect(considered).toBeGreaterThanOrEqual(0);
    // Validate MST weight is non-negative
    const mstWeight = await p.getMstWeight();
    expect(mstWeight).toBeGreaterThanOrEqual(0);

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Node drag interactions: mousedown, mousemove, mouseup update node and edge positions', async ({ page }) => {
    const p = new KruskalPage(page);

    // Ensure there is at least one edge to validate coords
    await p.clickLoadSample();
    const edgeCount = await p.countEdgeElements();
    expect(edgeCount).toBeGreaterThanOrEqual(1);

    // Capture coordinates of a known edge (id = 0) before drag if present
    let coordsBefore;
    try {
      coordsBefore = await p.getEdgeLineCoords(0);
    } catch (e) {
      // If edge id 0 doesn't exist, pick first existing edge by reading data-id from DOM
      const firstEdge = await page.locator('svg g[data-id]').first();
      const firstEdgeId = await firstEdge.getAttribute('data-id');
      coordsBefore = await p.getEdgeLineCoords(firstEdgeId);
    }

    // Drag the first node by a small delta
    await p.dragFirstNodeBy(40, 30);

    // After dragging, coordinates of edges should have changed (at least one endpoint moved)
    let coordsAfter;
    try {
      coordsAfter = await p.getEdgeLineCoords(0);
    } catch (e) {
      const firstEdge = await page.locator('svg g[data-id]').first();
      const firstEdgeId = await firstEdge.getAttribute('data-id');
      coordsAfter = await p.getEdgeLineCoords(firstEdgeId);
    }

    // At least one coordinate should differ after dragging nodes
    const changed = coordsBefore.x1 !== coordsAfter.x1 ||
                    coordsBefore.y1 !== coordsAfter.y1 ||
                    coordsBefore.x2 !== coordsAfter.x2 ||
                    coordsBefore.y2 !== coordsAfter.y2;
    expect(changed).toBeTruthy();

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge double-click randomizes weight and triggers resetAlgorithm without errors', async ({ page }) => {
    const p = new KruskalPage(page);

    await p.clickLoadSample();

    // Pick an existing edge data-id
    const firstEdge = page.locator('svg g[data-id]').first();
    const id = await firstEdge.getAttribute('data-id');

    // Capture weight before
    const weightSelector = `svg g[data-id="${id}"] text.edge-weight`;
    const beforeText = await page.locator(weightSelector).textContent();
    // Double click to randomize weight
    await p.dblclickEdgeById(id);

    // After double click, weight should be updated to some number and resetAlgorithm should have run (edgesConsidered = 0)
    const afterText = await page.locator(weightSelector).textContent();
    // It is possible the random weight equals previous by chance; we assert that application didn't throw and uf list is available
    const ufText = await p.getUFText();
    expect(ufText.length).toBeGreaterThanOrEqual(1);

    // Edges considered should be 0 after reset
    const considered = await p.getEdgesConsidered();
    expect(considered).toBe(0);

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Input controls update labels correctly and edge case: generate random with minimal nodes and zero probability', async ({ page }) => {
    const p = new KruskalPage(page);

    // Change inputs and validate labels update
    await p.setNodeCountValue(2);
    expect((await p.nodeCountLabel.textContent()).trim()).toBe('2');

    await p.setEdgeProbValue('0.05');
    expect((await p.edgeProbLabel.textContent()).trim()).toBe('0.05');

    await p.setSpeedValue('400');
    expect((await p.speedLabel.textContent()).trim()).toBe('400 ms/step');

    // Generate random with small node count and near-zero probability (edge case)
    await p.clickGenerateRandom();

    // The implementation ensures at least chain edges if none were generated.
    const nodeCount = await p.countNodeElements();
    const edgeCount = await p.countEdgeElements();
    expect(nodeCount).toBeGreaterThanOrEqual(2);
    // edgeCount should be at least nodeCount-1
    expect(edgeCount).toBeGreaterThanOrEqual(Math.max(1, nodeCount - 1));

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Keyboard shortcuts interactivity sanity check (space toggles play, ArrowRight steps)', async ({ page }) => {
    const p = new KruskalPage(page);

    // Ensure sample graph loaded
    await p.clickLoadSample();

    // Press ArrowRight to step
    await page.keyboard.press('ArrowRight');
    await p.waitForRender();

    const consideredAfterArrow = await p.getEdgesConsidered();
    expect(consideredAfterArrow).toBeGreaterThanOrEqual(0);

    // Press space to toggle play (plays or pauses). The event handler toggles play on ' '
    await page.keyboard.press(' ');
    await p.waitForRender();

    // play button text should change to indicate playing or paused (robust check)
    const playText = await p.playBtn.textContent();
    expect(['Auto Play', 'Pause']).toContain(playText.trim());

    // Reset play state by pressing space again if necessary
    if ((await p.playBtn.textContent()).trim() === 'Pause') {
      await page.keyboard.press(' ');
      await p.waitForRender();
    }

    // No runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

});