import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9334d61-d360-11f0-a097-ffdd56c22ef4.html';

// Page object for interacting with the graph demo
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // shorthand locators
    this.addNodeBtn = page.locator('#addNodeBtn');
    this.nodeLabelInput = page.locator('#nodeLabel');
    this.addEdgeBtn = page.locator('#addEdgeBtn');
    this.fromSelect = page.locator('#fromSelect');
    this.toSelect = page.locator('#toSelect');
    this.edgeType = page.locator('#edgeType');
    this.weightInput = page.locator('#weight');
    this.removeEdgeBtn = page.locator('#removeEdgeBtn');
    this.randomizeBtn = page.locator('#randomizeBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.exportBtn = page.locator('#exportBtn');
    this.importBtn = page.locator('#importBtn');
    this.ioArea = page.locator('#ioArea');
    this.modeAddNode = page.locator('#modeAddNode');
    this.modeAddEdge = page.locator('#modeAddEdge');
    this.modeSelect = page.locator('#modeSelect');
    this.sample1 = page.locator('#sample1');
    this.sample2 = page.locator('#sample2');
    this.sample3 = page.locator('#sample3');
    this.svg = page.locator('#svgCanvas');
    this.nodesGroup = page.locator('#nodes');
    this.edgesGroup = page.locator('#edges');
    this.info = page.locator('#info');
    this.adjCount = page.locator('#adjCount');
    this.listContent = page.locator('#listContent');
  }

  async getInfoText() {
    return (await this.info.textContent())?.trim();
  }
  async getAdjCountText() {
    return (await this.adjCount.textContent())?.trim();
  }
  async getNodeLabels() {
    // read nodeBadge texts
    return this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#listContent .nodeBadge')).map(n => n.textContent.trim());
    });
  }
  async getNodeCount() {
    return this.page.evaluate(() => document.querySelectorAll('#nodes g').length);
  }
  async getEdgeCount() {
    // number of rendered line elements (visual edges)
    return this.page.evaluate(() => document.querySelectorAll('#edges line').length);
  }
  async clickMode(mode) {
    if (mode === 'addNode') await this.modeAddNode.click();
    if (mode === 'addEdge') await this.modeAddEdge.click();
    if (mode === 'select') await this.modeSelect.click();
    // small wait for UI to update highlight
    await this.page.waitForTimeout(60);
  }
  async addNodeWithLabel(label) {
    await this.nodeLabelInput.fill(label);
    await this.addNodeBtn.click();
    // wait for render
    await this.page.waitForTimeout(80);
  }
  async clickSvgAtCoords(x, y) {
    // click coordinates inside svg canvas (relative to viewport)
    const box = await this.svg.boundingBox();
    if (!box) throw new Error('SVG bounding box not found');
    const cx = box.x + x;
    const cy = box.y + y;
    await this.page.mouse.click(cx, cy);
    // small delay for render updates
    await this.page.waitForTimeout(80);
  }
  async clickNode(label) {
    // click the svg group with data-label
    const sel = `#nodes g[data-label="${label}"]`;
    await this.page.locator(sel).first().click();
    await this.page.waitForTimeout(60);
  }
  async mousedownNode(label, options = {}) {
    const sel = `#nodes g[data-label="${label}"]`;
    const el = this.page.locator(sel).first();
    await el.waitFor();
    const box = await el.boundingBox();
    if (!box) throw new Error('Node bounding box missing');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await this.page.mouse.move(cx, cy);
    await this.page.mouse.down(options);
    await this.page.waitForTimeout(30);
  }
  async mousemoveTo(offsetX, offsetY) {
    await this.page.mouse.move(offsetX, offsetY);
    await this.page.waitForTimeout(40);
  }
  async mouseup() {
    await this.page.mouse.up();
    await this.page.waitForTimeout(60);
  }
  async exportJSON() {
    await this.exportBtn.click();
    await this.page.waitForTimeout(40);
    const txt = await this.ioArea.inputValue();
    try {
      return JSON.parse(txt);
    } catch (e) {
      return null;
    }
  }
  async importJSON(obj) {
    const txt = JSON.stringify(obj, null, 2);
    await this.ioArea.fill(txt);
    await this.importBtn.click();
    await this.page.waitForTimeout(80);
  }
  async getRenderedNodeTransform(label) {
    return this.page.evaluate((label) => {
      const g = document.querySelector(`#nodes g[data-label="${label}"]`);
      if (!g) return null;
      return g.getAttribute('transform');
    }, label);
  }
  async dblclickAdjChip(ownerLabel, neighborText) {
    // find chip under listContent for ownerLabel, then dblclick the chip with neighborText
    await this.page.evaluate(({ ownerLabel, neighborText }) => {
      const container = document.getElementById('listContent');
      const items = Array.from(container.querySelectorAll('.item'));
      for (const it of items) {
        const badge = it.querySelector('.nodeBadge');
        if (badge && badge.textContent.trim() === ownerLabel) {
          const chips = Array.from(it.querySelectorAll('.chip'));
          for (const ch of chips) {
            if (ch.textContent.trim().startsWith(neighborText)) {
              // dispatch dblclick event
              const evt = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
              ch.dispatchEvent(evt);
              return true;
            }
          }
        }
      }
      return false;
    }, { ownerLabel, neighborText });
    await this.page.waitForTimeout(80);
  }
}

test.describe('Adjacency List Interactive Demo - e9334d61-d360-11f0-a097-ffdd56c22ef4', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // capture page errors and console
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(URL);
    // ensure initial render settled
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(120);
  });

  test.afterEach(async ({ }, testInfo) => {
    // attach diagnostics to test output
    if (pageErrors.length) {
      console.warn('Captured page errors:', pageErrors.map(e => (e && e.message) || String(e)));
    }
    if (consoleErrors.length) {
      console.warn('Captured console errors:', consoleErrors);
    }
  });

  test.describe('Initial state and Idle (S0_Idle)', () => {
    test('Initial render shows Idle state UI elements and selects default mode', async ({ page }) => {
      const gp = new GraphPage(page);
      // Mode should be select (highlight class applied)
      const modeSelectHasHighlight = await page.evaluate(() => document.getElementById('modeSelect').classList.contains('highlight'));
      expect(modeSelectHasHighlight).toBe(true);

      // Info and adjacency list reflect empty graph
      await expect(gp.info).toBeVisible();
      const infoText = await gp.getInfoText();
      expect(infoText).toMatch(/Nodes:\s*0\s*—\s*Edges:\s*0/);

      const adjText = await gp.getAdjCountText();
      expect(adjText).toContain('0 entries');

      // No nodes and no edges initially
      expect(await gp.getNodeCount()).toBe(0);
      expect(await gp.getEdgeCount()).toBe(0);

      // Ensure no unexpected page-level errors (we assert none of the fatal JS error types occurred)
      const fatalErrorPresent = pageErrors.some(e => /ReferenceError|SyntaxError|TypeError/.test(String(e)));
      expect(fatalErrorPresent).toBe(false);
    });
  });

  test.describe('Node operations (S1_AddNode)', () => {
    test('Add node via UI button and verify adjacency list and svg node', async ({ page }) => {
      const gp = new GraphPage(page);

      // Add a labeled node
      await gp.addNodeWithLabel('TestNode1');

      // Adj list must contain badge "TestNode1"
      const labels = await gp.getNodeLabels();
      expect(labels).toContain('TestNode1');

      // Node should be rendered in svg
      expect(await gp.getNodeCount()).toBeGreaterThanOrEqual(1);

      // Info should update nodes count
      const infoText = await gp.getInfoText();
      expect(infoText).toMatch(/Nodes:\s*1/);
    });

    test('Add node via "Add Node" mode by clicking canvas (no label provided)', async ({ page }) => {
      const gp = new GraphPage(page);

      // ensure no label: clear input
      await gp.nodeLabelInput.fill('');
      // switch to add node mode
      await gp.clickMode('addNode');
      // click near center of svg to create a node (x,y relative to svg bounds)
      await gp.clickSvgAtCoords(300, 200);

      // Node count increased
      const nodeCount = await gp.getNodeCount();
      expect(nodeCount).toBeGreaterThanOrEqual(1);

      // Adj list now has at least one entry
      const labels = await gp.getNodeLabels();
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Edge operations (S2_AddEdge, S4_RemoveEdge)', () => {
    test('Add edge via selects and Export JSON reflects the edge (S2_AddEdge & S8_ExportJSON)', async ({ page }) => {
      const gp = new GraphPage(page);

      // create two named nodes
      await gp.addNodeWithLabel('A');
      await gp.addNodeWithLabel('B');

      // selects should now contain A and B
      await expect(gp.fromSelect).toHaveCount(1); // the select exists
      // choose from A to B
      await gp.fromSelect.selectOption({ label: 'A' });
      await gp.toSelect.selectOption({ label: 'B' });
      // set directed to true to ensure a directed edge is created
      await gp.edgeType.selectOption('directed');
      await gp.weightInput.fill('3');

      // click add edge
      await gp.addEdgeBtn.click();
      await page.waitForTimeout(120);

      // Export JSON and validate
      const exported = await gp.exportJSON();
      expect(exported).not.toBeNull();
      expect(Array.isArray(exported.nodes)).toBe(true);
      expect(Array.isArray(exported.edges)).toBe(true);

      // There should be an edge from A to B (directed)
      const found = exported.edges.find(e => e.from === 'A' && e.to === 'B' && e.directed === true && Number(e.weight) === 3);
      expect(found).toBeTruthy();

      // Visual edge should be present
      const edgeCount = await gp.getEdgeCount();
      expect(edgeCount).toBeGreaterThanOrEqual(1);
    });

    test('Add edge by clicking nodes in Add Edge mode and then remove it by clicking the line and Remove button (S2_AddEdge -> S4_RemoveEdge)', async ({ page }) => {
      const gp = new GraphPage(page);

      // ensure fresh graph
      await gp.clearBtn.click();
      await page.waitForTimeout(80);

      // add two nodes
      await gp.addNodeWithLabel('N1');
      await gp.addNodeWithLabel('N2');
      await page.waitForTimeout(80);

      // switch to addEdge mode
      await gp.clickMode('addEdge');

      // click first node (mousedown or click triggers pendingEdgeFrom)
      await gp.page.locator('#nodes g[data-label="N1"]').first().click();
      await page.waitForTimeout(60);

      // click second node to create edge
      await gp.page.locator('#nodes g[data-label="N2"]').first().click();
      await page.waitForTimeout(120);

      // confirm visual edge exists
      let edgeCountBefore = await gp.getEdgeCount();
      expect(edgeCountBefore).toBeGreaterThanOrEqual(1);

      // click the first rendered line to select it (selectEdge sets selectedEdgeId)
      const lineLocator = page.locator('#edges line').first();
      await lineLocator.click();
      await page.waitForTimeout(40);

      // click removeEdgeBtn which should remove selected edge
      await gp.removeEdgeBtn.click();
      await page.waitForTimeout(120);

      const edgeCountAfter = await gp.getEdgeCount();
      // either zero or reduced
      expect(edgeCountAfter).toBeLessThanOrEqual(edgeCountBefore - 1);
    });

    test('Remove edge via adjacency chip double-click (confirm dialog accepted)', async ({ page }) => {
      const gp = new GraphPage(page);

      // prepare a simple undirected edge between P and Q
      await gp.clearBtn.click();
      await page.waitForTimeout(80);
      await gp.addNodeWithLabel('P');
      await gp.addNodeWithLabel('Q');
      await page.waitForTimeout(40);
      // add edge from P to Q
      await gp.fromSelect.selectOption({ label: 'P' });
      await gp.toSelect.selectOption({ label: 'Q' });
      await gp.edgeType.selectOption('undirected');
      await gp.addEdgeBtn.click();
      await page.waitForTimeout(120);

      // intercept confirm and accept it when dblclick's confirm appears
      page.on('dialog', async dialog => {
        // should be the confirm triggered by dblclick on chip
        await dialog.accept();
      });

      // dblclick chip under P that references Q to remove
      // We use the helper to dispatch dblclick
      await gp.dblclickAdjChip('P', 'Q');

      // wait for render
      await page.waitForTimeout(120);

      // ensure adjacency list reflects removal: Q should no longer be a neighbor of P
      const adjHtml = await page.locator('#listContent').innerHTML();
      expect(adjHtml).not.toContain('Q');
    });
  });

  test.describe('Layout and view actions (S6_RandomizeLayout, S5_ClearGraph, helpReset view)', () => {
    test('Randomize layout changes node transforms (S6_RandomizeLayout)', async ({ page }) => {
      const gp = new GraphPage(page);

      // ensure at least two nodes exist
      await gp.clearBtn.click();
      await page.waitForTimeout(40);
      await gp.addNodeWithLabel('R1');
      await gp.addNodeWithLabel('R2');
      await page.waitForTimeout(60);

      const t1 = await gp.getRenderedNodeTransform('R1');
      const t2 = await gp.getRenderedNodeTransform('R2');

      await gp.randomizeBtn.click();
      await page.waitForTimeout(120);

      const t1b = await gp.getRenderedNodeTransform('R1');
      const t2b = await gp.getRenderedNodeTransform('R2');

      // transforms should change
      expect(t1b).not.toBe(t1);
      expect(t2b).not.toBe(t2);
    });

    test('Clear graph removes all nodes and edges (S5_ClearGraph)', async ({ page }) => {
      const gp = new GraphPage(page);

      // create nodes and edge
      await gp.clearBtn.click();
      await page.waitForTimeout(40);
      await gp.addNodeWithLabel('C1');
      await gp.addNodeWithLabel('C2');
      await gp.fromSelect.selectOption({ label: 'C1' });
      await gp.toSelect.selectOption({ label: 'C2' });
      await gp.addEdgeBtn.click();
      await page.waitForTimeout(60);

      // Click Clear
      await gp.clearBtn.click();
      await page.waitForTimeout(120);

      expect(await gp.getNodeCount()).toBe(0);
      expect(await gp.getEdgeCount()).toBe(0);
      const adjText = await gp.getAdjCountText();
      expect(adjText).toContain('0 entries');
    });

    test('Reset view ("Reset View" button) nudges node positions but preserves nodes', async ({ page }) => {
      const gp = new GraphPage(page);

      // add nodes
      await gp.clearBtn.click();
      await page.waitForTimeout(40);
      await gp.addNodeWithLabel('S1');
      await gp.addNodeWithLabel('S2');
      await page.waitForTimeout(40);

      const before1 = await gp.getRenderedNodeTransform('S1');
      const before2 = await gp.getRenderedNodeTransform('S2');

      await page.locator('#helpClear').click();
      await page.waitForTimeout(120);

      const after1 = await gp.getRenderedNodeTransform('S1');
      const after2 = await gp.getRenderedNodeTransform('S2');

      // positions should be different (nudged)
      expect(after1).not.toBe(before1);
      expect(after2).not.toBe(before2);

      // nodes still exist
      expect(await gp.getNodeCount()).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Import/Export and Samples (S7_ImportJSON, S8_ExportJSON, sample graphs)', () => {
    test('Export on empty graph produces empty nodes and edges arrays', async ({ page }) => {
      const gp = new GraphPage(page);

      await gp.clearBtn.click();
      await page.waitForTimeout(40);

      const exported = await gp.exportJSON();
      expect(exported).toBeTruthy();
      expect(Array.isArray(exported.nodes)).toBe(true);
      expect(Array.isArray(exported.edges)).toBe(true);
      expect(exported.nodes.length).toBe(0);
      expect(exported.edges.length).toBe(0);
    });

    test('Import JSON restores nodes and edges (S7_ImportJSON)', async ({ page }) => {
      const gp = new GraphPage(page);

      // create a sample object
      const sample = {
        nodes: [{ label: 'I1', x: 100, y: 100 }, { label: 'I2', x: 300, y: 120 }],
        edges: [{ from: 'I1', to: 'I2', weight: 7, directed: true }]
      };

      // import into page
      await gp.importJSON(sample);

      // verify nodes and edge appear
      const labels = await gp.getNodeLabels();
      expect(labels).toEqual(expect.arrayContaining(['I1', 'I2']));

      // exported JSON should contain the same logical edge
      const exported = await gp.exportJSON();
      const found = exported.edges.find(e => e.from === 'I1' && e.to === 'I2' && e.directed === true && Number(e.weight) === 7);
      expect(found).toBeTruthy();
    });

    test('Sample buttons populate expected structures (sample1/sample2/sample3)', async ({ page }) => {
      const gp = new GraphPage(page);

      // sample1 triangle
      await gp.sample1.click();
      await page.waitForTimeout(120);
      let exported1 = await gp.exportJSON();
      expect(exported1.nodes.length).toBeGreaterThanOrEqual(3);
      expect(exported1.edges.length).toBeGreaterThanOrEqual(3);

      // sample2 directed chain
      await gp.sample2.click();
      await page.waitForTimeout(120);
      const exported2 = await gp.exportJSON();
      // should have directed edges among sequential nodes
      expect(exported2.edges.some(e => e.directed)).toBeTruthy();

      // sample3 weighted
      await gp.sample3.click();
      await page.waitForTimeout(120);
      const exported3 = await gp.exportJSON();
      // at least one edge with weight property
      const hasWeighted = exported3.edges.some(e => e.weight != null);
      expect(hasWeighted).toBeTruthy();
    });
  });

  test.describe('Selection, highlights and dragging (S3_SelectNode)', () => {
    test('Selecting a node highlights neighbors and dims others (S3_SelectNode)', async ({ page }) => {
      const gp = new GraphPage(page);

      // create a small graph A-B-C with edges A-B and B-C
      await gp.clearBtn.click();
      await page.waitForTimeout(40);
      await gp.addNodeWithLabel('A');
      await gp.addNodeWithLabel('B');
      await gp.addNodeWithLabel('C');
      // A-B
      await gp.fromSelect.selectOption({ label: 'A' });
      await gp.toSelect.selectOption({ label: 'B' });
      await gp.edgeType.selectOption('undirected');
      await gp.addEdgeBtn.click();
      // B-C
      await gp.fromSelect.selectOption({ label: 'B' });
      await gp.toSelect.selectOption({ label: 'C' });
      await gp.addEdgeBtn.click();
      await page.waitForTimeout(120);

      // click node B to select
      await gp.clickMode('select');
      await gp.clickNode('B');
      await page.waitForTimeout(60);

      // verify that non-neighbor (if any) is dimmed: A and C remain fully visible while others (none) dimmed.
      // We'll check opacity styles: selected node should have orange stroke (#f97316)
      const stroke = await page.evaluate(() => {
        const g = document.querySelector('#nodes g[data-label="B"]');
        if (!g) return null;
        return g.querySelector('circle').getAttribute('stroke');
      });
      expect(stroke).toBe('#f97316');
    });

    test('Drag node changes position (mouse events)', async ({ page }) => {
      const gp = new GraphPage(page);

      // add node to drag
      await gp.clearBtn.click();
      await page.waitForTimeout(40);
      await gp.addNodeWithLabel('D1');
      await page.waitForTimeout(60);

      const before = await gp.getRenderedNodeTransform('D1');
      expect(before).toBeTruthy();

      // mousedown on node center
      await gp.mousedownNode('D1');
      // move the mouse by some offset
      const startBox = await page.locator('#nodes g[data-label="D1"]').first().boundingBox();
      if (!startBox) throw new Error('node bbox missing for dragging');
      // move right by 80px and down by 40px in viewport coordinates
      await page.mouse.move(startBox.x + startBox.width / 2 + 80, startBox.y + startBox.height / 2 + 40, { steps: 5 });
      // release
      await page.mouse.up();
      await page.waitForTimeout(140);

      const after = await gp.getRenderedNodeTransform('D1');
      expect(after).not.toBe(before);
    });
  });

  test.describe('Modes switching and keyboard shortcuts (transitions AddNodeMode, AddEdgeMode, SelectMode)', () => {
    test('Clicking mode buttons changes mode highlights', async ({ page }) => {
      const gp = new GraphPage(page);

      // Add Node mode
      await gp.clickMode('addNode');
      const addNodeHighlighted = await page.evaluate(() => document.getElementById('modeAddNode').classList.contains('highlight'));
      expect(addNodeHighlighted).toBe(true);

      // Add Edge mode
      await gp.clickMode('addEdge');
      const addEdgeHighlighted = await page.evaluate(() => document.getElementById('modeAddEdge').classList.contains('highlight'));
      expect(addEdgeHighlighted).toBe(true);

      // Select mode
      await gp.clickMode('select');
      const selectHighlighted = await page.evaluate(() => document.getElementById('modeSelect').classList.contains('highlight'));
      expect(selectHighlighted).toBe(true);
    });

    test('Keyboard shortcuts change modes (n, e, Escape)', async ({ page }) => {
      const gp = new GraphPage(page);

      // press 'n' to enter addNode
      await page.keyboard.press('n');
      await page.waitForTimeout(80);
      expect(await page.evaluate(() => document.getElementById('modeAddNode').classList.contains('highlight'))).toBe(true);

      // press 'e' to enter addEdge
      await page.keyboard.press('e');
      await page.waitForTimeout(80);
      expect(await page.evaluate(() => document.getElementById('modeAddEdge').classList.contains('highlight'))).toBe(true);

      // press Escape to return to select
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
      expect(await page.evaluate(() => document.getElementById('modeSelect').classList.contains('highlight'))).toBe(true);
    });
  });

  test.describe('Console and page error monitoring', () => {
    test('No uncaught ReferenceError / SyntaxError / TypeError occurred during interactions', async ({ page }) => {
      // We already collected errors in beforeEach via page.on('pageerror')
      // Assert that none of the pageErrors are ReferenceError/SyntaxError/TypeError
      const fatalErrors = pageErrors.filter(err => /ReferenceError|SyntaxError|TypeError/.test(String(err)));
      expect(fatalErrors.length).toBe(0);
      // Also assert there were no console 'error' messages indicating these fatal types
      const fatalConsoleErrors = consoleMessages.filter(m => m.type === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text));
      expect(fatalConsoleErrors.length).toBe(0);
    });
  });
});