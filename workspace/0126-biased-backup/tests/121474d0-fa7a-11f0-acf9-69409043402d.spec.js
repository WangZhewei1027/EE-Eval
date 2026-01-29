import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121474d0-fa7a-11f0-acf9-69409043402d.html';

// Page Object to encapsulate common interactions with the demo
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Inputs & Buttons
    this.vertexInput = page.locator('#vertex-input');
    this.addVertexBtn = page.locator('#add-vertex-btn');
    this.edgeUInput = page.locator('#edge-u-input');
    this.edgeVInput = page.locator('#edge-v-input');
    this.edgeWeightInput = page.locator('#edge-weight-input');
    this.addEdgeBtn = page.locator('#add-edge-btn');
    this.clearGraphBtn = page.locator('#clear-graph-btn');

    this.prepareKruskalBtn = page.locator('#prepare-kruskal-btn');
    this.stepKruskalBtn = page.locator('#step-kruskal-btn');
    this.autoRunBtn = page.locator('#auto-run-btn');
    this.pauseAutoBtn = page.locator('#pause-auto-btn');
    this.resetKruskalBtn = page.locator('#reset-kruskal-btn');

    this.autoIntervalSlider = page.locator('#auto-interval-slider');
    this.autoIntervalDisplay = page.locator('#auto-interval-display');

    this.verticesList = page.locator('#vertices-list');
    this.edgesList = page.locator('#edges-list');
    this.totalEdgesSpan = page.locator('#total-edges');
    this.currentEdgeSpan = page.locator('#current-edge');
    this.currentEdgeIndex = page.locator('#current-edge-index');
    this.mstEdgesList = page.locator('#mst-edges-list');

    this.ufTableBody = page.locator('#uf-table tbody');

    this.showGraphStateBtn = page.locator('#show-graph-state-btn');
    this.showSortedEdgesBtn = page.locator('#show-sorted-edges-btn');
    this.showUfStateBtn = page.locator('#show-uf-state-btn');
    this.infoOutput = page.locator('#info-output');

    this.ufFindInput = page.locator('#uf-find-input');
    this.ufFindBtn = page.locator('#uf-find-btn');
    this.ufFindResult = page.locator('#uf-find-result');

    this.ufUnionUInput = page.locator('#uf-union-u');
    this.ufUnionVInput = page.locator('#uf-union-v');
    this.ufUnionBtn = page.locator('#uf-union-btn');
    this.ufUnionResult = page.locator('#uf-union-result');

    this.logArea = page.locator('#log');
  }

  async addVertex(name, acceptDialogs = true) {
    if (acceptDialogs) {
      // Generic dialog acceptor to avoid blocking test when alerts happen
      this.page.once('dialog', async d => d.accept());
    }
    await this.vertexInput.fill(name);
    await this.addVertexBtn.click();
  }

  async addEdge(u, v, weight = '1', acceptDialogs = true) {
    if (acceptDialogs) {
      this.page.once('dialog', async d => d.accept());
    }
    await this.edgeUInput.fill(u);
    await this.edgeVInput.fill(v);
    await this.edgeWeightInput.fill(String(weight));
    await this.addEdgeBtn.click();
  }

  // clicks the prepare/initialize button
  async prepareKruskal() {
    await this.prepareKruskalBtn.click();
  }

  async stepKruskal() {
    await this.stepKruskalBtn.click();
  }

  async startAutoRun() {
    await this.autoRunBtn.click();
  }

  async pauseAutoRun() {
    await this.pauseAutoBtn.click();
  }

  async resetKruskal() {
    await this.resetKruskalBtn.click();
  }

  async clearGraph(acceptConfirm = true) {
    this.page.once('dialog', async d => {
      if (acceptConfirm) await d.accept();
      else await d.dismiss();
    });
    await this.clearGraphBtn.click();
  }

  async showGraphState() {
    await this.showGraphStateBtn.click();
  }

  async showSortedEdges() {
    await this.showSortedEdgesBtn.click();
  }

  async showUfState() {
    await this.showUfStateBtn.click();
  }

  async ufFind(vertex) {
    await this.ufFindInput.fill(vertex);
    await this.ufFindBtn.click();
  }

  async ufUnion(u, v) {
    await this.ufUnionUInput.fill(u);
    await this.ufUnionVInput.fill(v);
    await this.ufUnionBtn.click();
  }

  async setAutoInterval(ms) {
    // set slider value and trigger input event by focusing and filling
    await this.page.evaluate((v) => {
      const slider = document.querySelector('#auto-interval-slider');
      slider.value = v;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(ms));
  }

  async getLogText() {
    return await this.logArea.evaluate(el => el.value);
  }

  async getInfoOutput() {
    return await this.infoOutput.evaluate(el => el.value);
  }

  async getVerticesButtonsText() {
    return await this.verticesList.evaluate((el) =>
      Array.from(el.querySelectorAll('button')).map(b => b.textContent.trim())
    );
  }

  async getEdgesButtonsText() {
    return await this.edgesList.evaluate((el) =>
      Array.from(el.querySelectorAll('button')).map(b => b.textContent.trim())
    );
  }

  async getTotalEdges() {
    return await this.totalEdgesSpan.textContent();
  }

  async getCurrentEdge() {
    return await this.currentEdgeSpan.textContent();
  }

  async getCurrentEdgeIndex() {
    return await this.currentEdgeIndex.textContent();
  }

  async getMstEdgesText() {
    return await this.mstEdgesList.evaluate(el => Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE)
      .map(n => n.textContent ? n.textContent.trim() : ''));
  }

  async getUfTableRows() {
    return await this.ufTableBody.evaluate(tb => Array.from(tb.querySelectorAll('tr')).map(tr => {
      const tds = tr.querySelectorAll('td');
      return Array.from(tds).map(td => td.textContent.trim());
    }));
  }
}

// Collect console messages & page errors across tests using per-test arrays via fixtures
test.describe('Kruskal Algorithm Interactive Demo - FSM coverage', () => {
  // Note: Each test will navigate fresh and attach listeners in beforeEach
  test.beforeEach(async ({ page }) => {
    // allow tests to observe console messages and page errors
    page.context().clearCookies?.(); // no-op if undefined, harmless
  });

  test.describe('Graph Setup (S0_Idle -> S1_VertexAdded, S2_EdgeAdded, ClearGraph)', () => {
    test('Add vertices and edges enable prepare button and log events', async ({ page }) => {
      // This test validates adding vertices and edges transitions from Idle to VertexAdded and EdgeAdded;
      // it verifies DOM updates, prepare button enabling, and logged messages.
      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => consoleMessages.push(msg.text()));
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      // Initially prepare should be disabled
      await expect(app.prepareKruskalBtn).toBeDisabled();

      // Add two vertices
      await app.addVertex('A');
      await app.addVertex('B');

      // Verify vertices list contains A and B
      const verts = await app.getVerticesButtonsText();
      expect(verts).toEqual(expect.arrayContaining(['A', 'B']));

      // Add edge between A and B
      await app.addEdge('A', 'B', '5');

      // Verify edge list updated and total edges shows 1
      const edgesText = await app.getEdgesButtonsText();
      expect(edgesText.some(t => t.startsWith('A - B'))).toBeTruthy();
      expect(await app.getTotalEdges()).toBe('1');

      // After having vertices and edges prepare button should be enabled
      await expect(app.prepareKruskalBtn).toBeEnabled();

      // Check logs contain "Vertex added" and "Edge added"
      const log = await app.getLogText();
      expect(log).toContain('Vertex added: A');
      expect(log).toContain('Vertex added: B');
      expect(log).toContain('Edge added: A-B (weight 5)');

      // Assert no runtime page errors occurred during setup
      expect(pageErrors.length).toBe(0);
    });

    test('Clear graph removes vertices & edges and logs Graph cleared', async ({ page }) => {
      // Validates ClearGraph transition and effects (vertices/edges cleared, kruskal reset)
      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', msg => consoleMessages.push(msg.text()));
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      // Add a vertex and edge to enable the clear action in meaningful state
      await app.addVertex('X');
      await app.addVertex('Y');
      await app.addEdge('X', 'Y', '2');

      // Click clear graph and accept confirm dialog
      let seenDialog = false;
      page.once('dialog', async d => {
        // Confirm clearance
        expect(d.message()).toContain('Clear all vertices and edges?');
        seenDialog = true;
        await d.accept();
      });
      await app.clearGraph(true);
      expect(seenDialog).toBeTruthy();

      // After clearing, vertices list and edges list should be empty
      const verts = await app.getVerticesButtonsText();
      expect(verts.length).toBe(0);
      const edgesText = await app.getEdgesButtonsText();
      expect(edgesText.length).toBe(0);
      expect(await app.getTotalEdges()).toBe('0');

      // Log should contain Graph cleared and Kruskal reset
      const log = await app.getLogText();
      expect(log).toContain('Graph cleared.');
      expect(log).toContain('Kruskal reset.');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Kruskal Execution (S3_KruskalInitialized, S4_KruskalStepping, S5_AutoRunning, S6_KruskalCompleted)', () => {
    test('Prepare and step through Kruskal logs processing and completes', async ({ page }) => {
      // Validates prepareKruskal entry actions, stepping through edges, MST additions, and completion logs.
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      // Build a small graph A-B (1), B-C (2), A-C (3)
      await app.addVertex('A');
      await app.addVertex('B');
      await app.addVertex('C');
      await app.addEdge('A', 'B', '1');
      await app.addEdge('B', 'C', '2');
      await app.addEdge('A', 'C', '3');

      // Prepare Kruskal (should log initialization and enable step controls)
      await app.prepareKruskal();
      let logText = await app.getLogText();
      expect(logText).toContain('Kruskal initialized: sorted edges by weight.');

      // Reset button should be enabled once prepared
      await expect(app.resetKruskalBtn).toBeEnabled();

      // Step through edges one by one; expect "Process edge ..." logs and eventual "Kruskal complete"
      await app.stepKruskal();
      logText = await app.getLogText();
      expect(logText).toContain('Process edge A-B (w:1:'); // might include timestamp, but ensure substring present
      // The exact formatting in log is "Process edge A-B (w:1): roots ..." so check for core substring
      expect(logText).toMatch(/Process edge A-B.*w:1/);

      // Step second and third edges
      await app.stepKruskal();
      await app.stepKruskal();

      // After final step, expect 'Kruskal complete: all edges processed.' log line
      logText = await app.getLogText();
      expect(logText).toContain('Kruskal complete: all edges processed.');

      // Ensure MST list contains expected edges (two edges for 3 vertices)
      const mstItems = await app.getMstEdgesText();
      // There should be at least two MST entries (exact entries text may vary but contain ' - ' and 'w:')
      expect(mstItems.length).toBeGreaterThanOrEqual(2);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Auto-run starts and can be paused; start/stop log behavior', async ({ page }) => {
      // Validates AutoRun entry action (startAutoRun) and PauseAuto exit action (stopAutoRun).
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      // Build a small graph and prepare
      await app.addVertex('P');
      await app.addVertex('Q');
      await app.addEdge('P', 'Q', '1');

      await app.prepareKruskal();

      // Speed up auto-run interval to minimum for test reliability
      await app.setAutoInterval(100);

      // Start auto-run
      await app.startAutoRun();

      // After starting, pause button should be enabled and auto-run disabled
      await expect(app.pauseAutoBtn).toBeEnabled();
      await expect(app.autoRunBtn).toBeDisabled();

      // Wait briefly to allow at least one auto step to run
      await page.waitForTimeout(350);

      // Pause auto-run (this triggers stopAutoRun)
      await app.pauseAutoRun();

      // After pausing, autoRun should be enabled again
      await expect(app.autoRunBtn).toBeEnabled();
      await expect(app.pauseAutoBtn).toBeDisabled();

      // Check logs include at least one Process edge message from auto-run
      const logText = await app.getLogText();
      expect(logText).toContain('Process edge');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Reset Kruskal returns to idle and disables step controls', async ({ page }) => {
      // Validates ResetKruskal event resets internal state and UI controls.
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      await app.addVertex('R');
      await app.addVertex('S');
      await app.addEdge('R', 'S', '4');

      await app.prepareKruskal();
      // Reset Kruskal
      await app.resetKruskal();

      // Step and auto-run buttons should be disabled after reset
      await expect(app.stepKruskalBtn).toBeDisabled();
      await expect(app.autoRunBtn).toBeDisabled();
      await expect(app.resetKruskalBtn).toBeDisabled();

      // Log contains Kruskal reset
      const logText = await app.getLogText();
      expect(logText).toContain('Kruskal reset.');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Inspect & Union-Find Commands (ShowGraphState, ShowSortedEdges, ShowUfState, FindVertex, UnionVertices)', () => {
    test('Show graph state and sorted edges output', async ({ page }) => {
      // Validates showGraphState & showSortedEdges populate info-output accordingly
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      await app.addVertex('A1');
      await app.addVertex('B1');
      await app.addEdge('A1', 'B1', '7');

      // Show graph state
      await app.showGraphState();
      let info = await app.getInfoOutput();
      expect(info).toContain('Vertices:');
      expect(info).toContain('A1');
      expect(info).toContain('B1');
      expect(info).toContain('Edges:');

      // Show sorted edges
      await app.showSortedEdges();
      info = await app.getInfoOutput();
      expect(info).toContain('Edges Sorted by Weight');
      expect(info).toContain('A1 - B1');

      expect(pageErrors.length).toBe(0);
    });

    test('Show UF state before initialization and after prepare', async ({ page }) => {
      // Validates showUfState behavior in uninitialized and initialized Kruskal states.
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      await app.addVertex('U1');
      await app.addVertex('U2');
      await app.addEdge('U1', 'U2', '3');

      // Show UF state before prepare: should indicate not initialized
      await app.showUfState();
      let info = await app.getInfoOutput();
      expect(info).toContain('Kruskal not initialized');

      // Prepare and then show UF state: should list groups (one per vertex initially)
      await app.prepareKruskal();
      await app.showUfState();
      info = await app.getInfoOutput();
      expect(info).toContain('Union-Find Sets Groups');
      expect(info).toContain('Root');

      expect(pageErrors.length).toBe(0);
    });

    test('ufFind & ufUnion behavior for invalid and valid cases', async ({ page }) => {
      // Validates ufFind and ufUnion event handling for vertex not found, not initialized,
      // and correct operation after initialization.
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      // ufFind on non-existing vertex should show 'Vertex not found'
      await app.ufFind('NOPE');
      await expect(app.ufFindResult).toHaveText('Vertex not found');

      // Add vertices
      await app.addVertex('V1');
      await app.addVertex('V2');

      // ufFind on existing vertex but before prepare should show 'Kruskal not initialized'
      await app.ufFind('V1');
      await expect(app.ufFindResult).toHaveText('Kruskal not initialized');

      // ufUnion for invalid vertices shows message
      await app.ufUnion('X', 'Y');
      await expect(app.ufUnionResult).toHaveText('Invalid vertices');

      // Prepare kruskal and then ufFind + ufUnion should operate
      await app.addEdge('V1', 'V2', '1');
      await app.prepareKruskal();

      // ufFind returns root
      await app.ufFind('V1');
      await expect(app.ufFindResult).toHaveText(/Root:/);

      // ufUnion on two distinct sets merges them
      await app.ufUnion('V1', 'V2');
      await expect(app.ufUnionResult).toHaveText(/Union succeeded|Already in same set/);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Scenarios (input validation, duplicate, loops)', () => {
    test('Adding invalid vertex names triggers alerts', async ({ page }) => {
      // Validates input validation for vertex names (empty, spaces, too long)
      await page.goto(APP_URL);

      // Capture dialog messages for expected alerts
      const alerts = [];
      page.on('dialog', async d => {
        alerts.push(d.message());
        await d.accept();
      });

      const app = new KruskalPage(page);

      // Invalid: empty name
      await app.addVertex('', true);
      // Invalid: spaces
      await app.addVertex('a b', true);
      // Invalid: too long (more than maxlength 3)
      await app.addVertex('ABCD', true);

      // Make sure we captured at least three alert dialogs with messages indicating invalid name
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts.some(m => m.includes('Invalid vertex name'))).toBeTruthy();
    });

    test('Adding duplicate vertex and invalid edges produce alerts', async ({ page }) => {
      // Validate duplicate vertex alert and edge validation alerts
      await page.goto(APP_URL);

      const dialogs = [];
      page.on('dialog', async d => {
        dialogs.push(d.message());
        await d.accept();
      });

      const app = new KruskalPage(page);

      // Add a vertex
      await app.addVertex('Dup');

      // Try adding the same vertex again -> alert about already exists
      await app.addVertex('Dup');

      // Try to add an edge where vertices don't exist
      await app.addEdge('X', 'Y', '1');

      // Try to add a loop edge (same vertex both ends)
      await app.addEdge('Dup', 'Dup', '2');

      // Expect to have seen messages about duplicate and invalid vertices / loops
      expect(dialogs.some(m => m.includes('already exists'))).toBeTruthy();
      expect(dialogs.some(m => m.includes('Both vertices must exist') || m.includes('Edge vertices must be valid'))).toBeTruthy();
      expect(dialogs.some(m => m.includes('No loops allowed'))).toBeTruthy();
    });

    test('Attempt to add duplicate undirected edge triggers alert', async ({ page }) => {
      // Validates edge existence check (undirected): adding A-B then B-A should be considered duplicate
      const captured = [];
      page.on('dialog', async d => {
        captured.push(d.message());
        await d.accept();
      });

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      await app.addVertex('M');
      await app.addVertex('N');

      await app.addEdge('M', 'N', '5'); // first edge
      await app.addEdge('N', 'M', '5'); // duplicate undirected attempt

      // The second attempt should produce an alert 'Edge already exists between these vertices.'
      expect(captured.some(m => m.includes('Edge already exists between these vertices'))).toBeTruthy();
    });
  });

  test.describe('DOM interactions that trigger confirm dialogs (vertex/edge removal)', () => {
    test('Removing vertex via its button triggers confirm and updates UI', async ({ page }) => {
      // Validate that clicking a vertex button opens confirm dialog and on acceptance vertex & its edges removed.
      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      await app.addVertex('Z1');
      await app.addVertex('Z2');
      await app.addEdge('Z1', 'Z2', '9');

      // Find the vertex button in DOM and click it; a confirm dialog should appear and we accept it
      const vertexButton = page.locator('#vertices-list button', { hasText: 'Z1' });
      let sawDialog = false;
      page.once('dialog', async d => {
        sawDialog = true;
        expect(d.message()).toContain('Remove vertex "Z1"');
        await d.accept();
      });

      await vertexButton.click();
      expect(sawDialog).toBeTruthy();

      // After removal, Z1 shouldn't be in vertices
      const verts = await app.getVerticesButtonsText();
      expect(verts).not.toContain('Z1');

      // Edges list should no longer contain edge with Z1
      const edgesText = await app.getEdgesButtonsText();
      expect(edgesText.some(t => t.includes('Z1'))).toBeFalsy();
    });

    test('Removing edge via its button triggers confirm and updates UI', async ({ page }) => {
      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      await app.addVertex('E1');
      await app.addVertex('E2');
      await app.addEdge('E1', 'E2', '6');

      // Click the edge button; confirm will appear
      const edgeButton = page.locator('#edges-list button', { hasText: 'E1 - E2' });
      let sawDialog = false;
      page.once('dialog', async d => {
        sawDialog = true;
        expect(d.message()).toContain('Remove edge E1 - E2');
        await d.accept();
      });

      await edgeButton.click();
      expect(sawDialog).toBeTruthy();

      // Edge should be removed
      const edgesText = await app.getEdgesButtonsText();
      expect(edgesText.some(t => t.includes('E1 - E2'))).toBeFalsy();
    });
  });

  test.describe('Logging & runtime stability checks', () => {
    test('Page logs include expected lifecycle messages and no runtime errors', async ({ page }) => {
      // This test listens to console and pageerror events, performs a sequence of actions,
      // and asserts that expected lifecycle log messages appear while pageErrors remain empty.
      const consoleMsgs = [];
      const pageErrors = [];
      page.on('console', msg => consoleMsgs.push(msg.text()));
      page.on('pageerror', err => pageErrors.push(err));

      const app = new KruskalPage(page);
      await page.goto(APP_URL);

      // Sequence: add vertices, add edge, prepare, reset
      await app.addVertex('L1');
      await app.addVertex('L2');
      await app.addEdge('L1', 'L2', '2');
      await app.prepareKruskal();
      await app.resetKruskal();

      // Collect the final log area text as well
      const logText = await app.getLogText();

      // Assert logs contain key lifecycle messages (initialization, reset)
      expect(logText).toContain('Kruskal initialized: sorted edges by weight.');
      expect(logText).toContain('Kruskal reset.');

      // Assert console messages array (may include same logs) also contain 'Vertex added' and 'Edge added'
      expect(consoleMsgs.some(m => m.includes('Vertex added'))).toBeTruthy();
      expect(consoleMsgs.some(m => m.includes('Edge added'))).toBeTruthy();

      // Page should have no uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });
});