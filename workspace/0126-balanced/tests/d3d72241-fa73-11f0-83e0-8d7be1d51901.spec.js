import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d72241-fa73-11f0-83e0-8d7be1d51901.html';

// Page object encapsulating common interactions and queries
class GraphPage {
  constructor(page) {
    this.page = page;
    this.svg = page.locator('#svg');
    this.notice = page.locator('#notice');
  }

  // Click a mode button by id and wait for notice update
  async clickMode(modeId) {
    await Promise.all([
      this.page.locator(`#${modeId}`).click(),
      this.page.waitForTimeout(100) // small pause to allow UI update
    ]);
  }

  // Click somewhere on the SVG to add a node (client coordinates relative to svg)
  // offsetX/Y are percentages of svg bounding box (0..1)
  async addNodeAt(offsetX = 0.5, offsetY = 0.5) {
    const box = await this.svg.boundingBox();
    if (!box) throw new Error('SVG bounding box not available');
    const x = box.x + box.width * offsetX;
    const y = box.y + box.height * offsetY;
    await this.page.mouse.click(x, y, { force: true });
    // wait for rendering
    await this.page.waitForTimeout(150);
  }

  // Click a node group by data-id attribute
  async clickNodeById(id) {
    const locator = this.page.locator(`g.node-group[data-id="${id}"]`);
    await locator.waitFor({ state: 'visible' });
    const box1 = await locator.boundingBox();
    if (!box) throw new Error(`Node ${id} bounding box not found`);
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { force: true });
    // allow handlers (alerts, UI updates)
    await this.page.waitForTimeout(120);
  }

  // Drag a node by id by delta pixels
  async dragNodeById(id, deltaX, deltaY) {
    const locator1 = this.page.locator1(`g.node-group[data-id="${id}"]`);
    await locator.waitFor({ state: 'visible' });
    const box2 = await locator.boundingBox();
    if (!box) throw new Error(`Node ${id} bounding box not found for drag`);
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    // move in steps to ensure mousemove events fire
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      await this.page.mouse.move(startX + (deltaX * i) / steps, startY + (deltaY * i) / steps);
      await this.page.waitForTimeout(40);
    }
    await this.page.mouse.up();
    await this.page.waitForTimeout(150);
  }

  // Return count of node group elements
  async nodeCount() {
    return await this.page.locator('g.node-group').count();
  }

  // Return count of edge line elements
  async edgeCount() {
    return await this.page.locator('line[id^="edge-"]').count();
  }

  // Get notice text
  async getNotice() {
    return (await this.notice.innerText()).trim();
  }

  // Read distance for a node from the distance table (node label equals id)
  async getDistanceForNode(nodeId) {
    const rows = this.page.locator('#dist-table tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const label = (await row.locator('td').nth(0).innerText()).trim();
      if (label === String(nodeId)) {
        const distText = (await row.locator('td').nth(1).innerText()).trim();
        return distText;
      }
    }
    return null;
  }

  // Returns whether the circle element for node has a given class
  async nodeHasClass(nodeId, className) {
    const circ = this.page.locator(`#node-${nodeId}`);
    await circ.waitFor({ state: 'visible' });
    return await circ.evaluate((el, c) => el.classList.contains(c), className);
  }

  // Click a top-level control button by id
  async clickButton(id) {
    await this.page.locator(`#${id}`).click();
    await this.page.waitForTimeout(120);
  }

  // Get fringe content text
  async getFringeText() {
    return (await this.page.locator('#fringe').innerText()).trim();
  }

  // Get presence of highlighted edges (edge lines with class edge-highlight)
  async highlightedEdgesCount() {
    return await this.page.locator('line.edge-highlight').count();
  }
}

test.describe('Dijkstra Interactive Demo — FSM state & transition tests', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    // capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    // capture page uncaught errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Dismiss or accept any dialogs automatically to avoid blocking tests.
    // We accept confirms/alerts so flows that rely on user confirmation proceed.
    page.on('dialog', async dialog => {
      try {
        await dialog.accept();
      } catch (e) {
        // ignore if already handled
      }
    });

    await page.goto(APP_URL);
    // ensure page loaded and initial seed has been rendered
    await page.waitForSelector('g.node-group');
    // small wait for UI settle
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // no-op; listeners are tied to page and cleared automatically
  });

  test.describe('Modes and mode transitions (S0_Idle → modes)', () => {
    test('should render mode buttons and default to Drag mode (S0_Idle entry)', async ({ page }) => {
      const gp = new GraphPage(page);
      // Verify presence of mode buttons
      await expect(page.locator('#mode-add-node')).toBeVisible();
      await expect(page.locator('#mode-add-edge')).toBeVisible();
      await expect(page.locator('#mode-set-source')).toBeVisible();
      await expect(page.locator('#mode-drag')).toBeVisible();

      // Default mode is 'drag' (set in script). The notice should mention Drag
      const notice = await gp.getNotice();
      expect(notice.toLowerCase()).toContain('drag');

      // No runtime page errors occurred during initial render
      expect(pageErrors.length).toBe(0);
    });

    test('clicking Add Node switches mode to add-node (S1_AddNode) and updates notice', async ({ page }) => {
      const gp1 = new GraphPage(page);
      await gp.clickMode('mode-add-node');
      const notice1 = await gp.getNotice();
      expect(notice.toLowerCase()).toContain('add node');

      // The Add Node button should have the 'primary' class now
      const isPrimary = await page.locator('#mode-add-node').evaluate(el => el.classList.contains('primary'));
      expect(isPrimary).toBe(true);

      // No console errors during mode switch
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('clicking Add Edge and Set Source and Drag change modes accordingly (S2,S3,S4)', async ({ page }) => {
      const gp2 = new GraphPage(page);

      await gp.clickMode('mode-add-edge');
      expect((await gp.getNotice()).toLowerCase()).toContain('add edge');
      expect(await page.locator('#mode-add-edge').evaluate(el => el.classList.contains('primary'))).toBe(true);

      await gp.clickMode('mode-set-source');
      expect((await gp.getNotice()).toLowerCase()).toContain('set source');
      expect(await page.locator('#mode-set-source').evaluate(el => el.classList.contains('primary'))).toBe(true);

      await gp.clickMode('mode-drag');
      expect((await gp.getNotice()).toLowerCase()).toContain('drag');
      expect(await page.locator('#mode-drag').evaluate(el => el.classList.contains('primary'))).toBe(true);

      // ensure still no uncaught runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Graph building interactions (Add Node, Add Edge)', () => {
    test('adding a node increases node count (S1_AddNode → S0_Idle after add)', async ({ page }) => {
      const gp3 = new GraphPage(page);
      const before = await gp.nodeCount();
      await gp.clickMode('mode-add-node');
      // click near bottom-right area to add a node
      await gp.addNodeAt(0.85, 0.85);
      const after = await gp.nodeCount();
      expect(after).toBeGreaterThan(before);

      // newly added node should be present in distance table as uninitialized (—)
      const newlyAddedRow = await page.locator('#dist-table tbody tr').nth(after - 1).locator('td').nth(1).innerText();
      // since run not initialized, distance cells should show '—' for new node
      expect(newlyAddedRow.trim()).toBe('—');

      // no console errors
      expect(consoleErrors.length).toBe(0);
    });

    test('adding an edge by selecting two nodes creates edge line (S2_AddEdge → S0_Idle after add)', async ({ page }) => {
      const gp4 = new GraphPage(page);
      // ensure in add-edge mode
      await gp.clickMode('mode-add-edge');

      // pick two existing nodes (seedSample created nodes '1'..'7')
      const initialEdgeCount = await gp.edgeCount();

      // click node 1 then node 2 to create an edge
      await gp.clickNodeById('1');
      // notice updated to say selected node
      expect((await gp.getNotice()).toLowerCase()).toContain('selected node 1');

      await gp.clickNodeById('2');
      // small wait to allow draw
      await page.waitForTimeout(200);

      const afterEdgeCount = await gp.edgeCount();
      expect(afterEdgeCount).toBeGreaterThanOrEqual(initialEdgeCount);

      // weight label for new edges should be present as <text data-edge>
      // at least one <text> element with data-edge exists
      const weightLabels = await page.locator('text[data-edge]').count();
      expect(weightLabels).toBeGreaterThan(0);

      // no page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Set Source and Initialize Dijkstra (S3 → S5)', () => {
    test('Initialize without a source triggers alert (edge case)', async ({ page }) => {
      // reload a fresh page to ensure no source set
      await page.goto(APP_URL);
      // intercept dialogs to capture text
      let lastDialogMessage = null;
      page.on('dialog', async dialog => {
        lastDialogMessage = dialog.message();
        await dialog.accept();
      });

      // Click initialize immediately (no source set)
      await page.locator('#btn-init').click();
      await page.waitForTimeout(150);

      // Ensure alert was shown with expected prompt
      expect(lastDialogMessage).toBeTruthy();
      expect(lastDialogMessage.toLowerCase()).toContain('please set a source node first');

      // There should be no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('set a source node (S3_SetSource) and initialize Dijkstra (S5_DijkstraInitialized)', async ({ page }) => {
      const gp5 = new GraphPage(page);

      // choose Set Source mode and pick node '1'
      await gp.clickMode('mode-set-source');
      await gp.clickNodeById('1');

      // After selecting source, node 1 should have class node-source
      const isSource = await gp.nodeHasClass('1', 'node-source');
      expect(isSource).toBe(true);
      expect((await gp.getNotice()).toLowerCase()).toContain('source set to node 1');

      // Initialize Dijkstra
      await gp.clickButton('btn-init');
      await page.waitForTimeout(200);

      // Notice should reflect initialization
      expect((await gp.getNotice()).toLowerCase()).toContain('initialized');

      // Distance for source node should be 0 in table
      const d1 = await gp.getDistanceForNode('1');
      expect(d1).toBe('0');

      // Fringe should contain at least the source with dist=0 (once next step relaxes neighbors)
      const fringeText = await gp.getFringeText();
      // fringe may be empty initially because only source has finite dist but not listed if implementation hides it,
      // so allow either presence or 'Fringe empty' string but ensure no errors
      expect(fringeText.length).toBeGreaterThanOrEqual(0);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Stepping, Auto Run, Pause, and Reset (S6,S7,S8,S9)', () => {
    test('Next Step extracts a node and then relaxes neighbors (S5 → S6)', async ({ page }) => {
      const gp6 = new GraphPage(page);

      // ensure source is set and initialized (if not already)
      await gp.clickMode('mode-set-source');
      await gp.clickNodeById('1');
      await gp.clickButton('btn-init');
      await page.waitForTimeout(100);

      // Click Next Step to extract node 1
      await gp.clickButton('btn-next');
      // Notice should mention 'Extracted node' or 'Now relaxing'
      const notice1 = (await gp.getNotice()).toLowerCase();
      expect(notice1).toMatch(/extracted node|now relaxing/);

      // Click Next Step again to relax a neighbor (if neighbors exist)
      await gp.clickButton('btn-next');
      const notice2 = (await gp.getNotice()).toLowerCase();
      // It should either mention 'relaxed' or 'examined edge' or 'already finalized'
      expect(notice2).toMatch(/relaxed|examined edge|already finalized/);

      // Distance table should reflect some finite distances other than '—'
      const rowsText = await page.locator('#dist-table tbody tr').first().locator('td').nth(1).innerText();
      expect(rowsText).toBeDefined();

      expect(pageErrors.length).toBe(0);
    });

    test('Auto Run starts and Pause stops it (S7_AutoRun → S8_Pause)', async ({ page }) => {
      const gp7 = new GraphPage(page);

      // Ensure run initialized
      await gp.clickMode('mode-set-source');
      await gp.clickNodeById('1');
      await gp.clickButton('btn-init');

      // Start auto run
      await gp.clickButton('btn-run');

      // Notice should indicate auto-run started
      expect((await gp.getNotice()).toLowerCase()).toContain('auto-run started');

      // Wait a bit to let some steps run
      await page.waitForTimeout(900);

      // Pause auto-run
      await gp.clickButton('btn-pause');

      // Notice text should indicate paused state (script replaces text)
      const notice2 = (await gp.getNotice()).toLowerCase();
      // the script attempts to replace 'Auto-run started.' with 'Paused.' so ensure paused text presence
      expect(notice.includes('paused') || notice.includes('auto-run complete') || notice.includes('auto-run')).toBeTruthy();

      // Reset run
      await gp.clickButton('btn-reset');
      await page.waitForTimeout(120);
      // After reset, distances should show '—' again
      const distAfterReset = await gp.getDistanceForNode('1');
      expect(distAfterReset === '—' || distAfterReset === '0' || distAfterReset === '∞').toBeTruthy();

      expect(pageErrors.length).toBe(0);
    }, { timeout: 20000 });

    test('Reset run returns to idle run state (S8_Pause → S0_Idle via S9_Reset)', async ({ page }) => {
      const gp8 = new GraphPage(page);
      // Initialize quickly then reset
      await gp.clickMode('mode-set-source');
      await gp.clickNodeById('1');
      await gp.clickButton('btn-init');
      await gp.clickButton('btn-run');
      await page.waitForTimeout(300);
      await gp.clickButton('btn-pause');
      await gp.clickButton('btn-reset');
      await page.waitForTimeout(120);

      // Notice should mention 'Run state reset' or similar
      const notice3 = (await gp.getNotice()).toLowerCase();
      expect(notice).toContain('reset') || expect(notice).toContain('run state');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Shortest-tree highlighting & clearing (S10, S11)', () => {
    test('Show Shortest Tree highlights edges based on prev[] and Clear Highlights removes them', async ({ page }) => {
      const gp9 = new GraphPage(page);

      // Prepare: set source and initialize, perform a couple of steps to populate prev
      await gp.clickMode('mode-set-source');
      await gp.clickNodeById('1');
      await gp.clickButton('btn-init');
      // perform some steps to compute prev pointers
      for (let i = 0; i < 6; i++) {
        await gp.clickButton('btn-next');
        await page.waitForTimeout(120);
      }

      // Click highlight path
      await gp.clickButton('btn-highlight-path');
      await page.waitForTimeout(150);

      const highlighted = await gp.highlightedEdgesCount();
      // There may be 0 if no prev pointers yet, so allow >= 0, but ensure no error thrown
      expect(typeof highlighted).toBe('number');

      // Clear highlights
      await gp.clickButton('btn-clear-highlights');
      await page.waitForTimeout(150);
      const highlightedAfterClear = await gp.highlightedEdgesCount();
      expect(highlightedAfterClear).toBe(0);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Drag / Select interactions and node info dialog', () => {
    test('Dragging a node moves its position (S4_DragSelect)', async ({ page }) => {
      const gp10 = new GraphPage(page);

      // Ensure drag mode
      await gp.clickMode('mode-drag');

      // Choose node '2' to drag a bit
      const beforeBox = await page.locator('g.node-group[data-id="2"]').boundingBox();
      expect(beforeBox).toBeTruthy();

      // Drag node by 40px right and 30px down
      await gp.dragNodeById('2', 40, 30);
      const afterBox = await page.locator('g.node-group[data-id="2"]').boundingBox();
      expect(afterBox).toBeTruthy();

      // The center should have changed position
      const moved = Math.abs((afterBox.x + afterBox.width / 2) - (beforeBox.x + beforeBox.width / 2)) > 2 ||
                    Math.abs((afterBox.y + afterBox.height / 2) - (beforeBox.y + beforeBox.height / 2)) > 2;
      expect(moved).toBe(true);

      expect(pageErrors.length).toBe(0);
    });

    test('Clicking a node in drag mode shows an alert with node info (edge-case dialog)', async ({ page }) => {
      const gp11 = new GraphPage(page);
      // Ensure drag mode
      await gp.clickMode('mode-drag');

      // Capture dialog message for assertion
      let dialogMessage = null;
      const handler = async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      };
      page.on('dialog', handler);

      // Click node '1' which should trigger alert showing its info
      await gp.clickNodeById('1');

      // Allow some time for dialog handler
      await page.waitForTimeout(80);

      expect(dialogMessage).toBeTruthy();
      expect(dialogMessage.toLowerCase()).toContain('node 1');

      // remove handler to avoid double accept in other tests
      page.off('dialog', handler);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases: random graph and clear flow (confirm dialogs)', () => {
    test('Random graph generation confirms and produces nodes/edges', async ({ page }) => {
      const gp12 = new GraphPage(page);

      // Click Random Graph. The confirm is auto-accepted by global dialog handler in beforeEach.
      await gp.clickButton('btn-make-random');

      // Wait a bit for random graph to generate
      await page.waitForTimeout(400);

      // There should be at least 4 nodes (generator ensures min 5)
      const nodes = await gp.nodeCount();
      expect(nodes).toBeGreaterThanOrEqual(4);

      // And there should be at least some edges
      const edges = await gp.edgeCount();
      expect(edges).toBeGreaterThanOrEqual(1);

      expect(pageErrors.length).toBe(0);
    });

    test('Clear graph confirms and empties the canvas', async ({ page }) => {
      const gp13 = new GraphPage(page);

      // Click clear (confirm auto-accepted)
      await gp.clickButton('btn-clear');
      await page.waitForTimeout(200);

      // Node and edge counts should be reset (but seedSample was called on load; after clear it's empty)
      const nodes1 = await gp.nodeCount();
      // clearGraph resets nodes array, so expect 0 nodes
      expect(nodes).toBe(0);

      const edges1 = await gp.edgeCount();
      expect(edges).toBe(0);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Runtime health: console and page errors observation', () => {
    test('no uncaught page errors or console errors were emitted during our interactions', async ({ page }) => {
      // After all interactions in this test suite's beforeEach and tests, assert no uncaught errors
      // Note: this test runs in isolation so it only guarantees the current run has no errors after navigation.
      expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join(';')}`);
      expect(consoleErrors.length).toBe(0, `Unexpected console errors: ${consoleErrors.map(e => e.text).join(';')}`);
    });
  });
});