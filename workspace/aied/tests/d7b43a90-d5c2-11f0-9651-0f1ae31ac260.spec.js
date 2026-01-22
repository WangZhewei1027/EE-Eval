import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b43a90-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object to encapsulate page interactions
class TopoPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      nodes: '#nodes',
      edges: '#edges',
      runBtn: '#run-btn',
      error: '#error',
      result: '#result',
      graph: '#graph',
      svg: 'svg',
      nodeGroup: 'g.node',
      nodeHighlight: 'g.node.highlight',
      edgeGroup: 'g.edge',
      edgeHighlight: 'g.edge.highlight'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setNodes(value) {
    await this.page.fill(this.selectors.nodes, value);
  }

  async setEdges(value) {
    await this.page.fill(this.selectors.edges, value);
  }

  async clickRun() {
    await this.page.click(this.selectors.runBtn);
  }

  async getErrorText() {
    return (await this.page.locator(this.selectors.error).textContent()) || '';
  }

  async getResultText() {
    return (await this.page.locator(this.selectors.result).textContent()) || '';
  }

  async hasSVG() {
    return await this.page.locator(this.selectors.graph + ' ' + this.selectors.svg).count() > 0;
  }

  async countNodesInSVG() {
    return await this.page.locator(this.selectors.svg + ' ' + this.selectors.nodeGroup).count();
  }

  async countHighlightedNodes() {
    return await this.page.locator(this.selectors.svg + ' ' + this.selectors.nodeHighlight).count();
  }

  async countEdgesInSVG() {
    return await this.page.locator(this.selectors.svg + ' ' + this.selectors.edgeGroup).count();
  }
}

test.describe.configure({ mode: 'serial' }); // use serial mode to reduce flaky timing issues for animation tests
test.describe('Topological Sort Visualization - FSM behavior and UI validations', () => {
  // Increase default timeout for tests that wait for animations
  test.slow();

  let consoleMsgs;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMsgs = [];
    pageErrors = [];

    // Capture console messages and page errors for each test
    page.on('console', msg => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test initial state S0_Idle: initialRender should run and draw the graph from prefilled inputs
  test('S0_Idle: initial render creates SVG graph and no error text', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Verify initialRender ran: graph SVG exists and node elements are present
    expect(await topo.hasSVG()).toBeTruthy();
    const nodeCount = await topo.countNodesInSVG();
    // Prefilled nodes in the HTML: A,B,C,D,E,F -> expect 6 nodes
    expect(nodeCount).toBeGreaterThanOrEqual(6);

    // Error div should be empty on successful initial render
    const errorText = await topo.getErrorText();
    expect(errorText).toBe('');

    // No runtime page errors or console errors should have occurred during initial render
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test transition: S0_Idle -> S1_Error when nodes textarea is empty
  test('Transition: Run with empty nodes shows "Please enter nodes." error (S1_Error)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Clear nodes to simulate missing nodes
    await topo.setNodes('');
    // Ensure edges have some value (not necessary), keep prefilled edges
    await topo.clickRun();

    // After clicking run, parseInput should set the error text
    await expect.poll(async () => await topo.getErrorText(), { timeout: 2000 }).toBe('Please enter nodes.');

    // Result should remain empty
    const result = await topo.getResultText();
    expect(result).toBe('');

    // No uncaught JS errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test duplicate nodes error
  test('Transition: Duplicate nodes detection shows "Duplicate nodes detected." (S1_Error)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Put duplicate nodes
    await topo.setNodes('A\nA\nB');
    // Clear edges to avoid additional parsing errors
    await topo.setEdges('');
    await topo.clickRun();

    await expect.poll(async () => await topo.getErrorText(), { timeout: 2000 }).toBe('Duplicate nodes detected.');
    expect(await topo.getResultText()).toBe('');

    // No console or page errors beyond expected application validation
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test invalid edge format handling
  test('Parse error: invalid edge format produces descriptive error (S1_Error)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    await topo.setNodes('A\nB');
    // Invalid edge format (should be from,to)
    await topo.setEdges('A-B');
    await topo.clickRun();

    await expect.poll(async () => await topo.getErrorText(), { timeout: 2000 }).toContain('Invalid edge format');
    expect(await topo.getResultText()).toBe('');
    expect(pageErrors.length).toBe(0);
  });

  // Test edge refers to a missing node
  test('Parse error: edge source/destination not in nodes list (S1_Error)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    await topo.setNodes('A\nB');
    // Edge refers to node C which is not in list
    await topo.setEdges('A,C');
    await topo.clickRun();

    await expect.poll(async () => await topo.getErrorText(), { timeout: 2000 }).toContain('not in nodes list');
    expect(await topo.getResultText()).toBe('');
    expect(pageErrors.length).toBe(0);
  });

  // Test cycle detection: S0_Idle -> S2_Sorting -> S1_Error (guard hasCycle)
  test('Cycle detection: clicking Run on a cyclic graph shows cycle error', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Create a simple 2-node cycle A->B and B->A
    await topo.setNodes('A\nB');
    await topo.setEdges('A,B\nB,A');
    await topo.clickRun();

    // The app should run topologicalSort and then display the cycle error
    await expect.poll(async () => await topo.getErrorText(), { timeout: 3000 }).toBe('Graph has at least one cycle. Topological sort not possible.');

    // Graph should still be drawn (layoutNodes and drawGraph called in error branch)
    expect(await topo.hasSVG()).toBeTruthy();
    const nodesInSVG = await topo.countNodesInSVG();
    expect(nodesInSVG).toBeGreaterThanOrEqual(2);

    // Result should be empty when a cycle exists
    expect(await topo.getResultText()).toBe('');

    expect(pageErrors.length).toBe(0);
  });

  // Test successful sort that triggers Sorting -> Animating -> Completed transitions
  test('Successful topological sort animates and completes with final result (S2_Sorting -> S3_Animating -> S4_Completed)', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Use the prefilled example by default (A..F), ensure we have that content
    const nodesValue = await page.$eval('#nodes', el => el.value);
    const edgesValue = await page.$eval('#edges', el => el.value);
    expect(nodesValue.trim().length).toBeGreaterThan(0);
    expect(edgesValue.trim().length).toBeGreaterThan(0);

    // Attach a short-lived observer of the resultDiv text to catch the "Animating ..." state
    await topo.clickRun();

    // Immediately after clicking, animateTopoSort sets resultDiv to "Animating topological order..."
    await expect.poll(async () => await topo.getResultText(), { timeout: 2000 }).toBe('Animating topological order...');

    // While animation is running, some nodes should become highlighted at some point.
    // Wait until at least one highlighted node appears (this confirms S3_Animating behavior)
    await expect.poll(async () => {
      return await topo.countHighlightedNodes();
    }, { timeout: 4000 }).toBeGreaterThan(0);

    // Wait for final completion: resultDiv should eventually contain "Topological order:"
    await expect.poll(async () => await topo.getResultText(), { timeout: 15000 }).toContain('Topological order:');

    // Validate the reported order matches topologicalSort computed in page context
    const finalResult = await topo.getResultText();
    // Extract the order string after the colon
    const reportedOrder = finalResult.replace(/^Topological order:\s*/, '').trim();

    const expectedOrder = await page.evaluate(() => {
      // Use the page's own topologicalSort function to compute expected order from current inputs
      const nodes = document.getElementById('nodes').value.trim().split('\n').map(s => s.trim()).filter(Boolean);
      const edges = document.getElementById('edges').value.trim().split('\n').filter(Boolean).map(line => {
        const [from, to] = line.split(',').map(s => s.trim());
        return [from, to];
      });
      const res = topologicalSort(nodes, edges);
      // join using arrow to match UI
      return res.order.join(' → ');
    });

    expect(reportedOrder).toBe(expectedOrder);

    // After completion, ensure graph still exists and nodes are present
    expect(await topo.hasSVG()).toBeTruthy();
    expect(await topo.countNodesInSVG()).toBeGreaterThanOrEqual(1);

    // No uncaught page errors occurred during the full run
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Additional regression test: ensure multiple quick runs do not throw runtime errors
  test('Multiple runs (quick successive clicks) do not produce unexpected runtime errors', async ({ page }) => {
    const topo = new TopoPage(page);
    await topo.goto();

    // Use a valid small DAG
    await topo.setNodes('X\nY\nZ');
    await topo.setEdges('X,Y\nY,Z');

    // Click run multiple times quickly
    await Promise.all([
      topo.clickRun(),
      topo.clickRun(),
      topo.clickRun()
    ]);

    // Wait for final result eventually
    await expect.poll(async () => await topo.getResultText(), { timeout: 10000 }).toContain('Topological order:');

    // Ensure no page errors or console errors occurred
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});