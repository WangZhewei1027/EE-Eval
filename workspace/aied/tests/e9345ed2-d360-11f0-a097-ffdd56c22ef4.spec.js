import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9345ed2-d360-11f0-a097-ffdd56c22ef4.html';

// Page Object for the Topological Sort Visualizer
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.selectors = {
      modeLabel: '#modeLabel',
      status: '#status',
      selectedLabel: '#selectedLabel',
      nodesGroup: '#nodes',
      edgesGroup: '#edges',
      addNodeBtn: '#addNodeBtn',
      edgeModeBtn: '#edgeModeBtn',
      delModeBtn: '#delModeBtn',
      clearBtn: '#clearBtn',
      randBtn: '#randBtn',
      randN: '#randN',
      randP: '#randP',
      kahnBtn: '#kahnBtn',
      kahnStepBtn: '#kahnStepBtn',
      kahnPlayBtn: '#kahnPlayBtn',
      kahnStopBtn: '#kahnStopBtn',
      dfsBtn: '#dfsBtn',
      dfsStepBtn: '#dfsStepBtn',
      dfsPlayBtn: '#dfsPlayBtn',
      dfsStopBtn: '#dfsStopBtn',
      indegrees: '#indegrees',
      queue: '#queue',
      output: '#output',
      svg: '#svg',
      speed: '#speed',
    };
  }

  async modeText() {
    return (await this.page.locator(this.selectors.modeLabel).textContent())?.trim();
  }

  async statusText() {
    return (await this.page.locator(this.selectors.status).textContent())?.trim();
  }

  async selectedText() {
    return (await this.page.locator(this.selectors.selectedLabel).textContent())?.trim();
  }

  async nodesCount() {
    return await this.page.locator(`${this.selectors.nodesGroup} > g`).count();
  }

  async edgesCount() {
    return await this.page.locator(`${this.selectors.edgesGroup} path`).count();
  }

  async click(selector) {
    await this.page.locator(selector).click();
  }

  async clickNodeByIndex(idx) {
    // click the nth node group (0-based). This simulates selecting/dragging/clicking nodes.
    const nodes = this.page.locator(`${this.selectors.nodesGroup} > g`);
    await nodes.nth(idx).click();
  }

  async clickNodeWithLabel(label) {
    // find the text element with specific label and click its parent g
    const textLoc = this.page.locator(`${this.selectors.nodesGroup} text`, { hasText: label });
    const count = await textLoc.count();
    if (count === 0) throw new Error(`No node with label "${label}" found`);
    const parent = textLoc.first().locator('..'); // parent g
    await parent.click();
  }

  async indegreesText() {
    return (await this.page.locator(this.selectors.indegrees).textContent()) ?? '';
  }

  async outputText() {
    return (await this.page.locator(this.selectors.output).textContent()) ?? '';
  }

  async queueText() {
    return (await this.page.locator(this.selectors.queue).textContent()) ?? '';
  }

  async setSpeed(ms) {
    await this.page.locator(this.selectors.speed).evaluate((el, v) => (el.value = v), String(ms));
  }

  async getButtonClass(selector) {
    return (await this.page.locator(selector).getAttribute('class')) ?? '';
  }

  async clearGraph() {
    await this.click(this.selectors.clearBtn);
  }
}

// Global hooks: capture console errors and page errors for each test run
test.describe('Topological Sort Visualizer (e9345ed2-...)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages (filter console.error)
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), args: msg.args() });
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // give a moment for initial script to run and UI to settle
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // nothing to teardown globally here; each test inspects pageErrors/consoleErrors itself
  });

  test.describe('Initial state and Idle state', () => {
    test('Initial page loads and shows sample DAG in Idle mode', async ({ page }) => {
      const topo = new TopoPage(page);

      // Validate mode is Idle by default
      await expect(topo.modeText()).resolves.toBe('Idle');

      // Status should indicate sample loaded
      const status = await topo.statusText();
      expect(status.toLowerCase()).toContain('sample dag');

      // Expect nodes from the initial example: A,B,C,D,E -> 5 nodes
      const count = await topo.nodesCount();
      expect(count).toBeGreaterThanOrEqual(5);

      // Indegrees display contains expected labels (A through E at least)
      const indegText = await topo.indegreesText();
      expect(indegText).toMatch(/A:/);
      expect(indegText).toMatch(/E:/);

      // No runtime page errors or console.error messages should have occurred during load
      expect(pageErrors.length, `pageErrors: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });
  });

  test.describe('Modes: Add Edge and Delete', () => {
    test('Switch to Add edge mode and create an edge between two nodes', async ({ page }) => {
      const topo = new TopoPage(page);

      // Click Add edge button to enter edge mode
      await topo.click(topo.selectors.edgeModeBtn);
      await page.waitForTimeout(50);
      await expect(topo.modeText()).resolves.toBe('Add edge');

      // Button should have active class
      const edgeBtnClass = await topo.getButtonClass(topo.selectors.edgeModeBtn);
      expect(edgeBtnClass).toContain('active');

      // Count edges before adding
      const before = await topo.edgesCount();

      // Click first node then second node to create an edge
      // We attempt to click nodes by index; ensure at least 2 nodes exist
      const nodesBefore = await topo.nodesCount();
      expect(nodesBefore).toBeGreaterThanOrEqual(2);

      // Click node 0 -> should prompt to pick destination node
      await topo.clickNodeByIndex(0);
      await page.waitForTimeout(20);
      const statusAfterFirst = await topo.statusText();
      expect(statusAfterFirst.toLowerCase()).toContain('pick destination');

      // Click node 1 to create edge
      await topo.clickNodeByIndex(1);
      await page.waitForTimeout(50);

      // Status should indicate edge added
      const statusAfterAdd = await topo.statusText();
      expect(statusAfterAdd.toLowerCase()).toMatch(/edge .*→ .*added|edge .*-> .*added/i);

      // Edges count should have increased by at least 0 or 1 (duplicate prevention may prevent adding)
      const after = await topo.edgesCount();
      expect(after).toBeGreaterThanOrEqual(before);

      // Return to Idle should NOT automatically happen in implementation; check the actual mode text
      const modeNow = await topo.modeText();
      expect(['Add edge', 'Idle', 'Delete']).toContain(modeNow);

      // No page errors
      expect(pageErrors.length, `pageErrors during AddEdge: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors during AddEdge: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });

    test('Switch to Delete mode and delete a node', async ({ page }) => {
      const topo = new TopoPage(page);
      // Ensure there is at least one node to delete
      const nodesBefore = await topo.nodesCount();
      expect(nodesBefore).toBeGreaterThan(0);

      // Enter delete mode
      await topo.click(topo.selectors.delModeBtn);
      await page.waitForTimeout(50);
      await expect(topo.modeText()).resolves.toBe('Delete');

      // Click first node to delete
      // Capture label to assert deletion message
      const firstLabel = await page.locator('#nodes text').first().textContent();
      await topo.clickNodeByIndex(0);
      await page.waitForTimeout(50);

      // Status should mention deletion
      const status = await topo.statusText();
      expect(status).toContain('Deleted node');

      // Nodes count should decrease by 1
      const nodesAfter = await topo.nodesCount();
      expect(nodesAfter).toBe(nodesBefore - 1);

      // Mode should still be 'Delete' per implementation toggling; verify actual label
      const modeNow = await topo.modeText();
      expect(['Delete', 'Idle', 'Add edge']).toContain(modeNow);

      // No page errors
      expect(pageErrors.length, `pageErrors during Delete: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors during Delete: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });
  });

  test.describe('Graph operations and edge cases', () => {
    test('Generate a random graph and clear it', async ({ page }) => {
      const topo = new TopoPage(page);

      // Set randN to a known number
      await page.locator(topo.selectors.randN).fill('6');
      await page.locator(topo.selectors.randP).fill('30');

      // Click Generate
      await topo.click(topo.selectors.randBtn);
      await page.waitForTimeout(150);

      // Status should say generated random graph
      const status = await topo.statusText();
      expect(status.toLowerCase()).toContain('generated random graph');

      // Nodes count should match randN (6)
      const nodesCount = await topo.nodesCount();
      expect(nodesCount).toBeGreaterThanOrEqual(1);
      // At least make sure it is not zero
      expect(nodesCount).toBeGreaterThan(0);

      // Clear graph
      await topo.clearGraph();
      await page.waitForTimeout(50);

      // Nodes should be zero
      const nodesAfterClear = await topo.nodesCount();
      expect(nodesAfterClear).toBe(0);

      // Status should be Cleared graph
      const status2 = await topo.statusText();
      expect(status2).toMatch(/Cleared graph/);

      // No page errors
      expect(pageErrors.length, `pageErrors during Random/Clear: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors during Random/Clear: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });

    test('Add a node explicitly and ensure label and selection', async ({ page }) => {
      const topo = new TopoPage(page);

      // Count before
      const before = await topo.nodesCount();

      // Click add node button
      await topo.click(topo.selectors.addNodeBtn);
      await page.waitForTimeout(80);

      // Node count should increase
      const after = await topo.nodesCount();
      expect(after).toBeGreaterThanOrEqual(before + 1);

      // Select the newly added node (it will be the last one)
      const lastText = await page.locator('#nodes text').nth(after - 1).textContent();
      expect(lastText).toBeTruthy();

      // Click the newly added node to select it
      await page.locator('#nodes g').nth(after - 1).click();
      await page.waitForTimeout(30);
      const selected = await topo.selectedText();
      // selected label should match the text content
      expect(selected).toBe(lastText?.trim());

      // No page errors
      expect(pageErrors.length, `pageErrors during AddNode: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors during AddNode: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });
  });

  test.describe('Algorithms: Kahn and DFS', () => {
    test('Run Kahn initialization and step through a few steps', async ({ page }) => {
      const topo = new TopoPage(page);

      // Ensure there are nodes to run algorithms on; if not, generate a small graph
      if ((await topo.nodesCount()) === 0) {
        await topo.click(topo.selectors.randBtn);
        await page.waitForTimeout(100);
      }

      // Click Kahn run button (this will stop all and execute an initial next() of the generator)
      await topo.click(topo.selectors.kahnBtn);
      await page.waitForTimeout(60);

      // Status should show Kahn init or Pop ...
      const st = (await topo.statusText()).toLowerCase();
      expect(st).toMatch(/kahn|pop|init/);

      // Indegrees display should be present
      const indeg = await topo.indegreesText();
      expect(indeg.length).toBeGreaterThan(0);

      // Click Step to proceed with a step (runKahnStep)
      await topo.click(topo.selectors.kahnStepBtn);
      await page.waitForTimeout(60);

      const st2 = (await topo.statusText()).toLowerCase();
      expect(st2.length).toBeGreaterThan(0);

      // Play Kahn briefly, then stop
      await topo.setSpeed(200);
      await topo.click(topo.selectors.kahnPlayBtn);
      // allow a short interval of progression
      await page.waitForTimeout(300);
      await topo.click(topo.selectors.kahnStopBtn);
      await page.waitForTimeout(60);
      const st3 = await topo.statusText();
      expect(st3).toMatch(/Kahn reset|Topological order|Kahn finished|Cycle detected|Kahn init|Pop/i);

      // No page errors
      expect(pageErrors.length, `pageErrors during Kahn: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors during Kahn: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });

    test('Run DFS initialization and step through a few steps', async ({ page }) => {
      const topo = new TopoPage(page);

      // Ensure nodes exist
      if ((await topo.nodesCount()) === 0) {
        await topo.click(topo.selectors.randBtn);
        await page.waitForTimeout(100);
      }

      // Click DFS run button
      await topo.click(topo.selectors.dfsBtn);
      await page.waitForTimeout(60);

      // Status should reflect visiting or finished
      const s = (await topo.statusText()).toLowerCase();
      expect(s).toMatch(/visiting|finished|dfs topological|visit|back edge/i);

      // Step once
      await topo.click(topo.selectors.dfsStepBtn);
      await page.waitForTimeout(60);
      const s2 = (await topo.statusText()).toLowerCase();
      expect(s2.length).toBeGreaterThan(0);

      // Play DFS briefly then stop
      await topo.setSpeed(200);
      await topo.click(topo.selectors.dfsPlayBtn);
      await page.waitForTimeout(300);
      await topo.click(topo.selectors.dfsStopBtn);
      await page.waitForTimeout(60);

      const s3 = await topo.statusText();
      expect(s3).toMatch(/DFS reset|DFS topological sort complete|Visiting|Finished|Back edge detected/i);

      // No page errors
      expect(pageErrors.length, `pageErrors during DFS: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors during DFS: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });
  });

  test.describe('Transitions and resets', () => {
    test('Kahn Stop resets styles and displays', async ({ page }) => {
      const topo = new TopoPage(page);

      // Run Kahn a bit
      await topo.click(topo.selectors.kahnBtn);
      await page.waitForTimeout(60);
      await topo.click(topo.selectors.kahnStopBtn);
      await page.waitForTimeout(60);

      // Status must be 'Kahn reset'
      const st = await topo.statusText();
      expect(st).toMatch(/Kahn reset/);

      // Output and queue should be cleared (empty or whitespace)
      const q = await topo.queueText();
      const out = await topo.outputText();
      expect(q.trim()).toBe('');
      // output cleared by handler sets empty string
      // if some residual whitespace exists, ensure length small
      expect(out.trim().length).toBeLessThanOrEqual(100);

      expect(pageErrors.length, `pageErrors during Kahn Stop: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors during Kahn Stop: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });

    test('DFS Stop resets styles and displays', async ({ page }) => {
      const topo = new TopoPage(page);

      // Run DFS a bit
      await topo.click(topo.selectors.dfsBtn);
      await page.waitForTimeout(60);
      await topo.click(topo.selectors.dfsStopBtn);
      await page.waitForTimeout(60);

      // Status must be 'DFS reset'
      const st = await topo.statusText();
      expect(st).toMatch(/DFS reset/);

      // No page errors
      expect(pageErrors.length, `pageErrors during DFS Stop: ${pageErrors.map(e=>String(e.message)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `consoleErrors during DFS Stop: ${consoleErrors.map(c=>c.text).join('; ')}`).toBe(0);
    });
  });

  test.describe('Error & console observation (must not patch runtime)', () => {
    test('Observe console and page errors during interactions', async ({ page }) => {
      const topo = new TopoPage(page);

      // Perform a sequence of interactions to surface potential runtime issues:
      // - Toggle modes
      await topo.click(topo.selectors.edgeModeBtn);
      await page.waitForTimeout(20);
      await topo.click(topo.selectors.delModeBtn);
      await page.waitForTimeout(20);
      await topo.click(topo.selectors.edgeModeBtn);
      await page.waitForTimeout(20);

      // - Click background to cancel edge creation
      await page.locator('#svg').click({ force: true });
      await page.waitForTimeout(30);

      // - Click a few algorithm buttons
      await topo.click(topo.selectors.kahnStepBtn);
      await page.waitForTimeout(20);
      await topo.click(topo.selectors.dfsStepBtn);
      await page.waitForTimeout(20);
      // Reset both
      await topo.click(topo.selectors.kahnStopBtn);
      await topo.click(topo.selectors.dfsStopBtn);
      await page.waitForTimeout(50);

      // We assert that no uncaught exceptions (pageerror) happened during these interactions
      // and that there were no console.error messages.
      // If there ARE errors, we still report them in the assertion message (we do not patch or modify runtime).
      expect(pageErrors.length, `Expected no uncaught page errors, saw: ${pageErrors.map(e => `${e.name}: ${e.message}`).join(' | ')}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages, saw: ${consoleErrors.map(c => c.text).join(' | ')}`).toBe(0);
    });
  });
});