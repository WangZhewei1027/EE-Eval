import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e19391-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object to encapsulate interactions with the graph app
class GraphPage {
  constructor(page) {
    this.page = page;
    this.addNodeBtn = page.locator('#addNodeBtn');
    this.addEdgeBtn = page.locator('#addEdgeBtn');
    this.removeNodeBtn = page.locator('#removeNodeBtn');
    this.removeEdgeBtn = page.locator('#removeEdgeBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.toggleDirBtn = page.locator('#toggleDir');
    this.randomBtn = page.locator('#randomBtn');
    this.autoLayoutBtn = page.locator('#autoLayoutBtn');
    this.bfsBtn = page.locator('#bfsBtn');
    this.dfsBtn = page.locator('#dfsBtn');

    this.nodeNameInput = page.locator('#nodeName');
    this.edgeWeightInput = page.locator('#edgeWeight');

    this.fromSelect = page.locator('#fromSelect');
    this.toSelect = page.locator('#toSelect');
    this.startSelect = page.locator('#startSelect');

    this.adjList = page.locator('#adjList');
    this.svg = page.locator('#svg');
  }

  // Adds a node with the provided label (empty string uses auto-labeling)
  async addNode(label) {
    if (label !== undefined) {
      await this.nodeNameInput.fill(label);
    } else {
      await this.nodeNameInput.fill('');
    }
    await this.addNodeBtn.click();
  }

  // Adds an edge; if weight omitted, pass empty string
  async addEdge(fromValue, toValue, weight = '') {
    await this.fromSelect.selectOption(fromValue);
    await this.toSelect.selectOption(toValue);
    await this.edgeWeightInput.fill(weight);
    await this.addEdgeBtn.click();
  }

  // Remove edge (will trigger alert if endpoints not chosen)
  async removeEdge(fromValue, toValue) {
    if (fromValue) await this.fromSelect.selectOption(fromValue);
    if (toValue) await this.toSelect.selectOption(toValue);
    await this.removeEdgeBtn.click();
  }

  // Remove node - will show confirm; test should handle dialog
  async removeNode(nodeValue) {
    if (nodeValue) {
      // put the value into a select so the UI picks it up
      await this.fromSelect.selectOption(nodeValue);
    }
    await this.removeNodeBtn.click();
  }

  // Toggle directed button
  async toggleDirected() {
    await this.toggleDirBtn.click();
  }

  // Clear graph - will show confirm
  async clearGraph() {
    await this.clearBtn.click();
  }

  async randomGraph() {
    await this.randomBtn.click();
  }

  async relayout() {
    await this.autoLayoutBtn.click();
  }

  async executeBFS() {
    await this.bfsBtn.click();
  }

  async executeDFS() {
    await this.dfsBtn.click();
  }

  // Utility to fetch select options values (excluding placeholder)
  async getSelectOptions(selectLocator) {
    const values = await selectLocator.locator('option').allTextContents();
    // return option values (text content) and also values via evaluating
    const opts = await selectLocator.evaluate((sel) => {
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.textContent }));
    });
    return opts;
  }

  // Read adjacency list text
  async getAdjListText() {
    return (await this.adjList.textContent()) || '';
  }

  // Count svg node groups (each node is a g element containing a circle and text)
  async getSvgNodeCount() {
    return await this.svg.locator('g').count();
  }

  // Return array of node labels rendered in SVG (text elements with class nodeLabel)
  async getSvgNodeLabels() {
    return await this.svg.locator('text.nodeLabel').allTextContents();
  }

  // Return array of edge weight labels present in SVG (text.edgeWeight)
  async getSvgEdgeWeights() {
    return await this.svg.locator('text.edgeWeight').allTextContents();
  }

  // Return the text content of toggle button (Directed: ON/OFF)
  async getToggleText() {
    return (await this.toggleDirBtn.textContent()) || '';
  }

  // Helper to evaluate bfs/dfs in page context
  async evalBFS(startId) {
    return await this.page.evaluate((s) => {
      // BFS function defined in page; return its result
      try {
        return bfs(s);
      } catch (e) {
        return { error: String(e) };
      }
    }, startId);
  }

  async evalDFS(startId) {
    return await this.page.evaluate((s) => {
      try {
        return dfs(s);
      } catch (e) {
        return { error: String(e) };
      }
    }, startId);
  }
}

test.describe('Adjacency List — Interactive Demo (FSM validations)', () => {
  let graph;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.text()}`);
      }
    });

    // Collect uncaught page errors (these are serious)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait for svg to appear and initial seed to complete
    await page.waitForSelector('#svg');
    graph = new GraphPage(page);

    // ensure the seeded graph finished rendering
    await graph.page.waitForTimeout(200); // small wait for UI wiring/initial draw
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors or console errors during the test
    expect(pageErrors, `Expected no page errors, but found: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(consoleErrors, `Expected no console.error messages, but found: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Initial state (S0_Idle): seeded graph is present and adjacency list rendered', async () => {
    // Validate initial seeded nodes A..E exist in the adjacency list and selects
    const adjText = await graph.getAdjListText();
    expect(adjText).toContain('n1'); // first node id
    expect(adjText).toContain('A'); // seeded label
    // ensure selects contain options corresponding to nodes
    const fromOpts = await graph.getSelectOptions(graph.fromSelect);
    // first actual option is placeholder; ensure there are nodes present
    expect(fromOpts.length).toBeGreaterThan(1);
    // ensure svg nodes render with labels
    const svgLabels = await graph.getSvgNodeLabels();
    expect(svgLabels).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D', 'E']));
  });

  test('Add Node (S1_NodeAdded): can add a new node and it appears in UI', async () => {
    // Add a uniquely-named node and verify it's in selects and adjacency list
    const newLabel = 'TEST_NODE';
    await graph.addNode(newLabel);

    // wait for UI to refresh
    await graph.page.waitForTimeout(150);

    const adjText = await graph.getAdjListText();
    expect(adjText).toContain('TEST_NODE');

    const svgLabels = await graph.getSvgNodeLabels();
    expect(svgLabels).toContain('TEST_NODE');

    const fromOpts = await graph.getSelectOptions(graph.fromSelect);
    const values = fromOpts.map(o => o.value).filter(v => v);
    expect(values.length).toBeGreaterThan(5); // at least one added
  });

  test('Add Edge (S2_EdgeAdded): adding an edge updates adjacency list and SVG shows weight', async () => {
    // Add two nodes to ensure we have endpoints
    await graph.addNode('EdgeA');
    await graph.addNode('EdgeB');
    await graph.page.waitForTimeout(100);

    // get option values to use
    const opts = await graph.getSelectOptions(graph.fromSelect);
    // pick last two non-empty options
    const nodeOpts = opts.filter(o => o.value);
    const a = nodeOpts[nodeOpts.length - 2].value;
    const b = nodeOpts[nodeOpts.length - 1].value;

    // Add edge with weight
    await graph.addEdge(a, b, '7');

    await graph.page.waitForTimeout(150);

    const adjText = await graph.getAdjListText();
    // adjacency list should include an edge entry with weight 7 or show the 'to' id
    // check the 'from' node line contains the 'to' id or weight text
    expect(adjText).toContain(a);
    // check edge weight present in svg as text label
    const edgeWeights = await graph.getSvgEdgeWeights();
    expect(edgeWeights.some(w => w.trim() === '7')).toBeTruthy();
  });

  test('Add Edge error scenario: clicking Add Edge without endpoints triggers alert', async ({ page }) => {
    // Clear any selects (select placeholder) and try to add edge -> should raise alert
    // Listen for dialog
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Ensure selects are on placeholder
    await graph.fromSelect.selectOption('');
    await graph.toSelect.selectOption('');
    // Click addEdgeBtn which has guard to alert if endpoints missing
    await graph.addEdge('', '', '');

    // wait a tick for dialog to fire
    await page.waitForTimeout(50);

    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[0].message).toContain('Choose both endpoints');
  });

  test('Remove Edge (S4_EdgeRemoved): removing an existing edge updates adjacency list', async () => {
    // Setup: add two nodes and an edge, then remove it
    await graph.addNode('RemA');
    await graph.addNode('RemB');
    await graph.page.waitForTimeout(100);

    const opts = await graph.getSelectOptions(graph.fromSelect);
    const nodeOpts = opts.filter(o => o.value);
    const fromId = nodeOpts[nodeOpts.length - 2].value;
    const toId = nodeOpts[nodeOpts.length - 1].value;

    // Add an edge
    await graph.addEdge(fromId, toId, '3');
    await graph.page.waitForTimeout(100);
    let adjText = await graph.getAdjListText();
    expect(adjText).toContain(fromId);

    // Now remove the edge
    await graph.removeEdge(fromId, toId);
    await graph.page.waitForTimeout(100);
    adjText = await graph.getAdjListText();
    // adjacency list should no longer show the connection (weight text removed likely)
    // Check that the 'to' id no longer appears in the fromId's adjacency entry by evaluating adj map
    const exists = await graph.page.evaluate((f, t) => {
      if (!adj.has(f)) return false;
      return adj.get(f).some(e => e.to === t);
    }, fromId, toId);
    expect(exists).toBe(false);
  });

  test('Remove Node (S3_NodeRemoved): removing a node removes it from selects and adjacency', async ({ page }) => {
    // Add a node and then remove it via UI which triggers confirm
    await graph.addNode('DeleteMe');
    await graph.page.waitForTimeout(100);

    // Find the id of the added node by searching select options for text 'DeleteMe'
    const opts = await graph.getSelectOptions(graph.fromSelect);
    const found = opts.find(o => o.text && o.text.includes('DeleteMe'));
    expect(found).toBeTruthy();
    const nodeId = found.value;

    // handle dialog confirm
    page.once('dialog', async (dialog) => {
      // confirm dialog for removal; accept it
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Remove node');
      await dialog.accept();
    });

    // Trigger remove node
    await graph.removeNode(nodeId);
    await graph.page.waitForTimeout(150);

    // Ensure the node no longer appears in selects
    const newOpts = await graph.getSelectOptions(graph.fromSelect);
    const present = newOpts.some(o => o.value === nodeId);
    expect(present).toBe(false);

    // Ensure adjacency map doesn't contain it
    const inAdj = await graph.page.evaluate((id) => {
      return adj.has(id);
    }, nodeId);
    expect(inAdj).toBe(false);
  });

  test('Clear Graph (S5_GraphCleared): clear button empties the graph after confirmation', async ({ page }) => {
    // Click clear and accept confirm
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    await graph.clearGraph();
    // wait for UI update
    await graph.page.waitForTimeout(150);

    const adjText = await graph.getAdjListText();
    expect(adjText.trim()).toBe('(graph is empty)');

    // selects should have only placeholder options
    const fromOpts = await graph.getSelectOptions(graph.fromSelect);
    // there should be exactly 1 option: the placeholder
    expect(fromOpts.length).toBeLessThanOrEqual(1);
    // svg should have no node groups (only defs maybe)
    const nodeCount = await graph.getSvgNodeCount();
    // If defs are represented as a node g, still ensure nodeCount is small
    expect(nodeCount).toBeLessThanOrEqual(1);
  });

  test('Toggle Directed (S6_DirectedToggled): toggles button text and updates internal directed flag', async () => {
    // initial state is Directed: OFF
    let text = await graph.getToggleText();
    expect(text).toContain('Directed: OFF');

    // toggle to ON
    await graph.toggleDirected();
    await graph.page.waitForTimeout(50);
    text = await graph.getToggleText();
    expect(text).toContain('Directed: ON');

    // toggle back to OFF
    await graph.toggleDirected();
    await graph.page.waitForTimeout(50);
    text = await graph.getToggleText();
    expect(text).toContain('Directed: OFF');

    // verify that the page-level variable 'directed' corresponds (via page.evaluate)
    const directedFlag = await graph.page.evaluate(() => directed);
    expect(directedFlag).toBe(false);
  });

  test('Generate Random Graph (S7_RandomGraphGenerated): random graph populates selects and adjacency', async () => {
    // perform random graph generation
    await graph.randomGraph();
    // wait for generation
    await graph.page.waitForTimeout(300);

    const adjText = await graph.getAdjListText();
    // Should not be empty and should not be (graph is empty)
    expect(adjText.trim()).not.toBe('(graph is empty)');
    // selects should contain multiple options now
    const fromOpts = await graph.getSelectOptions(graph.fromSelect);
    expect(fromOpts.length).toBeGreaterThan(1);
  });

  test('Update Layout (S8_LayoutUpdated): re-layout modifies node transforms', async () => {
    // Ensure there is a multi-node graph; if empty, generate random graph
    let fromOpts = await graph.getSelectOptions(graph.fromSelect);
    if (fromOpts.length <= 1) {
      await graph.randomGraph();
      await graph.page.waitForTimeout(200);
      fromOpts = await graph.getSelectOptions(graph.fromSelect);
    }

    // capture current transforms of first two node g elements
    const transformsBefore = await graph.page.evaluate(() => {
      const gs = Array.from(document.querySelectorAll('#svg g'));
      return gs.slice(0, 3).map(g => g.getAttribute('transform'));
    });

    // trigger relayout
    await graph.relayout();
    await graph.page.waitForTimeout(120);

    const transformsAfter = await graph.page.evaluate(() => {
      const gs = Array.from(document.querySelectorAll('#svg g'));
      return gs.slice(0, 3).map(g => g.getAttribute('transform'));
    });

    // At least one transform should have changed (layoutNodes rearranges coordinates)
    const changed = transformsBefore.some((t, i) => t !== transformsAfter[i]);
    expect(changed).toBeTruthy();
  });

  test('Execute BFS and DFS (S9_BFSExecuted & S10_DFSExecuted): traversal functions produce expected orders and UI guards when no start selected', async ({ page }) => {
    // If graph empty, create a small deterministic graph to test traversals
    await graph.clearGraph();
    // accept confirm
    page.once('dialog', async (d) => d.accept());
    await graph.page.waitForTimeout(50);

    // build a simple chain A->B->C
    await graph.addNode('T1');
    await graph.addNode('T2');
    await graph.addNode('T3');
    await graph.page.waitForTimeout(100);
    const opts = await graph.getSelectOptions(graph.fromSelect);
    const nodeVals = opts.filter(o => o.value).map(o => o.value);
    const [n1, n2, n3] = nodeVals.slice(-3);
    // Make directed edges
    // Ensure directed mode ON to avoid symmetric duplication
    const dirTextBefore = await graph.getToggleText();
    if (!dirTextBefore.includes('ON')) {
      await graph.toggleDirected();
      await graph.page.waitForTimeout(40);
    }

    await graph.addEdge(n1, n2, '');
    await graph.addEdge(n2, n3, '');
    await graph.page.waitForTimeout(120);

    // Guard: click BFS without start selected should alert
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Ensure placeholder selected
    await graph.startSelect.selectOption('');
    await graph.executeBFS();
    await graph.page.waitForTimeout(50);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0].message).toContain('Choose a start node');

    // Now select a valid start and evaluate BFS/DFS outputs (direct evaluation to avoid long animation waits)
    const bfsOrder = await graph.evalBFS(n1);
    const dfsOrder = await graph.evalDFS(n1);

    expect(Array.isArray(bfsOrder)).toBeTruthy();
    expect(Array.isArray(dfsOrder)).toBeTruthy();

    // For chain n1->n2->n3 BFS and DFS from n1 should both visit n1,n2,n3
    expect(bfsOrder).toEqual([n1, n2, n3]);
    expect(dfsOrder).toEqual([n1, n2, n3]);

    // Additionally, trigger the BFS UI button and verify some visual highlight occurs during animation
    // Select start in UI
    await graph.startSelect.selectOption(n1);
    // Press BFS button - it will animate; wait a small amount and expect at least one node to be highlighted
    await graph.executeBFS();

    // Wait briefly for animation to start and draw highlighted node(s)
    await graph.page.waitForTimeout(700);

    // At least one circle should have the highlight stroke (stroke-width 3) or highlighted fill
    const highlightedExists = await graph.page.evaluate(() => {
      // look for any circle element with stroke-width 3 or fill equal to the highlight color
      const circles = Array.from(document.querySelectorAll('#svg circle'));
      return circles.some(c => c.getAttribute('stroke-width') === '3' || c.getAttribute('fill') === '#1d4ed8');
    });
    expect(highlightedExists).toBeTruthy();

    // Allow the animation to complete to avoid interfering with subsequent tests
    await graph.page.waitForTimeout(800);
  });

  test('Edge Cases: attempt operations without required inputs produce alerts and do not crash', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // 1) Remove edge without endpoints (alert)
    await graph.fromSelect.selectOption('');
    await graph.toSelect.selectOption('');
    await graph.removeEdge('', '');
    await graph.page.waitForTimeout(60);
    expect(dialogs.some(d => d.message.includes('Choose both endpoints'))).toBeTruthy();

    // 2) Remove node without selection (alert)
    await graph.removeNode();
    await graph.page.waitForTimeout(60);
    expect(dialogs.some(d => d.message.includes('Choose a node to remove'))).toBeTruthy();

    // 3) Clear graph cancel scenario: trigger clear but then programmatically dismiss; here we accept,
    // but ensure dialog exists and graph clears (we already validated clear above)
    // To ensure no crashes, call toggle directed multiple times
    await graph.toggleDirected();
    await graph.toggleDirected();
    await graph.page.waitForTimeout(40);
    const t = await graph.getToggleText();
    expect(t).toMatch(/Directed: (ON|OFF)/);
  });
});