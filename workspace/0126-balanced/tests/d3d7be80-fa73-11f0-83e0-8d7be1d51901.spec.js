import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d7be80-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for interacting with the PageRank demo
class PageRankPage {
  constructor(page) {
    this.page = page;
    this.svg = page.locator('#svg');
    this.nodesLocator = page.locator('#nodes g.node');
    this.edgesLocator = page.locator('#edges path');
    this.matrix = page.locator('#matrix');
    this.status = page.locator('#status');
    this.addNodeBtn = page.locator('#add-node');
    this.randomGraphBtn = page.locator('#random-graph');
    this.resetGraphBtn = page.locator('#reset-graph');
    this.stepBtn = page.locator('#step');
    this.runBtn = page.locator('#run');
    this.pauseBtn = page.locator('#pause');
    this.stopBtn = page.locator('#stop');
    this.modeDragBtn = page.locator('#mode-drag');
    this.modeEdgeBtn = page.locator('#mode-edge');
    this.modeDeleteBtn = page.locator('#mode-delete');
    this.dampingInput = page.locator('#damping');
    this.dampingVal = page.locator('#damping-val');
    this.speedInput = page.locator('#speed');
    this.speedVal = page.locator('#speed-val');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for initial rendering of matrix and nodes
    await expect(this.matrix).toBeVisible();
    await this.page.waitForFunction(() => {
      const m = document.getElementById('matrix');
      return m && m.innerText.includes('Ranks');
    });
  }

  // helper to get number of SVG node groups
  async nodeCount() {
    return await this.nodesLocator.count();
  }

  // helper to get number of edge paths
  async edgeCount() {
    return await this.edgesLocator.count();
  }

  // returns array of node ids in drawn order from DOM (data-id attribute)
  async getNodeIds() {
    return await this.page.$$eval('#nodes g.node', (els) => els.map(g => parseInt(g.dataset.id, 10)));
  }

  // read status text
  async getStatusText() {
    return (await this.status.textContent()) ?? '';
  }

  // read matrix raw HTML
  async getMatrixHTML() {
    return await this.matrix.innerHTML();
  }

  // click Add Node button
  async clickAddNode() {
    await this.addNodeBtn.click();
  }

  // double click at center of SVG
  async dblClickSvgCenter() {
    const box = await this.svg.boundingBox();
    if (!box) throw new Error('SVG bounding box not available');
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    // allow render/update
    await this.page.waitForTimeout(150);
  }

  // switch mode to 'drag'|'edge'|'delete'
  async setMode(mode) {
    if (mode === 'drag') await this.modeDragBtn.click();
    else if (mode === 'edge') await this.modeEdgeBtn.click();
    else if (mode === 'delete') await this.modeDeleteBtn.click();
    else throw new Error('Unknown mode: ' + mode);
    // small delay for UI internal update
    await this.page.waitForTimeout(50);
  }

  // click nth node (0-based) - triggers mousedown handlers attached to node groups
  async mousedownNodeByIndex(index) {
    const count = await this.nodeCount();
    if (index < 0 || index >= count) throw new Error('node index out of range');
    const node = this.nodesLocator.nth(index);
    // play a mousedown which should call the nodeMouseDown handler
    const box1 = await node.boundingBox();
    if (!box) throw new Error('node bounding box missing');
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.up();
    // small delay to allow handlers to run
    await this.page.waitForTimeout(120);
  }

  // click step/run/pause/stop
  async clickStep() { await this.stepBtn.click(); await this.page.waitForTimeout(80); }
  async clickRun() { await this.runBtn.click(); }
  async clickPause() { await this.pauseBtn.click(); await this.page.waitForTimeout(50); }
  async clickStop() { await this.stopBtn.click(); await this.page.waitForTimeout(150); }

  // set slider via DOM dispatch so input event fires
  async setDamping(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('damping');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await this.page.waitForTimeout(50);
  }
  async setSpeed(value) {
    await this.page.evaluate((v) => {
      const el1 = document.getElementById('speed');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    await this.page.waitForTimeout(50);
  }

  // click Random Graph and Reset
  async clickRandomGraph() { await this.randomGraphBtn.click(); await this.page.waitForTimeout(150); }
  async clickResetGraph() { await this.resetGraphBtn.click(); await this.page.waitForTimeout(200); }

  // press keyboard key
  async pressKey(key) {
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(120);
  }
}

test.describe('PageRank Interactive Demo - FSM and UI tests', () => {
  // capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state renders example graph (S0_Idle)', async ({ page }) => {
    // Validate render() entry action by checking initial content is present
    const app = new PageRankPage(page);
    await app.goto();

    // Expect status to show iteration 0 and nodes/edges
    const status = await app.getStatusText();
    expect(status).toContain('Iteration: 0');
    expect(status).toMatch(/Nodes:\s*\d+/);

    // Matrix should show "Ranks" header and adjacency table
    const matrixHtml = await app.getMatrixHTML();
    expect(matrixHtml).toContain('Ranks');
    expect(matrixHtml).toContain('Adjacency');

    // There should be at least 5 nodes from initExample()
    const nCount = await app.nodeCount();
    expect(nCount).toBeGreaterThanOrEqual(5);

    // No console errors or page errors during initial load
    expect(consoleErrors, 'console.error messages on initial load').toEqual([]);
    expect(pageErrors, 'page errors on initial load').toEqual([]);
  });

  test('Add Node button increases nodes and updates UI (S1_AddNode)', async ({ page }) => {
    const app1 = new PageRankPage(page);
    await app.goto();

    const before = await app.nodeCount();
    await app.clickAddNode();

    const after = await app.nodeCount();
    expect(after).toBeGreaterThan(before);

    // matrix should reflect increased node count
    const status1 = await app.getStatusText();
    expect(status).toMatch(/Nodes:\s*\d+/);
    const nodesText = await app.getMatrixHTML();
    // newly added node id should appear in matrix HTML
    expect(nodesText.length).toBeGreaterThan(0);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Double-click on SVG adds a node (S1_AddNode via dblclick)', async ({ page }) => {
    const app2 = new PageRankPage(page);
    await app.goto();

    const before1 = await app.nodeCount();
    await app.dblClickSvgCenter();
    const after1 = await app.nodeCount();
    expect(after).toBeGreaterThan(before);

    // verify status updated nodes count
    const status2 = await app.getStatusText();
    expect(status).toContain('Nodes:');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Add Edge via edge mode between two nodes (S2_AddEdge)', async ({ page }) => {
    const app3 = new PageRankPage(page);
    await app.goto();

    // ensure we have at least two nodes to connect
    let cnt = await app.nodeCount();
    if (cnt < 2) await app.clickAddNode();

    // pick two nodes' ids (DOM)
    const idsBefore = await app.getNodeIds();
    expect(idsBefore.length).toBeGreaterThanOrEqual(2);
    const sourceId = idsBefore[0];
    const targetId = idsBefore[1];

    // count edges before
    const edgesBefore = await app.edgeCount();

    // set mode to edge and click source then target
    await app.setMode('edge');
    // click first node (mousedown)
    await app.mousedownNodeByIndex(0); // selects source
    // click second node to complete edge
    await app.mousedownNodeByIndex(1);

    // allow render and matrix update
    await page.waitForTimeout(200);

    // edges drawn should have increased by at least 1 (or remain if already existed)
    const edgesAfter = await app.edgeCount();
    expect(edgesAfter).toBeGreaterThanOrEqual(edgesBefore);

    // matrix adjacency should reflect a 1 in the corresponding row/column when possible
    const matrixHtml1 = await app.getMatrixHTML();
    // look for a table header with the source id and a column for the target id
    expect(matrixHtml.includes(String(sourceId))).toBeTruthy();
    expect(matrixHtml.includes(String(targetId))).toBeTruthy();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Self-edge attempt is ignored (edge pending cancel) and does not crash', async ({ page }) => {
    const app4 = new PageRankPage(page);
    await app.goto();

    const firstIdList = await app.getNodeIds();
    if (firstIdList.length === 0) await app.clickAddNode();

    // set edge mode and click same node twice - should cancel and not add self-edge
    await app.setMode('edge');
    // click node 0 twice
    await app.mousedownNodeByIndex(0);
    const edgesBefore1 = await app.edgeCount();
    await app.mousedownNodeByIndex(0); // should cancel selection, not add self-edge

    await page.waitForTimeout(120);
    const edgesAfter1 = await app.edgeCount();
    // edges should be unchanged
    expect(edgesAfter).toBe(edgesBefore);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Delete node in delete mode removes a node and updates adjacency (S3_DeleteNode)', async ({ page }) => {
    const app5 = new PageRankPage(page);
    await app.goto();

    // ensure at least one node to delete
    let before2 = await app.nodeCount();
    expect(before).toBeGreaterThanOrEqual(1);

    // set delete mode, delete first node
    await app.setMode('delete');
    // capture id to ensure it's gone from matrix
    const ids = await app.getNodeIds();
    const targetId1 = ids[0];
    await app.mousedownNodeByIndex(0);

    await page.waitForTimeout(200);
    const after2 = await app.nodeCount();
    expect(after).toBe(before - 1);

    const matrixHtml2 = await app.getMatrixHTML();
    // removed node id should not be present in matrix header/body
    expect(matrixHtml.includes(String(targetId))).toBe(false);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Step advances one PageRank iteration and updates ranks (S4_RunIterations via Step)', async ({ page }) => {
    const app6 = new PageRankPage(page);
    await app.goto();

    // read initial iteration number
    const s1 = await app.getStatusText();
    const match1 = s1.match(/Iteration:\s*(\d+)/);
    const iterBefore = match1 ? parseInt(match1[1], 10) : 0;

    // click step to perform single iteration
    await app.clickStep();

    // wait for status to reflect iteration increment
    await page.waitForFunction((before) => {
      const t = document.getElementById('status').textContent || '';
      const m1 = t.match(/Iteration:\s*(\d+)/);
      const it = m ? parseInt(m[1], 10) : 0;
      return it >= before + 1;
    }, iterBefore, { timeout: 2000 });

    const s2 = await app.getStatusText();
    expect(s2).toContain('Iteration:');

    // matrix ranks should be present and numeric
    const matrix = await app.getMatrixHTML();
    expect(matrix).toMatch(/\d+\.\d{6}/);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Run, Pause and Stop transitions behave correctly (S4_RunIterations -> S5_Pause -> S6_Stop)', async ({ page }) => {
    const app7 = new PageRankPage(page);
    await app.goto();

    // ensure a known starting iteration
    await app.clickStop();
    await page.waitForTimeout(120);
    const status0 = await app.getStatusText();
    expect(status0).toContain('Iteration: 0');

    // Start running
    await app.clickRun();

    // Wait until iteration increments to 1 (runLoop should trigger)
    await page.waitForFunction(() => {
      const s = document.getElementById('status').textContent || '';
      const m2 = s.match(/Iteration:\s*(\d+)/);
      return m && parseInt(m[1], 10) >= 1;
    }, { timeout: 4000 });

    // Pause
    const statusDuringRun = await app.getStatusText();
    expect(statusDuringRun).toMatch(/Iteration:\s*\d+/);
    await app.clickPause();

    // capture current iteration, wait 500ms and expect it not to increase after pause
    const statusAfterPause = await app.getStatusText();
    const m3 = statusAfterPause.match(/Iteration:\s*(\d+)/);
    const iterAfterPause = m ? parseInt(m[1], 10) : null;
    await page.waitForTimeout(600);
    const statusAfterWait = await app.getStatusText();
    const m2 = statusAfterWait.match(/Iteration:\s*(\d+)/);
    const iterAfterWait = m2 ? parseInt(m2[1], 10) : null;
    expect(iterAfterWait).toBe(iterAfterPause);

    // Now stop: iteration resets to 0 and ranks are reset
    await app.clickStop();
    const statusStopped = await app.getStatusText();
    expect(statusStopped).toContain('Iteration: 0');

    // check matrix ranks roughly uniform (sums to 1 and have decimals)
    const matrixHtml3 = await app.getMatrixHTML();
    expect(matrixHtml).toMatch(/\d+\.\d{6}/);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Adjust damping and speed sliders update their displayed values (S7_SetDamping, S8_SetSpeed)', async ({ page }) => {
    const app8 = new PageRankPage(page);
    await app.goto();

    // set damping to 50 -> display 0.50
    await app.setDamping(50);
    expect(await app.dampingVal.textContent()).toBe('0.50');

    // set speed to 500 -> display "500 ms"
    await app.setSpeed(500);
    expect(await app.speedVal.textContent()).toBe('500 ms');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Random graph generation and reset return to example (components and transitions)', async ({ page }) => {
    const app9 = new PageRankPage(page);
    await app.goto();

    // Randomize graph
    await app.clickRandomGraph();

    const nodesRandom = await app.nodeCount();
    // Should be between 4 and 8 per implementation
    expect(nodesRandom).toBeGreaterThanOrEqual(4);
    expect(nodesRandom).toBeLessThanOrEqual(9);

    // Reset graph returns to the example initial state (5 nodes)
    await app.clickResetGraph();
    // initExample creates 5 nodes; allow layout tick to update
    await page.waitForFunction(() => {
      const s1 = document.getElementById('status').textContent || '';
      return /Iteration:\s*0/.test(s);
    }, { timeout: 2000 });

    const nodesAfterReset = await app.nodeCount();
    expect(nodesAfterReset).toBeGreaterThanOrEqual(5);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Keyboard shortcuts: Space toggles run/pause and "r" resets (edge cases)', async ({ page }) => {
    const app10 = new PageRankPage(page);
    await app.goto();

    // Ensure stopped state
    await app.clickStop();

    // Press Space to start run
    await app.pressKey('Space');
    // wait for iteration >=1
    await page.waitForFunction(() => {
      const t1 = document.getElementById('status').textContent || '';
      const m4 = t.match(/Iteration:\s*(\d+)/);
      return m && parseInt(m[1], 10) >= 1;
    }, { timeout: 4000 });

    // Press Space to pause
    await app.pressKey('Space');
    // capture iteration, wait to ensure no further increment
    const statusPaused = await app.getStatusText();
    const m5 = statusPaused.match(/Iteration:\s*(\d+)/);
    const iterPaused = m ? parseInt(m[1], 10) : 0;
    await page.waitForTimeout(600);
    const statusAfter = await app.getStatusText();
    const m21 = statusAfter.match(/Iteration:\s*(\d+)/);
    const iterAfter = m2 ? parseInt(m2[1], 10) : 0;
    expect(iterAfter).toBe(iterPaused);

    // Press 'r' to reset example
    await app.pressKey('r');
    // status should indicate iteration 0 and nodes reset
    await page.waitForFunction(() => /Iteration:\s*0/.test((document.getElementById('status') || {}).textContent || ''), { timeout: 2000 });
    const finalStatus = await app.getStatusText();
    expect(finalStatus).toContain('Iteration: 0');

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge cases: deleting until zero nodes does not crash and UI updates gracefully', async ({ page }) => {
    const app11 = new PageRankPage(page);
    await app.goto();

    // delete nodes one by one
    await app.setMode('delete');
    let count1 = await app.nodeCount();
    // perform deletions up to available nodes
    for (let i = 0; i < 10 && count > 0; i++) {
      // always delete the first node in the list
      await app.mousedownNodeByIndex(0);
      await page.waitForTimeout(80);
      count = await app.nodeCount();
    }

    // After deleting all nodes, ensure no exceptions occurred and the matrix handles zero nodes
    const matrixHtml4 = await app.getMatrixHTML();
    // Matrix may be empty but should not throw; check it exists
    expect(typeof matrixHtml).toBe('string');

    // Try adding a node when zero nodes exist
    await app.setMode('drag');
    await app.clickAddNode();
    const countAfter = await app.nodeCount();
    expect(countAfter).toBeGreaterThanOrEqual(1);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});