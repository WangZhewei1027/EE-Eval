import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14a1b1-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object to encapsulate common interactions with the PageRank Explorer UI
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvasSel = '#graphCanvas';
    this.nodeLabelSel = '#nodeLabel';
    this.addNodeBtnSel = '#addNodeBtn';
    this.addNodeCenterBtnSel = '#addNodeAtCenterBtn';
    this.startAddEdgeBtnSel = '#startAddEdgeBtn';
    this.finishAddEdgeBtnSel = '#finishAddEdgeBtn';
    this.edgeModeSel = '#edgeMode';
    this.edgeSourceSel = '#edgeSource';
    this.edgeTargetSel = '#edgeTarget';
    this.edgeWeightSel = '#edgeWeight';
    this.delSelectedBtnSel = '#delSelectedBtn';
    this.selectedNodeSel = '#selectedNode';
    this.genRandBtnSel = '#genRandBtn';
    this.initPRBtnSel = '#initPRBtn';
    this.runPRBtnSel = '#runPRBtn';
    this.pausePRBtnSel = '#pausePRBtn';
    this.resetPRBtnSel = '#resetPRBtn';
    this.exportJSONBtnSel = '#exportJSONBtn';
    this.importJSONBtnSel = '#importJSONBtn';
    this.importFileSel = '#importFile';
    this.logAreaSel = '#logArea';
    this.iterCountSel = '#iterCount';
    this.runningFlagSel = '#runningFlag';
    this.adjListPreSel = '#adjListPre';
    this.prPreSel = '#prPre';
    this.showMatrixBtnSel = '#showMatrixBtn';
    this.edgeSelectControlsSel = '#edgeSelectControls';
    // The "Add Edge (from selects)" button was appended dynamically to edgeSelectControls
    this.addEdgeSelectBtnLocator = () =>
      this.page.locator('#edgeSelectControls button', { hasText: 'Add Edge (from selects)' });
  }

  async addNodeRandom(label) {
    if (label !== undefined) {
      await this.page.fill(this.nodeLabelSel, String(label));
    }
    await this.page.click(this.addNodeBtnSel);
  }

  async addNodeCenter(label) {
    if (label !== undefined) {
      await this.page.fill(this.nodeLabelSel, String(label));
    }
    await this.page.click(this.addNodeCenterBtnSel);
  }

  // Add node at absolute canvas coordinates using ctrl+click (the app adds node on ctrlKey)
  async addNodeAtCanvas(x, y, label) {
    if (label !== undefined) {
      await this.page.fill(this.nodeLabelSel, String(label));
    }
    await this.page.click(this.canvasSel, { position: { x, y }, modifiers: ['Control'] });
  }

  async startAddEdgeMode() {
    await this.page.click(this.startAddEdgeBtnSel);
  }

  async finishAddEdgeMode() {
    await this.page.click(this.finishAddEdgeBtnSel);
  }

  // Click on canvas at coordinates (no modifiers) - used to select nodes when addEdgeModeActive
  async clickCanvasAt(x, y) {
    await this.page.click(this.canvasSel, { position: { x, y } });
  }

  // Uses the select-based UI to add an edge: ensures select mode active, picks provided from/to values and clicks the dynamic add button
  async addEdgeViaSelect(fromValue, toValue, weight = 1) {
    // set edge mode to select
    await this.page.selectOption(this.edgeModeSel, 'select');
    // ensure controls are visible (visibility handled by app; still safe to select)
    await this.page.locator(this.edgeSelectControlsSel).waitFor({ state: 'visible' });
    await this.page.selectOption(this.edgeSourceSel, fromValue);
    await this.page.selectOption(this.edgeTargetSel, toValue);
    await this.page.fill(this.edgeWeightSel, String(weight));
    const btn = this.addEdgeSelectBtnLocator();
    await expect(btn).toBeVisible();
    await btn.click();
  }

  async deleteSelectedNodeByOptionValue(value) {
    await this.page.selectOption(this.selectedNodeSel, value);
    await this.page.click(this.delSelectedBtnSel);
  }

  async generateRandomGraph(nodes = 5, prob = 0.3, weightRange = '1,1', seed = '') {
    await this.page.fill('#randNodes', String(nodes));
    await this.page.fill('#randProb', String(prob));
    await this.page.fill('#weightRange', String(weightRange));
    if (seed !== '') await this.page.fill('#randSeed', String(seed));
    else await this.page.fill('#randSeed', '');
    await this.page.click(this.genRandBtnSel);
  }

  async initializePageRank() {
    await this.page.click(this.initPRBtnSel);
  }

  async runPageRank() {
    await this.page.click(this.runPRBtnSel);
  }

  async pausePageRank() {
    await this.page.click(this.pausePRBtnSel);
  }

  async resetPageRank() {
    await this.page.click(this.resetPRBtnSel);
  }

  async exportGraph() {
    await this.page.click(this.exportJSONBtnSel);
  }

  // Simulate importing JSON by setting the file input
  async importGraphFromObject(obj, fileName = 'import.json') {
    const content = JSON.stringify(obj, null, 2);
    // Playwright can set input files with content
    await this.page.setInputFiles(this.importFileSel, {
      name: fileName,
      mimeType: 'application/json',
      buffer: Buffer.from(content, 'utf8')
    });
    // The change handler on importFile will fire automatically
  }

  async getSelectedNodeOptionValues() {
    return this.page.$$eval('#selectedNode option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  }

  async getEdgeSourceOptionValues() {
    return this.page.$$eval('#edgeSource option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  }

  async getLogText() {
    return this.page.locator(this.logAreaSel).innerText();
  }

  async getIterCountText() {
    return this.page.locator(this.iterCountSel).innerText();
  }

  async getRunningFlagText() {
    return this.page.locator(this.runningFlagSel).innerText();
  }

  async getAdjListText() {
    return this.page.locator(this.adjListPreSel).innerText();
  }

  async getPrPreText() {
    return this.page.locator(this.prPreSel).innerText();
  }

  // Return all option values (including placeholder) for a given select
  async selectOptions(selectSelector) {
    return this.page.$$eval(`${selectSelector} option`, opts => opts.map(o => ({ value: o.value, text: o.textContent })));
  }
}

test.describe('Interactive PageRank Explorer - FSM validation', () => {
  let consoleErrors = [];
  let pageErrors = [];
  let pageObject;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // capture console errors and page errors to assert later that none occurred during interactions
    page.on('console', msg => {
      // collect console messages, especially errors
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // auto-accept dialogs so that tests do not hang on alerts created by the page
    page.on('dialog', async dialog => {
      // capture dialog messages in consoleErrors for visibility
      consoleErrors.push({ dialog: dialog.message() });
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    pageObject = new PageRankPage(page);

    // Basic sanity: ensure canvas exists and controls rendered
    await expect(page.locator('#graphCanvas')).toBeVisible();
    await expect(page.locator('#addNodeBtn')).toBeVisible();
    await expect(page.locator('#initPRBtn')).toBeVisible();
  });

  test.afterEach(async () => {
    // After each test ensure there were no console errors or unhandled page errors
    // This validates that the app runs without runtime exceptions for the exercised scenario.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e=>String(e)).join('\n')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console messages/errors: ${JSON.stringify(consoleErrors, null, 2)}`).toBe(0);
  });

  test.describe('S0 Idle state and initial UI', () => {
    test('initial UI shows Idle state controls (Add Node, Initialize PageRank)', async ({ page }) => {
      // Validate presence of buttons and initial status fields as evidence for S0_Idle
      await expect(page.locator('#addNodeBtn')).toHaveText('Add Node (random position)');
      await expect(page.locator('#initPRBtn')).toHaveText('Initialize PageRank');
      await expect(page.locator('#iterCount')).toHaveText('0');
      await expect(page.locator('#runningFlag')).toHaveText('false');
      // The control panel should contain node label input
      await expect(page.locator('#nodeLabel')).toBeVisible();
    });
  });

  test.describe('Node creation and deletion (S1_AddingNode, S8_DeletingNode)', () => {
    test('Add node via random button transitions from Idle to AddingNode (S1_AddingNode)', async ({ page }) => {
      // Before adding, selected node select only has placeholder
      let options = await pageObject.selectOptions('#selectedNode');
      expect(options.length).toBeGreaterThanOrEqual(1);
      const beforeCount = options.length;

      // Add a labeled node and assert selects update and log contains "Added node"
      await pageObject.addNodeRandom('TestA');
      // wait for log update that indicates node added
      await page.waitForFunction(
        (sel) => document.querySelector(sel).textContent.includes('Added node'),
        {},
        '#logArea'
      );
      const log = await pageObject.getLogText();
      expect(log).toMatch(/Added node/i);

      // After adding, options should have increased by at least 1 (placeholder + new)
      options = await pageObject.selectOptions('#selectedNode');
      expect(options.length).toBeGreaterThan(beforeCount);
    });

    test('Add node at canvas coordinates using ctrl+click and then delete it (edge case handling)', async ({ page }) => {
      // Add two nodes at exact coordinates using ctrl+click to have deterministic locations
      await pageObject.addNodeAtCanvas(150, 150, 'C1');
      await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');
      await pageObject.addNodeAtCanvas(300, 150, 'C2');
      await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');

      const opts = await pageObject.selectOptions('#selectedNode');
      // find option for C1
      const c1 = opts.find(o => o.text && o.text.includes('C1')) || opts[1];
      expect(c1).toBeTruthy();

      // Delete the C1 node via Delete Selected Node UI (S8_DeletingNode)
      await pageObject.deleteSelectedNodeByOptionValue(c1.value);

      // Log should indicate removal
      await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Removed node') || document.querySelector(sel).textContent.includes('Removed'), {}, '#logArea');
      const log = await pageObject.getLogText();
      expect(log).toMatch(/Removed node/i);
      // Ensure selectedNode options decreased (or C1 no longer present)
      const newOpts = await pageObject.selectOptions('#selectedNode');
      expect(newOpts.find(o => o.value === c1.value)).toBeFalsy();
    });
  });

  test.describe('Edge creation modes (S2_AddingEdge)', () => {
    test('Start add edge mode and create an edge by clicking nodes on the canvas', async ({ page }) => {
      // Create two nodes at known positions to click on them
      await pageObject.addNodeAtCanvas(200, 220, 'EdgeSrc');
      await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');
      await pageObject.addNodeAtCanvas(360, 220, 'EdgeTgt');
      await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');

      // Start add edge mode
      await pageObject.startAddEdgeMode();
      // Wait for log indicating add edge mode started
      await page.waitForFunction(() => {
        const l = document.querySelector('#logArea').textContent;
        return l.includes('Add Edge mode ON');
      });
      // Click source then target (these clicks will be captured by canvas mousedown handlers)
      await pageObject.clickCanvasAt(200, 220); // selects source
      await page.waitForFunction(() => document.querySelector('#logArea').textContent.includes('Edge source selected'), {}, { timeout: 2000 }).catch(() => {});
      await pageObject.clickCanvasAt(360, 220); // target - should create edge
      // Wait for log indicating edge added
      await page.waitForFunction(() => document.querySelector('#logArea').textContent.includes('Added edge'), {}, { timeout: 2000 });
      const log = await pageObject.getLogText();
      expect(log).toMatch(/Added edge/i);
      // Ensure adjacency list shows the edge (arrow or -> depending on which update ran last)
      const adjText = await pageObject.getAdjListText();
      expect(adjText.length).toBeGreaterThan(0);
      expect(/EdgeSrc|EdgeTgt/i.test(adjText)).toBeTruthy();
      // finish add edge mode (cleanup)
      await pageObject.finishAddEdgeMode();
    });

    test('Add edge via select controls (select mode), verifying validation and addition', async ({ page }) => {
      // Create two nodes with deterministic ids via addNodeCenter to ensure options exist
      await pageObject.addNodeCenter('S1');
      await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');
      await pageObject.addNodeCenter('S2');
      await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');

      const sourceOpts = await pageObject.getEdgeSourceOptionValues();
      // skip placeholder
      const realOpts = sourceOpts.filter(o => o.value !== '');
      expect(realOpts.length).toBeGreaterThanOrEqual(2);
      const from = realOpts[0].value;
      const to = realOpts[1].value;

      // Add edge via selects
      await pageObject.addEdgeViaSelect(from, to, 2);
      // Wait for log entry "Added edge"
      await page.waitForFunction(() => document.querySelector('#logArea').textContent.includes('Added edge'), {}, { timeout: 2000 });
      const log = await pageObject.getLogText();
      expect(log).toMatch(/Added edge/i);
      // adjacency list should reflect the edge
      const adjText = await pageObject.getAdjListText();
      expect(adjText).toMatch(new RegExp(`${from}.*${to}`));
    });
  });

  test.describe('Random graph generation (S5_GeneratingRandomGraph)', () => {
    test('Generate random graph clears current and builds new nodes/edges', async ({ page }) => {
      // Generate a small random graph with a fixed seed for determinism
      await pageObject.generateRandomGraph(6, 0.5, '1,2', '42');
      // Wait for log entry about generation
      await page.waitForFunction(() => document.querySelector('#logArea').textContent.includes('Generated random graph'), {}, { timeout: 2000 });
      const log = await pageObject.getLogText();
      expect(log).toMatch(/Generated random graph/i);
      // Ensure node select lists are populated (more than placeholder)
      const opts = await pageObject.selectOptions('#selectedNode');
      expect(opts.length).toBeGreaterThan(1);
      // Ensure adjacency list display exists
      const adj = await pageObject.getAdjListText();
      expect(adj.length).toBeGreaterThan(0);
    });
  });

  test.describe('PageRank lifecycle (S4_PageRankInitialized, S3_PageRankRunning, S9_ResettingPageRank)', () => {
    test('Initialize -> Run -> Pause -> Reset PageRank transitions and visual indicators', async ({ page }) => {
      // Ensure at least two nodes exist; if not, add them
      let opts = await pageObject.selectOptions('#selectedNode');
      if (opts.length <= 1) {
        await pageObject.addNodeCenter('PR1');
        await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');
        await pageObject.addNodeCenter('PR2');
        await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');
      }

      // Initialize PageRank (S4)
      await pageObject.initializePageRank();
      // Expect initialization log
      await page.waitForFunction(() => document.querySelector('#logArea').textContent.includes('Initialized PageRank'), {}, { timeout: 2000 });
      const logInit = await pageObject.getLogText();
      expect(logInit).toMatch(/Initialized PageRank/i);
      // prPre should not be "(not initialized)"
      const prText = await pageObject.getPrPreText();
      expect(prText).not.toMatch(/\(not initialized\)/);

      // Run PageRank (S3 entry action runPageRank)
      await pageObject.runPageRank();
      // runningFlag should be true
      await page.waitForFunction(() => document.querySelector('#runningFlag').textContent === 'true', {}, { timeout: 2000 });
      const runningText = await pageObject.getRunningFlagText();
      expect(runningText).toBe('true');
      // log should contain started message
      const afterRunLog = await pageObject.getLogText();
      expect(afterRunLog).toMatch(/Started running PageRank/i);

      // Let it run for a short time to allow at least one iteration
      await page.waitForTimeout(600);

      // Pause PageRank
      await pageObject.pausePageRank();
      await page.waitForFunction(() => document.querySelector('#runningFlag').textContent === 'false', {}, { timeout: 2000 });
      const afterPauseLog = await pageObject.getLogText();
      // Pause handler logs 'Paused PageRank run'
      expect(afterPauseLog).toMatch(/Paused PageRank run/i);

      // Verify iteration count incremented (>0)
      const iterText = await pageObject.getIterCountText();
      expect(Number(iterText)).toBeGreaterThanOrEqual(1);

      // Reset PageRank
      await pageObject.resetPageRank();
      await page.waitForFunction(() => document.querySelector('#iterCount').textContent === '0', {}, { timeout: 2000 });
      const afterResetLog = await pageObject.getLogText();
      expect(afterResetLog).toMatch(/PageRank reset/i);
      const iterAfterReset = await pageObject.getIterCountText();
      expect(iterAfterReset).toBe('0');
      const runningAfterReset = await pageObject.getRunningFlagText();
      expect(runningAfterReset).toBe('false');
    });
  });

  test.describe('Export and Import (S6_ExportingGraph, S7_ImportingGraph)', () => {
    test('Export graph triggers JSON download anchor creation and logs export', async ({ page }) => {
      // Export the graph - we cannot read disk, but the app logs the export
      await pageObject.exportGraph();
      await page.waitForFunction(() => document.querySelector('#logArea').textContent.includes('Exported graph and settings to JSON'), {}, { timeout: 2000 });
      const log = await pageObject.getLogText();
      expect(log).toMatch(/Exported graph and settings to JSON/i);
    });

    test('Import graph via file input replaces graph and settings', async ({ page }) => {
      // Prepare a minimal graph object to import
      const importObj = {
        graph: {
          nodes: [
            { id: 'import1', label: 'import1', x: 120, y: 120 },
            { id: 'import2', label: 'import2', x: 200, y: 200 }
          ],
          edges: [{ from: 'import1', to: 'import2', weight: 1 }],
          directed: true
        },
        settings: {
          damping: 0.9,
          tol: 1e-7,
          maxIter: 50,
          normMode: 'column',
          sinkMode: 'teleport',
          persMode: 'uniform',
          personalization: []
        }
      };

      // Trigger import by setting the file input contents
      await pageObject.importGraphFromObject(importObj, 'graph_import.json');

      // Because FileReader is used asynchronously, wait for import log
      await page.waitForFunction(() => document.querySelector('#logArea').textContent.includes('Imported graph from JSON'), {}, { timeout: 3000 });

      const log = await pageObject.getLogText();
      expect(log).toMatch(/Imported graph from JSON/i);

      // After import, selected node options should include import1/import2
      const opts = await pageObject.selectOptions('#selectedNode');
      expect(opts.some(o => o.text && o.text.includes('import1'))).toBeTruthy();
      expect(opts.some(o => o.text && o.text.includes('import2'))).toBeTruthy();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempt to add edge via selects without choosing nodes triggers alert (handled)', async ({ page }) => {
      // Ensure select mode visible
      await page.selectOption('#edgeMode', 'select');
      await page.locator('#edgeSelectControls').waitFor({ state: 'visible' });
      // Make sure selects are reset (choose placeholder)
      await page.selectOption('#edgeSource', '');
      await page.selectOption('#edgeTarget', '');
      // Listen for dialog and capture its message via the dialog handler in beforeEach
      // Click the dynamic "Add Edge (from selects)" button which will call alert if missing
      const btn = page.locator('#edgeSelectControls button', { hasText: 'Add Edge (from selects)' });
      await expect(btn).toBeVisible();
      await btn.click();
      // The dialog will be auto-accepted in our beforeEach and recorded into consoleErrors
      // Verify that an alert dialog message related to choosing both source and target was observed
      const found = consoleErrors.find(e => {
        if (e.dialog) return /Choose both source and target/i.test(e.dialog);
        return false;
      });
      expect(found).toBeTruthy();
    });

    test('Custom personalization with invalid JSON triggers alert and falls back to uniform', async ({ page }) => {
      // Create two nodes if none exist
      const opts = await pageObject.selectOptions('#selectedNode');
      if (opts.length <= 1) {
        await pageObject.addNodeCenter('P1');
        await page.waitForFunction(sel => document.querySelector(sel).textContent.includes('Added node'), {}, '#logArea');
      }

      // Switch to custom personalization mode and input invalid JSON
      await page.selectOption('#persMode', 'custom');
      await page.waitForFunction(() => document.querySelector('#persCustom').style.display === 'block');
      await page.fill('#persJSON', '{ invalid: json }');

      // Initialize PageRank which will attempt to parse JSON and should alert; our dialog handler will accept
      await pageObject.initializePageRank();

      // The dialog should have been captured in consoleErrors
      const found = consoleErrors.find(e => e.dialog && /Invalid JSON|Custom personalization must be an array/i.test(e.dialog));
      // We expect an alert to have been fired (either "Invalid JSON for personalization vector" or "Custom personalization must be an array...")
      expect(found).toBeTruthy();
      // Also the app should still initialize and set prPre content
      await page.waitForFunction(() => document.querySelector('#prPre').textContent && !document.querySelector('#prPre').textContent.includes('(not initialized)'), {}, { timeout: 2000 });
      const prText = await pageObject.getPrPreText();
      expect(prText).not.toMatch(/\(not initialized\)/);
    });
  });
});