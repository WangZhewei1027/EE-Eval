import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d38b0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Undirected Graph Demo
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeInput = page.locator('#nodeInput');
    this.edgeInput = page.locator('#edgeInput');
    this.addNodeButton = page.locator('button[onclick="addNode()"]');
    this.addEdgeButton = page.locator('button[onclick="addEdge()"]');
    this.graph = page.locator('#graph');
    this.nodeSelector = this.graph.locator('.node');
    this.edgeSelector = this.graph.locator('.edge');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial renderGraph (S0_Idle) has completed by waiting for graph container
    await this.graph.waitFor({ state: 'attached' });
  }

  async addNode(value) {
    await this.nodeInput.fill(value);
    await this.addNodeButton.click();
  }

  async addEdge(value) {
    await this.edgeInput.fill(value);
    await this.addEdgeButton.click();
  }

  async getNodeCount() {
    return await this.nodeSelector.count();
  }

  async getNodeTexts() {
    const count = await this.nodeSelector.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.nodeSelector.nth(i).textContent()).trim());
    }
    return texts;
  }

  async getEdgeCount() {
    return await this.edgeSelector.count();
  }

  async getEdgeTexts() {
    const count1 = await this.edgeSelector.count1();
    const texts1 = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.edgeSelector.nth(i).textContent()).trim());
    }
    return texts;
  }

  async getNodeInputValue() {
    return await this.nodeInput.inputValue();
  }

  async getEdgeInputValue() {
    return await this.edgeInput.inputValue();
  }

  async graphInnerHTML() {
    return await this.graph.innerHTML();
  }
}

test.describe('Undirected Graph Demo - FSM states and interactions', () => {
  // Collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will set up its own listeners via the GraphPage helper
  });

  test.describe('S0_Idle (Initial state) validations', () => {
    test('Initial render shows header and empty graph container (S0_Idle)', async ({ page }) => {
      // Capture console and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const gp = new GraphPage(page);
      await gp.goto();

      // Validate presence of header and graph container (evidence in FSM)
      await expect(page.locator('h2')).toHaveText('Undirected Graph Visualization');
      await expect(gp.graph).toBeVisible();

      // Graph should be empty initially: no node elements, but an edges container may be present after renderGraph
      const nodeCount = await gp.getNodeCount();
      expect(nodeCount).toBe(0);

      const edgeCount = await gp.getEdgeCount();
      // edges container exists but since no edges added, count should be 0
      expect(edgeCount).toBe(0);

      // Ensure renderGraph created the DOM structure by checking innerHTML exists (non-null string)
      const html = await gp.graphInnerHTML();
      expect(typeof html).toBe('string');

      // Assert there were no page errors and no console errors during initial render
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('S1_NodeAdded transitions and behaviors', () => {
    test('Add a single node: Node is added, input cleared, graph re-rendered (S0 -> S1)', async ({ page }) => {
      const consoleMessages1 = [];
      const pageErrors1 = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const gp1 = new GraphPage(page);
      await gp.goto();

      // Add node "A"
      await gp.addNode('A');

      // After adding, node element should appear
      await expect(gp.nodeSelector.first()).toHaveText('A');
      expect(await gp.getNodeCount()).toBe(1);

      // Input should be cleared per FSM evidence
      expect(await gp.getNodeInputValue()).toBe('');

      // Graph should have been re-rendered (presence of node demonstrates renderGraph ran)
      const nodeTexts = await gp.getNodeTexts();
      expect(nodeTexts).toContain('A');

      // No console errors or page errors
      const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Adding duplicate node does not create duplicate elements (Set behavior)', async ({ page }) => {
      const consoleMessages2 = [];
      const pageErrors2 = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const gp2 = new GraphPage(page);
      await gp.goto();

      await gp.addNode('B');
      // Add 'B' again
      await gp.addNode('B');

      // Should still be only one 'B' in DOM
      const nodeTexts1 = await gp.getNodeTexts();
      const occurrences = nodeTexts.filter(t => t === 'B').length;
      expect(occurrences).toBe(1);
      expect(await gp.getNodeCount()).toBe(1);

      // No console/page errors
      const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Adding empty or whitespace-only node does nothing (edge case)', async ({ page }) => {
      const consoleMessages3 = [];
      const pageErrors3 = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const gp3 = new GraphPage(page);
      await gp.goto();

      // Initial node count
      expect(await gp.getNodeCount()).toBe(0);

      // Try adding empty string
      await gp.addNode('');
      expect(await gp.getNodeCount()).toBe(0);

      // Try adding whitespace
      await gp.addNode('   ');
      expect(await gp.getNodeCount()).toBe(0);

      // No console/page errors expected
      const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('S2_EdgeAdded transitions and behaviors', () => {
    test('Add edge when nodes exist: edges are added in both directions and input cleared (S0 -> S2)', async ({ page }) => {
      const consoleMessages4 = [];
      const pageErrors4 = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const gp4 = new GraphPage(page);
      await gp.goto();

      // Ensure nodes A and B exist first
      await gp.addNode('A');
      await gp.addNode('B');

      expect(await gp.getNodeCount()).toBe(2);
      const nodes = await gp.getNodeTexts();
      expect(nodes).toEqual(expect.arrayContaining(['A', 'B']));

      // Add edge A-B
      await gp.addEdge('A-B');

      // Edge input should be cleared
      expect(await gp.getEdgeInputValue()).toBe('');

      // Two edge entries should be present for undirected graph: "A - B" and "B - A"
      const edgeTexts = await gp.getEdgeTexts();
      expect(edgeTexts).toEqual(expect.arrayContaining(['A - B', 'B - A']));
      expect(await gp.getEdgeCount()).toBeGreaterThanOrEqual(2);

      // No console/page errors
      const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Attempt to add edge when nodes do NOT exist triggers alert and does not add edge (edge case)', async ({ page }) => {
      const consoleMessages5 = [];
      const pageErrors5 = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const gp5 = new GraphPage(page);
      await gp.goto();

      // Ensure no nodes exist
      expect(await gp.getNodeCount()).toBe(0);

      // Intercept the dialog to capture the alert text
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      // Try adding an edge when nodes missing
      await gp.addEdge('X-Y');

      // Expect the alert message to indicate both nodes must exist
      expect(dialogMessage).toMatch(/Both nodes must exist/i);

      // Ensure no edges added
      expect(await gp.getEdgeCount()).toBe(0);

      // No page errors
      const consoleErrors5 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Malformed edge input without hyphen does nothing (edge case)', async ({ page }) => {
      const consoleMessages6 = [];
      const pageErrors6 = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const gp6 = new GraphPage(page);
      await gp.goto();

      // Add nodes required
      await gp.addNode('C');
      await gp.addNode('D');

      // Provide malformed edge input
      await gp.addEdge('CD'); // no hyphen

      // No edges should be added
      expect(await gp.getEdgeCount()).toBe(0);

      // Edge input should remain unchanged because addEdge only clears on success
      expect(await gp.getEdgeInputValue()).toBe('CD');

      // No page errors or console errors
      const consoleErrors6 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Comprehensive transition sequences (integration)', () => {
    test('Sequence: Idle -> Add A (S1) -> Add B (S0) -> Add Edge A-B (S2) -> Add Edge again re-renders (S0)', async ({ page }) => {
      const consoleMessages7 = [];
      const pageErrors7 = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const gp7 = new GraphPage(page);
      await gp.goto();

      // S0 -> S1: Add node A
      await gp.addNode('A');
      expect((await gp.getNodeTexts())).toContain('A');

      // S1 -> S0: Add node B (ensures re-render and return to Idle)
      await gp.addNode('B');
      const nodesAfter = await gp.getNodeTexts();
      expect(nodesAfter).toEqual(expect.arrayContaining(['A', 'B']));
      expect(await gp.getNodeCount()).toBe(2);

      // S0 -> S2: Add edge A-B
      await gp.addEdge('A-B');
      const edgesAfter = await gp.getEdgeTexts();
      expect(edgesAfter).toEqual(expect.arrayContaining(['A - B', 'B - A']));

      // S2 -> S0: Add another edge that already exists to ensure renderGraph is invoked and no duplicates beyond Set semantics
      await gp.addEdge('A-B');
      // still only single pair entries in the Set rendering; at least two entries should exist
      const edgesFinal = await gp.getEdgeTexts();
      // Confirm presence and that no unexpected runtime errors occurred
      expect(edgesFinal).toEqual(expect.arrayContaining(['A - B', 'B - A']));

      // Verify no page errors or console error messages
      const consoleErrors7 = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});